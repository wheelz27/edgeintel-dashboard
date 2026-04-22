/**
 * POST /api/unlock
 * Validates a daily access code.
 * Code format: EDGE{MMDD} — generated daily by pipeline (e.g. EDGE0421)
 * Also accepts codes from env var EXTRA_CODES (comma-separated) for manual overrides.
 */

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ valid: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const submitted = (body.code || "").trim().toUpperCase();
  if (!submitted) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Generate today's code (ET timezone)
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayCode = `EDGE${mm}${dd}`;

  // Also accept yesterday's code (for late-night users)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const mm2 = String(yesterday.getMonth() + 1).padStart(2, "0");
  const dd2 = String(yesterday.getDate()).padStart(2, "0");
  const yesterdayCode = `EDGE${mm2}${dd2}`;

  // Accept extra manual codes from env (comma-separated)
  const extraCodes = (process.env.EXTRA_CODES || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const valid =
    submitted === todayCode ||
    submitted === yesterdayCode ||
    extraCodes.includes(submitted);

  return new Response(JSON.stringify({ valid }), {
    headers: { "Content-Type": "application/json" },
  });
}
