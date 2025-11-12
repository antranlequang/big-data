#!/usr/bin/env python3
"""
Start Candle Data Service
Initializes and starts the daily candle data update service
"""

import sys
import os
import argparse
from datetime import datetime
import requests

# Logging config
import logging

logging.basicConfig(
    filename="candle_service.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# Add lib directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'lib'))

from lib.candle_scheduler import CandleScheduler

def main():
    """Main function to start the candle data service"""
    parser = argparse.ArgumentParser(description='Candle Data Service Manager')
    parser.add_argument('--action', choices=['start', 'manual', 'status'], default='start',
                       help='Action to perform (default: start)')
    parser.add_argument('--coins', type=int, default=50,
                       help='Number of top coins to track (default: 50)')
    parser.add_argument('--coin-ids', nargs='+',
                       help='Specific coin IDs to update (for manual action)')

    args = parser.parse_args()

    logger.info("🕯️ Candle Data Service Manager")
    logger.info(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"🎯 Action: {args.action}")
    logger.info(f"📊 Tracking top {args.coins} coins")
    logger.info("-" * 50)

    # Initialize scheduler
    scheduler = CandleScheduler(top_coins_count=args.coins)

    try:
        if args.action == 'start':
            logger.info("🚀 Starting candle data service...")

            # Setup schedule
            scheduler.setup_schedule()

            # Run initial update
            logger.info("🔄 Performing initial data update...")
            results = scheduler.manual_update()

            success_count = sum(1 for success in results.values() if success)
            logger.info(f"✅ Initial update completed: {success_count}/{len(results)} successful")

            # Start scheduler
            logger.info("📅 Starting daily scheduler...")
            scheduler.run_scheduler()

        elif args.action == 'manual':
            coin_ids = args.coin_ids if args.coin_ids else None
            results = scheduler.manual_update(coin_ids)

            # ✅ Trả JSON hợp lệ duy nhất về dashboard
            import json
            print(json.dumps({"status": "success", "results": results}, ensure_ascii=False))
            return
            # The following lines are commented out to avoid printing non-JSON logs to stdout
            # success_count = sum(1 for success in results.values() if success)
            # print(f"✅ Manual update completed: {success_count}/{len(results)} successful")
            # for coin_id, success in results.items():
            #     status = "✅" if success else "❌"
            #     print(f"  {status} {coin_id}")

        elif args.action == 'status':
            logger.info("📊 Service status:")
            status = scheduler.get_status()

            for key, value in status.items():
                logger.info(f"  {key}: {value}")

            # Try to load last update summary
            try:
                import json
                with open('candle_update_summary.json', 'r') as f:
                    summary = json.load(f)

                logger.info(f"\n📄 Last update:")
                logger.info(f"  Time: {summary['timestamp']}")
                logger.info(f"  Total: {summary['total_coins']}")
                logger.info(f"  Successful: {summary['successful']}")
                logger.info(f"  Failed: {summary['failed']}")

            except FileNotFoundError:
                logger.info("\n📄 No update summary found")
            except Exception as e:
                logger.error(f"\n❌ Error reading update summary: {e}")

    except KeyboardInterrupt:
        logger.info("⏹️ Service stopped by user")
    except Exception as e:
        logger.error(f"❌ Service error: {e}")
    finally:
        scheduler.stop()
        logger.info("🛑 Candle data service shutdown complete")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import json
        print(json.dumps({"status": "error", "message": str(e)}))