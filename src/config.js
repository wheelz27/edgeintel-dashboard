/* ================================================================
   EDGEINTEL CONFIG — UPDATE THIS FILE DAILY
   
   This is the ONLY file you edit.
   1. Replace PICKS with your model output
   2. Change DAILY_CODE 
   3. Push to GitHub → Vercel auto-deploys
   ================================================================ */

// ── YOUR DISCORD LINK ──────────────────────────────────────────
export const DISCORD_INVITE = "https://discord.gg/YOUR_SERVER";

// ── TODAY'S ACCESS CODE (change daily, post in Discord #daily-code) ──
export const DAILY_CODE = "EDGE0301";

// ── PRICING ────────────────────────────────────────────────────
export const PRODUCT_PRICE = "$29/mo";
export const PAYPAL_LINK = "https://paypal.me/Wheelz27";

// ── TODAY'S PICKS (paste your model output here) ───────────────
export const PICKS = [
  {
    id: 1, sport: "NBA", icon: "🏀", game: "76ers @ Celtics", market: "Spread",
    pick: "BOS -9.5", odds: "-110", book: "FanDuel", confidence: 82, status: "active",
    lineOpen: "-8.5", lineCurrent: "-9.5", lineMove: "steaming",
    why: [
      "Usage consolidates toward BOS creators in half-court sets",
      "Bench unit mismatch projects +6.2 net rating advantage",
      "Pace profile supports 2H separation — BOS 3Q net rating +4.1"
    ],
    risk: [
      "Late lineup scratch flips rotation math entirely",
      "Blowout triggers garbage time — margin compresses back",
      "Steam already moved line from -8.5 → -9.5 since open"
    ],
    execution: "Take -9.5 to -10 max. Hard pass if -11+. Size: 1.5u.",
    tipTime: "7:30 PM ET",
  },
  {
    id: 2, sport: "NBA", icon: "🏀", game: "Kings @ Lakers", market: "Player Props",
    pick: "Fox O 27.5 PTS", odds: "-115", book: "DraftKings", confidence: 76, status: "active",
    lineOpen: "26.5", lineCurrent: "27.5", lineMove: "steaming",
    why: [
      "LAL perimeter defense ranks 26th in guard scoring allowed",
      "Fox usage spikes to 34% in current rotation config",
      "Pace-up matchup projects 104+ possessions"
    ],
    risk: [
      "Early blowout reduces 4Q volume opportunity",
      "Zone adjustment shifts Fox to facilitator mode"
    ],
    execution: "Take -115 to -125. Pass at -140+. Size: 1u.",
    tipTime: "10:00 PM ET",
  },
  {
    id: 3, sport: "NBA", icon: "🏀", game: "Knicks @ Spurs", market: "Player Props",
    pick: "Wemby O 4.5 BLK", odds: "+105", book: "BetMGM", confidence: 68, status: "active",
    lineOpen: "4.5", lineCurrent: "4.5", lineMove: "stable",
    why: [
      "NYK rim attempt rate is top-5 in the league",
      "Wemby block rate 7.8% — elite profile for this matchup",
      "Paint touch volume supports a 5+ block ceiling game"
    ],
    risk: [
      "Foul trouble limits minutes below 30",
      "NYK adjusts to 5-out — fewer rim contests available"
    ],
    execution: "Plus money preferred. Pass if it moves to -130+. Size: 0.75u.",
    tipTime: "8:00 PM ET",
  },
  {
    id: 4, sport: "NHL", icon: "🏒", game: "Knights @ Penguins", market: "Player Props",
    pick: "Eichel O 3.5 SOG", odds: "-120", book: "DraftKings", confidence: 80, status: "active",
    lineOpen: "3.5", lineCurrent: "3.5", lineMove: "stable",
    why: [
      "Eichel averaging 4.1 SOG/game over last 15 starts",
      "PIT allowing 34.2 shots against per game — bottom 5 in NHL",
      "VGK PP projects heavy o-zone time with Eichel quarterbacking"
    ],
    risk: [
      "Early lead → Knights turtle and dump pucks",
      "PIT goalie heater suppresses rebound shot opportunities"
    ],
    execution: "Take -120 to -135. Pass at -150+. Size: 1.5u.",
    tipTime: "7:00 PM ET",
  },
  {
    id: 5, sport: "NHL", icon: "🏒", game: "Panthers @ Islanders", market: "Player Props",
    pick: "Barkov 1+ Point", odds: "-135", book: "FanDuel", confidence: 74, status: "active",
    lineOpen: "-125", lineCurrent: "-135", lineMove: "steaming",
    why: [
      "PP1 exposure with FLA converting at 28% rate",
      "Top line minutes project 19+ TOI tonight",
      "NYI penalty kill struggling at 74% — bottom 8 in league"
    ],
    risk: [
      "Low-event game script — Sorokin steals it",
      "Barkov minute restriction if nursing something undisclosed"
    ],
    execution: "Take -135 to -150. Hard avoid at -170+. Size: 1u.",
    tipTime: "7:00 PM ET",
  },
  {
    id: 6, sport: "NHL", icon: "🏒", game: "Flames @ Ducks", market: "Game Total",
    pick: "Under 5.5", odds: "-105", book: "BetMGM", confidence: 71, status: "active",
    lineOpen: "5.5", lineCurrent: "5.5", lineMove: "stable",
    why: [
      "Both teams bottom-10 in GF/game over last 20",
      "Goalie matchup projects .920+ save pct both sides",
      "CGY's dump-and-chase system kills pace and shot quality"
    ],
    risk: [
      "Empty net goal in final 2 min swings the over",
      "Both PK units shaky — special teams chaos possible"
    ],
    execution: "Take -105 to -120. Pass at -135+. Size: 1u.",
    tipTime: "9:00 PM ET",
  },
  {
    id: 7, sport: "MMA", icon: "🥊", game: "UFC 312 Main Event", market: "Rounds",
    pick: "Over 2.5 Rounds", odds: "-140", book: "BetMGM", confidence: 72, status: "active",
    lineOpen: "-130", lineCurrent: "-140", lineMove: "steaming",
    why: [
      "Grappling-heavy matchup projects extended clinch sequences",
      "Neither fighter has a sub finish in last 4 bouts each",
      "Total clinch time projection: 8+ minutes across fight"
    ],
    risk: [
      "One-shot KO variance is always non-zero in MMA",
      "Referee standup patterns change grappling control dynamics"
    ],
    execution: "Take -140 to -155. Pass at -180+. Size: 1u.",
    tipTime: "12:00 AM ET",
  },
  {
    id: 8, sport: "MMA", icon: "🥊", game: "UFC 312 Co-Main", market: "Method of Victory",
    pick: "Underdog by Decision", odds: "+220", book: "FanDuel", confidence: 63, status: "active",
    lineOpen: "+240", lineCurrent: "+220", lineMove: "steaming",
    why: [
      "Significant cardio edge in rounds 3-5",
      "Control time wrestling path exists and is scoreable",
      "Judges historically favor output volume — underdog has it late"
    ],
    risk: [
      "Early knockdown completely flips scorecard math",
      "Judge inconsistency at this particular venue/commission"
    ],
    execution: "Small size only — 0.5u max. High variance play. Need +200 or better.",
    tipTime: "11:30 PM ET",
  },
  {
    id: 9, sport: "MMA", icon: "🥊", game: "UFC 312 Featured", market: "Method of Victory",
    pick: "Favorite by KO/TKO", odds: "+155", book: "DraftKings", confidence: 65, status: "active",
    lineOpen: "+170", lineCurrent: "+155", lineMove: "steaming",
    why: [
      "Power differential is stark — favorite lands 20% harder shots",
      "Chin durability concerns surfacing in recent camps",
      "Distance control + jab sets up the right hand finish path"
    ],
    risk: [
      "Wrestling surprise path neutralizes power entirely",
      "Cardio dump in round 2 if favorite can't finish early"
    ],
    execution: "Small size — 0.5u. Only at +140 or better. Pass at even money.",
    tipTime: "11:00 PM ET",
  },
];

// ── RESULTS HISTORY (update after grading) ─────────────────────
export const RESULTS = [
  { date: "Feb 28", game: "BOS @ MIA", pick: "BOS -6.5", odds: "-110", result: "W", clv: "+1.5", profit: "+1.00" },
  { date: "Feb 28", game: "DEN @ DAL", pick: "Jokic O 11.5 REB", odds: "-115", result: "W", clv: "+0.8", profit: "+0.87" },
  { date: "Feb 27", game: "NYR @ TBL", pick: "Over 6.5", odds: "+100", result: "L", clv: "+0.5", profit: "-1.00" },
  { date: "Feb 27", game: "GSW @ LAC", pick: "Curry O 28.5 PTS", odds: "-110", result: "W", clv: "+2.1", profit: "+1.00" },
  { date: "Feb 26", game: "UFC FN Main", pick: "Over 1.5 Rds", odds: "-130", result: "W", clv: "+1.0", profit: "+0.77" },
  { date: "Feb 26", game: "VGK @ SEA", pick: "Eichel O 2.5 SOG", odds: "-125", result: "W", clv: "+0.5", profit: "+0.80" },
  { date: "Feb 25", game: "PHI @ CLE", pick: "CLE -7", odds: "-110", result: "W", clv: "+1.8", profit: "+1.00" },
  { date: "Feb 25", game: "MIN @ OKC", pick: "SGA O 31.5 PTS", odds: "-105", result: "L", clv: "+0.3", profit: "-1.00" },
  { date: "Feb 24", game: "LAL @ PHX", pick: "PHX -4.5", odds: "-110", result: "W", clv: "+1.2", profit: "+1.00" },
  { date: "Feb 24", game: "FLA @ CAR", pick: "Under 5.5", odds: "-115", result: "W", clv: "+0.9", profit: "+0.87" },
  { date: "Feb 23", game: "UFC 311 Main", pick: "Fav by Sub", odds: "+175", result: "W", clv: "+3.2", profit: "+1.75" },
  { date: "Feb 23", game: "BOS @ NYK", pick: "BOS -3", odds: "-110", result: "L", clv: "+0.7", profit: "-1.00" },
];
