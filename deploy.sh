#!/bin/bash

# Crypto Advisor Deployment Script
# Run this to set up and start the system automatically

echo "============================================================"
echo "🚀 Crypto Advisor Deployment Script"
echo "============================================================"
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.7 or higher."
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"
echo ""

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip."
    exit 1
fi

echo "✓ pip3 found"
echo ""

# Install Flask if not already installed
echo "📦 Installing dependencies..."
pip3 install flask --quiet --user 2>/dev/null || pip3 install flask --quiet

if [ $? -eq 0 ]; then
    echo "✓ Flask installed successfully"
else
    echo "⚠️  Flask installation warning (may already be installed)"
fi

echo ""
echo "============================================================"
echo "Choose your deployment option:"
echo "============================================================"
echo ""
echo "1. Enhanced API (Recommended) - 14 coins, 8 agents"
echo "2. Simple API - 3 coins, 4 agents (faster)"
echo "3. Demo Mode - No backend needed"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting Enhanced API Server..."
        echo ""
        python3 enhanced_api.py
        ;;
    2)
        echo ""
        echo "🚀 Starting Simple API Server..."
        echo ""
        python3 live_api.py
        ;;
    3)
        echo ""
        echo "📱 Opening Demo Dashboard..."
        echo ""
        echo "Please open demo-dashboard.html in your web browser"
        echo ""
        if command -v open &> /dev/null; then
            open demo-dashboard.html
        elif command -v xdg-open &> /dev/null; then
            xdg-open demo-dashboard.html
        else
            echo "Path: $(pwd)/demo-dashboard.html"
        fi
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac
