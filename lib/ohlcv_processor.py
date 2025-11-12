#!/usr/bin/env python3
"""
PySpark OHLCV Data Processor
Processes candlestick data from MinIO and ensures continuity
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
from pyspark.sql.window import Window
from minio import Minio
import io

class OHLCVProcessor:
    def __init__(self):
        """Initialize PySpark OHLCV processor"""
        # Initialize Spark
        self.spark = SparkSession.builder \
            .appName("OHLCVProcessor") \
            .config("spark.sql.adaptive.enabled", "true") \
            .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
            .getOrCreate()
        
        self.spark.sparkContext.setLogLevel("WARN")
        
        # MinIO client
        self.minio_client = Minio(
            '127.0.0.1:9000',
            access_key='bankuser',
            secret_key='BankPass123!',
            secure=False
        )
        
        self.source_bucket = 'crypto-ohlcv-data'
        self.processed_bucket = 'crypto-processed-ohlcv'
        
        # Ensure processed bucket exists
        self._ensure_bucket_exists()
        
        print("🔧 PySpark OHLCV Processor initialized")

    def _ensure_bucket_exists(self):
        """Ensure processed data bucket exists"""
        try:
            if not self.minio_client.bucket_exists(self.processed_bucket):
                self.minio_client.make_bucket(self.processed_bucket)
                print(f"✅ Created processed bucket: {self.processed_bucket}")
        except Exception as e:
            print(f"❌ Bucket creation error: {e}")

    def load_raw_ohlcv_data(self, coin_id, time_period="1y"):
        """Load raw OHLCV data from MinIO"""
        try:
            filename = f"ohlcv_data/{coin_id}_{time_period}.json"
            print(f"📂 Attempting to load: {filename}")
            print(f"📁 From bucket: {self.source_bucket}")
            
            # List files to see what's available
            try:
                objects = list(self.minio_client.list_objects(self.source_bucket, prefix="ohlcv_data/"))
                print(f"📋 Available files in bucket:")
                for obj in objects[:10]:  # Show first 10 files
                    print(f"   - {obj.object_name}")
                if len(objects) > 10:
                    print(f"   ... and {len(objects) - 10} more files")
            except Exception as list_error:
                print(f"⚠️ Could not list bucket contents: {list_error}")
            
            response = self.minio_client.get_object(self.source_bucket, filename)
            data = json.loads(response.read().decode('utf-8'))
            
            ohlcv_records = data.get('ohlcv_data', [])
            print(f"📥 Loaded {len(ohlcv_records)} raw records for {coin_id}")
            
            return ohlcv_records, data
            
        except Exception as e:
            print(f"❌ Error loading raw data from {filename}: {e}")
            print(f"❌ Bucket: {self.source_bucket}")
            return [], {}

    def process_ohlcv_with_pyspark(self, ohlcv_data, coin_id):
        """Process OHLCV data with PySpark for continuity and quality"""
        print(f"🔧 Processing OHLCV data for {coin_id} with PySpark...")
        
        if not ohlcv_data:
            print("❌ No data to process")
            return None
        
        # Define schema
        schema = StructType([
            StructField("timestamp", LongType(), True),
            StructField("date", StringType(), True),
            StructField("open", DoubleType(), True),
            StructField("high", DoubleType(), True),
            StructField("low", DoubleType(), True),
            StructField("close", DoubleType(), True),
            StructField("volume", DoubleType(), True),
            StructField("coin_id", StringType(), True)
        ])
        
        # Create DataFrame
        df = self.spark.createDataFrame(ohlcv_data, schema)
        print(f"📊 Initial dataset: {df.count()} records")
        
        # Step 1: Data validation and cleaning
        print("🧹 Step 1: Data validation...")
        
        # Remove invalid records
        df = df.filter(col("open").isNotNull() & (col("open") > 0)) \
              .filter(col("high").isNotNull() & (col("high") > 0)) \
              .filter(col("low").isNotNull() & (col("low") > 0)) \
              .filter(col("close").isNotNull() & (col("close") > 0)) \
              .filter(col("date").isNotNull())
        
        # Validate OHLC relationships
        df = df.filter(col("high") >= col("low")) \
              .filter(col("high") >= col("open")) \
              .filter(col("high") >= col("close")) \
              .filter(col("low") <= col("open")) \
              .filter(col("low") <= col("close"))
        
        print(f"📊 After validation: {df.count()} records")
        
        # Step 2: Handle missing volume data
        print("🧹 Step 2: Handling missing volume...")
        df = df.fillna({'volume': 0.0})
        
        # Step 3: Remove duplicates
        print("🧹 Step 3: Removing duplicates...")
        df = df.dropDuplicates(['date', 'coin_id'])
        
        # Step 4: Sort by date
        df = df.orderBy("date")
        
        # Step 5: Ensure date continuity
        print("🧹 Step 4: Ensuring date continuity...")
        
        # Convert to Pandas for easier date handling
        pandas_df = df.toPandas()
        pandas_df['date'] = pd.to_datetime(pandas_df['date'])
        pandas_df = pandas_df.sort_values('date').reset_index(drop=True)
        
        if len(pandas_df) == 0:
            print("❌ No valid data after cleaning")
            return None
        
        # Create continuous date range
        start_date = pandas_df['date'].min()
        end_date = pandas_df['date'].max()
        
        print(f"📅 Date range: {start_date.date()} to {end_date.date()}")
        
        # Create full date range
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Reindex to fill missing dates
        pandas_df = pandas_df.set_index('date').reindex(date_range)
        
        # For missing days, we'll remove them to ensure continuity
        # (as per your requirement: "delete days without data")
        pandas_df = pandas_df.dropna(subset=['open', 'high', 'low', 'close'])
        
        # Reset index and clean up
        pandas_df = pandas_df.reset_index()
        pandas_df = pandas_df.rename(columns={'index': 'date'})
        pandas_df['date'] = pandas_df['date'].dt.strftime('%Y-%m-%d')
        
        print(f"📊 After continuity processing: {len(pandas_df)} records")
        
        # Step 5: Calculate technical indicators
        print("🧹 Step 5: Adding technical indicators...")
        
        # Simple moving averages
        pandas_df['sma_7'] = pandas_df['close'].rolling(window=7, min_periods=1).mean()
        pandas_df['sma_20'] = pandas_df['close'].rolling(window=20, min_periods=1).mean()
        pandas_df['sma_50'] = pandas_df['close'].rolling(window=50, min_periods=1).mean()
        
        # Daily returns
        pandas_df['daily_return'] = pandas_df['close'].pct_change()
        pandas_df['daily_return_pct'] = pandas_df['daily_return'] * 100
        
        # Volatility (7-day rolling standard deviation)
        pandas_df['volatility_7d'] = pandas_df['daily_return'].rolling(window=7, min_periods=1).std() * 100
        
        # Price ranges
        pandas_df['daily_range'] = pandas_df['high'] - pandas_df['low']
        pandas_df['daily_range_pct'] = (pandas_df['daily_range'] / pandas_df['open']) * 100
        
        # Volume moving average
        pandas_df['volume_ma_7'] = pandas_df['volume'].rolling(window=7, min_periods=1).mean()
        
        # Bollinger Bands (20-day)
        sma_20 = pandas_df['close'].rolling(window=20, min_periods=1).mean()
        std_20 = pandas_df['close'].rolling(window=20, min_periods=1).std()
        pandas_df['bb_upper'] = sma_20 + (std_20 * 2)
        pandas_df['bb_lower'] = sma_20 - (std_20 * 2)
        
        # Fill NaN values
        pandas_df = pandas_df.fillna(method='bfill').fillna(method='ffill')
        
        print(f"✅ Processing completed: {len(pandas_df)} records with technical indicators")
        
        return pandas_df

    def save_processed_data(self, processed_df, coin_id, time_period="1y"):
        """Save processed OHLCV data to MinIO"""
        try:
            if processed_df is None or len(processed_df) == 0:
                print("❌ No processed data to save")
                return False
            
            # Convert DataFrame to records
            records = processed_df.to_dict('records')
            
            # Create data package
            data_package = {
                'coin_id': coin_id,
                'time_period': time_period,
                'processed_at': datetime.now().isoformat(),
                'data_points': len(records),
                'date_range': {
                    'start': processed_df['date'].iloc[0],
                    'end': processed_df['date'].iloc[-1]
                },
                'technical_indicators': [
                    'sma_7', 'sma_20', 'sma_50', 'daily_return', 'daily_return_pct',
                    'volatility_7d', 'daily_range', 'daily_range_pct', 'volume_ma_7',
                    'bb_upper', 'bb_lower'
                ],
                'ohlcv_data': records
            }
            
            # Save to MinIO
            filename = f"processed/{coin_id}_{time_period}_processed.json"
            json_data = json.dumps(data_package, indent=2, default=str)
            json_bytes = json_data.encode('utf-8')
            
            self.minio_client.put_object(
                self.processed_bucket,
                filename,
                io.BytesIO(json_bytes),
                len(json_bytes),
                content_type='application/json'
            )
            
            print(f"💾 Saved processed data: {filename}")
            return True
            
        except Exception as e:
            print(f"❌ Error saving processed data: {e}")
            return False

    def process_coin_data(self, coin_id, time_period="1y"):
        """Complete processing pipeline for a coin"""
        print(f"\n🔄 Processing {coin_id} ({time_period})...")
        
        # Load raw data
        raw_data, metadata = self.load_raw_ohlcv_data(coin_id, time_period)
        
        if not raw_data:
            print(f"❌ No raw data available for {coin_id}")
            return False
        
        # Process with PySpark
        processed_df = self.process_ohlcv_with_pyspark(raw_data, coin_id)
        
        if processed_df is None:
            print(f"❌ Processing failed for {coin_id}")
            return False
        
        # Save processed data
        success = self.save_processed_data(processed_df, coin_id, time_period)
        
        if success:
            print(f"✅ Successfully processed {coin_id}")
            return True
        else:
            print(f"❌ Failed to save processed data for {coin_id}")
            return False

    def get_processed_data(self, coin_id, time_period="1y"):
        """Retrieve processed OHLCV data"""
        try:
            filename = f"processed/{coin_id}_{time_period}_processed.json"
            
            response = self.minio_client.get_object(self.processed_bucket, filename)
            data = json.loads(response.read().decode('utf-8'))
            
            print(f"📥 Retrieved processed data for {coin_id}: {data['data_points']} records")
            return data
            
        except Exception as e:
            print(f"❌ Error retrieving processed data: {e}")
            return None

    def close(self):
        """Clean up Spark session"""
        if self.spark:
            self.spark.stop()
        print("🛑 PySpark session closed")

def main():
    """Test the processor"""
    processor = OHLCVProcessor()
    
    try:
        # Test processing Bitcoin data
        success = processor.process_coin_data('bitcoin', '1y')
        
        if success:
            # Try to retrieve processed data
            data = processor.get_processed_data('bitcoin', '1y')
            if data:
                print(f"✅ Test successful! Processed {data['data_points']} records")
                print(f"📅 Date range: {data['date_range']['start']} to {data['date_range']['end']}")
                print(f"📊 Technical indicators: {', '.join(data['technical_indicators'])}")
        
    finally:
        processor.close()

if __name__ == "__main__":
    main()