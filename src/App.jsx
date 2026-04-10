import { useState, useEffect, useRef, useCallback } from "react";
import { DISCORD_INVITE, PRODUCT_PRICE, PAYPAL_LINK } from "./config.js";

/* ================================================================
   EDGEINTEL DASHBOARD
   ✅ Real Claude AI for Scotty
   ✅ Live-updating picks with auto-refresh
   ✅ Discord + PayPal paywall
   ✅ Daily access code unlock
   ✅ Track record with CLV
   ================================================================ */

const REFRESH_INTERVAL = 60000;
const SCORE_INTERVAL  = 30000;

const ESPN_URLS = {
  NBA:   "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  NHL:   "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  NCAAB: "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard",
};

// Build a flat map: lowercase team key → score data for fast look-up
async function loadScores() {
  const map = {};
  await Promise.all(
    Object.entries(ESPN_URLS).map(async ([, url]) => {
      try {
        const data = await fetch(url).then(r => r.json());
        for (const event of data.events ?? []) {
          const comp = event.competitions?.[0];
          if (!comp) continue;
          const home = comp.competitors.find(c => c.homeAway === "home");
          const away = comp.competitors.find(c => c.homeAway === "away");
          if (!home || !away) continue;
          const entry = {
            state:  comp.status.type.state,
            period: comp.status.period,
            clock:  comp.status.displayClock,
            detail: comp.status.type.shortDetail,
            home: { abbr: home.team.abbreviation, score: home.score, short: home.team.shortDisplayName },
            away: { abbr: away.team.abbreviation, score: away.score, short: away.team.shortDisplayName },
          };
          for (const side of [home, away]) {
            for (const key of [side.team.abbreviation, side.team.shortDisplayName, side.team.displayName]) {
              map[key.toLowerCase()] = entry;
            }
          }
        }
      } catch { /* ESPN down or CORS — silently skip */ }
    })
  );
  return map;
}

function findScore(game, scores) {
  if (!game || !scores) return null;
  const lower = game.toLowerCase();
  // Try exact multi-word keys first (e.g. "golden state warriors")
  for (const key of Object.keys(scores)) {
    if (key.length > 4 && lower.includes(key)) return scores[key];
  }
  // Fall back to individual tokens (abbreviations like "GSW")
  const tokens = lower.replace(/\s+vs?\.?\s+|\s+@\s+/g, " ").split(/[\s,]+/).filter(t => t.length > 1);
  for (const token of tokens) {
    if (scores[token]) return scores[token];
  }
  return null;
}

const T = {
  bg: "#060a10", surface: "#0c1219", surfaceHover: "#111a25", elevated: "#141e2b",
  border: "rgba(255,255,255,0.06)", borderHover: "rgba(100,160,255,0.22)",
  text: "#d0d5e0", textMuted: "#5a6378",
  accent: "#4d8eff", accentGlow: "rgba(77,142,255,0.12)",
  teal: "#00e5c3", tealGlow: "rgba(0,229,195,0.10)",
  green: "#22c55e", red: "#ef4444", gold: "#f5a623", discord: "#5865F2",
};

function SubscribePage() {
  const [email, setEmail] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !discordId.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          discord_user_id: discordId.trim(),
          discord_username: discordUsername.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.role || data.note || "You're registered. Role will be granted once payment is confirmed.");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Check your connection and try again.");
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
    background: "#0c1219", border: "1px solid rgba(255,255,255,0.09)",
    color: "#d0d5e0", outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060a10", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}>
      {/* Logo / Brand */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px", color: "#d0d5e0" }}>
          EDGE<span style={{ color: "#4d8eff" }}>INTEL</span>
        </div>
        <div style={{ fontSize: 12, color: "#5a6378", marginTop: 4, letterSpacing: "2px", textTransform: "uppercase" }}>Syndicate Access</div>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 420, background: "#0c1219", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "32px 28px" }}>
        {status === "success" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#d0d5e0", marginBottom: 10 }}>You're in</div>
            <div style={{ fontSize: 13, color: "#5a6378", lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
            <a href="/" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, background: "#4d8eff", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Go to Dashboard
            </a>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#d0d5e0", marginBottom: 6 }}>Activate Syndicate Access</div>
              <div style={{ fontSize: 13, color: "#5a6378", lineHeight: 1.6 }}>
                Enter the email you paid with and your Discord User ID to get the Syndicate role granted automatically.
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5a6378", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>Payment Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(77,142,255,0.4)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5a6378", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>Discord User ID</label>
                <input
                  type="text" required value={discordId} onChange={e => setDiscordId(e.target.value)}
                  placeholder="e.g. 123456789012345678" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(77,142,255,0.4)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
                />
                <div style={{ fontSize: 11, color: "#5a6378", marginTop: 6, lineHeight: 1.5 }}>
                  Discord → Settings → Advanced → Enable Developer Mode → right-click your username → Copy User ID
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5a6378", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>Discord Username <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="text" value={discordUsername} onChange={e => setDiscordUsername(e.target.value)}
                  placeholder="e.g. wheelz27" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(77,142,255,0.4)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.09)"}
                />
              </div>

              {status === "error" && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 12, marginBottom: 16 }}>
                  {message}
                </div>
              )}

              <button
                type="submit" disabled={status === "loading"}
                style={{ width: "100%", padding: "13px", borderRadius: 10, background: status === "loading" ? "rgba(77,142,255,0.4)" : "#4d8eff", color: "#fff", fontWeight: 800, fontSize: 14, border: "none", cursor: status === "loading" ? "not-allowed" : "pointer", transition: "background 0.2s", letterSpacing: "0.3px" }}
              >
                {status === "loading" ? "Activating..." : "Activate Syndicate Role"}
              </button>
            </form>

            <div style={{ marginTop: 20, padding: "12px 14px", borderRadius: 10, background: "rgba(88,101,242,0.06)", border: "1px solid rgba(88,101,242,0.14)", fontSize: 12, color: "#5a6378", lineHeight: 1.6 }}>
              Haven't joined the Discord yet?{" "}
              <a href="https://discord.gg/j5QYKkpE" target="_blank" rel="noreferrer" style={{ color: "#5865F2", fontWeight: 600, textDecoration: "none" }}>
                Join here first
              </a>
              , then come back to activate.
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: "#5a6378" }}>
        <a href="/" style={{ color: "#5a6378", textDecoration: "none" }}>← Back to Dashboard</a>
      </div>
    </div>
  );
}

export default function App() {
  if (window.location.pathname === "/subscribe") return <SubscribePage />;

  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [activeTab, setActiveTab] = useState("picks");
  const [selectedPick, setSelectedPick] = useState(null);
  const [dossierTab, setDossierTab] = useState("analysis");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [scottyLoading, setScottyLoading] = useState(false);
  const [sportFilter, setSportFilter] = useState("ALL");
  const [picks, setPicks] = useState([]);
  const [results, setResults] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pulseId, setPulseId] = useState(null);
  const [scores, setScores] = useState({});
  const chatEndRef = useRef(null);

  const sportIcon = { NBA: "🏀", NHL: "🏒", NCAAB: "🏈" };
  const deriveMarket = (pick) => {
    if (/^(over|under)/i.test(pick)) return "Total";
    if (/\bML\b/i.test(pick)) return "Moneyline";
    return "Spread";
  };

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [slateRes, resultsRes] = await Promise.all([
        fetch("/data/slate.json"),
        fetch("/data/results.json"),
      ]);
      const slateData = await slateRes.json();
      const resultsData = await resultsRes.json();

      const mapped = (slateData.games || []).map(g => ({
        id: g.id,
        sport: g.sport,
        game: g.game,
        icon: sportIcon[g.sport] || "🎯",
        market: deriveMarket(g.best_bet?.pick || ""),
        pick: g.best_bet?.pick || "",
        odds: g.best_bet?.odds || "",
        book: g.best_bet?.book || "",
        confidence: Math.round(g.confidence),
        tipTime: g.time,
        lineOpen: g.model_vs_market?.market_spread ?? "—",
        lineCurrent: g.model_vs_market?.market_spread ?? "—",
        lineMove: "stable",
        model_vs_market: g.model_vs_market ?? {},
        why: [g.why],
        risk: [g.risk],
        execution: g.execution,
        isEdgePick: g.isEdgePick,
      }));

      setPicks(prev => {
        // pulse the pick with the biggest confidence change
        const prevMap = Object.fromEntries(prev.map(p => [p.id, p.confidence]));
        let maxD = 0, cId = null;
        mapped.forEach(p => {
          const d = Math.abs(p.confidence - (prevMap[p.id] ?? p.confidence));
          if (d > maxD) { maxD = d; cId = p.id; }
        });
        if (cId) { setPulseId(cId); setTimeout(() => setPulseId(null), 1500); }
        return mapped;
      });
      setResults(resultsData.picks || []);
    } catch (e) {
      console.error("Failed to fetch data:", e);
    }
    setLastRefresh(new Date());
    setTimeout(() => setIsRefreshing(false), 600);
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [fetchData]);

  useEffect(() => {
    loadScores().then(setScores);
    const t = setInterval(() => loadScores().then(setScores), SCORE_INTERVAL);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const tryCode = async () => {
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setUnlocked(true); setCodeError(false); setActiveTab("picks");
      } else {
        setCodeError(true); setTimeout(() => setCodeError(false), 2500);
      }
    } catch {
      setCodeError(true); setTimeout(() => setCodeError(false), 2500);
    }
  };

  // ── SCOTTY AI ─────────────────────────────────────────────────
  const askScotty = async (pick, question) => {
    setScottyLoading(true);
    setChatMessages(prev => [...prev, { role: "user", text: question }]);
    // Seed an empty assistant bubble that we'll fill as the stream arrives
    setChatMessages(prev => [...prev, { role: "assistant", text: "" }]);

    try {
      const res = await fetch("/api/scotty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick, messages: chatMessages, question }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop(); // keep any incomplete line for next chunk

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const evt = JSON.parse(payload);
            // Anthropic streams content_block_delta events with delta.text
            const token = evt?.delta?.text ?? "";
            if (token) {
              setChatMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = {
                  ...msgs[msgs.length - 1],
                  text: msgs[msgs.length - 1].text + token,
                };
                return msgs;
              });
            }
          } catch { /* skip malformed SSE events */ }
        }
      }
    } catch {
      setChatMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { role: "assistant", text: "Signal lost. Try again." };
        return msgs;
      });
    }

    setScottyLoading(false);
  };

  const quickAsk = (type) => {
    const qs = {
      edge: "Break down the core edge. What's the single biggest driver?",
      risk: "What kills this bet? Top threats and how to defend.",
      sizing: "Exact sizing, timing window, and price where we hard pass.",
      live: `Line is ${selectedPick.lineCurrent} (opened ${selectedPick.lineOpen}, ${selectedPick.lineMove}). Still a play?`,
      hedge: "Already in this — what's my hedge or exit strategy?",
    };
    askScotty(selectedPick, qs[type]);
  };

  const edgePicks = picks.filter(p => p.isEdgePick).sort((a, b) => b.confidence - a.confidence);
  const freePick = edgePicks[0] ?? null;
  const otherEdgePicks = edgePicks.slice(1);
  const filteredPicks = sportFilter === "ALL" ? picks : picks.filter(p => p.sport === sportFilter);
  const sports = ["ALL", ...new Set(picks.map(p => p.sport))];

  const stats = {
    total: results.length, wins: results.filter(r => r.result === "W").length,
    losses: results.filter(r => r.result === "L").length,
    get wr() { return this.total ? ((this.wins / this.total) * 100).toFixed(1) : "0.0"; },
    get profit() { return results.reduce((s, r) => s + parseFloat(r.profit || 0), 0).toFixed(2); },
    get clv() { return this.total ? (results.reduce((s, r) => s + parseFloat(r.clv || 0), 0) / this.total).toFixed(2) : "0.00"; },
  };

  const openDossier = (p) => { setSelectedPick(p); setChatMessages([]); setDossierTab("analysis"); };
  const now = new Date();
  const stamp = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " • " + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const ago = Math.round((now - lastRefresh) / 1000);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'SF Pro Display',-apple-system,'Segoe UI',sans-serif", fontSize: 13, lineHeight: 1.55 }}>
      
      {/* HEADER */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: "-0.5px", background: "linear-gradient(135deg,#4d8eff,#00e5c3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>EDGEINTEL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: isRefreshing ? "rgba(34,197,94,0.15)" : T.accentGlow, border: `1px solid ${isRefreshing ? "rgba(34,197,94,0.3)" : "rgba(77,142,255,0.2)"}`, color: isRefreshing ? T.green : T.accent, transition: "all 0.3s" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isRefreshing ? T.green : T.accent, animation: "pulse 2s infinite", display: "inline-block" }} />
            {isRefreshing ? "UPDATING" : "LIVE"}
          </div>
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

      {/* NAV */}
      <div style={{ display: "flex", padding: "0 20px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        {[{ key: "picks", label: "📡 Today's Card" }, { key: "results", label: "📊 Track Record" }, { key: "unlock", label: unlocked ? "🔓 Active" : "🔒 Unlock" }].map(tab => (
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
                <div style={{ color: T.textMuted, fontSize: 12 }}>All picks, dossiers, live updates & Scotty AI unlocked.</div>
              </div>
            ) : (
              <>
                <div style={{ padding: 28, borderRadius: 16, border: `1px solid ${T.border}`, background: T.surface, marginBottom: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔐</div>
                  <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Enter Today's Code</div>
                  <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 20 }}>Daily code from the Syndicate Discord channel.</div>
                  <div style={{ display: "flex", gap: 8, maxWidth: 320, margin: "0 auto" }}>
                    <input value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => e.key === "Enter" && tryCode()} placeholder="ACCESS CODE" style={{ flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 14, background: T.bg, border: `1px solid ${codeError ? T.red : T.border}`, color: T.text, outline: "none", fontWeight: 800, letterSpacing: "3px", textAlign: "center", textTransform: "uppercase" }} />
                    <button onClick={tryCode} style={{ padding: "10px 20px", borderRadius: 10, fontSize: 12, fontWeight: 800, background: T.accent, border: "none", color: "#fff", cursor: "pointer" }}>GO</button>
                  </div>
                  {codeError && <div style={{ color: T.red, fontSize: 11, marginTop: 8, fontWeight: 700 }}>Invalid code. Check #daily-code in Discord.</div>}
                </div>
                <div style={{ padding: 22, borderRadius: 16, background: `linear-gradient(135deg,rgba(88,101,242,0.08),rgba(0,229,195,0.04))`, border: `1px solid ${T.border}`, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>No code yet?</div>
                  <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 14, lineHeight: 1.6 }}>Join EdgeIntel Discord → subscribe ({PRODUCT_PRICE}) → get daily codes + Scotty AI + line alerts.</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, fontSize: 12, fontWeight: 800, background: T.discord, color: "#fff", textDecoration: "none" }}>JOIN DISCORD</a>
                    <a href={PAYPAL_LINK} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, fontSize: 12, fontWeight: 800, background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, textDecoration: "none" }}>PAY VIA PAYPAL</a>
                  </div>
                </div>
                <div style={{ padding: 18, borderRadius: 14, background: T.surface, border: `1px solid ${T.border}`, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Syndicate members get:</div>
                  {["Every pick revealed — odds, book, sizing","Full dossiers with model reasoning","Scotty AI — ask anything about any pick","Live line movement tracking","Execution rules with exact thresholds","Complete results history with CLV"].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 12, color: T.textMuted }}><span style={{ color: T.teal }}>✓</span>{item}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ RESULTS TAB ═══ */}
        {activeTab === "results" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Win Rate", value: `${stats.wr}%`, color: parseFloat(stats.wr) > 55 ? T.teal : T.text },
                { label: "Record", value: `${stats.wins}W-${stats.losses}L`, color: T.text },
                { label: "Profit", value: `${parseFloat(stats.profit) > 0 ? "+" : ""}${stats.profit}u`, color: parseFloat(stats.profit) > 0 ? T.green : T.red },
                { label: "Avg CLV", value: `+${stats.clv}`, color: T.teal },
              ].map((s, i) => (
                <div key={i} style={{ padding: "14px 12px", borderRadius: 12, textAlign: "center", background: T.surface, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "8px 12px", borderRadius: 10, marginBottom: 14, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.12)", fontSize: 11, color: T.textMuted }}>
              <strong style={{ color: T.accent }}>CLV</strong> = where line closed vs where we bet. Consistent +CLV = long-term profit.
            </div>
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}`, background: T.surface }}>
              <div style={{ display: "grid", gridTemplateColumns: "65px 1fr 1fr 55px 55px 70px", padding: "8px 12px", fontSize: 9.5, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: `1px solid ${T.border}` }}>
                <div>Date</div><div>Game</div><div>Pick</div><div>Result</div><div>CLV</div><div>P&L</div>
              </div>
              {results.map((r, i) => {
                const locked = !unlocked && i > 3;
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "65px 1fr 1fr 55px 55px 70px", padding: "9px 12px", fontSize: 12, borderBottom: i < results.length - 1 ? `1px solid ${T.border}` : "none", filter: locked ? "blur(5px)" : "none", userSelect: locked ? "none" : "auto" }}>
                    <div style={{ color: T.textMuted }}>{r.date}</div>
                    <div style={{ fontWeight: 700 }}>{r.game}</div>
                    <div style={{ color: T.teal, fontWeight: 700 }}>{r.pick} ({r.odds})</div>
                    <div style={{ fontWeight: 900, color: r.result === "W" ? T.green : T.red }}>{r.result}</div>
                    <div style={{ color: T.teal, fontWeight: 700 }}>{r.clv}</div>
                    <div style={{ fontWeight: 800, color: parseFloat(r.profit) > 0 ? T.green : T.red }}>{parseFloat(r.profit) > 0 ? "+" : ""}{r.profit}u</div>
                  </div>
                );
              })}
            </div>
            {!unlocked && (
              <div style={{ textAlign: "center", padding: 18, background: T.surface, borderRadius: "0 0 12px 12px", borderTop: `1px solid ${T.border}`, marginTop: -1 }}>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>4 of {results.length} shown</div>
                <button onClick={() => setActiveTab("unlock")} style={{ padding: "8px 22px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: T.discord, border: "none", color: "#fff", cursor: "pointer" }}>🔒 UNLOCK FULL HISTORY</button>
              </div>
            )}
          </div>
        )}

        {/* ═══ PICKS TAB ═══ */}
        {activeTab === "picks" && (
          <div style={{ display: "grid", gridTemplateColumns: selectedPick && unlocked ? "1fr 1fr" : "1fr", gap: 20 }}>
            <div>
              {unlocked ? (
                /* ── UNLOCKED: all edge picks as normal rows ── */
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    ⭐ EDGE PICKS
                    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", color: T.gold, fontWeight: 800 }}>HIGHEST CONFIDENCE</span>
                  </div>
                  {edgePicks.map((p, i) => (
                    <PickRow key={`e-${p.id}`} pick={p} rank={i + 1} isSelected={selectedPick?.id === p.id} locked={false} pulsing={pulseId === p.id} onOpen={() => openDossier(p)} score={findScore(p.game, scores)} />
                  ))}
                </div>
              ) : (
                /* ── LOCKED: free pick card + locked edge rows ── */
                <>
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                      🎯 TODAY'S FREE PICK
                      <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: T.green, fontWeight: 800 }}>FREE</span>
                    </div>
                    {freePick
                      ? <FreePickCard pick={freePick} onUnlock={() => setActiveTab("unlock")} score={findScore(freePick.game, scores)} />
                      : <div style={{ padding: 20, borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 12, textAlign: "center" }}>No picks available yet — check back after 10 AM ET.</div>
                    }
                  </div>
                  {otherEdgePicks.length > 0 && (
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                        ⭐ MORE EDGE PICKS
                        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: "rgba(88,101,242,0.08)", border: "1px solid rgba(88,101,242,0.2)", color: T.discord, fontWeight: 800 }}>SYNDICATE ONLY</span>
                      </div>
                      {otherEdgePicks.map(p => (
                        <PickRow key={`e-${p.id}`} pick={p} isSelected={false} locked={true} pulsing={pulseId === p.id} onOpen={() => setActiveTab("unlock")} score={findScore(p.game, scores)} />
                      ))}
                    </div>
                  )}
                </>
              )}
              {/* Full slate */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>📋 FULL SLATE — {picks.length} games</div>
                <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                  {sports.map(s => (
                    <button key={s} onClick={() => setSportFilter(s)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: sportFilter === s ? T.accentGlow : "transparent", border: `1px solid ${sportFilter === s ? "rgba(77,142,255,0.25)" : T.border}`, color: sportFilter === s ? T.accent : T.textMuted, cursor: "pointer" }}>{s}</button>
                  ))}
                </div>
                {filteredPicks.map(p => (
                  <PickRow key={`s-${p.id}`} pick={p} isSelected={selectedPick?.id === p.id} locked={!unlocked} pulsing={pulseId === p.id} onOpen={() => unlocked ? openDossier(p) : setActiveTab("unlock")} score={findScore(p.game, scores)} />
                ))}
              </div>
            </div>

            {/* DOSSIER PANEL */}
            {selectedPick && unlocked ? (
              <div style={{ borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, overflow: "hidden", position: "sticky", top: 16, maxHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, background: "linear-gradient(135deg,rgba(77,142,255,0.05),transparent)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginBottom: 3 }}>🧠 PICK DOSSIER</div>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>{selectedPick.icon} {selectedPick.game}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 9.5, fontWeight: 800, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.2)", color: T.accent }}>{selectedPick.sport}</span>
                        <span style={{ fontSize: 11, color: T.textMuted }}>{selectedPick.market} • {selectedPick.tipTime}</span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPick(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 7, padding: "3px 9px", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                  <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(0,229,195,0.05)", border: "1px solid rgba(0,229,195,0.12)", display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
                    <div><span style={{ color: T.textMuted }}>Pick</span> <strong style={{ color: T.teal }}>{selectedPick.pick} {selectedPick.odds}</strong></div>
                    <div><span style={{ color: T.textMuted }}>Book</span> <strong>{selectedPick.book}</strong></div>
                    <div><span style={{ color: T.textMuted }}>Conf</span> <strong>{selectedPick.confidence}%</strong></div>
                    <div><span style={{ color: T.textMuted }}>Line</span> <strong style={{ color: selectedPick.lineMove === "steaming" ? T.gold : selectedPick.lineMove === "fading" ? T.green : T.textMuted }}>{selectedPick.lineOpen} → {selectedPick.lineCurrent} {selectedPick.lineMove === "steaming" ? "🔥" : selectedPick.lineMove === "fading" ? "↓" : ""}</strong></div>
                  </div>
                </div>

                <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
                  {[{ key: "analysis", label: "Analysis" }, { key: "scotty", label: "Ask Scotty 🤖" }].map(t => (
                    <button key={t.key} onClick={() => setDossierTab(t.key)} style={{ flex: 1, padding: "9px", fontSize: 11, fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", color: dossierTab === t.key ? T.accent : T.textMuted, borderBottom: dossierTab === t.key ? `2px solid ${T.accent}` : "2px solid transparent" }}>{t.label}</button>
                  ))}
                </div>

                <div style={{ flex: 1, overflow: "auto", padding: "14px 16px" }}>
                  {dossierTab === "analysis" && (
                    <div>
                      <Section title="WHY" icon="✅" color={T.teal} items={selectedPick.why} />
                      <Section title="RISK" icon="⚠️" color={T.red} items={selectedPick.risk} />
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: T.gold, marginBottom: 5, letterSpacing: "0.5px" }}>⚡ EXECUTION</div>
                        <div style={{ padding: "9px 12px", borderRadius: 10, background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.12)", fontSize: 12, lineHeight: 1.6 }}>{selectedPick.execution}</div>
                      </div>
                    </div>
                  )}

                  {dossierTab === "scotty" && (
                    <div style={{ display: "flex", flexDirection: "column", minHeight: 300 }}>
                      <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                        {[{ key: "edge", label: "Core edge" }, { key: "risk", label: "Kill factors" }, { key: "sizing", label: "Size + timing" }, { key: "live", label: "Live line" }, { key: "hedge", label: "Hedge" }].map(q => (
                          <button key={q.key} onClick={() => quickAsk(q.key)} disabled={scottyLoading} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 10.5, fontWeight: 700, background: T.accentGlow, border: "1px solid rgba(77,142,255,0.18)", color: T.accent, cursor: scottyLoading ? "wait" : "pointer", opacity: scottyLoading ? 0.5 : 1 }}>{q.label}</button>
                        ))}
                      </div>
                      <div style={{ flex: 1, overflow: "auto", marginBottom: 10 }}>
                        {chatMessages.length === 0 && <div style={{ textAlign: "center", padding: "28px 16px", color: T.textMuted, fontSize: 12 }}><div style={{ fontSize: 24, marginBottom: 8 }}>🤖</div>Scotty is powered by Claude AI. Ask anything about this pick.</div>}
                        {chatMessages.map((msg, i) => (
                          <div key={i} style={{ marginBottom: 8, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                            <div style={{ maxWidth: "88%", padding: "9px 13px", borderRadius: 11, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", background: msg.role === "user" ? T.accentGlow : "rgba(255,255,255,0.025)", border: `1px solid ${msg.role === "user" ? "rgba(77,142,255,0.18)" : T.border}` }}>{msg.text}</div>
                          </div>
                        ))}
                        {scottyLoading && <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}><div style={{ padding: "10px 16px", borderRadius: 11, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.border}`, fontSize: 12, color: T.textMuted }}><span style={{ animation: "pulse 1s infinite" }}>Scotty analyzing...</span></div></div>}
                        <div ref={chatEndRef} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !scottyLoading && chatInput.trim()) { askScotty(selectedPick, chatInput); setChatInput(""); }}} placeholder="Ask Scotty..." disabled={scottyLoading} style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontSize: 12, background: T.bg, border: `1px solid ${T.border}`, color: T.text, outline: "none", opacity: scottyLoading ? 0.5 : 1 }} />
                        <button onClick={() => { if (chatInput.trim()) { askScotty(selectedPick, chatInput); setChatInput(""); }}} disabled={scottyLoading || !chatInput.trim()} style={{ padding: "9px 16px", borderRadius: 9, fontSize: 11, fontWeight: 800, background: T.accent, border: "none", color: "#fff", cursor: "pointer", opacity: scottyLoading || !chatInput.trim() ? 0.4 : 1 }}>SEND</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface, padding: 36, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 280 }}>
                {unlocked ? (
                  <><div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div><div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>Pick Dossier</div><div style={{ fontSize: 12, color: T.textMuted }}>Click any pick for full analysis + Scotty AI</div></>
                ) : (
                  <><div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div><div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>Dossier Locked</div><div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14, maxWidth: 260 }}>Full analysis, execution, and Scotty AI require Syndicate access.</div>
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
      </div>

      {/* BOTTOM CTA */}
      {!unlocked && activeTab === "picks" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 20px", background: "linear-gradient(180deg,transparent,rgba(6,10,16,0.97) 40%)", display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", borderRadius: 12, background: "rgba(88,101,242,0.08)", border: "1px solid rgba(88,101,242,0.2)", backdropFilter: "blur(12px)" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>🔒 Full picks, dossiers & Scotty AI locked</span>
            <button onClick={() => setActiveTab("unlock")} style={{ padding: "7px 18px", borderRadius: 9, fontSize: 11, fontWeight: 800, background: T.discord, border: "none", color: "#fff", cursor: "pointer" }}>UNLOCK</button>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 18px", borderRadius: 9, fontSize: 11, fontWeight: 800, background: "transparent", border: "1px solid rgba(88,101,242,0.35)", color: T.discord, textDecoration: "none" }}>DISCORD</a>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes rowPulse{0%{box-shadow:0 0 0 0 rgba(77,142,255,.3)}70%{box-shadow:0 0 0 6px rgba(77,142,255,0)}100%{box-shadow:0 0 0 0 rgba(77,142,255,0)}}`}</style>
    </div>
  );
}

function FreePickCard({ pick, onUnlock, score }) {
  const confColor = pick.confidence >= 80 ? T.teal : pick.confidence >= 70 ? T.accent : T.gold;
  const hasLiveScore = score && score.state !== "pre";
  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(0,229,195,0.2)", background: "linear-gradient(135deg,rgba(0,229,195,0.04),transparent)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,229,195,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{pick.icon} {pick.game}</div>
            <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{pick.sport} • {pick.market}</span>
              {hasLiveScore
                ? <LiveScore score={score} sport={pick.sport} />
                : <span>• {pick.tipTime}</span>
              }
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: confColor }}>{pick.confidence}%</div>
            <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Confidence</div>
          </div>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,229,195,0.06)", border: "1px solid rgba(0,229,195,0.15)", display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
          <div><div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginBottom: 2 }}>PICK</div><strong style={{ color: T.teal }}>{pick.pick}</strong></div>
          <div><div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginBottom: 2 }}>ODDS</div><strong>{pick.odds}</strong></div>
          <div><div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginBottom: 2 }}>BOOK</div><strong>{pick.book}</strong></div>
        </div>
      </div>
      {/* Why */}
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: T.teal, marginBottom: 8, letterSpacing: "0.5px" }}>✅ WHY</div>
        {pick.why.map((item, i) => (
          <div key={i} style={{ padding: "7px 11px", borderRadius: 8, marginBottom: 4, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, lineHeight: 1.5, display: "flex", gap: 7 }}>
            <span style={{ color: T.textMuted, flexShrink: 0, fontSize: 11 }}>{i + 1}.</span><span>{item}</span>
          </div>
        ))}
      </div>
      {/* Upsell */}
      <div style={{ padding: "12px 16px 14px" }}>
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(88,101,242,0.06)", border: "1px solid rgba(88,101,242,0.15)", fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>🔒 <strong style={{ color: T.accent }}>Risk, execution & Scotty AI</strong> are Syndicate-only.</span>
          <button onClick={onUnlock} style={{ padding: "6px 16px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: T.discord, border: "none", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>UNLOCK ACCESS</button>
        </div>
      </div>
    </div>
  );
}

function PickRow({ pick, rank, isSelected, locked, pulsing, onOpen, score }) {
  const [h, setH] = useState(false);
  const mc = pick.lineMove === "steaming" ? T.gold : pick.lineMove === "fading" ? T.green : T.textMuted;
  const mi = pick.lineMove === "steaming" ? "🔥" : pick.lineMove === "fading" ? "↓" : "—";
  const hasLiveScore = score && score.state !== "pre";
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={onOpen} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px", borderRadius: 11, marginBottom: 5, border: `1px solid ${isSelected ? "rgba(77,142,255,0.25)" : h ? T.borderHover : T.border}`, background: isSelected ? T.accentGlow : h ? T.surfaceHover : T.surface, cursor: "pointer", transition: "all 0.15s", gap: 10, animation: pulsing ? "rowPulse 0.8s ease-out" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
        {rank && <div style={{ width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 900, background: rank === 1 ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${rank === 1 ? "rgba(245,166,35,0.25)" : T.border}`, color: rank === 1 ? T.gold : T.textMuted }}>{rank}</div>}
        <div style={{ fontSize: 16 }}>{pick.icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pick.game}</div>
          <div style={{ fontSize: 10.5, color: T.textMuted, display: "flex", gap: 5, flexWrap: "wrap", marginTop: 1 }}>
            <span>{pick.sport}</span><span style={{ opacity: 0.35 }}>•</span><span>{pick.market}</span><span style={{ opacity: 0.35 }}>•</span>
            {locked ? <span style={{ color: T.discord, fontWeight: 700 }}>🔒 Hidden</span> : <span style={{ color: T.teal, fontWeight: 700 }}>{pick.pick} {pick.odds}</span>}
            <span style={{ opacity: 0.35 }}>•</span><span style={{ color: mc, fontWeight: 700 }}>{mi}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <ConfBar value={pick.confidence} />
        {hasLiveScore
          ? <LiveScore score={score} sport={pick.sport} />
          : <span style={{ fontSize: 10, color: T.textMuted }}>{pick.tipTime}</span>
        }
        <div style={{ padding: "3px 9px", borderRadius: 7, fontSize: 9.5, fontWeight: 800, background: locked ? "rgba(88,101,242,0.08)" : T.accentGlow, border: `1px solid ${locked ? "rgba(88,101,242,0.18)" : "rgba(77,142,255,0.18)"}`, color: locked ? T.discord : T.accent }}>{locked ? "🔒" : "VIEW"}</div>
      </div>
    </div>
  );
}

function LiveScore({ score, sport }) {
  if (!score || score.state === "pre") return null;
  const { state, home, away, period, clock } = score;

  const periodLabel = (p) => {
    if (sport === "NHL")   return p <= 3 ? `P${p}` : "OT";
    if (sport === "NCAAB") return p === 1 ? "H1" : p === 2 ? "H2" : "OT";
    return p <= 4 ? `Q${p}` : "OT"; // NBA
  };

  const homeScore = parseInt(home.score || 0);
  const awayScore = parseInt(away.score || 0);
  const homeWins  = state === "post" && homeScore > awayScore;
  const awayWins  = state === "post" && awayScore > homeScore;

  if (state === "post") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, marginRight: 2 }}>FINAL</span>
        <span style={{ color: awayWins ? T.green : T.text }}>{away.abbr} {away.score}</span>
        <span style={{ color: T.textMuted, fontWeight: 400 }}>–</span>
        <span style={{ color: homeWins ? T.green : T.text }}>{home.abbr} {home.score}</span>
      </div>
    );
  }

  // Live / in-progress
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 6, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.red, display: "inline-block", animation: "pulse 1s infinite", flexShrink: 0 }} />
      <span>{away.abbr} {away.score}</span>
      <span style={{ color: T.textMuted, fontWeight: 400 }}>–</span>
      <span>{home.abbr} {home.score}</span>
      <span style={{ color: T.textMuted, fontSize: 9, fontWeight: 700 }}>{periodLabel(period)} {clock}</span>
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
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color, marginBottom: 6, letterSpacing: "0.5px" }}>{icon} {title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ padding: "7px 11px", borderRadius: 8, marginBottom: 3, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, lineHeight: 1.5, display: "flex", gap: 7 }}>
          <span style={{ color: "#5a6378", flexShrink: 0, fontSize: 11 }}>{i + 1}.</span><span>{item}</span>
        </div>
      ))}
    </div>
  );
}
