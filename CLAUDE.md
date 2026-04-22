# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

EdgeIntel is an AI-powered sports betting intelligence platform (NBA, NHL, NCAAB). It runs a daily automated pipeline that fetches live odds and team schedules, applies a time-weighted power rating model to find market edges, and publishes picks to a React dashboard deployed on Vercel. Monetization is via Discord subscription + PayPal for full dossier access.

## Commands

### Frontend (React + Vite)
```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run preview   # Preview production build
```

### Pipeline (Python)
```bash
python pipeline/daily_pipeline.py    # Generate today's picks (writes to public/data/slate.json)
python pipeline/power_ratings.py     # Update team power ratings
python marketing/daily_pick_card.py  # Generate social media pick card images
```

No linting or test commands are configured — there is no test suite.

## Architecture

### Data Flow
1. **GitHub Actions** (`edgeintel.yml`) triggers daily at 10 AM ET
2. **`pipeline/daily_pipeline.py`** fetches ESPN schedules + The Odds API data, calculates model projections, finds edges vs market spreads, grades yesterday's picks, and posts to Discord
3. Output is written to **`public/data/slate.json`** (today's picks) and **`public/data/results.json`** (season stats)
4. The git commit triggers a **Vercel** rebuild, deploying the updated data as a static SPA
5. Users view picks at the Vercel URL; premium content is gated behind a daily unlock code

### Frontend (`src/`)
- **`App.jsx`** — single large component containing the entire dashboard: top picks, full slate with sport/line filters, results tracking (win/loss/CLV/profit), paywall unlock modal, and "Ask Scotty" Claude AI chat per pick
- **`config.js`** — Discord invite URL, PayPal link, pricing

The UI reads `slate.json` and `results.json` at runtime from `/data/`. No backend API is called for pick data.

### Pipeline (`pipeline/`)
- **`power_ratings.py`** — calculates time-weighted team strength (L1/L5/L15/Season) from game results
- **`daily_pipeline.py`** — orchestrates the full daily run: fetch schedules → fetch odds → project scores via power ratings → compute edge vs market spread → rank games → flag top 2–3 as `isEdgePick` → write slate.json → post Discord notification

### External APIs
| API | Auth | Usage |
|-----|------|-------|
| ESPN (unofficial) | None | Game schedules, team data |
| The Odds API | `ODDS_API_KEY` in `.env` | Live sportsbook odds (500 req/month free tier) |
| Anthropic Claude | `ANTHROPIC_API_KEY` in `.env` | "Ask Scotty" pick analysis chat |
| Discord Webhooks | `DISCORD_WEBHOOK` in `.env` | Daily pick notifications |

### Key Data Files
- `public/data/slate.json` — generated daily; consumed by frontend for today's picks
- `public/data/results.json` — season-long stats and pick history
- `public/data/archive/` — historical per-day pick data

### Deployment
- Frontend: Vercel (static SPA). Config in `vercel.json` (SPA rewrites, cache headers).
- Automation: GitHub Actions (`.github/workflows/edgeintel.yml`).
- `enhanced_api.py` and `live_api.py` are legacy Flask servers (crypto advisor demo); not part of the sports betting core.
