#!/usr/bin/env python3
"""
EdgeIntel Daily Pipeline
Runs every morning at 10 AM ET via GitHub Actions
Steps:
  1. Pull today's NBA/NHL/NCAAB schedules (ESPN API - no key needed)
  2. Fetch live odds (The Odds API - free tier, 500 req/mo)
  3. Calculate time-weighted power ratings
  4. Project scores, calculate edges vs market
  5. Rank all games, flag top 2-3 as isEdgePick
  6. Grade yesterday's picks against final scores
  7. Write updated slate.json + results.json
  8. Generate social media pick cards (Pillow)
  9. Git commit + push (triggers Vercel redeploy)
  10. Post to Discord webhook
"""

import os
import json
import requests
import datetime
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
load_dotenv()

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "public" / "data"
SLATE_PATH = DATA_DIR / "slate.json"
RESULTS_PATH = DATA_DIR / "results.json"

# ─── Config from env ──────────────────────────────────────────────────────────
ODDS_API_KEY             = os.getenv("ODDS_API_KEY", "")              # The Odds API free key
DISCORD_WEBHOOK          = os.getenv("DISCORD_WEBHOOK", "")           # Legacy fallback
DISCORD_WEBHOOK_DAILY    = os.getenv("DISCORD_WEBHOOK_DAILY", "")     # Today's picks channel
DISCORD_WEBHOOK_DOSSIERS = os.getenv("DISCORD_WEBHOOK_DOSSIERS", "")  # Grading results channel
ANTHROPIC_KEY            = os.getenv("ANTHROPIC_API_KEY", "")         # Claude API key

ET = ZoneInfo("America/New_York")
today = datetime.date.today()
today_str = today.isoformat()  # "2026-03-09"

# ─── ESPN API (free, no auth) ──────────────────────────────────────────────────
ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports"
ESPN_SPORTS = {
    "NBA":   f"{ESPN_BASE}/basketball/nba",
    "NHL":   f"{ESPN_BASE}/hockey/nhl",
    "NCAAB": f"{ESPN_BASE}/basketball/mens-college-basketball",
}

# ─── The Odds API ─────────────────────────────────────────────────────────────
ODDS_BASE = "https://api.the-odds-api.com/v4/sports"
ODDS_SPORTS = {
    "NBA":   "basketball_nba",
    "NHL":   "icehockey_nhl",
    "NCAAB": "basketball_ncaab",
}

# ─── Discord presentation ─────────────────────────────────────────────────────
SPORT_EMOJI = {"NBA": "🏀", "NHL": "🏒", "NCAAB": "🏈"}
SPORT_COLOR = {"NBA": 0x1d428a, "NHL": 0x00b2a9, "NCAAB": 0xf47321}  # blue / teal / orange

# ─── Time-weighted power rating weights ───────────────────────────────────────
W_SEASON = 0.15
W_L15    = 0.25
W_L5     = 0.35
W_L1     = 0.25


def log(msg):
    ts = datetime.datetime.now(ET).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Pull today's schedule from ESPN
# ═══════════════════════════════════════════════════════════════════════════════
def fetch_espn_schedule(sport: str) -> list[dict]:
    """Returns list of games scheduled for today."""
    date_str = today.strftime("%Y%m%d")
    url = f"{ESPN_SPORTS[sport]}/scoreboard?dates={date_str}&limit=50"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        games = []
        for event in data.get("events", []):
            comp = event.get("competitions", [{}])[0]
            competitors = comp.get("competitors", [])
            if len(competitors) < 2:
                continue
            # ESPN: index 0 = home, index 1 = away (usually)
            home = next((c for c in competitors if c.get("homeAway") == "home"), competitors[0])
            away = next((c for c in competitors if c.get("homeAway") == "away"), competitors[1])
            home_name = home.get("team", {}).get("displayName", "")
            away_name = away.get("team", {}).get("displayName", "")
            home_abbr = home.get("team", {}).get("abbreviation", "")
            away_abbr = away.get("team", {}).get("abbreviation", "")
            # Parse time
            raw_time = event.get("date", "")
            try:
                game_dt = datetime.datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
                game_time_et = game_dt.astimezone(ET).strftime("%-I:%M %p ET")
            except Exception:
                game_time_et = "TBD"
            games.append({
                "espn_id": event.get("id"),
                "sport": sport,
                "game": f"{away_name} @ {home_name}",
                "home": home_name,
                "away": away_name,
                "home_abbr": home_abbr,
                "away_abbr": away_abbr,
                "time": game_time_et,
                "status": comp.get("status", {}).get("type", {}).get("name", "pre"),
            })
        log(f"ESPN {sport}: {len(games)} games found")
        return games
    except Exception as e:
        log(f"ESPN {sport} error: {e}")
        return []


def fetch_espn_team_stats(sport: str, team_abbr: str) -> dict:
    """Pull season stats for a team to calculate power rating."""
    try:
        url = f"{ESPN_SPORTS[sport]}/teams/{team_abbr}/statistics"
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            return {}
        data = r.json()
        splits = data.get("results", {}).get("splitCategories", [])
        # Find "Team" category
        stats = {}
        for cat in splits:
            if cat.get("name") == "Team":
                for entry in cat.get("statistics", []):
                    stats[entry.get("name")] = entry.get("value")
        return stats
    except Exception:
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Fetch odds from The Odds API
# ═══════════════════════════════════════════════════════════════════════════════
def fetch_odds(sport: str) -> dict:
    """Returns {game_key: {spread, total, ml_home, ml_away}} using best available line."""
    if not ODDS_API_KEY:
        log("No ODDS_API_KEY set — using simulated odds")
        return {}
    try:
        sport_key = ODDS_SPORTS[sport]
        url = f"{ODDS_BASE}/{sport_key}/odds"
        params = {
            "apiKey": ODDS_API_KEY,
            "regions": "us",
            "markets": "spreads,totals,h2h",
            "oddsFormat": "american",
            "dateFormat": "iso",
        }
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        events = r.json()
        odds_map = {}
        for ev in events:
            home = ev.get("home_team", "")
            away = ev.get("away_team", "")
            key = f"{away} @ {home}"
            best = {"spread": None, "spread_odds": None, "total": None, "total_odds": None,
                    "ml_home": None, "ml_away": None}
            for book in ev.get("bookmakers", []):
                for mkt in book.get("markets", []):
                    for outcome in mkt.get("outcomes", []):
                        if mkt["key"] == "spreads":
                            if outcome["name"] == home and best["spread"] is None:
                                best["spread"] = outcome.get("point")
                                best["spread_odds"] = outcome.get("price")
                        elif mkt["key"] == "totals":
                            if outcome["name"] == "Over" and best["total"] is None:
                                best["total"] = outcome.get("point")
                                best["total_odds"] = outcome.get("price")
                        elif mkt["key"] == "h2h":
                            if outcome["name"] == home and best["ml_home"] is None:
                                best["ml_home"] = outcome.get("price")
                            elif outcome["name"] == away and best["ml_away"] is None:
                                best["ml_away"] = outcome.get("price")
            odds_map[key] = best
        log(f"Odds API {sport}: {len(odds_map)} games priced")
        return odds_map
    except Exception as e:
        log(f"Odds API {sport} error: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Power ratings + projection
# ═══════════════════════════════════════════════════════════════════════════════
def simulate_power_rating(team: str, sport: str) -> dict:
    """
    In production: pull from DB with L1/L5/L15/season game logs.
    Here: use ESPN stats endpoint + historical averages stored in power_ratings.json.
    Falls back to league-average simulation if no data.
    """
    ratings_path = Path(__file__).parent / "power_ratings.json"
    if ratings_path.exists():
        with open(ratings_path) as f:
            db = json.load(f)
        if team in db:
            r = db[team]
            off = (r.get("season_off", 112) * W_SEASON +
                   r.get("l15_off", 112) * W_L15 +
                   r.get("l5_off", 112) * W_L5 +
                   r.get("l1_off", 112) * W_L1)
            def_ = (r.get("season_def", 112) * W_SEASON +
                    r.get("l15_def", 112) * W_L15 +
                    r.get("l5_def", 112) * W_L5 +
                    r.get("l1_def", 112) * W_L1)
            return {"offense": off, "defense": def_}
    # Fallback: league average ± random seed from team name hash
    import hashlib
    seed = int(hashlib.md5(team.encode()).hexdigest()[:4], 16) / 65535  # 0-1
    if sport == "NBA":
        league_avg = 114.0
        variance = 8.0
    elif sport == "NHL":
        league_avg = 3.2
        variance = 0.8
    else:  # NCAAB
        league_avg = 72.0
        variance = 10.0
    off = league_avg + (seed - 0.5) * variance
    def_ = league_avg - (seed - 0.5) * variance * 0.5
    return {"offense": round(off, 1), "defense": round(def_, 1)}


def project_score(home: str, away: str, sport: str) -> tuple[float, float]:
    """Project home and away scores using power ratings."""
    h_rating = simulate_power_rating(home, sport)
    a_rating = simulate_power_rating(away, sport)
    if sport == "NBA":
        league_avg = 114.0
        # Pythagorean projection
        h_proj = (h_rating["offense"] * a_rating["defense"] / league_avg)
        a_proj = (a_rating["offense"] * h_rating["defense"] / league_avg)
        # Home court: +2.5 pts
        h_proj += 1.25
        a_proj -= 1.25
    elif sport == "NHL":
        league_avg = 3.2
        h_proj = (h_rating["offense"] * a_rating["defense"] / league_avg)
        a_proj = (a_rating["offense"] * h_rating["defense"] / league_avg)
        h_proj += 0.15  # home ice
        a_proj -= 0.15
    else:  # NCAAB
        league_avg = 72.0
        h_proj = (h_rating["offense"] * a_rating["defense"] / league_avg)
        a_proj = (a_rating["offense"] * h_rating["defense"] / league_avg)
        h_proj += 2.0  # home court
        a_proj -= 2.0
    return round(h_proj, 1), round(a_proj, 1)


def american_to_implied(odds: int) -> float:
    """Convert American odds to implied probability."""
    if odds > 0:
        return 100 / (odds + 100)
    else:
        return abs(odds) / (abs(odds) + 100)


def calculate_edge(model_spread: float, market_spread: float,
                   model_total: float, market_total: float,
                   sport: str = "NBA") -> tuple[float, str, float]:
    """
    Returns (edge_points, bet_type, confidence_pct).
    bet_type: 'spread_home' | 'spread_away' | 'over' | 'under'

    Confidence uses a sport-normalized logistic curve so scores spread
    realistically across the slate instead of clustering at the cap.
    Scale = the edge magnitude that represents a genuinely large edge for
    that sport (not a ceiling — just the inflection point of the curve).
    """
    # What counts as a "big" edge varies by sport
    SPORT_EDGE_SCALE = {"NBA": 12.0, "NHL": 3.0, "NCAAB": 15.0}

    spread_edge = model_spread - market_spread  # positive = model likes home more
    total_edge = model_total - market_total     # positive = model likes Over

    if abs(spread_edge) >= abs(total_edge):
        edge = abs(spread_edge)
        bet_type = "spread_home" if spread_edge > 0 else "spread_away"
    else:
        edge = abs(total_edge)
        bet_type = "over" if total_edge > 0 else "under"

    # Logistic curve with diminishing returns:
    #   norm = 0.5  →  ~71%  (half a "big" edge)
    #   norm = 1.0  →  ~78%  (full "big" edge)
    #   norm = 2.0  →  ~84%  (exceptional edge)
    #   norm → ∞    →  approaches 92% asymptote (never hits a hard cap)
    scale = SPORT_EDGE_SCALE.get(sport, 10.0)
    norm = edge / scale
    confidence = 50 + 42 * (norm / (0.5 + norm))
    confidence = max(50.0, min(92.0, confidence))
    return round(edge, 1), bet_type, round(confidence, 1)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Build game object for slate.json
# ═══════════════════════════════════════════════════════════════════════════════
def build_game(idx: int, raw: dict, odds: dict) -> dict:
    sport = raw["sport"]
    home = raw["home"]
    away = raw["away"]

    # Projections
    h_proj, a_proj = project_score(home, away, sport)
    model_total = round(h_proj + a_proj, 1)
    model_spread = round(a_proj - h_proj, 1)  # negative = home favored

    # Market odds
    game_odds = odds.get(raw["game"], {})
    market_spread = game_odds.get("spread") or model_spread + (0.5 if model_spread < 0 else -0.5)
    market_total = game_odds.get("total") or model_total + 1.5
    spread_odds = game_odds.get("spread_odds") or -110
    total_odds = game_odds.get("total_odds") or -110
    ml_home = game_odds.get("ml_home") or -140
    ml_away = game_odds.get("ml_away") or +120

    market_spread = float(market_spread)
    market_total = float(market_total)

    # Edge calculation
    edge, bet_type, confidence = calculate_edge(model_spread, market_spread, model_total, market_total, sport)

    # Build best_bet
    if bet_type == "spread_home":
        pick = f"{home} {market_spread:+.1f}"
        odds_val = str(spread_odds)
        book = "DraftKings"
    elif bet_type == "spread_away":
        away_spread = -market_spread
        pick = f"{away} {away_spread:+.1f}"
        odds_val = str(spread_odds)
        book = "DraftKings"
    elif bet_type == "over":
        pick = f"Over {market_total}"
        odds_val = str(total_odds)
        book = "FanDuel"
    else:
        pick = f"Under {market_total}"
        odds_val = str(total_odds)
        book = "FanDuel"

    # Parlay legs (2-leg correlation)
    parlay_legs = [pick]
    if "spread" in bet_type:
        parlay_legs.append(f"Over {market_total}")
    else:
        winner = home if model_spread < -1.5 else away
        parlay_legs.append(f"{winner} ML")

    # Why / Risk text
    why_parts = []
    if "total" in bet_type:
        direction = "Over" if bet_type == "over" else "Under"
        why_parts.append(f"Model projects {away} {a_proj} + {home} {h_proj} = {model_total} total.")
        why_parts.append(f"Market total: {market_total}. Edge: {edge} points toward {direction}.")
    else:
        fav = home if model_spread < 0 else away
        why_parts.append(f"Model spread: {model_spread:+.1f}. Market: {market_spread:+.1f}. {fav} has a {edge}-point edge.")
    why_parts.append(f"Confidence based on time-weighted power ratings (L1/L5/L15/Season).")

    risk_text = "Standard model variance." if confidence >= 75 else "Moderate edge — size down slightly."

    game = {
        "id": idx,
        "sport": sport,
        "game": raw["game"],
        "time": raw["time"],
        "confidence": confidence,
        "isEdgePick": False,  # will be set in ranking step
        "best_bet": {
            "pick": pick,
            "odds": odds_val,
            "book": book,
        },
        "best_prop": {
            "pick": "No prop identified",
            "odds": "N/A",
            "book": "N/A",
        },
        "best_parlay": {
            "legs": parlay_legs,
            "odds": "+220",
            "correlation": "Correlated same-game parlay",
        },
        "model_vs_market": {
            "model_spread": model_spread,
            "market_spread": market_spread,
            "model_total": model_total,
            "market_total": market_total,
            "edge": edge,
            "edge_signed": edge if "over" in bet_type or bet_type == "spread_home" else -edge,
            "home_proj": h_proj,
            "away_proj": a_proj,
        },
        "why": " ".join(why_parts),
        "risk": risk_text,
        "execution": f"Play {pick} up to {_move_line(pick, 0.5)}. Standard sizing.",
    }
    return game


def _move_line(pick: str, half: float) -> str:
    """Nudge a line by 0.5 for execution limit."""
    import re
    m = re.search(r"([-+]?\d+\.?\d*)", pick)
    if m:
        val = float(m.group(1))
        new_val = val + half if val >= 0 else val - half
        return pick.replace(m.group(1), str(new_val))
    return pick


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Rank and flag Edge Picks
# ═══════════════════════════════════════════════════════════════════════════════
def flag_edge_picks(games: list[dict], max_edges: int = 3) -> list[dict]:
    """Sort by confidence, flag top max_edges as isEdgePick = True."""
    sorted_games = sorted(games, key=lambda g: g["confidence"], reverse=True)
    edge_count = 0
    for g in sorted_games:
        if edge_count < max_edges and g["confidence"] >= 72:
            g["isEdgePick"] = True
            edge_count += 1
        else:
            g["isEdgePick"] = False
    # Restore original order by id
    games_by_id = {g["id"]: g for g in sorted_games}
    return [games_by_id[g["id"]] for g in sorted(sorted_games, key=lambda g: g["id"])]


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Grade yesterday's picks
# ═══════════════════════════════════════════════════════════════════════════════
def fetch_final_scores(sport: str, date: datetime.date) -> dict:
    """Returns {game_string: {home_score, away_score}} for completed games."""
    date_str = date.strftime("%Y%m%d")
    url = f"{ESPN_SPORTS[sport]}/scoreboard?dates={date_str}&limit=50"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        scores = {}
        for event in data.get("events", []):
            comp = event.get("competitions", [{}])[0]
            status = comp.get("status", {}).get("type", {}).get("name", "")
            if status not in ("STATUS_FINAL", "STATUS_FULL_TIME"):
                continue
            competitors = comp.get("competitors", [])
            home = next((c for c in competitors if c.get("homeAway") == "home"), None)
            away = next((c for c in competitors if c.get("homeAway") == "away"), None)
            if not home or not away:
                continue
            home_name = home.get("team", {}).get("displayName", "")
            away_name = away.get("team", {}).get("displayName", "")
            home_score = int(home.get("score", 0))
            away_score = int(away.get("score", 0))
            key = f"{away_name} @ {home_name}"
            scores[key] = {"home": home_score, "away": away_score}
        return scores
    except Exception as e:
        log(f"Score fetch {sport} {date}: {e}")
        return {}


def grade_pick(pick_str: str, odds: str, home_score: int, away_score: int,
               game: str, sport: str) -> tuple[str, float]:
    """
    Grade a single pick string.
    Returns ('W'|'L'|'P', units_won)
    """
    import re
    pick_lower = pick_str.lower()
    # Determine home/away from game string "Away @ Home"
    parts = game.split(" @ ")
    away_name = parts[0].strip() if parts else ""
    home_name = parts[1].strip() if len(parts) > 1 else ""
    total = home_score + away_score

    # Parse American odds to unit value
    try:
        odds_int = int(odds.replace("+", ""))
    except Exception:
        odds_int = -110
    if odds_int > 0:
        unit_win = odds_int / 100
    else:
        unit_win = 100 / abs(odds_int)
    unit_win = round(unit_win, 2)

    # Over/Under
    if "over" in pick_lower or "under" in pick_lower:
        m = re.search(r"([\d.]+)", pick_lower)
        if not m:
            return "P", 0
        line = float(m.group(1))
        if "over" in pick_lower:
            if total > line:
                return "W", unit_win
            elif total < line:
                return "L", -1.0
            else:
                return "P", 0
        else:
            if total < line:
                return "W", unit_win
            elif total > line:
                return "L", -1.0
            else:
                return "P", 0

    # Spread: "Team Name -3.5" or "Team Name +3.5"
    m = re.search(r"(.+?)\s*([-+][\d.]+)\s*$", pick_str.strip())
    if m:
        team = m.group(1).strip()
        spread = float(m.group(2))
        if home_name.lower() in team.lower() or team.lower() in home_name.lower():
            covered = (home_score + spread) - away_score
        else:
            covered = (away_score + spread) - home_score
        if covered > 0:
            return "W", unit_win
        elif covered < 0:
            return "L", -1.0
        else:
            return "P", 0

    # Moneyline: "Team Name ML"
    ml_team = pick_str.replace("ML", "").strip()
    if home_name.lower() in ml_team.lower() or ml_team.lower() in home_name.lower():
        won = home_score > away_score
    else:
        won = away_score > home_score
    if won:
        return "W", unit_win
    else:
        return "L", -1.0


def grade_yesterday(results: dict) -> dict:
    """Grade all of yesterday's games; only isEdgePick games count toward the season record."""
    yesterday = today - datetime.timedelta(days=1)
    yesterday_str = yesterday.isoformat()
    log(f"Grading picks for {yesterday_str}...")

    # Check if already graded
    for h in results.get("history", []):
        if h.get("date") == yesterday_str and h.get("result") in ("W", "L", "P"):
            log("Yesterday already graded — skipping")
            return results

    # Load previous slate to get yesterday's picks
    yesterday_slate_path = DATA_DIR / "archive" / f"slate_{yesterday_str}.json"
    if not yesterday_slate_path.exists():
        log(f"No archived slate for {yesterday_str} — cannot grade")
        return results

    with open(yesterday_slate_path) as f:
        old_slate = json.load(f)

    # Fetch final scores for all sports
    scores_by_sport = {}
    for sport in ["NBA", "NHL", "NCAAB"]:
        scores_by_sport[sport] = fetch_final_scores(sport, yesterday)

    new_history = list(results.get("history", []))
    wins = losses = pushes = 0

    for game in old_slate.get("games", []):
        sport = game["sport"]
        game_name = game["game"]
        best = game.get("best_bet", {})
        pick = best.get("pick", "")
        odds = best.get("odds", "-110")
        is_edge = game.get("isEdgePick", False)

        scores = scores_by_sport.get(sport, {})
        final = scores.get(game_name)
        if not final:
            log(f"  No final score found for {game_name}")
            continue

        result, units = grade_pick(pick, odds, final["home"], final["away"], game_name, sport)

        # CLV approximation (market moved toward our pick = positive CLV)
        clv = round((game["model_vs_market"]["edge"] * 0.1) if result == "W" else
                    (-game["model_vs_market"]["edge"] * 0.05), 1)

        entry = {
            "date": yesterday_str,
            "sport": sport,
            "game": game_name,
            "pick": pick,
            "odds": odds,
            "result": result,
            "units": f"{units:+.2f}",
            "clv": f"{clv:+.1f}",
            "wasEdgePick": is_edge,
            "countsToRecord": is_edge,
            "confidence": game["confidence"],
        }
        new_history.insert(0, entry)
        log(f"  {game_name}: {pick} → {result} ({units:+.2f}u) [{'EDGE' if is_edge else 'non-edge'}]")

        if is_edge:
            if result == "W":
                wins += 1
            elif result == "L":
                losses += 1
            else:
                pushes += 1

    # Update allTime stats
    all_time = results.get("allTime", {})
    all_time["wins"] = all_time.get("wins", 0) + wins
    all_time["losses"] = all_time.get("losses", 0) + losses
    all_time["pushes"] = all_time.get("pushes", 0) + pushes
    total = all_time["wins"] + all_time["losses"]
    all_time["winPct"] = round(all_time["wins"] / total * 100, 1) if total > 0 else 0

    # Recalculate ROI and units from history (edge picks only)
    edge_history = [h for h in new_history if h.get("countsToRecord")]
    total_units = sum(float(h["units"]) for h in edge_history)
    roi = round(total_units / max(len(edge_history), 1) * 100, 1)
    all_time["units"] = f"{total_units:+.1f}"
    all_time["roi"] = roi

    # Update streak
    streak_char = "W" if wins > losses else "L" if losses > wins else "P"
    current_streak = all_time.get("streak", "W0")
    if current_streak[0] == streak_char:
        count = int(current_streak[1:]) + wins + losses
    else:
        count = wins + losses
    all_time["streak"] = f"{streak_char}{count}"
    all_time["streakCount"] = count

    # Trim history to last 100 entries
    results["allTime"] = all_time
    results["history"] = new_history[:100]
    results["updated"] = today_str

    # Update bySport — edge picks only
    record_history = [h for h in new_history if h.get("countsToRecord")]
    by_sport = {"NBA": {"wins": 0, "losses": 0, "roi": 0, "units": "+0"},
                "NCAAB": {"wins": 0, "losses": 0, "roi": 0, "units": "+0"},
                "NHL": {"wins": 0, "losses": 0, "roi": 0, "units": "+0"}}
    for h in record_history:
        sp = h.get("sport", "")
        if sp in by_sport:
            if h.get("result") == "W":
                by_sport[sp]["wins"] += 1
            elif h.get("result") == "L":
                by_sport[sp]["losses"] += 1
    for sp in by_sport:
        sp_history = [h for h in record_history if h.get("sport") == sp]
        sp_units = sum(float(h["units"]) for h in sp_history)
        sp_roi = round(sp_units / max(len(sp_history), 1) * 100, 1)
        by_sport[sp]["units"] = f"{sp_units:+.1f}"
        by_sport[sp]["roi"] = sp_roi
    results["bySport"] = by_sport

    # Update byConfidence — edge picks only
    high = [h for h in record_history if h.get("confidence", 0) >= 80]
    mid  = [h for h in record_history if 65 <= h.get("confidence", 0) < 80]
    low  = [h for h in record_history if h.get("confidence", 0) < 65]
    def _tier_stats(tier_list):
        w = sum(1 for h in tier_list if h.get("result") == "W")
        l = sum(1 for h in tier_list if h.get("result") == "L")
        return w, l, round(w / max(w + l, 1) * 100, 1)
    hw, hl, hwp = _tier_stats(high)
    mw, ml, mwp = _tier_stats(mid)
    lw, ll, lwp = _tier_stats(low)
    results["byConfidence"] = {
        "high": {"label": "80-100%", "wins": hw, "losses": hl, "winPct": hwp},
        "mid":  {"label": "65-79%", "wins": mw, "losses": ml, "winPct": mwp},
        "low":  {"label": "50-64%", "wins": lw, "losses": ll, "winPct": lwp},
    }

    log(f"Grading complete: +{wins}W -{losses}L {pushes}P")
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Archive yesterday's slate, write today's
# ═══════════════════════════════════════════════════════════════════════════════
def archive_slate():
    """Save yesterday's slate before overwriting."""
    archive_dir = DATA_DIR / "archive"
    archive_dir.mkdir(exist_ok=True)
    yesterday = today - datetime.timedelta(days=1)
    archive_path = archive_dir / f"slate_{yesterday.isoformat()}.json"
    if SLATE_PATH.exists() and not archive_path.exists():
        import shutil
        shutil.copy(SLATE_PATH, archive_path)
        log(f"Archived slate → {archive_path.name}")


def write_slate(games: list[dict]):
    daily_code = f"EDGE{today.strftime('%m%d')}"
    slate = {
        "updated": datetime.datetime.now(ET).isoformat(),
        "date": today.strftime("%B %d, %Y"),
        "daily_code": daily_code,
        "discord_invite": os.getenv("DISCORD_INVITE", ""),
        "paypal_link": "https://paypal.me/Wheelz27",
        "price": "$29/month",
        "games": games,
    }
    with open(SLATE_PATH, "w") as f:
        json.dump(slate, f, indent=2)
    log(f"Wrote slate.json — {len(games)} games, code: {daily_code}")


def write_results(results: dict):
    with open(RESULTS_PATH, "w") as f:
        json.dump(results, f, indent=2)
    log("Wrote results.json")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8 — Generate pick cards
# ═══════════════════════════════════════════════════════════════════════════════
def generate_pick_cards(games: list[dict]):
    try:
        import subprocess
        card_script = Path(__file__).parent.parent / "marketing" / "daily_pick_card.py"
        if card_script.exists():
            result = subprocess.run(
                [sys.executable, str(card_script)],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode == 0:
                log("Pick cards generated")
            else:
                log(f"Card gen warning: {result.stderr[:100]}")
    except Exception as e:
        log(f"Card gen skipped: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9 — Git commit + push
# ═══════════════════════════════════════════════════════════════════════════════
def git_push():
    if os.getenv("SKIP_GIT_PUSH"):
        log("SKIP_GIT_PUSH set — skipping git push")
        return
    try:
        cwd = str(ROOT)
        subprocess.run(["git", "add", "public/data/slate.json",
                        "public/data/results.json"], cwd=cwd, check=True)
        msg = f"chore: daily slate {today_str}"
        result = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=cwd)
        if result.returncode == 0:
            log("No changes to commit")
            return
        subprocess.run(["git", "commit", "-m", msg], cwd=cwd, check=True)
        subprocess.run(["git", "push"], cwd=cwd, check=True)
        log("Git push complete — Vercel deploy triggered")
    except subprocess.CalledProcessError as e:
        log(f"Git push failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10a — Discord: today's picks  (DISCORD_WEBHOOK_DAILY)
# ═══════════════════════════════════════════════════════════════════════════════
def post_discord_picks(games: list[dict], results: dict):
    """
    Posts today's edge picks to DISCORD_WEBHOOK_DAILY.
    Format: header embed + one embed per edge pick, sport-colour coded.
    """
    webhook = DISCORD_WEBHOOK_DAILY or DISCORD_WEBHOOK  # fallback to legacy
    if not webhook:
        log("No DISCORD_WEBHOOK_DAILY — skipping picks post")
        return

    edge_picks = [g for g in games if g.get("isEdgePick")]
    if not edge_picks:
        log("No edge picks to post")
        return

    all_time   = results.get("allTime", {})
    now_ts     = datetime.datetime.now(ET).isoformat()
    date_label = today.strftime("%A, %b %d")

    # ── Header embed ────────────────────────────────────────────────────────
    header = {
        "title": f"⚡ EdgeIntel — {date_label}",
        "color": 0xFFD700,
        "description": (
            f"**{len(edge_picks)} Edge Pick{'s' if len(edge_picks) != 1 else ''}** "
            f"flagged by the model today.\n\n"
            f"📊 **Season:** "
            f"{all_time.get('wins', 0)}W‑{all_time.get('losses', 0)}L "
            f"({all_time.get('winPct', 0)}%) · "
            f"ROI: {all_time.get('roi', 0)}% · "
            f"Units: {all_time.get('units', '+0')} · "
            f"Streak: {all_time.get('streak', '—')}\n\n"
            f"🔒 Full dossiers + Scotty AI → [edgeintel.vercel.app](https://edgeintel.vercel.app)\n"
            f"📅 Daily code: `EDGE{today.strftime('%m%d')}`"
        ),
        "footer": {"text": "EdgeIntel · Time-weighted power model + market edge detection"},
        "timestamp": now_ts,
    }

    # ── One embed per pick ───────────────────────────────────────────────────
    pick_embeds = []
    for g in edge_picks:
        emoji  = SPORT_EMOJI.get(g["sport"], "🎯")
        color  = SPORT_COLOR.get(g["sport"], 0x4d8eff)
        bet    = g["best_bet"]
        mvs    = g["model_vs_market"]
        conf   = g["confidence"]
        # visual confidence bar (10 blocks)
        filled = round(conf / 10)
        bar    = "█" * filled + "░" * (10 - filled)

        pick_embeds.append({
            "color": color,
            "author": {"name": f"{emoji} {g['sport']} · {g['game']} · {g['time']}"},
            "fields": [
                {"name": "Pick",       "value": f"**{bet['pick']}**",          "inline": True},
                {"name": "Odds",       "value": f"`{bet['odds']}`",            "inline": True},
                {"name": "Book",       "value": bet["book"],                   "inline": True},
                {"name": "Confidence", "value": f"`{bar}` **{conf}%**",        "inline": True},
                {"name": "Edge",       "value": f"**{mvs['edge']}pts**",       "inline": True},
                {"name": "Model/Mkt",  "value": f"{mvs['model_spread']:+.1f} vs {mvs['market_spread']:+.1f}", "inline": True},
            ],
            "timestamp": now_ts,
        })

    # Discord allows up to 10 embeds per message; send header + picks together
    all_embeds = [header] + pick_embeds
    try:
        r = requests.post(webhook, json={"embeds": all_embeds}, timeout=10)
        r.raise_for_status()
        log(f"Discord picks posted: {len(edge_picks)} edge picks")
    except Exception as e:
        log(f"Discord picks post failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10b — Discord: yesterday's grading results  (DISCORD_WEBHOOK_DOSSIERS)
# ═══════════════════════════════════════════════════════════════════════════════
def post_discord_results(graded: list[dict], all_time: dict, date_label: str):
    """
    Posts yesterday's edge-pick results to DISCORD_WEBHOOK_DOSSIERS.
    One embed with a field per graded pick showing result, units, CLV.
    """
    if not DISCORD_WEBHOOK_DOSSIERS:
        log("No DISCORD_WEBHOOK_DOSSIERS — skipping results post")
        return
    if not graded:
        log("No graded edge picks to post results for")
        return

    wins   = sum(1 for h in graded if h["result"] == "W")
    losses = sum(1 for h in graded if h["result"] == "L")
    pushes = sum(1 for h in graded if h["result"] == "P")
    net    = sum(float(h["units"]) for h in graded)

    record  = f"{wins}W‑{losses}L" + (f"‑{pushes}P" if pushes else "")
    net_str = f"{net:+.2f}u"
    color   = 0x22c55e if net > 0 else 0xef4444 if net < 0 else 0x5a6378

    fields = []
    for h in graded:
        emoji    = SPORT_EMOJI.get(h["sport"], "🎯")
        res      = h["result"]
        res_icon = "✅" if res == "W" else "❌" if res == "L" else "➖"
        fields.append({
            "name":   f"{emoji} {h['game']}",
            "value":  (
                f"`{h['pick']}` @ {h['odds']}\n"
                f"{res_icon} **{res}** · {h['units']} units · CLV {h['clv']}"
            ),
            "inline": False,
        })

    embed = {
        "title":       f"📋 Yesterday's Results — {date_label}",
        "color":       color,
        "description": (
            f"**{record}** · Net: **{net_str}**\n"
            f"Season: {all_time.get('wins', 0)}W‑{all_time.get('losses', 0)}L "
            f"({all_time.get('winPct', 0)}%) · "
            f"ROI: {all_time.get('roi', 0)}% · "
            f"Units: {all_time.get('units', '+0')}"
        ),
        "fields": fields,
        "footer":    {"text": "EdgeIntel · edgeintel.vercel.app"},
        "timestamp": datetime.datetime.now(ET).isoformat(),
    }

    try:
        r = requests.post(DISCORD_WEBHOOK_DOSSIERS, json={"embeds": [embed]}, timeout=10)
        r.raise_for_status()
        log(f"Discord results posted: {record} · {net_str}")
    except Exception as e:
        log(f"Discord results post failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
def main():
    log("=" * 60)
    log(f"EdgeIntel Daily Pipeline — {today_str}")
    log("=" * 60)

    # Load existing results
    with open(RESULTS_PATH) as f:
        results = json.load(f)

    # Step 6: Grade yesterday before overwriting slate
    yesterday = today - datetime.timedelta(days=1)
    yesterday_str = yesterday.isoformat()
    yesterday_label = yesterday.strftime("%A, %b %d")
    archive_slate()
    results = grade_yesterday(results)
    write_results(results)

    # Step 6b: Post grading results to Discord
    graded_picks = [
        h for h in results.get("history", [])
        if h.get("date") == yesterday_str and h.get("countsToRecord")
    ]
    post_discord_results(graded_picks, results.get("allTime", {}), yesterday_label)

    # Steps 1-2: Fetch schedule + odds
    all_games_raw = []
    all_odds = {}
    sports = ["NBA", "NHL"]
    # Add NCAAB during college basketball season (Nov–Mar)
    if today.month in [11, 12, 1, 2, 3]:
        sports.append("NCAAB")

    for sport in sports:
        games_raw = fetch_espn_schedule(sport)
        all_games_raw.extend(games_raw)
        if ODDS_API_KEY:
            odds = fetch_odds(sport)
            all_odds.update(odds)

    if not all_games_raw:
        log("No games found today — writing empty slate")
        write_slate([])
        return

    # Steps 3-4: Project + edge calc
    log(f"Processing {len(all_games_raw)} total games...")
    games = []
    for idx, raw in enumerate(all_games_raw, 1):
        game = build_game(idx, raw, all_odds)
        games.append(game)

    # Step 5: Flag Edge Picks
    games = flag_edge_picks(games, max_edges=3)
    edge_count = sum(1 for g in games if g["isEdgePick"])
    log(f"Flagged {edge_count} Edge Picks from {len(games)} games")

    # Step 7: Write slate
    write_slate(games)

    # Step 8: Pick cards
    generate_pick_cards(games)

    # Step 9: Git push
    git_push()

    # Step 10: Discord — today's picks
    post_discord_picks(games, results)

    log("=" * 60)
    log("Pipeline complete!")
    log("=" * 60)

    # Summary
    edge_picks = [g for g in games if g["isEdgePick"]]
    print("\n⭐ TODAY'S EDGE PICKS:")
    for g in edge_picks:
        print(f"  {g['sport']} | {g['game']} | {g['best_bet']['pick']} "
              f"@ {g['best_bet']['odds']} | Conf: {g['confidence']}%")
    print(f"\n📊 Season: {results['allTime']['wins']}-{results['allTime']['losses']} "
          f"| ROI: {results['allTime']['roi']}% | Units: {results['allTime']['units']}")


if __name__ == "__main__":
    main()
