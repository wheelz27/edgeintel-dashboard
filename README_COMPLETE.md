# 🚀 Crypto Advisor - Complete System

A production-ready, multi-agent cryptocurrency analysis system with real market data and beautiful web interface.

## 🎯 What This Is

An **institutional-grade crypto advisor** that:
- ✅ Analyzes 14+ cryptocurrencies with REAL market data
- ✅ Uses 8 specialized AI agents for comprehensive analysis
- ✅ Determines market regime (Risk-On, Risk-Off, Neutral)
- ✅ Provides confidence scores and risk levels
- ✅ No API keys required (uses free CoinGecko API)
- ✅ Beautiful web dashboard with charts
- ✅ Ready to deploy to production

## 📦 What You Get

### Backend APIs
1. **enhanced_api.py** ⭐ RECOMMENDED
   - 14 cryptocurrencies (BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOT, MATIC, LINK, ATOM, NEAR, UNI, ARB)
   - 8 advanced analysis agents
   - Real-time CoinGecko data
   - Comprehensive market analysis

2. **live_api.py** 
   - 3 cryptocurrencies (BTC, ETH, SOL)
   - 4 basic agents
   - Lighter, faster option

3. **api_server.py**
   - Template for connecting to your full crypto_advisor Python backend
   - Use this if you have the complete institutional system

### Frontend
- **dashboard.html** - Professional web interface (connects to API)
- **demo-dashboard.html** - Standalone demo (no backend needed)

### Deployment
- **deploy.sh** - One-command deployment script
- **QUICKSTART.md** - Quick start guide
- **PRODUCTION_DEPLOY.md** - Cloud deployment guide
- **requirements.txt** - Python dependencies

## ⚡ Quick Start (3 Steps)

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Start Server
```bash
# Option A: Use the deployment script
chmod +x deploy.sh
./deploy.sh

# Option B: Start directly
python enhanced_api.py
```

### Step 3: Open Dashboard
Open `dashboard.html` in your web browser

**That's it!** The system is now running with real market data.

## 📊 Supported Cryptocurrencies

| Symbol | Name | Rank |
|--------|------|------|
| BTC | Bitcoin | #1 |
| ETH | Ethereum | #2 |
| SOL | Solana | Top 10 |
| BNB | Binance Coin | Top 5 |
| XRP | Ripple | Top 10 |
| ADA | Cardano | Top 10 |
| AVAX | Avalanche | Top 20 |
| DOT | Polkadot | Top 20 |
| MATIC | Polygon | Top 20 |
| LINK | Chainlink | Top 20 |
| ATOM | Cosmos | Top 30 |
| NEAR | NEAR Protocol | Top 30 |
| UNI | Uniswap | Top 30 |
| ARB | Arbitrum | Top 50 |

## 🤖 Analysis Agents

Each agent specializes in a different aspect of market analysis:

### 1. Market Structure Agent
- **Analyzes**: Multi-timeframe trends (7d, 30d, 200d)
- **Signals**: Strong bullish/bearish, consolidation
- **Output**: Trend direction with confidence

### 2. Momentum Agent
- **Analyzes**: Price momentum across 1h, 24h, 7d
- **Signals**: Strong positive/negative, mixed
- **Output**: Momentum alignment score

### 3. Volume Analysis Agent
- **Analyzes**: Trading volume vs market cap
- **Signals**: High interest, normal, low interest
- **Output**: Liquidity assessment

### 4. Volatility Risk Agent
- **Analyzes**: Daily range, price swings
- **Signals**: Extreme/high/moderate/low volatility
- **Output**: Risk level based on price stability

### 5. Market Position Agent
- **Analyzes**: Market cap rank and dominance
- **Signals**: Top tier, major asset, mid-cap
- **Output**: Liquidity tier classification

### 6. ATH/ATL Analysis Agent
- **Analyzes**: Distance from all-time high/low
- **Signals**: Near ATH, moderate distance, deep pullback
- **Output**: Price position context

### 7. Trend Strength Agent
- **Analyzes**: Multi-timeframe trend alignment
- **Signals**: Very strong/strong/moderate/weak trend
- **Output**: Trend conviction score

### 8. Supply Analysis Agent
- **Analyzes**: Circulating vs total supply
- **Signals**: Fully diluted, inflation risk
- **Output**: Supply dynamics

## 🎯 How It Works

```
1. User selects asset (e.g., BTC)
2. Dashboard calls API: POST /api/analyze/btc
3. API fetches real data from CoinGecko
4. All 8 agents analyze different aspects
5. Risk Synthesis combines agent outputs
6. Returns: Regime + Confidence + Risk Level
7. Dashboard displays results with charts
```

## 📈 Example Analysis Output

```json
{
  "asset": "BTC",
  "regime": "Risk-On",
  "confidence": 0.78,
  "risk_level": "Low",
  "timestamp": "2025-02-11T10:30:00",
  "price_data": {
    "current_price": 97234.50,
    "price_change_24h": 2.3,
    "price_change_7d": 5.1,
    "price_change_30d": 12.4,
    "volume_24h": 28500000000,
    "market_cap": 1920000000000,
    "market_cap_rank": 1
  },
  "agents": [
    {
      "name": "Market Structure Agent",
      "signal": "Bullish structure",
      "confidence": 0.75,
      "sentiment": "bullish",
      "details": "7d: +5.1% | 30d: +12.4% | 200d: +45.2%"
    },
    // ... 7 more agents
  ]
}
```

## 🌐 API Endpoints

```
GET  /                      API info and status
GET  /api/health            System health check
GET  /api/config            Configuration details
GET  /api/assets            List all supported assets
POST /api/analyze/<asset>   Run full analysis
POST /api/backtest          Run historical backtest

Example:
POST http://localhost:5000/api/analyze/btc
```

## 💻 Usage Examples

### Via Dashboard (Recommended)
1. Open dashboard.html
2. Select cryptocurrency
3. Click "Run Advisory Cycle"
4. View real-time analysis

### Via Command Line
```bash
# Analyze Bitcoin
curl -X POST http://localhost:5000/api/analyze/btc

# Analyze Ethereum
curl -X POST http://localhost:5000/api/analyze/eth

# Run backtest
curl -X POST http://localhost:5000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{"asset":"btc","steps":100}'
```

### Via Python
```python
import requests

# Analyze SOL
response = requests.post('http://localhost:5000/api/analyze/sol')
data = response.json()

print(f"Asset: {data['asset']}")
print(f"Regime: {data['regime']}")
print(f"Confidence: {data['confidence']:.1%}")
print(f"Risk Level: {data['risk_level']}")
print(f"Price: ${data['price_data']['current_price']:,.2f}")
```

## 🚀 Deployment Options

### Local (Development)
```bash
python enhanced_api.py
# Access: http://localhost:5000
```

### Cloud (Production)
See `PRODUCTION_DEPLOY.md` for detailed guides:
- Render (FREE)
- Railway ($5/mo)
- DigitalOcean ($5/mo)
- Heroku ($7/mo)
- AWS EC2 (Free tier)
- Custom VPS ($5-10/mo)

## 🔧 Configuration

### Add New Cryptocurrency
Edit `enhanced_api.py`:
```python
self.coin_map = {
    'btc': 'bitcoin',
    'eth': 'ethereum',
    # Add new coin:
    'doge': 'dogecoin',  # Symbol: CoinGecko ID
}
```

### Adjust Agent Weights
Modify `synthesize_regime()` method to weight agents differently:
```python
# Example: Give more weight to momentum
if agent['name'] == 'Momentum Agent':
    weight = agent['confidence'] * 1.5
```

### Change Rate Limits
CoinGecko allows 50 calls/minute. Adjust if needed:
```python
import time
time.sleep(1.2)  # Wait 1.2 seconds between calls
```

## 📊 Data Source

All market data comes from **CoinGecko Free API**:
- ✅ No API key required
- ✅ 50 calls per minute
- ✅ Real-time price data
- ✅ Historical data
- ✅ 10,000+ coins supported
- ✅ Market cap, volume, supply data

## 🛡️ Security & Best Practices

✅ **No API keys stored** - Uses public CoinGecko endpoints  
✅ **CORS enabled** - Safe for web browsers  
✅ **Error handling** - Graceful degradation  
✅ **Rate limiting** - Respects API limits  
✅ **No trade execution** - Analysis only  
✅ **No financial advice** - Educational tool  

## 🎓 Understanding the Output

### Market Regime
- **Risk-On**: Bullish signals dominate, favorable conditions
- **Risk-Off**: Bearish signals dominate, defensive stance
- **Neutral**: Mixed signals, no clear direction

### Confidence Score
- **>75%**: High confidence, strong signal alignment
- **60-75%**: Medium confidence, moderate alignment
- **<60%**: Low confidence, conflicting signals

### Risk Level
- **Low**: Stable conditions, high confidence
- **Medium**: Moderate uncertainty
- **High**: Volatile or conflicting signals

## 🐛 Troubleshooting

**Problem**: Dashboard shows "Disconnected"  
**Solution**: Make sure `enhanced_api.py` is running

**Problem**: "Failed to fetch market data"  
**Solution**: CoinGecko rate limit hit, wait 60 seconds

**Problem**: ModuleNotFoundError: flask  
**Solution**: Run `pip install -r requirements.txt`

**Problem**: Port 5000 already in use  
**Solution**: Change port in `enhanced_api.py`: `app.run(port=8000)`

## 📚 Learn More

- CoinGecko API: https://www.coingecko.com/en/api
- Flask Documentation: https://flask.palletsprojects.com/
- Multi-Agent Systems: https://en.wikipedia.org/wiki/Multi-agent_system

## 🤝 Contributing

Want to add features? Here are ideas:
- [ ] More cryptocurrencies
- [ ] Additional analysis agents
- [ ] Historical data visualization
- [ ] Portfolio tracking
- [ ] Discord/Slack notifications
- [ ] Email alerts
- [ ] Mobile app
- [ ] Database integration
- [ ] User authentication
- [ ] Custom watchlists

## 📄 License

This is a personal/educational project. Use at your own risk.

## ⚠️ Disclaimer

This system provides analysis and insights for educational purposes only. It does NOT:
- Execute trades
- Provide financial advice
- Guarantee investment returns
- Predict future prices

Always do your own research and consult with financial professionals before making investment decisions.

## 🎉 Quick Commands Reference

```bash
# Install
pip install -r requirements.txt

# Run enhanced version (recommended)
python enhanced_api.py

# Run simple version
python live_api.py

# Run with auto-deploy script
./deploy.sh

# Test API
curl http://localhost:5000/api/health

# Analyze Bitcoin
curl -X POST http://localhost:5000/api/analyze/btc
```

---

**Ready to start?** Run `python enhanced_api.py` and open `dashboard.html`! 🚀
