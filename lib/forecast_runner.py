#!/usr/bin/env python3
"""
Forecast Runner Script
Called by Next.js API to generate forecasts for a specific coin
"""

import sys
import json
import os

# Add lib directory to path
lib_path = os.path.join(os.path.dirname(__file__))
if lib_path not in sys.path:
    sys.path.insert(0, lib_path)

# Add parent directory to path
parent_path = os.path.dirname(os.path.dirname(__file__))
if parent_path not in sys.path:
    sys.path.insert(0, parent_path)

try:
    from online_forecasting import get_forecasting_service
except ImportError:
    # Try alternative import
    from lib.online_forecasting import get_forecasting_service

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'error': 'Coin ID required'
        }))
        sys.exit(1)
    
    coin_id = sys.argv[1]
    
    try:
        # Suppress console output
        from contextlib import redirect_stderr
        from io import StringIO
        
        stderr_capture = StringIO()
        with redirect_stderr(stderr_capture):
            service = get_forecasting_service(quiet_mode=True)
            result = service.process_and_forecast(coin_id)
        
        if result:
            print(json.dumps(result))
        else:
            print(json.dumps({
                'coin_id': coin_id,
                'current_price': 0,
                'recent_prices': [],
                'forecasts': [],
                'timestamp': None
            }))
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        print(json.dumps({
            'error': error_msg,
            'coin_id': coin_id
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()

