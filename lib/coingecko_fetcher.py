#!/usr/bin/env python3
"""
CoinGecko API Data Fetcher
Fetches OHLCV data for top 1000 cryptocurrencies
"""

import os
import sys
import time
import json
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from minio import Minio
from minio.error import S3Error
import io

class CoinGeckoFetcher:
    def __init__(self):
        """Initialize CoinGecko API fetcher"""
        self.base_url = "https://api.coingecko.com/api/v3"
        self.minio_client = Minio(
            '127.0.0.1:9000',
            access_key='bankuser',
            secret_key='BankPass123!',
            secure=False
        )
        self.bucket_name = 'crypto-ohlcv-data'
        self.rate_limit_delay = 1.5  # Seconds between requests to respect API limits
        
        # Ensure bucket exists
        self._ensure_bucket_exists()
        
        print("🚀 CoinGecko Fetcher initialized")

    def _ensure_bucket_exists(self):
        """Ensure MinIO bucket exists"""
        try:
            if not self.minio_client.bucket_exists(self.bucket_name):
                self.minio_client.make_bucket(self.bucket_name)
                print(f"✅ Created MinIO bucket: {self.bucket_name}")
            else:
                print(f"✅ MinIO bucket exists: {self.bucket_name}")
        except Exception as e:
            print(f"❌ MinIO bucket error: {e}")

    def get_top_coins_list(self, limit=1000):
        """Get list of top cryptocurrencies by market cap"""
        print(f"📋 Fetching top {limit} coins list...")
        
        try:
            # CoinGecko supports up to 250 per page
            all_coins = []
            pages_needed = (limit + 249) // 250  # Round up
            
            for page in range(1, pages_needed + 1):
                per_page = min(250, limit - len(all_coins))
                
                url = f"{self.base_url}/coins/markets"
                params = {
                    'vs_currency': 'usd',
                    'order': 'market_cap_desc',
                    'per_page': per_page,
                    'page': page,
                    'sparkline': False,
                    'price_change_percentage': '24h'
                }
                
                print(f"📡 Fetching page {page}/{pages_needed} ({per_page} coins)...")
                response = requests.get(url, params=params, timeout=30)
                
                if response.status_code == 200:
                    coins = response.json()
                    all_coins.extend(coins)
                    print(f"✅ Got {len(coins)} coins from page {page}")
                    
                    # Rate limiting
                    time.sleep(self.rate_limit_delay)
                else:
                    print(f"❌ API request failed: {response.status_code}")
                    break
            
            # Extract coin info
            coin_list = []
            for coin in all_coins[:limit]:
                coin_list.append({
                    'id': coin['id'],
                    'symbol': coin['symbol'].upper(),
                    'name': coin['name'],
                    'market_cap_rank': coin.get('market_cap_rank', 0),
                    'market_cap': coin.get('market_cap', 0),
                    'current_price': coin.get('current_price', 0)
                })
            
            print(f"✅ Retrieved {len(coin_list)} coins")
            return coin_list
            
        except Exception as e:
            print(f"❌ Error fetching coins list: {e}")
            return []

    def get_coin_ohlcv_data(self, coin_id, days=365):
        """Get OHLCV data for a specific coin"""
        print(f"📊 Fetching OHLCV data for {coin_id} ({days} days)...")
        
        try:
            # Get OHLC data
            url = f"{self.base_url}/coins/{coin_id}/ohlc"
            params = {
                'vs_currency': 'usd',
                'days': days
            }
            
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code != 200:
                print(f"❌ OHLC request failed for {coin_id}: {response.status_code}")
                return None
            
            ohlc_data = response.json()
            
            # Also get market chart for volume data
            time.sleep(self.rate_limit_delay)
            
            chart_url = f"{self.base_url}/coins/{coin_id}/market_chart"
            chart_params = {
                'vs_currency': 'usd',
                'days': days,
                'interval': 'daily'
            }
            
            chart_response = requests.get(chart_url, params=chart_params, timeout=30)
            
            if chart_response.status_code != 200:
                print(f"❌ Market chart request failed for {coin_id}: {chart_response.status_code}")
                return None
            
            chart_data = chart_response.json()
            
            # Combine OHLC with volume data
            ohlcv_data = []
            
            # Create volume lookup by date
            volume_data = {}
            if 'total_volumes' in chart_data:
                for timestamp, volume in chart_data['total_volumes']:
                    date_key = datetime.fromtimestamp(timestamp / 1000).strftime('%Y-%m-%d')
                    volume_data[date_key] = volume
            
            # Process OHLC data
            for timestamp, open_price, high_price, low_price, close_price in ohlc_data:
                date = datetime.fromtimestamp(timestamp / 1000)
                date_key = date.strftime('%Y-%m-%d')
                
                ohlcv_data.append({
                    'timestamp': timestamp,
                    'date': date_key,
                    'open': open_price,
                    'high': high_price,
                    'low': low_price,
                    'close': close_price,
                    'volume': volume_data.get(date_key, 0),
                    'coin_id': coin_id
                })
            
            print(f"✅ Retrieved {len(ohlcv_data)} OHLCV records for {coin_id}")
            return ohlcv_data
            
        except Exception as e:
            print(f"❌ Error fetching OHLCV data for {coin_id}: {e}")
            return None

    def save_coin_data_to_minio(self, coin_id, ohlcv_data, time_period="1y"):
        """Save coin OHLCV data to MinIO"""
        try:
            if not ohlcv_data:
                print(f"❌ No data to save for {coin_id}")
                return False
            
            # Create filename
            filename = f"ohlcv_data/{coin_id}_{time_period}.json"
            
            # Prepare data with metadata
            data_package = {
                'coin_id': coin_id,
                'time_period': time_period,
                'data_points': len(ohlcv_data),
                'date_range': {
                    'start': ohlcv_data[0]['date'] if ohlcv_data else None,
                    'end': ohlcv_data[-1]['date'] if ohlcv_data else None
                },
                'fetched_at': datetime.now().isoformat(),
                'ohlcv_data': ohlcv_data
            }
            
            # Convert to JSON
            json_data = json.dumps(data_package, indent=2)
            json_bytes = json_data.encode('utf-8')
            
            # Upload to MinIO
            self.minio_client.put_object(
                self.bucket_name,
                filename,
                io.BytesIO(json_bytes),
                len(json_bytes),
                content_type='application/json'
            )
            
            print(f"💾 Saved {len(ohlcv_data)} records to MinIO: {filename}")
            print(f"📁 MinIO bucket: {self.bucket_name}")
            print(f"📄 File path: {filename}")
            print(f"📊 Data size: {len(json_bytes)} bytes")
            
            # Verify the file was saved
            try:
                objects = list(self.minio_client.list_objects(self.bucket_name, prefix=filename))
                if objects:
                    print(f"✅ Verified file exists in MinIO: {objects[0].object_name}")
                else:
                    print(f"⚠️ File not found in MinIO after upload!")
            except Exception as e:
                print(f"⚠️ Could not verify MinIO upload: {e}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error saving to MinIO: {e}")
            return False

    def fetch_and_save_coin_data(self, coin_id, days=365):
        """Fetch and save data for a specific coin"""
        print(f"\n🔄 Processing {coin_id}...")
        
        # Determine time period label based on days
        if days <= 30:
            time_period = "1m"
        elif days <= 90:
            time_period = "3m"
        elif days <= 180:
            time_period = "6m"
        elif days <= 365:
            time_period = "1y"
        else:
            time_period = "2y"
        
        # Fetch OHLCV data
        ohlcv_data = self.get_coin_ohlcv_data(coin_id, days)
        
        if ohlcv_data:
            # Save to MinIO (this will overwrite existing data)
            success = self.save_coin_data_to_minio(coin_id, ohlcv_data, time_period)
            
            if success:
                print(f"✅ Successfully processed {coin_id}")
                return True
            else:
                print(f"❌ Failed to save {coin_id}")
                return False
        else:
            print(f"❌ Failed to fetch data for {coin_id}")
            return False

    def get_saved_coin_data(self, coin_id, time_period="1y"):
        """Retrieve saved coin data from MinIO"""
        try:
            filename = f"ohlcv_data/{coin_id}_{time_period}.json"
            
            response = self.minio_client.get_object(self.bucket_name, filename)
            data = json.loads(response.read().decode('utf-8'))
            
            print(f"📥 Retrieved {data['data_points']} records for {coin_id}")
            return data
            
        except S3Error as e:
            if e.code == 'NoSuchKey':
                print(f"📭 No saved data found for {coin_id}")
                return None
            else:
                print(f"❌ MinIO error: {e}")
                return None
        except Exception as e:
            print(f"❌ Error retrieving data: {e}")
            return None

    def list_available_coins(self):
        """List all coins with saved data"""
        try:
            objects = self.minio_client.list_objects(
                self.bucket_name, 
                prefix="ohlcv_data/",
                recursive=True
            )
            
            coins = []
            for obj in objects:
                # Extract coin_id from filename: ohlcv_data/bitcoin_1y.json
                filename = obj.object_name
                if filename.startswith("ohlcv_data/") and filename.endswith(".json"):
                    parts = filename.replace("ohlcv_data/", "").replace(".json", "").split("_")
                    if len(parts) >= 2:
                        coin_id = "_".join(parts[:-1])  # Handle coins with underscores
                        time_period = parts[-1]
                        coins.append({
                            'coin_id': coin_id,
                            'time_period': time_period,
                            'filename': filename,
                            'last_modified': obj.last_modified
                        })
            
            return coins
            
        except Exception as e:
            print(f"❌ Error listing coins: {e}")
            return []

def main():
    """Test the fetcher"""
    fetcher = CoinGeckoFetcher()
    
    # Test with Bitcoin
    print("Testing with Bitcoin...")
    success = fetcher.fetch_and_save_coin_data('bitcoin', days=30)
    
    if success:
        # Try to retrieve the data
        data = fetcher.get_saved_coin_data('bitcoin', '1m')
        if data:
            print(f"✅ Test successful! Retrieved {data['data_points']} records")
        else:
            print("❌ Could not retrieve saved data")
    else:
        print("❌ Test failed")

if __name__ == "__main__":
    main()