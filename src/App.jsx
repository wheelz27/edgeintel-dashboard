import { useState, useEffect, useRef, useCallback } from "react";

/* ================================================================
   EDGEINTEL DASHBOARD v3
   - Reads picks from /data/slate.json (no more editing code)
   - Reads results from /data/results.json
   - Daily code from slate.json
   - Full paywall + Scotty AI + game analytics
   - Just update JSON files → push → Vercel deploys
   ================================================================ */

const REFRESH_INTERVAL = 60000;
const DISCORD_INVITE = "https://discord.gg/edgeintel"; // UPDATE THIS
const PAYPAL_LINK = "https://paypal.me/Wheelz27";
const PRODUCT_PRICE = "$29/mo";

const T = {
  bg: "#060a10", surface: "#0c1219", surfaceHover: "#111a25", elevated: "#141e2b",
  border: "rgba(255,255,255,0.06)", borderHover: "rgba(100,160,255,0.22)",
  text: "#d0d5e0", textMuted: "#5a6378",
  accent: "#4d8eff", accentGlow: "rgba(77,142,255,0.12)",
  teal: "#00e5c3", tealGlow: "rgba(0,229,195,0.10)",
  green: "#22c55e", red: "#ef4444", gold: "#f5a623", discord: "#5865F2",
};

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [dailyCode, setDailyCode] = useState("");
  const [activeTab, setActiveTab] = useState("picks");
  const [selectedGame, setSelectedGame] = useState(null);
  const [dossierTab, setDossierTab] = useState("analysis");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [scottyLoading, setScottyLoading] = useState(false);
  const [sportFilter, setSportFilter] = useState("ALL");
  const [games, setGames] = useState([]);
  const [results, setResults] = useState({ record: { wins: 0, losses: 0, pushes: 0, units: 0, roi: 0 }, results: [] });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const chatEndRef = useRef(null);

  // ── LOAD DATA FROM JSON ───────────────────────────────────────
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [slateRes, resultsRes] = await Promise.all([
        fetch("/data/slate.json?" + Date.now()),
        fetch("/data/results.json?" + Date.now()),
      ]);
      if (slateRes.ok) {
        const slate = await slateRes.json();
        setGames(slate.games || []);
        setDailyCode(slate.daily_code || "");
      }
      if (resultsRes.ok) {
        const res = await resultsRes.json();
        setResults(res);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setLastRefresh(new Date());
    setLoading(false);
    setTimeout(() => setIsRefreshing(false), 600);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const t = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [fetchData]);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const tryCode = () => {
    if (codeInput.trim().toUpperCase() === dailyCode.toUpperCase()) {
      setUnlocked(true); setCodeError(false); setActiveTab("picks");
    } else { setCodeError(true); setTimeout(() => setCodeError(false), 2500); }
  };

  // ── SCOTTY AI ─────────────────────────────────────────────────
  const askScotty = async (game, question) => {
    setScottyLoading(true);
    setChatMessages(prev => [...prev, { role: "user", text: question }]);
    const bet = game.bestBet || {};
    const sys = `You are Scotty, the AI betting analyst for EdgeIntel. Sharp, direct, operator-minded. No fluff. Think probability × price × timing.

Game: ${game.matchup} (${game.sport})
Best Bet: ${bet.pick} at ${bet.odds} (${bet.book || "best available"})
Confidence: ${bet.confidence}%
Market: spread ${game.market?.spread}, total ${game.market?.total}
Model: proj spread ${game.model?.proj_spread}, proj total ${game.model?.proj_total}, edge spread ${game.model?.edge_spread}, edge total ${game.model?.edge_total}
Why: ${(bet.why || []).join("; ")}
Risk: ${(bet.risk || []).join("; ")}
Execution: ${bet.execution || "Standard sizing"}
Best Prop: ${game.bestProp?.pick || "None"}
Best Parlay: ${(game.bestParlay?.legs || []).join(" + ")} — ${game.bestParlay?.correlation || ""}

Rules: Max 150 words. Use bullets. Say "the model projects" not "I think". End every answer with ACTION: (bet/pass/wait/hedge).`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys,
          messages: [...chatMessages.map(m => ({ role: m.role, content: m.text })), { role: "user", content: question }],
        }),
      });
      const data = await res.json();
      const reply = data.content?.filter(i => i.type === "text").map(i => i.text).join("\n") || "Signal lost. Try again.";
      setChatMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      const fb = `⚡ ${game.matchup}\nBest Bet: ${bet.pick} (${bet.odds}) — ${bet.confidence}% conf\n\nEdge:\n${(bet.why||[]).map(w=>"• "+w).join("\n")}\n\nRisk:\n${(bet.risk||[]).map(r=>"• "+r).join("\n")}\n\nExecution: ${bet.execution||"Standard"}\n\nACTION: Review and size accordingly.`;
      setChatMessages(prev => [...prev, { role: "assistant", text: fb }]);
    }
    setScottyLoading(false);
  };

  const quickAsk = (type) => {
    if (!selectedGame) return;
    const bet = selectedGame.bestBet || {};
    const qs = {
      edge: "Break down the core edge. What's the single biggest driver?",
      risk: "What kills this bet? Top threats and how to defend.",
      sizing: "Exact sizing, timing window, and price where we hard pass.",
      live: `Market is ${selectedGame.market?.spread} spread, ${selectedGame.market?.total} total. Model says ${selectedGame.model?.proj_spread} / ${selectedGame.model?.proj_total}. Still a play?`,
      hedge: "Already in this — what's my hedge or exit strategy?",
      prop: `Break down the prop: ${selectedGame.bestProp?.pick}. Worth it?`,
      parlay: `Parlay angle: ${(selectedGame.bestParlay?.legs||[]).join(" + ")}. Correlation legit?`,
    };
    askScotty(selectedGame, qs[type]);
  };

  // ── DERIVED ───────────────────────────────────────────────────
  const filteredGames = sportFilter === "ALL" ? games : games.filter(g => g.sport === sportFilter);
  const sports = ["ALL", ...new Set(games.map(g => g.sport))];
  const topGames = [...games].sort((a, b) => (b.bestBet?.confidence || 0) - (a.bestBet?.confidence || 0)).slice(0, 3);
  const rec = results.record || {};
  const allResults = results.results || [];
  const now = new Date();
  const stamp = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " • " + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const ago = Math.round((now - lastRefresh) / 1000);

  const openGame = (g) => { setSelectedGame(g); setChatMessages([]); setDossierTab("analysis"); };

  if (loading) return <div style={{ minHeight: "100vh", background: T.bg, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 900, background: "linear-gradient(135deg,#4d8eff,#00e5c3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 10 }}>EDGEINTEL</div><div style={{ color: T.textMuted }}>Loading intelligence...</div></div></div>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'SF Pro Display',-apple-system,'Segoe UI',sans-serif", fontSize: 13, lineHeight: 1.55 }}>

      {/* HEADER */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.5px", background: "linear-gradient(135deg,#4d8eff,#00e5c3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>EDGEINTEL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: isRefreshing ? "rgba(34,197,94,0.15)" : T.accentGlow, border: `1px solid ${isRefreshing ? "rgba(34,197,94,0.3)" : "rgba(77,142,255,0.2)"}`, color: isRefreshing ? T.green : T.accent, transition: "all 0.3s" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isRefreshing ? T.green : T.accent, animation: "pulse 2s infinite", display: "inline-block" }} /> {isRefreshing ? "UPDATING" : "LIVE"}
          </div>
          {games.length > 0 && <span style={{ fontSize: 10, color: T.textMuted }}>{games.length} games on slate</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 10, color: T.textMuted }}>{stamp} • {ago < 5 ? "just now" : `${ago}s ago`}</span>
          <button onClick={fetchData} style={{ padding: "4px 12px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer" }}>↻</button>
          {unlocked ? (
            <div style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: T.tealGlow, border: "1px solid rgba(0,229,195,0.3)", color: T.teal }}>✓ SYNDICATE</div>
          ) : (
            <div style={{ padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", color: T.gold }}>FREE TIER</div>
          )}
        </div>
      </div>

      {/* RECORD BAR */}
      <div style={{ display: "flex", gap: 16, padding: "8px 20px", background: T.surface, borderBottom: `1px solid ${T.border}`, fontSize: 11 }}>
        <span><strong style={{ color: T.teal }}>{rec.wins || 0}W-{rec.losses || 0}L</strong> <span style={{ color: T.textMuted }}>record</span></span>
        <span><strong style={{ color: parseFloat(rec.units) > 0 ? T.green : T.red }}>+{rec.units || 0}u</strong> <span style={{ color: T.textMuted }}>profit</span></span>
        <span><strong style={{ color: T.teal }}>{rec.roi || 0}%</strong> <span style={{ color: T.textMuted }}>ROI</span></span>
      </div>

      {/* NAV */}
      <div style={{ display: "flex", padding: "0 20px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        {[{ key: "picks", label: "📡 Today's Slate" }, { key: "results", label: "📊 Track Record" }, { key: "unlock", label: unlocked ? "🔓 Active" : "🔒 Unlock" }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: "11px 18px", fontSize: 11.5, fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", color: activeTab === tab.key ? T.accent : T.textMuted, borderBottom: activeTab === tab.key ? `2px solid ${T.accent}` : "2px solid transparent" }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ padding: "20px 20px 100px", maxWidth: 1440, margin: "0 auto" }}>

        {/* ═══ UNLOCK TAB ═══ */}
        {activeTab === "unlock" && (
          <div style={{ maxWidth: 500, margin: "32px auto", textAlign: "center" }}>
            {unlocked ? (
              <div style={{ padding: 28, borderRadius: 16, border: "1px solid rgba(0,229,195,0.2)", background: T.tealGlow }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.teal, marginBottom: 6 }}>Full Access Active</div>
                <div style={{ color: T.textMuted, fontSize: 12 }}>All picks, dossiers, analytics & Scotty AI unlocked.</div>
              </div>
            ) : (
              <>
                <div style={{ padding: 28, borderRadius: 16, border: `1px solid ${T.border}`, background: T.surface, marginBottom: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔐</div>
                  <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Enter Today's Code</div>
                  <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 20 }}>Get your daily code from the Syndicate Discord.</div>
                  <div style={{ display: "flex", gap: 8, maxWidth: 320, margin: "0 auto" }}>
                    <input value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => e.key === "Enter" && tryCode()} placeholder="ACCESS CODE" style={{ flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 14, background: T.bg, border: `1px solid ${codeError ? T.red : T.border}`, color: T.text, outline: "none", fontWeight: 800, letterSpacing: "3px", textAlign: "center", textTransform: "uppercase" }} />
                    <button onClick={tryCode} style={{ padding: "10px 20px", borderRadius: 10, fontSize: 12, fontWeight: 800, background: T.accent, border: "none", color: "#fff", cursor: "pointer" }}>GO</button>
                  </div>
                  {codeError && <div style={{ color: T.red, fontSize: 11, marginTop: 8, fontWeight: 700 }}>Invalid code. Check #daily-code in Discord.</div>}
                </div>
                <div style={{ padding: 22, borderRadius: 16, background: "linear-gradient(135deg,rgba(88,101,242,0.08),rgba(0,229,195,0.04))", border: `1px solid ${T.border}`, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>No code yet?</div>
                  <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>Join EdgeIntel Discord → subscribe ({PRODUCT_PRICE}) → get daily codes + full analytics + Scotty AI.</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, fontSize: 12, fontWeight: 800, background: T.discord, color: "#fff", textDecoration: "none" }}>JOIN DISCORD</a>
                    <a href={PAYPAL_LINK} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, fontSize: 12, fontWeight: 800, background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, textDecoration: "none" }}>PAY VIA PAYPAL</a>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ RESULTS TAB ═══ */}
        {activeTab === "results" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Win Rate", value: rec.wins && rec.losses ? `${((rec.wins / (rec.wins + rec.losses)) * 100).toFixed(1)}%` : "—", color: T.teal },
                { label: "Record", value: `${rec.wins || 0}W-${rec.losses || 0}L`, color: T.text },
                { label: "Profit", value: `+${rec.units || 0}u`, color: parseFloat(rec.units) > 0 ? T.green : T.red },
                { label: "ROI", value: `${rec.roi || 0}%`, color: T.teal },
              ].map((s, i) => (
                <div key={i} style={{ padding: "14px 12px", borderRadius: 12, textAlign: "center", background: T.surface, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}`, background: T.surface, overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "50px 1fr 40px 55px" : "65px 1fr 1fr 55px 55px 70px", padding: "8px 12px", fontSize: 9.5, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${T.border}`, minWidth: isMobile ? "auto" : "auto" }}>
                <div>Date</div>{!isMobile && <div>Game</div>}<div>Pick</div><div>Result</div>{!isMobile && <div>CLV</div>}<div>P&L</div>
              </div>
              {allResults.map((r, i) => {
                const locked = !unlocked && i > 3;
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: isMobile ? "50px 1fr 40px 55px" : "65px 1fr 1fr 55px 55px 70px", padding: "9px 12px", fontSize: isMobile ? 11 : 12, borderBottom: i < allResults.length - 1 ? `1px solid ${T.border}` : "none", filter: locked ? "blur(5px)" : "none", userSelect: locked ? "none" : "auto" }}>
                    <div style={{ color: T.textMuted }}>{r.date}</div>
                    {!isMobile && <div style={{ fontWeight: 700 }}>{r.game}</div>}
                    <div style={{ color: T.teal, fontWeight: 700 }}>{r.pick}</div>
                    <div style={{ fontWeight: 900, color: r.result === "W" ? T.green : T.red }}>{r.result}</div>
                    {!isMobile && <div style={{ color: T.teal, fontWeight: 700 }}>{r.clv || "—"}</div>}
                    <div style={{ fontWeight: 800, color: parseFloat(r.profit) > 0 ? T.green : T.red }}>{parseFloat(r.profit) > 0 ? "+" : ""}{r.profit}u</div>
                  </div>
                );
              })}
            </div>
            {!unlocked && allResults.length > 4 && (
              <div style={{ textAlign: "center", padding: 18 }}>
                <button onClick={() => setActiveTab("unlock")} style={{ padding: "8px 22px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: T.discord, border: "none", color: "#fff", cursor: "pointer" }}>🔒 UNLOCK FULL HISTORY</button>
              </div>
            )}
          </div>
        )}

        {/* ═══ PICKS TAB ═══ */}
        {activeTab === "picks" && (
          <>
            {/* MOBILE: show analytics full-screen when game selected */}
            {isMobile && selectedGame && unlocked ? (
              <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                {/* Back button */}
                <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setSelectedGame(null)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: T.accentGlow, border: `1px solid rgba(77,142,255,0.2)`, color: T.accent, cursor: "pointer" }}>← Back to Slate</button>
                </div>
                {/* Header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: "linear-gradient(135deg,rgba(77,142,255,0.05),transparent)" }}>
                  <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginBottom: 3 }}>🧠 GAME INTELLIGENCE</div>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>{selectedGame.icon} {selectedGame.matchup}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 9.5, fontWeight: 800, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.2)", color: T.accent }}>{selectedGame.sport}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{selectedGame.time}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, fontSize: 11 }}>
                      <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, marginBottom: 4 }}>MARKET</div>
                      <div>Spread: <strong>{selectedGame.market?.spread}</strong></div>
                      <div>Total: <strong>{selectedGame.market?.total}</strong></div>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,229,195,0.03)", border: "1px solid rgba(0,229,195,0.1)", fontSize: 11 }}>
                      <div style={{ fontSize: 9, color: T.teal, fontWeight: 700, marginBottom: 4 }}>MODEL</div>
                      <div>Spread: <strong style={{ color: T.teal }}>{selectedGame.model?.proj_spread}</strong></div>
                      <div>Total: <strong style={{ color: T.teal }}>{selectedGame.model?.proj_total}</strong></div>
                    </div>
                  </div>
                </div>
                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
                  {[{ key: "analysis", label: "Analysis" }, { key: "scotty", label: "Ask Scotty 🤖" }].map(t => (
                    <button key={t.key} onClick={() => setDossierTab(t.key)} style={{ flex: 1, padding: "9px", fontSize: 11, fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", color: dossierTab === t.key ? T.accent : T.textMuted, borderBottom: dossierTab === t.key ? `2px solid ${T.accent}` : "2px solid transparent" }}>{t.label}</button>
                  ))}
                </div>
                {/* Analysis */}
                <div style={{ padding: "14px 16px" }}>
                  {dossierTab === "analysis" && (
                    <div>
                      {selectedGame.bestBet && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: T.teal, marginBottom: 6 }}>🎯 BEST BET</div>
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,229,195,0.04)", border: "1px solid rgba(0,229,195,0.12)", marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 900, color: T.teal }}>{selectedGame.bestBet.pick} <span style={{ color: T.text, fontWeight: 700, fontSize: 12 }}>{selectedGame.bestBet.odds}</span></div>
                            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{selectedGame.bestBet.book} • {selectedGame.bestBet.confidence}% conf • {selectedGame.bestBet.units}u</div>
                          </div>
                          <Section title="WHY" icon="✅" color={T.teal} items={selectedGame.bestBet.why || []} />
                          <Section title="RISK" icon="⚠️" color={T.red} items={selectedGame.bestBet.risk || []} />
                          {selectedGame.bestBet.execution && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: T.gold, marginBottom: 5 }}>⚡ EXECUTION</div>
                              <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(245,166,35,0.04)", border: "1px solid rgba(245,166,35,0.12)", fontSize: 12, lineHeight: 1.6 }}>{selectedGame.bestBet.execution}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedGame.bestProp && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: T.accent, marginBottom: 6 }}>📌 BEST PROP</div>
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.12)" }}>
                            <div style={{ fontSize: 13, fontWeight: 800 }}>{selectedGame.bestProp.pick} <span style={{ color: T.textMuted, fontSize: 11 }}>{selectedGame.bestProp.odds} • {selectedGame.bestProp.confidence}%</span></div>
                            {selectedGame.bestProp.why && selectedGame.bestProp.why.map((w, i) => (
                              <div key={i} style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>• {w}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedGame.bestParlay && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: T.gold, marginBottom: 6 }}>🧩 BEST PARLAY</div>
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(245,166,35,0.04)", border: "1px solid rgba(245,166,35,0.12)" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{(selectedGame.bestParlay.legs || []).join(" + ")} <span style={{ color: T.gold }}>{selectedGame.bestParlay.odds}</span></div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>Correlation: {selectedGame.bestParlay.correlation}</div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>Confidence: {selectedGame.bestParlay.confidence}%</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {dossierTab === "scotty" && (
                    <div>
                      <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                        {[{ key: "edge", label: "Core edge" }, { key: "risk", label: "Kill factors" }, { key: "sizing", label: "Size + timing" }, { key: "prop", label: "Prop" }, { key: "parlay", label: "Parlay" }].map(q => (
                          <button key={q.key} onClick={() => quickAsk(q.key)} disabled={scottyLoading} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.18)", color: T.accent, cursor: scottyLoading ? "wait" : "pointer", opacity: scottyLoading ? 0.5 : 1 }}>{q.label}</button>
                        ))}
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        {chatMessages.length === 0 && <div style={{ textAlign: "center", padding: "20px 16px", color: T.textMuted, fontSize: 12 }}><div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>Ask Scotty anything about this game.</div>}
                        {chatMessages.map((msg, i) => (
                          <div key={i} style={{ marginBottom: 8, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                            <div style={{ maxWidth: "88%", padding: "9px 13px", borderRadius: 11, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", background: msg.role === "user" ? T.accentGlow : "rgba(255,255,255,0.025)", border: `1px solid ${msg.role === "user" ? "rgba(77,142,255,0.18)" : T.border}` }}>{msg.text}</div>
                          </div>
                        ))}
                        {scottyLoading && <div style={{ padding: "10px 16px", borderRadius: 11, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.border}`, fontSize: 12, color: T.textMuted, display: "inline-block" }}>Scotty analyzing...</div>}
                        <div ref={chatEndRef} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !scottyLoading && chatInput.trim()) { askScotty(selectedGame, chatInput); setChatInput(""); }}} placeholder="Ask Scotty..." disabled={scottyLoading} style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontSize: 12, background: T.bg, border: `1px solid ${T.border}`, color: T.text, outline: "none" }} />
                        <button onClick={() => { if (chatInput.trim()) { askScotty(selectedGame, chatInput); setChatInput(""); }}} disabled={scottyLoading || !chatInput.trim()} style={{ padding: "9px 16px", borderRadius: 9, fontSize: 11, fontWeight: 800, background: T.accent, border: "none", color: "#fff", cursor: "pointer", opacity: scottyLoading || !chatInput.trim() ? 0.4 : 1 }}>SEND</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
            /* DESKTOP + GAME LIST */
            <div style={{ display: "grid", gridTemplateColumns: selectedGame && unlocked && !isMobile ? "1fr 1fr" : "1fr", gap: 20 }}>
            <div>
              {/* Top 3 */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  🔥 TOP PLAYS
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", color: T.gold, fontWeight: 800 }}>HIGHEST CONFIDENCE</span>
                </div>
                {topGames.map((g, i) => (
                  <GameRow key={`t-${g.id}`} game={g} rank={i + 1} isSelected={selectedGame?.id === g.id} locked={!unlocked} onOpen={() => unlocked ? openGame(g) : setActiveTab("unlock")} />
                ))}
              </div>

              {/* Full slate */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>📋 FULL SLATE — {games.length} games</div>
                <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                  {sports.map(s => (
                    <button key={s} onClick={() => setSportFilter(s)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: sportFilter === s ? T.accentGlow : "transparent", border: `1px solid ${sportFilter === s ? "rgba(77,142,255,0.25)" : T.border}`, color: sportFilter === s ? T.accent : T.textMuted, cursor: "pointer" }}>{s}</button>
                  ))}
                </div>
                {filteredGames.map(g => (
                  <GameRow key={`s-${g.id}`} game={g} isSelected={selectedGame?.id === g.id} locked={!unlocked} onOpen={() => unlocked ? openGame(g) : setActiveTab("unlock")} />
                ))}
              </div>
            </div>

            {/* ── ANALYTICS PANEL ── */}
            {selectedGame && unlocked ? (
              <div style={{ borderRadius: isMobile ? 0 : 14, border: isMobile ? "none" : `1px solid ${T.border}`, background: T.surface, overflow: "hidden", position: isMobile ? "fixed" : "sticky", top: isMobile ? 0 : 16, left: isMobile ? 0 : "auto", right: isMobile ? 0 : "auto", bottom: isMobile ? 0 : "auto", maxHeight: isMobile ? "100vh" : "calc(100vh - 160px)", height: isMobile ? "100vh" : "auto", display: "flex", flexDirection: "column", zIndex: isMobile ? 999 : "auto" }}>
                {/* Header */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: "linear-gradient(135deg,rgba(77,142,255,0.05),transparent)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginBottom: 3 }}>🧠 GAME INTELLIGENCE</div>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>{selectedGame.icon} {selectedGame.matchup}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 9.5, fontWeight: 800, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.2)", color: T.accent }}>{selectedGame.sport}</span>
                        <span style={{ fontSize: 11, color: T.textMuted }}>{selectedGame.time}</span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedGame(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 7, padding: "3px 9px", fontSize: 11, cursor: "pointer", height: "fit-content" }}>✕</button>
                  </div>
                  {/* Market + Model */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, fontSize: 11 }}>
                      <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, marginBottom: 4 }}>MARKET</div>
                      <div>Spread: <strong>{selectedGame.market?.spread}</strong></div>
                      <div>Total: <strong>{selectedGame.market?.total}</strong></div>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,229,195,0.03)", border: "1px solid rgba(0,229,195,0.1)", fontSize: 11 }}>
                      <div style={{ fontSize: 9, color: T.teal, fontWeight: 700, marginBottom: 4 }}>MODEL</div>
                      <div>Spread: <strong style={{ color: T.teal }}>{selectedGame.model?.proj_spread}</strong> <span style={{ color: T.textMuted, fontSize: 10 }}>({selectedGame.model?.edge_spread > 0 ? "+" : ""}{selectedGame.model?.edge_spread} edge)</span></div>
                      <div>Total: <strong style={{ color: T.teal }}>{selectedGame.model?.proj_total}</strong> <span style={{ color: T.textMuted, fontSize: 10 }}>({selectedGame.model?.edge_total > 0 ? "+" : ""}{selectedGame.model?.edge_total} edge)</span></div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
                  {[{ key: "analysis", label: "Analysis" }, { key: "scotty", label: "Ask Scotty 🤖" }].map(t => (
                    <button key={t.key} onClick={() => setDossierTab(t.key)} style={{ flex: 1, padding: "9px", fontSize: 11, fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", color: dossierTab === t.key ? T.accent : T.textMuted, borderBottom: dossierTab === t.key ? `2px solid ${T.accent}` : "2px solid transparent" }}>{t.label}</button>
                  ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: "auto", padding: "14px 16px" }}>
                  {dossierTab === "analysis" && (
                    <div>
                      {/* Best Bet */}
                      {selectedGame.bestBet && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: T.teal, marginBottom: 6, letterSpacing: "0.5px" }}>🎯 BEST BET</div>
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,229,195,0.04)", border: "1px solid rgba(0,229,195,0.12)", marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 900, color: T.teal }}>{selectedGame.bestBet.pick} <span style={{ color: T.text, fontWeight: 700, fontSize: 12 }}>{selectedGame.bestBet.odds}</span></div>
                            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{selectedGame.bestBet.book} • {selectedGame.bestBet.confidence}% conf • {selectedGame.bestBet.units}u</div>
                          </div>
                          <Section title="WHY" icon="✅" color={T.teal} items={selectedGame.bestBet.why || []} />
                          <Section title="RISK" icon="⚠️" color={T.red} items={selectedGame.bestBet.risk || []} />
                          {selectedGame.bestBet.execution && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 800, color: T.gold, marginBottom: 5 }}>⚡ EXECUTION</div>
                              <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(245,166,35,0.04)", border: "1px solid rgba(245,166,35,0.12)", fontSize: 12, lineHeight: 1.6 }}>{selectedGame.bestBet.execution}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Best Prop */}
                      {selectedGame.bestProp && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: T.accent, marginBottom: 6 }}>📌 BEST PROP</div>
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.12)" }}>
                            <div style={{ fontSize: 13, fontWeight: 800 }}>{selectedGame.bestProp.pick} <span style={{ color: T.textMuted, fontSize: 11 }}>{selectedGame.bestProp.odds} • {selectedGame.bestProp.confidence}%</span></div>
                            {selectedGame.bestProp.why && selectedGame.bestProp.why.map((w, i) => (
                              <div key={i} style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>• {w}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Best Parlay */}
                      {selectedGame.bestParlay && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: T.gold, marginBottom: 6 }}>🧩 BEST PARLAY</div>
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(245,166,35,0.04)", border: "1px solid rgba(245,166,35,0.12)" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{(selectedGame.bestParlay.legs || []).join(" + ")} <span style={{ color: T.gold }}>{selectedGame.bestParlay.odds}</span></div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>Correlation: {selectedGame.bestParlay.correlation}</div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>Confidence: {selectedGame.bestParlay.confidence}%</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {dossierTab === "scotty" && (
                    <div style={{ display: "flex", flexDirection: "column", minHeight: 300 }}>
                      <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                        {[{ key: "edge", label: "Core edge" }, { key: "risk", label: "Kill factors" }, { key: "sizing", label: "Size + timing" }, { key: "live", label: "Market check" }, { key: "prop", label: "Prop" }, { key: "parlay", label: "Parlay" }, { key: "hedge", label: "Hedge" }].map(q => (
                          <button key={q.key} onClick={() => quickAsk(q.key)} disabled={scottyLoading} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.18)", color: T.accent, cursor: scottyLoading ? "wait" : "pointer", opacity: scottyLoading ? 0.5 : 1 }}>{q.label}</button>
                        ))}
                      </div>
                      <div style={{ flex: 1, overflow: "auto", marginBottom: 10 }}>
                        {chatMessages.length === 0 && <div style={{ textAlign: "center", padding: "28px 16px", color: T.textMuted, fontSize: 12 }}><div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>Scotty is powered by Claude AI. Ask anything about this game.</div>}
                        {chatMessages.map((msg, i) => (
                          <div key={i} style={{ marginBottom: 8, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                            <div style={{ maxWidth: "88%", padding: "9px 13px", borderRadius: 11, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", background: msg.role === "user" ? T.accentGlow : "rgba(255,255,255,0.025)", border: `1px solid ${msg.role === "user" ? "rgba(77,142,255,0.18)" : T.border}` }}>{msg.text}</div>
                          </div>
                        ))}
                        {scottyLoading && <div style={{ padding: "10px 16px", borderRadius: 11, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.border}`, fontSize: 12, color: T.textMuted, display: "inline-block" }}>Scotty analyzing...</div>}
                        <div ref={chatEndRef} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !scottyLoading && chatInput.trim()) { askScotty(selectedGame, chatInput); setChatInput(""); }}} placeholder="Ask Scotty anything..." disabled={scottyLoading} style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontSize: 12, background: T.bg, border: `1px solid ${T.border}`, color: T.text, outline: "none" }} />
                        <button onClick={() => { if (chatInput.trim()) { askScotty(selectedGame, chatInput); setChatInput(""); }}} disabled={scottyLoading || !chatInput.trim()} style={{ padding: "9px 16px", borderRadius: 9, fontSize: 11, fontWeight: 800, background: T.accent, border: "none", color: "#fff", cursor: "pointer", opacity: scottyLoading || !chatInput.trim() ? 0.4 : 1 }}>SEND</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === "picks" && !isMobile && (
              <div style={{ borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: 36, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 280 }}>
                {unlocked ? (
                  <><div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div><div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>Game Intelligence</div><div style={{ fontSize: 12, color: T.textMuted }}>Click any game for full analytics + Scotty AI</div></>
                ) : (
                  <><div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div><div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>Analytics Locked</div><div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, maxWidth: 260 }}>Full breakdown, best bets, props, parlays & Scotty AI require Syndicate.</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                      <button onClick={() => setActiveTab("unlock")} style={{ padding: "8px 18px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: T.discord, border: "none", color: "#fff", cursor: "pointer" }}>ENTER CODE</button>
                      <a href={PAYPAL_LINK} target="_blank" rel="noopener noreferrer" style={{ padding: "8px 18px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, textDecoration: "none" }}>PAY {PRODUCT_PRICE}</a>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          )}
          </>
        )}
      </div>

      {/* BOTTOM CTA */}
      {!unlocked && activeTab === "picks" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 20px", background: "linear-gradient(180deg,transparent,rgba(6,10,16,0.97) 40%)", display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", borderRadius: 12, background: "rgba(88,101,242,0.08)", border: "1px solid rgba(88,101,242,0.2)", backdropFilter: "blur(12px)" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>🔒 Full analytics, props, parlays & Scotty AI locked</span>
            <button onClick={() => setActiveTab("unlock")} style={{ padding: "7px 18px", borderRadius: 9, fontSize: 11, fontWeight: 800, background: T.discord, border: "none", color: "#fff", cursor: "pointer" }}>UNLOCK</button>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 18px", borderRadius: 9, fontSize: 11, fontWeight: 800, background: "transparent", border: "1px solid rgba(88,101,242,0.35)", color: T.discord, textDecoration: "none" }}>DISCORD</a>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

// ── COMPONENTS ──────────────────────────────────────────────────

function GameRow({ game, rank, isSelected, locked, onOpen }) {
  const [h, setH] = useState(false);
  const bet = game.bestBet || {};
  const conf = bet.confidence || 0;
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={onOpen} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px", borderRadius: 11, marginBottom: 5, border: `1px solid ${isSelected ? "rgba(77,142,255,0.25)" : h ? T.borderHover : T.border}`, background: isSelected ? T.accentGlow : h ? T.surfaceHover : T.surface, cursor: "pointer", transition: "all 0.15s", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
        {rank && <div style={{ width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 900, background: rank === 1 ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${rank === 1 ? "rgba(245,166,35,0.25)" : T.border}`, color: rank === 1 ? T.gold : T.textMuted }}>{rank}</div>}
        <div style={{ fontSize: 16 }}>{game.icon || "🎯"}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{game.matchup}</div>
          <div style={{ fontSize: 10.5, color: T.textMuted, display: "flex", gap: 5, flexWrap: "wrap", marginTop: 1 }}>
            <span>{game.sport}</span><span style={{ opacity: 0.35 }}>•</span>
            {locked ? <span style={{ color: T.discord, fontWeight: 700 }}>🔒 Pick Hidden</span> : <span style={{ color: T.teal, fontWeight: 700 }}>{bet.pick} {bet.odds}</span>}
            <span style={{ opacity: 0.35 }}>•</span><span>{game.time}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <ConfBar value={conf} />
        <div style={{ padding: "3px 9px", borderRadius: 7, fontSize: 9.5, fontWeight: 800, background: locked ? "rgba(88,101,242,0.08)" : T.accentGlow, border: `1px solid ${locked ? "rgba(88,101,242,0.18)" : "rgba(77,142,255,0.18)"}`, color: locked ? T.discord : T.accent }}>{locked ? "🔒" : "VIEW"}</div>
      </div>
    </div>
  );
}

function ConfBar({ value }) {
  const c = value >= 75 ? "#00e5c3" : value >= 65 ? "#f5a623" : "#5a6378";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 36, height: 3.5, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: 2, background: c, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: c, minWidth: 28, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

function Section({ title, icon, color, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color, marginBottom: 5, letterSpacing: "0.5px" }}>{icon} {title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ padding: "6px 10px", borderRadius: 8, marginBottom: 2, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", fontSize: 12, lineHeight: 1.5, display: "flex", gap: 7 }}>
          <span style={{ color: "#5a6378", flexShrink: 0, fontSize: 11 }}>{i + 1}.</span><span>{item}</span>
        </div>
      ))}
    </div>
  );
}
