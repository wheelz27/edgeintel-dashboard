# EDGEINTEL Dashboard

AI-powered sports betting intelligence dashboard with Discord paywall.

## Deploy to Vercel (Free — 5 minutes)

### Step 1: Push to GitHub
```bash
# In this folder:
git init
git add .
git commit -m "EdgeIntel dashboard"

# Create a repo on github.com (click New Repository)
# Then:
git remote add origin https://github.com/YOUR_USERNAME/edgeintel-dashboard.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to **https://vercel.com** → Sign up with GitHub (free)
2. Click **"Add New Project"**
3. Select your **edgeintel-dashboard** repo
4. Framework: **Vite** (should auto-detect)
5. Click **Deploy**
6. Wait ~60 seconds → you get a live URL like `edgeintel-dashboard.vercel.app`

### Step 3: Update your Discord bot
Change `DASHBOARD_URL` in your bot to your new Vercel URL.

## Daily Updates

**To update picks:**
1. Edit `src/config.js` — replace the PICKS array and DAILY_CODE
2. Push to GitHub:
```bash
git add .
git commit -m "March 2 picks"
git push
```
3. Vercel auto-deploys in ~30 seconds

## Files

| File | What it does |
|------|-------------|
| `src/config.js` | **THE ONLY FILE YOU EDIT** — picks, code, results |
| `src/App.jsx` | Main dashboard (don't touch unless customizing) |
| `src/main.jsx` | React entry point (don't touch) |
| `index.html` | HTML shell (don't touch) |

## Test Access Code

Default code: `EDGE0301` (change in config.js)
