export const config = { runtime: "edge" };

import {
  verifyStripeSignature,
  extractEmail,
  kvGet,
  kvSet,
  grantSyndicateRole,
  json,
} from "./_lib.js";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "invoice.paid",
]);

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json({ error: "STRIPE_WEBHOOK_SECRET not set" }, 500);

  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) return json({ error: "Missing stripe-signature header" }, 400);

  const payload = await req.text();

  if (!(await verifyStripeSignature(payload, sigHeader, secret))) {
    return json({ error: "Invalid signature" }, 400);
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { type: eventType, id: eventId = "unknown" } = event;

  if (!HANDLED_EVENTS.has(eventType)) {
    return json({ status: "ignored", type: eventType });
  }

  const email = extractEmail(event)?.toLowerCase().trim();
  if (!email) {
    return json({ status: "ignored", reason: "no customer email in event", eventId });
  }

  const subscriber = await kvGet(email);

  // ── No record yet — store pending, wait for /api/subscribe ───────────────
  if (!subscriber) {
    await kvSet(email, {
      email,
      discord_user_id: null,
      paid: true,
      active: false,
      paid_at: new Date().toISOString(),
      stripe_event_id: eventId,
    });
    return json({
      status: "pending",
      reason: `Payment recorded for ${email}. Direct them to POST /api/subscribe with their Discord user ID.`,
    });
  }

  // ── Record exists but no Discord ID yet ───────────────────────────────────
  if (!subscriber.discord_user_id) {
    await kvSet(email, {
      ...subscriber,
      paid: true,
      paid_at: new Date().toISOString(),
      stripe_event_id: eventId,
    });
    return json({
      status: "pending",
      reason: "Subscriber registered but no discord_user_id. Ask them to re-register at /api/subscribe.",
    });
  }

  // ── Grant Syndicate role ──────────────────────────────────────────────────
  const granted = await grantSyndicateRole(subscriber.discord_user_id);

  await kvSet(email, {
    ...subscriber,
    paid: true,
    active: granted,
    paid_at: new Date().toISOString(),
    stripe_event_id: eventId,
    ...(granted ? { granted_at: new Date().toISOString() } : {}),
  });

  if (granted) {
    return json({
      status: "ok",
      email,
      discord_user_id: subscriber.discord_user_id,
      role: "Syndicate granted",
    });
  }
  return json({ status: "error", reason: "Discord role grant failed" }, 500);
}
