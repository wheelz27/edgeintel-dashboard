/**
 * Shared helpers for EdgeIntel Edge functions.
 * Requires env vars:
 *   UPSTASH_REDIS_REST_URL    — from Upstash console
 *   UPSTASH_REDIS_REST_TOKEN  — from Upstash console
 *   DISCORD_BOT_TOKEN
 *   DISCORD_GUILD_ID
 *   DISCORD_SYNDICATE_ROLE_ID
 */

// ── Upstash Redis (REST API — no SDK, works in Edge runtime) ──────────────────

async function kvExec(...args) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return res.json();
}

export async function kvGet(email) {
  const { result } = await kvExec("GET", `sub:${email}`);
  return result ? JSON.parse(result) : null;
}

export async function kvSet(email, data) {
  await kvExec("SET", `sub:${email}`, JSON.stringify(data));
}

// ── Discord role grant ────────────────────────────────────────────────────────

export async function grantSyndicateRole(discordUserId) {
  const url = `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${process.env.DISCORD_SYNDICATE_ROLE_ID}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "X-Audit-Log-Reason": "EdgeIntel payment confirmed",
    },
  });
  return res.status === 200 || res.status === 204;
}

// ── Stripe signature verification (Web Crypto — no stripe npm pkg) ────────────

export async function verifyStripeSignature(payload, sigHeader, secret) {
  try {
    const parts = Object.fromEntries(
      sigHeader.split(",").map((p) => p.split("=", 2))
    );
    const { t: timestamp, v1 } = parts;
    if (!timestamp || !v1) return false;

    const signed = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signed)
    );
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (expected.length !== v1.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function extractEmail(event) {
  const obj = event?.data?.object ?? {};
  return (
    obj.customer_email ||
    obj.customer_details?.email ||
    obj.email ||
    null
  );
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
