"""
Live Crypto Advisor API using CoinGecko Free API
No API key required - uses public endpoints
"""

from flask import Flask, jsonify, request
from datetime import datetime
import json
import random
import time
import urllib.request
import urllib.error

app = Flask(__name__)

class LiveCryptoAdvisor:
    def __init__(self):
        self.base_url = "https://api.coingecko.com/api/v3"
        
    def fetch_coingecko(self, endpoint):
        """Fetch data from CoinGecko API"""
        try:
            url = f"{self.base_url}{endpoint}"
            with urllib.request.urlopen(url, timeout=10) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code}: {e.reason}")
            return None
        except Exception as e:
            print(f"Error fetching from CoinGecko: {e}")
            return None
    
    def get_market_data(self, coin_id):
        """Get current market data for a coin"""
        endpoint = f"/coins/{coin_id}?localization=false&tickers=false&community_data=true&developer_data=false&sparkline=false"
        return self.fetch_coingecko(endpoint)
    
    def get_price_change(self, coin_id):
        """Get price change data"""
        data = self.get_market_data(coin_id)
        if not data:
            return None
        
        market_data = data.get('market_data', {})
        return {
            'current_price': market_data.get('current_price', {}).get('usd', 0),
            'price_change_24h': market_data.get('price_change_percentage_24h', 0),
            'price_change_7d': market_data.get('price_change_percentage_7d', 0),
            'price_change_30d': market_data.get('price_change_percentage_30d', 0),
            'volume_24h': market_data.get('total_volume', {}).get('usd', 0),
            'market_cap': market_data.get('market_cap', {}).get('usd', 0),
            'market_cap_rank': data.get('market_cap_rank', 0)
        }
    
    def analyze_market_structure(self, price_data):
        """Analyze market structure based on price changes"""
        if not price_data:
            return {'signal': 'No data', 'confidence': 0, 'sentiment': 'neutral'}
        
        change_7d = price_data['price_change_7d']
        change_30d = price_data['price_change_30d']
        
        # Determine trend
        if change_7d > 5 and change_30d > 10:
            signal = "Strong uptrend"
            sentiment = "bullish"
            confidence = 0.8
        elif change_7d > 0 and change_30d > 0:
            signal = "Uptrend"
            sentiment = "bullish"
            confidence = 0.65
        elif change_7d < -5 and change_30d < -10:
            signal = "Strong downtrend"
            sentiment = "bearish"
            confidence = 0.8
        elif change_7d < 0 and change_30d < 0:
            signal = "Downtrend"
            sentiment = "bearish"
            confidence = 0.65
        else:
            signal = "Consolidation"
            sentiment = "neutral"
            confidence = 0.7
        
        return {
            'name': 'Market Structure Agent',
            'signal': signal,
            'confidence': confidence,
            'sentiment': sentiment,
            'details': f"7d: {change_7d:.1f}%, 30d: {change_30d:.1f}% | Volume: ${price_data['volume_24h']/1e9:.2f}B"
        }
    
    def analyze_momentum(self, price_data):
        """Analyze price momentum"""
        if not price_data:
            return {'signal': 'No data', 'confidence': 0, 'sentiment': 'neutral'}
        
        change_24h = price_data['price_change_24h']
        change_7d = price_data['price_change_7d']
        
        # Check momentum alignment
        if change_24h > 0 and change_7d > 0:
            signal = "Positive momentum"
            sentiment = "bullish"
            confidence = 0.75
        elif change_24h < 0 and change_7d < 0:
            signal = "Negative momentum"
            sentiment = "bearish"
            confidence = 0.75
        else:
            signal = "Mixed momentum"
            sentiment = "neutral"
            confidence = 0.6
        
        return {
            'name': 'Momentum Agent',
            'signal': signal,
            'confidence': confidence,
            'sentiment': sentiment,
            'details': f"24h: {change_24h:.1f}%, Price: ${price_data['current_price']:,.2f}"
        }
    
    def analyze_market_cap(self, price_data):
        """Analyze market cap position"""
        if not price_data:
            return {'signal': 'No data', 'confidence': 0, 'sentiment': 'neutral'}
        
        rank = price_data['market_cap_rank']
        market_cap = price_data['market_cap']
        
        if rank <= 10:
            signal = "Top tier asset - high liquidity"
            sentiment = "bullish"
            confidence = 0.85
        elif rank <= 50:
            signal = "Major asset - good liquidity"
            sentiment = "neutral"
            confidence = 0.75
        else:
            signal = "Mid-cap asset - moderate risk"
            sentiment = "neutral"
            confidence = 0.6
        
        return {
            'name': 'Market Position Agent',
            'signal': signal,
            'confidence': confidence,
            'sentiment': sentiment,
            'details': f"Rank: #{rank} | Market Cap: ${market_cap/1e9:.2f}B"
        }
    
    def analyze_volatility(self, price_data):
        """Analyze price volatility"""
        if not price_data:
            return {'signal': 'No data', 'confidence': 0, 'sentiment': 'neutral'}
        
        change_24h = abs(price_data['price_change_24h'])
        change_7d = abs(price_data['price_change_7d'])
        
        # Assess volatility
        if change_24h > 10 or change_7d > 20:
            signal = "High volatility - elevated risk"
            sentiment = "bearish"
            confidence = 0.8
        elif change_24h > 5 or change_7d > 10:
            signal = "Moderate volatility"
            sentiment = "neutral"
            confidence = 0.7
        else:
            signal = "Low volatility - stable"
            sentiment = "bullish"
            confidence = 0.75
        
        return {
            'name': 'Volatility Risk Agent',
            'signal': signal,
            'confidence': confidence,
            'sentiment': sentiment,
            'details': f"24h swing: {change_24h:.1f}%, 7d swing: {change_7d:.1f}%"
        }
    
    def synthesize_regime(self, agents):
        """Determine overall market regime from agent outputs"""
        bullish_count = sum(1 for a in agents if a['sentiment'] == 'bullish')
        bearish_count = sum(1 for a in agents if a['sentiment'] == 'bearish')
        
        if bullish_count > bearish_count + 1:
            regime = 'Risk-On'
        elif bearish_count > bullish_count + 1:
            regime = 'Risk-Off'
        else:
            regime = 'Neutral'
        
        avg_confidence = sum(a['confidence'] for a in agents) / len(agents)
        
        if avg_confidence > 0.75:
            risk_level = 'Low'
        elif avg_confidence > 0.6:
            risk_level = 'Medium'
        else:
            risk_level = 'High'
        
        return regime, avg_confidence, risk_level
    
    def analyze_asset(self, asset):
        """Perform full analysis on an asset"""
        # Map asset symbols to CoinGecko IDs
        coin_map = {
            'btc': 'bitcoin',
            'eth': 'ethereum',
            'sol': 'solana'
        }
        
        coin_id = coin_map.get(asset.lower())
        if not coin_id:
            return None
        
        # Fetch real market data
        price_data = self.get_price_change(coin_id)
        if not price_data:
            return None
        
        # Run all agents
        agents = [
            self.analyze_market_structure(price_data),
            self.analyze_momentum(price_data),
            self.analyze_market_cap(price_data),
            self.analyze_volatility(price_data)
        ]
        
        # Synthesize regime
        regime, confidence, risk_level = self.synthesize_regime(agents)
        
        return {
            'timestamp': datetime.now().isoformat(),
            'asset': asset.upper(),
            'regime': regime,
            'confidence': confidence,
            'risk_level': risk_level,
            'agents': agents,
            'price_data': price_data
        }
    
    def run_backtest(self, asset, steps):
        """Simulate backtest (synthetic for now)"""
        equity_curve = []
        value = 100
        for _ in range(steps):
            value += (random.random() - 0.45) * 2
            equity_curve.append(round(value, 2))
        
        accuracy = 0.65 + random.random() * 0.20
        false_pos = 0.10 + random.random() * 0.15
        
        return {
            'timestamp': datetime.now().isoformat(),
            'asset': asset.upper(),
            'steps': steps,
            'metrics': {
                'accuracy': accuracy,
                'false_positive_rate': false_pos,
                'true_positive_rate': 1 - false_pos,
                'regime_changes_detected': int(steps * 0.15),
                'total_signals': int(steps * 0.3)
            },
            'equity_curve': equity_curve
        }

# Initialize advisor
advisor = LiveCryptoAdvisor()

@app.route('/')
def home():
    return jsonify({
        'name': 'Live Crypto Advisor API',
        'version': '1.0.0',
        'status': 'running',
        'data_source': 'CoinGecko Free API',
        'note': 'Real market data, no API key required'
    })

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'system_initialized': True,
        'data_source': 'live'
    })

@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify({
        'assets': [
            {'symbol': 'btc', 'name': 'Bitcoin', 'enabled': True},
            {'symbol': 'eth', 'name': 'Ethereum', 'enabled': True},
            {'symbol': 'sol', 'name': 'Solana', 'enabled': True}
        ],
        'agents': {
            'market_structure': True,
            'momentum': True,
            'market_position': True,
            'volatility_risk': True
        },
        'discord_enabled': False
    })

@app.route('/api/analyze/<asset>', methods=['POST'])
def analyze(asset):
    """Run live analysis for asset"""
    asset = asset.lower()
    
    if asset not in ['btc', 'eth', 'sol']:
        return jsonify({'error': 'Invalid asset. Supported: btc, eth, sol'}), 400
    
    result = advisor.analyze_asset(asset)
    
    if not result:
        return jsonify({'error': 'Failed to fetch market data from CoinGecko'}), 500
    
    return jsonify(result)

@app.route('/api/backtest', methods=['POST'])
def backtest():
    """Run backtest"""
    data = request.get_json()
    
    if not data or 'asset' not in data:
        return jsonify({'error': 'Missing asset parameter'}), 400
    
    asset = data['asset'].lower()
    steps = data.get('steps', 100)
    
    if asset not in ['btc', 'eth', 'sol']:
        return jsonify({'error': 'Invalid asset'}), 400
    
    result = advisor.run_backtest(asset, steps)
    return jsonify(result)

@app.route('/api/assets', methods=['GET'])
def list_assets():
    return jsonify({
        'assets': [
            {'symbol': 'btc', 'name': 'Bitcoin', 'enabled': True},
            {'symbol': 'eth', 'name': 'Ethereum', 'enabled': True},
            {'symbol': 'sol', 'name': 'Solana', 'enabled': True}
        ]
    })

# CORS headers
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

if __name__ == '__main__':
    print("=" * 70)
    print("🚀 LIVE Crypto Advisor API Server")
    print("=" * 70)
    print("✓ Using REAL CoinGecko data (no API key needed)")
    print("✓ 3 assets: BTC, ETH, SOL")
    print("✓ 4 analysis agents with live market data")
    print("\nEndpoints:")
    print("  GET  /api/health      - System status")
    print("  GET  /api/config      - Configuration")
    print("  POST /api/analyze/btc - Run live analysis")
    print("  POST /api/backtest    - Run backtest")
    print("\nServer starting on http://0.0.0.0:5000")
    print("Open dashboard.html in your browser to use the interface!")
    print("=" * 70)
    
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
