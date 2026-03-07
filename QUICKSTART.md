# 🚀 Quick Start Guide - Live Crypto Advisor with Free APIs

## What You're Getting

A **fully functional crypto advisor** that uses **real market data** from free APIs (no signup or API keys required):

- ✅ **CoinGecko API** - Real-time prices, market caps, volume, price changes
- ✅ **CryptoCompare** - Additional market data (100K free calls/month)
- ✅ **Multi-agent analysis** - Market structure, momentum, volatility, position
- ✅ **Live dashboard** - Beautiful web interface
- ✅ **No API keys needed** - Works out of the box

## 📦 Files You Need

1. **live_api.py** - Flask server using real CoinGecko data
2. **dashboard.html** - Web interface (connects to Flask backend)
3. **demo-dashboard.html** - Standalone demo (no backend needed)

## 🏃 How to Run

### Option 1: Live System (Recommended)

```bash
# 1. Make sure you have Flask installed
pip install flask

# 2. Start the API server
python live_api.py

# You'll see:
# ============================================================
# 🚀 LIVE Crypto Advisor API Server
# ============================================================
# ✓ Using REAL CoinGecko data (no API key needed)
# ✓ 3 assets: BTC, ETH, SOL
# ✓ 4 analysis agents with live market data
# Server starting on http://0.0.0.0:5000
# ============================================================

# 3. Open dashboard.html in your browser
# The dashboard will auto-connect to the API server at localhost:5000
```

### Option 2: Demo Mode (No Setup)

```bash
# Just open demo-dashboard.html in your browser
# Works immediately with simulated data
```

## 🎯 What Each Agent Does

### 1. Market Structure Agent
- Analyzes 7-day and 30-day price trends
- Identifies uptrends, downtrends, or consolidation
- Uses real price change percentages from CoinGecko

### 2. Momentum Agent
- Compares 24h vs 7d price movements
- Detects momentum alignment or divergence
- Shows current price and 24h change

### 3. Market Position Agent
- Evaluates market cap rank (#1-10 = top tier)
- Assesses liquidity based on market size
- Shows market cap in billions

### 4. Volatility Risk Agent
- Measures price swing magnitude
- Flags high volatility as elevated risk
- Calculates 24h and 7d price swings

### Risk Synthesis
- Combines all agent signals
- Determines: Risk-On, Risk-Off, or Neutral
- Calculates confidence score (0-100%)
- Assigns risk level: Low, Medium, High

## 📊 Example Analysis Output

When you run analysis on BTC, you'll get:

```json
{
  "asset": "BTC",
  "regime": "Risk-On",
  "confidence": 0.75,
  "risk_level": "Medium",
  "price_data": {
    "current_price": 97234.50,
    "price_change_24h": 2.3,
    "price_change_7d": 5.1,
    "volume_24h": 28500000000,
    "market_cap": 1920000000000
  },
  "agents": [
    {
      "name": "Market Structure Agent",
      "signal": "Uptrend",
      "confidence": 0.65,
      "sentiment": "bullish",
      "details": "7d: 5.1%, 30d: 12.3% | Volume: $28.5B"
    },
    // ... other agents
  ]
}
```

## 🔧 API Endpoints

Once running, the server exposes:

```
GET  /                    - API info
GET  /api/health          - Health check
GET  /api/config          - System configuration
POST /api/analyze/btc     - Run analysis on BTC
POST /api/analyze/eth     - Run analysis on ETH
POST /api/analyze/sol     - Run analysis on SOL
POST /api/backtest        - Run historical backtest
GET  /api/assets          - List available assets
```

## 💡 Usage Examples

### Via Dashboard
1. Select asset (BTC/ETH/SOL)
2. Click "Run Advisory Cycle"
3. View real-time analysis with charts

### Via curl
```bash
# Health check
curl http://localhost:5000/api/health

# Analyze Bitcoin
curl -X POST http://localhost:5000/api/analyze/btc

# Run backtest
curl -X POST http://localhost:5000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{"asset":"btc","steps":100}'
```

### Via Python
```python
import requests

# Analyze ETH
response = requests.post('http://localhost:5000/api/analyze/eth')
data = response.json()

print(f"Regime: {data['regime']}")
print(f"Confidence: {data['confidence']:.0%}")
print(f"Current Price: ${data['price_data']['current_price']:,.2f}")
```

## 🌐 Free API Limits

### CoinGecko (Used in live_api.py)
- ✅ 50 calls/minute
- ✅ No API key required
- ✅ All major coins supported
- ✅ Real-time price data
- ✅ Historical data available

### CryptoCompare (Alternative)
- ✅ 100,000 calls/month free
- ✅ Many endpoints work without API key
- ✅ Includes social sentiment
- ✅ News aggregation

### CoinMarketCap (Alternative)
- ✅ Free tier available
- ✅ 20,000+ cryptocurrencies
- ✅ Historical data
- ✅ Exchange data

## 🚫 What's NOT Included

This is an **analysis system only**:
- ❌ No trade execution
- ❌ No wallet integration
- ❌ No automated trading
- ❌ No leverage recommendations
- ❌ No price predictions

This is intentional - it's designed for **informed decision making**, not automated trading.

## 🔐 Rate Limit Protection

The code includes automatic rate limiting:
- Minimum 1 second between requests
- Graceful error handling
- Timeout protection (10 seconds)

## 🐛 Troubleshooting

### Dashboard shows "Disconnected"
- Make sure live_api.py is running
- Check http://localhost:5000/api/health in browser
- Verify no other app is using port 5000

### "Failed to fetch market data"
- CoinGecko might be rate limiting
- Wait 60 seconds and try again
- Check your internet connection
- Try demo-dashboard.html instead

### Import errors
```bash
pip install flask
# That's all you need!
```

## 📈 Next Steps

### Add More Assets
Edit live_api.py, add to coin_map:
```python
coin_map = {
    'btc': 'bitcoin',
    'eth': 'ethereum',
    'sol': 'solana',
    'ada': 'cardano',  # Add this
    'dot': 'polkadot'  # And this
}
```

### Add More Agents
Create new analysis functions:
```python
def analyze_social_sentiment(self, price_data):
    # Your logic here
    return {
        'name': 'Social Sentiment Agent',
        'signal': 'Bullish chatter',
        'confidence': 0.7,
        'sentiment': 'bullish'
    }
```

### Connect to Your Backend
If you have the full crypto_advisor system from the original spec, you can:
1. Replace simple agents with real multi-agent system
2. Add CoinGlass for derivatives data
3. Add Glassnode for on-chain data
4. Implement Discord notifications
5. Add persistent memory/learning

## 📚 Resources

- CoinGecko API Docs: https://www.coingecko.com/en/api
- CryptoCompare API: https://min-api.cryptocompare.com/
- Flask Documentation: https://flask.palletsprojects.com/

## ⚡ Performance Tips

- Run on localhost for fastest response
- Use demo mode for testing UI changes
- Cache results if making multiple requests
- Consider websockets for real-time updates

## 🎉 You're Ready!

Start with: `python live_api.py`

Then open `dashboard.html` in your browser and start analyzing!
