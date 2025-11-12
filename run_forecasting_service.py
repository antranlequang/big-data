#!/usr/bin/env python3
"""
Continuous Forecasting Service
Runs online learning forecasting continuously in the background
"""

import os
import sys
import time
import signal
from datetime import datetime

# Add lib directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'lib'))
sys.path.append(os.path.dirname(__file__))

from lib.online_forecasting import OnlineForecastingService

# Global service instance
service = None

def signal_handler(sig, frame):
    """Handle shutdown signals gracefully"""
    print("\n🛑 Shutting down forecasting service...")
    if service:
        service.close()
    sys.exit(0)

def main():
    """Main function to run continuous forecasting service"""
    global service
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("=" * 60)
    print("🚀 ONLINE LEARNING FORECASTING SERVICE")
    print("📊 Continuous 5-minute price forecasting")
    print("=" * 60)
    
    # Initialize service
    service = OnlineForecastingService()
    
    # Get list of top 50 coin IDs (you can customize this)
    # For now, we'll focus on the most popular coins
    top_coins = [
        'bitcoin', 'ethereum', 'binancecoin', 'solana', 'cardano',
        'dogecoin', 'polygon', 'avalanche-2', 'chainlink', 'polkadot',
        'litecoin', 'bitcoin-cash', 'stellar', 'tron', 'ethereum-classic',
        'monero', 'dash', 'zcash', 'ripple', 'tether'
    ]
    
    print(f"📊 Forecasting for {len(top_coins)} coins")
    print("🔄 Service will run continuously...")
    print("=" * 60)
    
    # Run continuous forecasting
    try:
        service.run_continuous_forecasting(
            coin_ids=top_coins,
            interval_seconds=300  # Update every minute
        )
    except KeyboardInterrupt:
        signal_handler(None, None)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        if service:
            service.close()
        sys.exit(1)

if __name__ == '__main__':
    main()

