#!/usr/bin/env python3
"""
Candle Data Daily Scheduler
Handles automatic daily updates of 6-month candle data for all coins
"""

import schedule
import time
import json
from datetime import datetime, timedelta
from candle_data_manager import CandleDataManager
import logging
import threading

class CandleScheduler:
    def __init__(self, top_coins_count=50):
        """Initialize the candle data scheduler"""
        self.manager = CandleDataManager()
        self.top_coins_count = top_coins_count
        self.is_running = False
        self.thread = None
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('candle_scheduler.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        print("📅 Candle Data Scheduler initialized")

    def get_top_coins_list(self):
        """Get list of top coins to update"""
        # Default top coins list (can be customized)
        top_coins = [
            'bitcoin', 'ethereum', 'binancecoin', 'ripple', 'cardano',
            'solana', 'dogecoin', 'polygon', 'litecoin', 'chainlink',
            'bitcoin-cash', 'avalanche-2', 'uniswap', 'cosmos', 'algorand',
            'stellar', 'vechain', 'internet-computer', 'filecoin', 'tron',
            'ethereum-classic', 'monero', 'eos', 'aave', 'maker',
            'compound', 'yearn-finance', 'sushiswap', 'curve-dao-token', 
            'synthetix-network-token', 'uma', 'loopring', 'ren', 
            'kyber-network-crystal', 'balancer', 'bancor', 'ocean-protocol',
            'the-graph', 'livepeer', 'numeraire', 'augur', 'storj',
            'basic-attention-token', '0x', 'civic', 'district0x', 
            'golem', 'request-network', 'aragon', 'status'
        ]
        
        return top_coins[:self.top_coins_count]

    def daily_update_job(self):
        """Main daily update job"""
        self.logger.info("🔄 Starting daily candle data update job")
        
        try:
            # Get list of coins to update
            coin_ids = self.get_top_coins_list()
            self.logger.info(f"📊 Updating candle data for {len(coin_ids)} coins")
            
            # Perform bulk update
            results = self.manager.bulk_update_candle_data(coin_ids)
            
            # Log results
            success_count = sum(1 for success in results.values() if success)
            fail_count = len(coin_ids) - success_count
            
            self.logger.info(f"✅ Daily update completed: {success_count} successful, {fail_count} failed")
            
            # Log failed updates
            failed_coins = [coin for coin, success in results.items() if not success]
            if failed_coins:
                self.logger.warning(f"❌ Failed updates: {', '.join(failed_coins)}")
            
            # Save update summary
            self.save_update_summary(results)
            
            return results
            
        except Exception as e:
            self.logger.error(f"❌ Daily update job failed: {e}")
            return {}

    def save_update_summary(self, results):
        """Save update summary to file"""
        try:
            summary = {
                'timestamp': datetime.now().isoformat(),
                'total_coins': len(results),
                'successful': sum(1 for success in results.values() if success),
                'failed': sum(1 for success in results.values() if not success),
                'results': results
            }
            
            with open('candle_update_summary.json', 'w') as f:
                json.dump(summary, f, indent=2)
                
            self.logger.info("📄 Update summary saved to candle_update_summary.json")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to save update summary: {e}")

    def setup_schedule(self):
        """Setup the daily schedule"""
        # Schedule daily update at 2 AM (to avoid peak API usage)
        schedule.every().day.at("02:00").do(self.daily_update_job)
        
        # Also schedule a backup update at 2 PM in case morning update fails
        schedule.every().day.at("14:00").do(self.backup_update_job)
        
        self.logger.info("📅 Schedule configured: Daily updates at 2:00 AM and 2:00 PM")

    def backup_update_job(self):
        """Backup update job - only update coins that failed in the morning"""
        self.logger.info("🔄 Starting backup update job")
        
        try:
            # Check if morning update was successful
            try:
                with open('candle_update_summary.json', 'r') as f:
                    last_summary = json.load(f)
                    
                last_update = datetime.fromisoformat(last_summary['timestamp'])
                if last_update.date() == datetime.now().date() and last_summary['failed'] == 0:
                    self.logger.info("✅ Morning update was successful, skipping backup")
                    return
                    
                # Update only failed coins
                failed_coins = [coin for coin, success in last_summary['results'].items() if not success]
                
                if failed_coins:
                    self.logger.info(f"🔄 Retrying {len(failed_coins)} failed coins")
                    results = self.manager.bulk_update_candle_data(failed_coins)
                    self.save_backup_summary(results)
                else:
                    self.logger.info("✅ No failed coins to retry")
                    
            except FileNotFoundError:
                # No summary file, run full backup update
                self.daily_update_job()
                
        except Exception as e:
            self.logger.error(f"❌ Backup update job failed: {e}")

    def save_backup_summary(self, results):
        """Save backup update summary"""
        try:
            summary = {
                'timestamp': datetime.now().isoformat(),
                'type': 'backup_update',
                'total_coins': len(results),
                'successful': sum(1 for success in results.values() if success),
                'failed': sum(1 for success in results.values() if not success),
                'results': results
            }
            
            with open('candle_backup_summary.json', 'w') as f:
                json.dump(summary, f, indent=2)
                
            self.logger.info("📄 Backup summary saved")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to save backup summary: {e}")

    def run_scheduler(self):
        """Run the scheduler in a loop"""
        self.is_running = True
        self.logger.info("🚀 Candle data scheduler started")
        
        while self.is_running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except KeyboardInterrupt:
                self.logger.info("⏹️ Scheduler stopped by user")
                break
            except Exception as e:
                self.logger.error(f"❌ Scheduler error: {e}")
                time.sleep(300)  # Wait 5 minutes before retrying

    def start_background(self):
        """Start scheduler in background thread"""
        if not self.is_running:
            self.thread = threading.Thread(target=self.run_scheduler, daemon=True)
            self.thread.start()
            self.logger.info("🎯 Scheduler started in background")
        else:
            self.logger.warning("⚠️ Scheduler is already running")

    def stop(self):
        """Stop the scheduler"""
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        self.logger.info("⏹️ Scheduler stopped")

    def manual_update(self, coin_ids=None):
        """Manually trigger an update"""
        if coin_ids is None:
            coin_ids = self.get_top_coins_list()
            
        self.logger.info(f"🔄 Manual update triggered for {len(coin_ids)} coins")
        results = self.manager.bulk_update_candle_data(coin_ids)
        self.save_manual_summary(results)
        return results

    def save_manual_summary(self, results):
        """Save manual update summary"""
        try:
            summary = {
                'timestamp': datetime.now().isoformat(),
                'type': 'manual_update',
                'total_coins': len(results),
                'successful': sum(1 for success in results.values() if success),
                'failed': sum(1 for success in results.values() if not success),
                'results': results
            }
            
            with open('candle_manual_summary.json', 'w') as f:
                json.dump(summary, f, indent=2)
                
            self.logger.info("📄 Manual update summary saved")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to save manual summary: {e}")

    def get_status(self):
        """Get scheduler status"""
        return {
            'is_running': self.is_running,
            'next_run': str(schedule.next_run()) if schedule.jobs else None,
            'jobs_count': len(schedule.jobs),
            'top_coins_count': self.top_coins_count
        }

def main():
    """Main function to run the scheduler"""
    scheduler = CandleScheduler(top_coins_count=50)
    
    try:
        # Setup schedule
        scheduler.setup_schedule()
        
        # Run initial update if needed
        print("🔄 Running initial update check...")
        scheduler.manual_update()
        
        # Start scheduler
        scheduler.run_scheduler()
        
    except KeyboardInterrupt:
        print("\n⏹️ Shutting down scheduler...")
    finally:
        scheduler.stop()

if __name__ == "__main__":
    main()