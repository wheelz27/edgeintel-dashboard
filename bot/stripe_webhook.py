"""
EdgeIntel — Webhook Handler
============================
FastAPI app that:
  - POST /webhook/stripe   — receives Stripe events, verifies signature, grants Syndicate role
  - POST /webhook/paypal   — receives PayPal IPN events, verifies with PayPal, grants role
  - POST /subscribe        — registers email + Discord info after paying
  - GET  /health           — liveness check

Run:
  uvicorn bot.stripe_webhook:app --host 0.0.0.0 --port 8000

Or from the bot/ directory:
  uvicorn stripe_webhook:app --host 0.0.0.0 --port 8000

Required env vars (add to .env):
  STRIPE_WEBHOOK_SECRET      — from Stripe Dashboard → Webhooks → signing secret
  DISCORD_BOT_TOKEN          — bot token (already in .env)
  DISCORD_GUILD_ID           — right-click your server → Copy Server ID
  DISCORD_SYNDICATE_ROLE_ID  — right-click Syndicate role → Copy Role ID

PayPal IPN setup:
  1. Log into PayPal Business → Account Settings → Notifications → Instant Payment Notifications
  2. Set notification URL to: https://your-domain.com/webhook/paypal
  3. Enable IPN
  No extra env vars needed — PayPal IPN uses a verification handshake, not a secret key.
"""

import hashlib
import hmac
import json
import os
import datetime
import urllib.parse
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Config ────────────────────────────────────────────────────────────────────
STRIPE_WEBHOOK_SECRET     = os.getenv("STRIPE_WEBHOOK_SECRET", "")
DISCORD_BOT_TOKEN         = os.getenv("DISCORD_BOT_TOKEN", "")
DISCORD_GUILD_ID          = os.getenv("DISCORD_GUILD_ID", "")
DISCORD_SYNDICATE_ROLE_ID = os.getenv("DISCORD_SYNDICATE_ROLE_ID", "")

SUBSCRIBERS_PATH = Path(__file__).parent / "subscribers.json"

app = FastAPI(title="EdgeIntel Stripe Webhook", version="1.0.0")


# ── Subscribers store ─────────────────────────────────────────────────────────

def load_subscribers() -> dict:
    if SUBSCRIBERS_PATH.exists():
        with open(SUBSCRIBERS_PATH) as f:
            return json.load(f)
    return {}


def save_subscribers(data: dict) -> None:
    with open(SUBSCRIBERS_PATH, "w") as f:
        json.dump(data, f, indent=2)


# ── Stripe signature verification ─────────────────────────────────────────────

def verify_stripe_signature(payload: bytes, sig_header: str, secret: str) -> bool:
    """
    Stripe signs every webhook with HMAC-SHA256.
    Header format: t=<timestamp>,v1=<hex_digest>
    Signed payload: "<timestamp>.<raw_body>"
    """
    try:
        parts = dict(part.split("=", 1) for part in sig_header.split(","))
        timestamp = parts.get("t", "")
        v1        = parts.get("v1", "")
        if not timestamp or not v1:
            return False
        signed = f"{timestamp}.{payload.decode('utf-8')}"
        expected = hmac.new(
            secret.encode("utf-8"),
            signed.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, v1)
    except Exception:
        return False


# ── Discord role grant ────────────────────────────────────────────────────────

async def grant_syndicate_role(discord_user_id: str) -> tuple[bool, str]:
    """
    Grant the Syndicate role via Discord REST API (no bot process required).
    Returns (success, message).
    """
    if not all([DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_SYNDICATE_ROLE_ID]):
        return False, "Discord env vars not configured (DISCORD_GUILD_ID, DISCORD_SYNDICATE_ROLE_ID)"

    url = (
        f"https://discord.com/api/v10/guilds/{DISCORD_GUILD_ID}"
        f"/members/{discord_user_id}/roles/{DISCORD_SYNDICATE_ROLE_ID}"
    )
    headers = {
        "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
        "X-Audit-Log-Reason": "EdgeIntel Stripe payment confirmed",
    }
    async with httpx.AsyncClient() as client:
        res = await client.put(url, headers=headers, timeout=10)

    if res.status_code in (200, 204):
        return True, "role granted"
    return False, f"Discord API returned {res.status_code}: {res.text}"


# ── Extract customer email from Stripe event ──────────────────────────────────

def extract_email(event: dict) -> str | None:
    obj = event.get("data", {}).get("object", {})
    return (
        obj.get("customer_email")
        or obj.get("customer_details", {}).get("email")
        or obj.get("email")
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/webhook/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(None, alias="stripe-signature"),
):
    """
    Receives Stripe webhook events.
    Handles:
      - checkout.session.completed
      - invoice.paid
    Both trigger a Syndicate role grant for the paying customer.
    """
    payload = await request.body()

    # ── Verify signature ──────────────────────────────────────────────────────
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET not set")

    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    if not verify_stripe_signature(payload, stripe_signature, STRIPE_WEBHOOK_SECRET):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # ── Parse event ───────────────────────────────────────────────────────────
    try:
        event = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_type = event.get("type", "")
    event_id   = event.get("id", "unknown")

    if event_type not in ("checkout.session.completed", "invoice.paid"):
        return JSONResponse({"status": "ignored", "type": event_type})

    # ── Find customer email ───────────────────────────────────────────────────
    email = extract_email(event)
    if not email:
        return JSONResponse({"status": "ignored", "reason": "no customer email in event", "event_id": event_id})

    email = email.lower()

    # ── Look up subscriber record ─────────────────────────────────────────────
    subscribers = load_subscribers()
    subscriber  = subscribers.get(email)

    if not subscriber:
        # Store a pending record so we can grant when they register
        subscribers[email] = {
            "email": email,
            "discord_username": None,
            "discord_user_id": None,
            "active": False,
            "paid": True,
            "paid_at": datetime.datetime.utcnow().isoformat(),
            "stripe_event_id": event_id,
        }
        save_subscribers(subscribers)
        return JSONResponse({
            "status": "pending",
            "reason": (
                f"Payment recorded for {email} but no Discord registration yet. "
                "Direct them to POST /subscribe with their Discord user ID."
            ),
        })

    discord_user_id = subscriber.get("discord_user_id")
    if not discord_user_id:
        # Payment confirmed but no user ID — mark paid, wait for registration
        subscribers[email]["paid"] = True
        subscribers[email]["paid_at"] = datetime.datetime.utcnow().isoformat()
        subscribers[email]["stripe_event_id"] = event_id
        save_subscribers(subscribers)
        return JSONResponse({
            "status": "pending",
            "reason": "Subscriber registered but no discord_user_id. Ask them to re-register at /subscribe.",
        })

    # ── Grant role ────────────────────────────────────────────────────────────
    success, msg = await grant_syndicate_role(discord_user_id)

    subscribers[email]["paid"]           = True
    subscribers[email]["active"]         = success
    subscribers[email]["paid_at"]        = datetime.datetime.utcnow().isoformat()
    subscribers[email]["stripe_event_id"] = event_id
    if success:
        subscribers[email]["granted_at"] = datetime.datetime.utcnow().isoformat()
    save_subscribers(subscribers)

    if success:
        return JSONResponse({
            "status": "ok",
            "email": email,
            "discord_user_id": discord_user_id,
            "role": "Syndicate granted",
        })
    else:
        return JSONResponse({"status": "error", "reason": msg}, status_code=500)


class SubscribeRequest(BaseModel):
    email: str
    discord_username: str
    discord_user_id: str  # Settings → copy User ID (enable Developer Mode first)


@app.post("/subscribe")
async def subscribe(body: SubscribeRequest):
    """
    Registers a subscriber's email + Discord account.

    Call this after payment — Stripe needs to match the email to a Discord user ID
    to grant the Syndicate role automatically.

    discord_user_id: found in Discord under Settings → Advanced → Developer Mode,
                     then right-click your username → Copy User ID.
    """
    subscribers = load_subscribers()
    email = body.email.lower()
    existing = subscribers.get(email, {})

    subscribers[email] = {
        **existing,  # preserve paid/active/stripe fields if already set
        "email":            email,
        "discord_username": body.discord_username,
        "discord_user_id":  body.discord_user_id,
        "registered_at":    datetime.datetime.utcnow().isoformat(),
    }
    save_subscribers(subscribers)

    # If they've already paid (webhook fired before they registered), grant now
    already_paid = existing.get("paid", False)
    grant_result = None
    if already_paid and not existing.get("active"):
        success, msg = await grant_syndicate_role(body.discord_user_id)
        if success:
            subscribers[email]["active"]     = True
            subscribers[email]["granted_at"] = datetime.datetime.utcnow().isoformat()
            save_subscribers(subscribers)
        grant_result = "role granted immediately (payment was already confirmed)" if success else msg

    return JSONResponse({
        "status": "registered",
        "email": email,
        "discord_username": body.discord_username,
        "discord_user_id": body.discord_user_id,
        **({"role": grant_result} if grant_result else {
            "note": "Syndicate role will be granted automatically when your Stripe payment is confirmed."
        }),
    })


@app.post("/webhook/paypal")
async def paypal_webhook(request: Request):
    """
    Receives PayPal IPN (Instant Payment Notification) events.

    PayPal IPN flow:
      1. PayPal POSTs form-encoded payment data to this URL
      2. We POST it back to PayPal prefixed with cmd=_notify-validate
      3. PayPal replies "VERIFIED" or "INVALID"
      4. If VERIFIED and payment_status == "Completed", grant Syndicate role

    The payer's email must already exist in subscribers.json (via /subscribe),
    OR we store a pending record and grant when they register.
    """
    raw_body = await request.body()

    # ── Step 1: Verify with PayPal ────────────────────────────────────────────
    verify_payload = b"cmd=_notify-validate&" + raw_body
    paypal_ipn_url = "https://ipnpb.paypal.com/cgi-bin/webscr"  # production

    async with httpx.AsyncClient() as client:
        verify_res = await client.post(
            paypal_ipn_url,
            content=verify_payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )

    if verify_res.text != "VERIFIED":
        # Log invalid IPN attempts but don't 500 — PayPal expects 200 always
        return JSONResponse({"status": "invalid", "reason": "IPN verification failed"})

    # ── Step 2: Parse form data ───────────────────────────────────────────────
    params = dict(urllib.parse.parse_qsl(raw_body.decode("utf-8")))

    payment_status = params.get("payment_status", "")
    txn_type       = params.get("txn_type", "")

    # Only process completed payments (not refunds, reversals, etc.)
    if payment_status != "Completed":
        return JSONResponse({"status": "ignored", "payment_status": payment_status})

    # Accept standard payments and subscriptions
    valid_txn_types = {"web_accept", "subscr_payment", ""}
    if txn_type and txn_type not in valid_txn_types:
        return JSONResponse({"status": "ignored", "txn_type": txn_type})

    # ── Step 3: Extract payer email ───────────────────────────────────────────
    email = (params.get("payer_email") or params.get("receiver_email") or "").lower().strip()
    txn_id = params.get("txn_id", "unknown")
    amount = params.get("mc_gross", "?")
    currency = params.get("mc_currency", "USD")

    if not email:
        return JSONResponse({"status": "ignored", "reason": "no payer_email in IPN"})

    # ── Step 4: Look up or create subscriber record ───────────────────────────
    subscribers = load_subscribers()
    subscriber  = subscribers.get(email)

    if not subscriber:
        subscribers[email] = {
            "email": email,
            "discord_username": None,
            "discord_user_id": None,
            "active": False,
            "paid": True,
            "paid_at": datetime.datetime.utcnow().isoformat(),
            "paypal_txn_id": txn_id,
            "amount": f"{amount} {currency}",
        }
        save_subscribers(subscribers)
        return JSONResponse({
            "status": "pending",
            "reason": (
                f"PayPal payment verified for {email} (txn {txn_id}) but no Discord "
                "registration yet. Direct them to POST /subscribe with their Discord user ID."
            ),
        })

    discord_user_id = subscriber.get("discord_user_id")
    if not discord_user_id:
        subscribers[email]["paid"] = True
        subscribers[email]["paid_at"] = datetime.datetime.utcnow().isoformat()
        subscribers[email]["paypal_txn_id"] = txn_id
        subscribers[email]["amount"] = f"{amount} {currency}"
        save_subscribers(subscribers)
        return JSONResponse({
            "status": "pending",
            "reason": "Payment recorded but no discord_user_id. Ask them to re-register at /subscribe.",
        })

    # ── Step 5: Grant Syndicate role ──────────────────────────────────────────
    success, msg = await grant_syndicate_role(discord_user_id)

    subscribers[email]["paid"]         = True
    subscribers[email]["active"]       = success
    subscribers[email]["paid_at"]      = datetime.datetime.utcnow().isoformat()
    subscribers[email]["paypal_txn_id"] = txn_id
    subscribers[email]["amount"]       = f"{amount} {currency}"
    if success:
        subscribers[email]["granted_at"] = datetime.datetime.utcnow().isoformat()
    save_subscribers(subscribers)

    if success:
        return JSONResponse({
            "status": "ok",
            "email": email,
            "discord_user_id": discord_user_id,
            "role": "Syndicate granted",
            "txn_id": txn_id,
        })
    return JSONResponse({"status": "error", "reason": msg}, status_code=500)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "subscribers": len(load_subscribers()),
        "discord_configured": bool(DISCORD_BOT_TOKEN and DISCORD_GUILD_ID and DISCORD_SYNDICATE_ROLE_ID),
        "stripe_configured": bool(STRIPE_WEBHOOK_SECRET),
    }
