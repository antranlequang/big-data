#!/usr/bin/env python3
"""
Test script for online_forecasting.py
Run this to test the forecasting service for a specific coin
"""

import sys
import os
import json

# Add lib directory to path
lib_path = os.path.join(os.path.dirname(__file__), 'lib')
if lib_path not in sys.path:
    sys.path.insert(0, lib_path)

from lib.online_forecasting import OnlineForecastingService

def main():
    """Test the forecasting service"""
    # Get coin ID from command line or use default
    coin_id = sys.argv[1] if len(sys.argv) > 1 else 'bitcoin'
    
    print("=" * 60)
    print("🧪 Testing Online Forecasting Service")
    print(f"📊 Coin: {coin_id}")
    print("=" * 60)
    
    try:
        # Initialize service
        service = OnlineForecastingService()
        
        # Process and forecast
        print(f"\n🔄 Processing data for {coin_id}...")
        result = service.process_and_forecast(coin_id)
        
        if result:
            print("\n✅ Forecast generated successfully!")
            print("\n📊 Results:")
            print(f"   Current Price: ${result['current_price']:,.2f}")
            print(f"   Historical Points: {len(result['historical_prices'])}")
            print(f"   Forecast Points: {len(result['forecasts'])}")
            
            print("\n🔮 Forecasts (next 5 minutes):")
            for forecast in result['forecasts']:
                change_pct = ((forecast['forecast_price'] - result['current_price']) / result['current_price']) * 100
                print(f"   +{forecast['minute']}min: ${forecast['forecast_price']:,.2f} ({change_pct:+.2f}%)")
            
            print("\n📄 Full JSON result:")
            print(json.dumps(result, indent=2))
        else:
            print("\n❌ Failed to generate forecast")
            print("   Make sure:")
            print("   1. MinIO is running")
            print("   2. Data files exist in MinIO (top50_*.csv)")
            print("   3. The coin ID is correct")
        
        # Clean up
        service.close()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

