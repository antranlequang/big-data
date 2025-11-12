#!/usr/bin/env python3
"""
Candle Chart Data Manager
Handles 6-month OHLCV data retrieval, storage, and daily updates for candle charts
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from minio import Minio
from minio.error import S3Error
import requests
import io
from typing import Dict, List, Optional, Tuple
import time
import logging

class CandleDataManager:
    def __init__(self):
        """Initialize candle data manager with MinIO and API connections"""
        self.minio_client = Minio(
            '127.0.0.1:9000',
            access_key='bankuser',
            secret_key='BankPass123!',
            secure=False
        )
        self.bucket_name = 'crypto-candle-data'
        self.coingecko_base_url = "https://api.coingecko.com/api/v3"
        self.rate_limit_delay = 1.2
        self.logger = logging.getLogger(__name__)
        # Ensure bucket exists
        self._ensure_bucket_exists()
        self.logger.info("🕯️ Candle Data Manager initialized")

    def _ensure_bucket_exists(self):
        """Ensure MinIO bucket exists for candle data"""
        try:
            if not self.minio_client.bucket_exists(self.bucket_name):
                self.minio_client.make_bucket(self.bucket_name)
                self.logger.info(f"Created MinIO bucket: {self.bucket_name}")
            else:
                self.logger.debug(f"MinIO bucket exists: {self.bucket_name}")
        except Exception as e:
            self.logger.error(f"MinIO bucket error: {e}")

    def get_6_month_date_range(self) -> Tuple[datetime, datetime]:
        """Get 6-month date range from yesterday going back"""
        today = datetime.now()
        yesterday = today - timedelta(days=1)
        six_months_ago = yesterday - timedelta(days=180)  # 6 months = ~180 days
        return six_months_ago, yesterday

    def fetch_ohlcv_from_binance(self, symbol: str, interval: str = '1d', limit: int = 180):
        """
        Fetch historical OHLCV candle data from Binance API
        symbol: e.g. 'BTCUSDT', 'ETHUSDT'
        interval: '1m', '5m', '1h', '1d', ...
        limit: number of candles (max 1000)
        """
        self.logger.info(f"📊 Fetching {limit} {interval} candles for {symbol} from Binance...")

        try:
            url = "https://api.binance.com/api/v3/klines"
            params = {
                "symbol": symbol.upper(),
                "interval": interval,
                "limit": limit
            }
            response = requests.get(url, params=params, timeout=30)

            if response.status_code != 200:
                self.logger.error(f"❌ Binance request failed: {response.status_code}")
                return None

            raw_data = response.json()

            candle_data = []
            for k in raw_data:
                candle_data.append({
                    "timestamp": k[0],
                    "date": datetime.fromtimestamp(k[0] / 1000).strftime("%Y-%m-%d"),
                    "open": float(k[1]),
                    "high": float(k[2]),
                    "low": float(k[3]),
                    "close": float(k[4]),
                    "volume": float(k[5]),
                    "symbol": symbol
                })

            self.logger.info(f"✅ Retrieved {len(candle_data)} candles for {symbol}")
            return candle_data

        except Exception as e:
            self.logger.error(f"❌ Error fetching data from Binance for {symbol}: {e}")
            return None

    def save_candle_data_to_minio(self, coin_id: str, candle_data: List[Dict]) -> bool:
        """Save 6-month candle data to MinIO"""
        try:
            if not candle_data:
                self.logger.error(f"❌ No candle data to save for {coin_id}")
                return False
            
            start_date, end_date = self.get_6_month_date_range()
            filename = f"candle_6m/{coin_id}_6m_{datetime.now().strftime('%Y%m%d')}.json"
            
            # Prepare data package with metadata
            data_package = {
                'coin_id': coin_id,
                'period': '6m',
                'data_points': len(candle_data),
                'date_range': {
                    'start': start_date.strftime('%Y-%m-%d'),
                    'end': end_date.strftime('%Y-%m-%d')
                },
                'fetched_at': datetime.now().isoformat(),
                'next_update': (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
                'candle_data': candle_data
            }
            
            # Convert to JSON
            json_data = json.dumps(data_package, indent=2)
            json_bytes = json_data.encode('utf-8')
            
            # Upload to MinIO (this will overwrite existing data)
            self.minio_client.put_object(
                self.bucket_name,
                filename,
                io.BytesIO(json_bytes),
                len(json_bytes),
                content_type='application/json'
            )
            
            self.logger.info(f"💾 Saved {len(candle_data)} candle records to MinIO: {filename}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Error saving candle data to MinIO: {e}")
            return False

    def get_candle_data_from_minio(self, coin_id: str) -> Optional[Dict]:
        """Retrieve candle data from MinIO"""
        try:
            # Look for today's file first
            today_filename = f"candle_6m/{coin_id}_6m_{datetime.now().strftime('%Y%m%d')}.json"
            
            try:
                response = self.minio_client.get_object(self.bucket_name, today_filename)
                data = json.loads(response.read().decode('utf-8'))
                self.logger.info(f"📥 Retrieved today's candle data for {coin_id}")
                return data
            except S3Error as e:
                if e.code != 'NoSuchKey':
                    raise e
            
            # If today's file doesn't exist, look for yesterday's file
            yesterday_filename = f"candle_6m/{coin_id}_6m_{(datetime.now() - timedelta(days=1)).strftime('%Y%m%d')}.json"
            
            try:
                response = self.minio_client.get_object(self.bucket_name, yesterday_filename)
                data = json.loads(response.read().decode('utf-8'))
                self.logger.info(f"📥 Retrieved yesterday's candle data for {coin_id}")
                return data
            except S3Error as e:
                if e.code != 'NoSuchKey':
                    raise e
            
            self.logger.warning(f"📭 No candle data found for {coin_id}")
            return None
            
        except Exception as e:
            self.logger.error(f"❌ Error retrieving candle data: {e}")
            return None

    def needs_daily_update(self, coin_id: str) -> bool:
        """Check if daily update is needed for candle data"""
        try:
            data = self.get_candle_data_from_minio(coin_id)
            
            if not data:
                self.logger.info(f"📅 No existing data found for {coin_id}, update needed")
                return True
            
            # Check if data is from today
            fetched_date = datetime.fromisoformat(data['fetched_at']).date()
            today = datetime.now().date()
            
            if fetched_date < today:
                self.logger.info(f"📅 Data for {coin_id} is from {fetched_date}, update needed")
                return True
            
            self.logger.info(f"📅 Data for {coin_id} is current ({fetched_date})")
            return False
            
        except Exception as e:
            self.logger.error(f"❌ Error checking update status: {e}")
            return True  # Default to needing update on error

    def update_daily_candle_data(self, coin_id: str) -> bool:
        """Perform daily update of 6-month candle data"""
        self.logger.info(f"🔄 Starting daily candle data update for {coin_id}...")
        
        try:
            # Check if update is needed
            if not self.needs_daily_update(coin_id):
                self.logger.info(f"⏭️ No update needed for {coin_id}")
                return True
            
            # Convert coin_id (like 'bitcoin') → Binance symbol (e.g. 'BTCUSDT')
            symbol_map = {
                'bitcoin': 'BTCUSDT',
                'ethereum': 'ETHUSDT',
                'binancecoin': 'BNBUSDT',
                'solana': 'SOLUSDT',
                'cardano': 'ADAUSDT',
                'dogecoin': 'DOGEUSDT',
                'polygon': 'MATICUSDT',
                'avalanche-2': 'AVAXUSDT',
                'chainlink': 'LINKUSDT',
                'polkadot': 'DOTUSDT',
                'litecoin': 'LTCUSDT',
                'bitcoin-cash': 'BCHUSDT',
                'stellar': 'XLMUSDT',
                'tron': 'TRXUSDT',
                'ethereum-classic': 'ETCUSDT',
                'monero': 'XMRUSDT',
                'dash': 'DASHUSDT',
                'zcash': 'ZECUSDT',
                'ripple': 'XRPUSDT',
                'tether': 'USDTUSDT'  # tether chỉ là stablecoin, vẫn để đồng bộ logic
            }
            symbol = symbol_map.get(coin_id.lower(), f"{coin_id.upper()}USDT")

            candle_data = self.fetch_ohlcv_from_binance(symbol)
            
            if not candle_data:
                self.logger.error(f"❌ Failed to fetch candle data for {coin_id}")
                return False
            
            # Save to MinIO (overwrites old data)
            success = self.save_candle_data_to_minio(coin_id, candle_data)
            
            if success:
                self.logger.info(f"✅ Daily update completed for {coin_id}")
                return True
            else:
                self.logger.error(f"❌ Failed to save updated data for {coin_id}")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Error during daily update for {coin_id}: {e}")
            return False

    def bulk_update_candle_data(self, coin_ids: List[str]) -> Dict[str, bool]:
        """Perform bulk daily update for multiple coins"""
        self.logger.info(f"🔄 Starting bulk candle data update for {len(coin_ids)} coins...")
        
        results = {}
        
        for i, coin_id in enumerate(coin_ids, 1):
            self.logger.info(f"📊 Processing coin {i}/{len(coin_ids)}: {coin_id}")
            try:
                results[coin_id] = self.update_daily_candle_data(coin_id)
                # Rate limiting between requests
                if i < len(coin_ids):
                    time.sleep(self.rate_limit_delay)
            except Exception as e:
                self.logger.error(f"❌ Error processing {coin_id}: {e}")
                results[coin_id] = False
        
        success_count = sum(1 for success in results.values() if success)
        self.logger.info(f"✅ Bulk update completed: {success_count}/{len(coin_ids)} successful")
        
        return results

    def list_available_candle_data(self) -> List[Dict]:
        """List all available candle data files in MinIO"""
        try:
            objects = self.minio_client.list_objects(
                self.bucket_name,
                prefix="candle_6m/",
                recursive=True
            )
            
            files = []
            for obj in objects:
                if obj.object_name.endswith('.json'):
                    # Parse filename: candle_6m/bitcoin_6m_20241106.json
                    parts = obj.object_name.replace('candle_6m/', '').replace('.json', '').split('_')
                    if len(parts) >= 3:
                        coin_id = '_'.join(parts[:-2])
                        period = parts[-2]
                        date_str = parts[-1]
                        
                        files.append({
                            'coin_id': coin_id,
                            'period': period,
                            'date': date_str,
                            'filename': obj.object_name,
                            'last_modified': obj.last_modified
                        })
            
            return sorted(files, key=lambda x: x['last_modified'], reverse=True)
            
        except Exception as e:
            self.logger.error(f"❌ Error listing candle data: {e}")
            return []

def main():
    """Test the candle data manager"""
    import logging
    logging.basicConfig(level=logging.INFO)
    manager = CandleDataManager()
    # Test with Bitcoin
    manager.logger.info("Testing candle data manager with Bitcoin...")
    # Update daily data
    success = manager.update_daily_candle_data('bitcoin')
    if success:
        # Retrieve the data
        data = manager.get_candle_data_from_minio('bitcoin')
        if data:
            manager.logger.info(f"✅ Test successful! Retrieved {data['data_points']} candle records")
            manager.logger.info(f"📅 Date range: {data['date_range']['start']} to {data['date_range']['end']}")
        else:
            manager.logger.error("❌ Could not retrieve saved candle data")
    else:
        manager.logger.error("❌ Test failed")

if __name__ == "__main__":
    main()