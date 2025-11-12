#!/usr/bin/env python3
"""
Forecast Service Runner
Runs the continuous forecasting service for 50 coins at a time
"""

import os
import sys
import signal
import time
from datetime import datetime

# Add lib directory to path
lib_path = os.path.join(os.path.dirname(__file__), 'lib')
if lib_path not in sys.path:
    sys.path.insert(0, lib_path)

from online_forecasting import OnlineForecastingService

# Global service instance
forecasting_service = None

def signal_handler(sig, frame):
    """Handle shutdown signals gracefully"""
    global forecasting_service
    print("\n🛑 Shutting down forecasting service...")
    
    if forecasting_service:
        forecasting_service.close()
    
    print("✅ Forecasting service stopped")
    sys.exit(0)

def main():
    """Main function to run the forecasting service"""
    global forecasting_service
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)   # Ctrl+C
    signal.signal(signal.SIGTERM, signal_handler)  # Termination signal
    
    print("🚀 Starting Forecast Service for Top 50 Coins")
    print("=" * 60)
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🔮 Processing 50 coins at a time")
    print("💾 Saving forecasts to MinIO with 'forecast_price' filename")
    print("⏱️ Update interval: 60 seconds")
    print("🛑 Press Ctrl+C to stop")
    print("=" * 60)
    
    try:
        # Initialize the forecasting service
        forecasting_service = OnlineForecastingService()
        
        # Start continuous forecasting (will auto-detect top 50 coins)
        forecasting_service.run_continuous_forecasting(
            coin_ids=None,  # Auto-detect from MinIO
            interval_seconds=60
        )
        
    except KeyboardInterrupt:
        print("\n🛑 Received keyboard interrupt")
        signal_handler(None, None)
    except Exception as e:
        print(f"\n❌ Error running forecasting service: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()