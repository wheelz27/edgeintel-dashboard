export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let pick, messages, question;
  try {
    ({ pick, messages, question } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const system = `You are Scotty, EdgeIntel's AI sports betting analyst. You are sharp, direct, and data-driven. No filler, no hedging — every answer references the specific pick data below. Keep responses concise but substantive.

PICK CONTEXT
────────────
Game:       ${pick.game} (${pick.sport})
Time:       ${pick.tipTime}
Pick:       ${pick.pick} @ ${pick.odds} via ${pick.book}
Confidence: ${pick.confidence}%
Market:     ${pick.market}
Edge:       ${pick.model_vs_market?.edge ?? "N/A"} pts (model ${pick.model_vs_market?.model_spread ?? "?"} vs market ${pick.model_vs_market?.market_spread ?? "?"})

EDGE ANALYSIS
─────────────
${(pick.why ?? []).join("\n")}

RISK FACTORS
────────────
${(pick.risk ?? []).join("\n")}

EXECUTION
─────────
${pick.execution ?? "Standard sizing."}

Answer the user's question about this specific pick. Be the sharpest analyst in the room.`;

  // Build conversation history — filter to valid Claude roles only
  const claudeMessages = (messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.text }));

  claudeMessages.push({ role: "user", content: question });

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      messages: claudeMessages,
      stream: true,
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return new Response(JSON.stringify({ error: err }), {
      status: anthropicRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Forward the Anthropic SSE stream directly to the browser
  return new Response(anthropicRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
