export const config = { runtime: "edge" };

import { kvGet, kvSet, grantSyndicateRole, json } from "./_lib.js";

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { email, discord_user_id, discord_username } = body;
  if (!email || !discord_user_id) {
    return json({ error: "email and discord_user_id are required" }, 400);
  }

  const normalEmail = email.toLowerCase().trim();
  const existing = (await kvGet(normalEmail)) ?? {};

  const updated = {
    ...existing,
    email: normalEmail,
    discord_user_id,
    discord_username: discord_username ?? existing.discord_username ?? null,
    registered_at: new Date().toISOString(),
  };
  await kvSet(normalEmail, updated);

  // Already paid but role not yet granted — grant immediately
  if (existing.paid && !existing.active) {
    const granted = await grantSyndicateRole(discord_user_id);
    if (granted) {
      await kvSet(normalEmail, {
        ...updated,
        active: true,
        granted_at: new Date().toISOString(),
      });
      return json({
        status: "registered",
        email: normalEmail,
        discord_user_id,
        role: "Syndicate granted — payment was already confirmed",
      });
    }
  }

  return json({
    status: "registered",
    email: normalEmail,
    discord_user_id,
    note: "Syndicate role will be granted automatically when your Stripe payment is confirmed.",
  });
}
