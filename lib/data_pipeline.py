#!/usr/bin/env python3
"""
Complete Data Pipeline: MinIO → PySpark Processing → Clean Data
Independent of the web platform
"""

import os
import sys
import time
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
from minio import Minio
import schedule
import threading

class CryptoDataPipeline:
    def __init__(self):
        """Initialize the data pipeline with MinIO and Spark"""
        # MinIO Configuration (same as your existing setup)
        self.minio_client = Minio(
            '127.0.0.1:9000',
            access_key='bankuser',
            secret_key='BankPass123!',
            secure=False
        )
        self.bucket_name = 'crypto-data'
        
        # Initialize Spark
        self.spark = SparkSession.builder \
            .appName("CryptoDataPipeline") \
            .config("spark.sql.adaptive.enabled", "true") \
            .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
            .getOrCreate()
        
        self.spark.sparkContext.setLogLevel("WARN")
        
        # Ensure directories exist
        os.makedirs('./data/processed', exist_ok=True)
        os.makedirs('./data/clean', exist_ok=True)
        
        print("🏭 Crypto Data Pipeline initialized")

    def read_raw_data_from_minio(self, days_back=7):
        """Read raw crypto data from MinIO for processing"""
        print(f"📥 Reading raw data from MinIO (last {days_back} days)...")
        
        all_data = []
        
        # Read data from multiple days
        for i in range(days_back):
            date_str = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            filename = f'crypto_prices/top50_{date_str}.csv'
            
            try:
                # Get object from MinIO
                response = self.minio_client.get_object(self.bucket_name, filename)
                csv_data = response.read().decode('utf-8')
                
                if csv_data.strip():
                    # Parse CSV manually to handle potential formatting issues
                    lines = csv_data.strip().split('\n')
                    if len(lines) > 1:  # Has header + data
                        headers = lines[0].split(',')
                        
                        for line in lines[1:]:
                            try:
                                values = self.parse_csv_line(line)
                                if len(values) == len(headers):
                                    record = dict(zip(headers, values))
                                    all_data.append(record)
                            except Exception as e:
                                print(f"⚠️ Skipping malformed line: {e}")
                                continue
                
                print(f"✅ Read {len([d for d in all_data if d.get('timestamp', '').startswith(date_str)])} records from {date_str}")
                
            except Exception as e:
                print(f"⚠️ No data for {date_str}: {e}")
                continue
        
        print(f"📊 Total raw records collected: {len(all_data)}")
        return all_data

    def parse_csv_line(self, line):
        """Parse CSV line handling quoted strings"""
        result = []
        current = ''
        in_quotes = False
        
        for char in line:
            if char == '"':
                in_quotes = not in_quotes
            elif char == ',' and not in_quotes:
                result.append(current.strip().strip('"'))
                current = ''
            else:
                current += char
        
        result.append(current.strip().strip('"'))
        return result

    def process_data_with_pyspark(self, raw_data):
        """Process and clean data using PySpark"""
        print("🧹 Processing data with PySpark...")
        
        if not raw_data:
            print("❌ No raw data to process")
            return None
        
        # Define schema for the data
        schema = StructType([
            StructField("timestamp", StringType(), True),
            StructField("id", StringType(), True),
            StructField("symbol", StringType(), True),
            StructField("name", StringType(), True),
            StructField("price_usd", StringType(), True),
            StructField("market_cap", StringType(), True),
            StructField("volume_24h", StringType(), True),
            StructField("price_change_1h", StringType(), True),
            StructField("price_change_24h", StringType(), True),
            StructField("price_change_7d", StringType(), True),
            StructField("high_24h", StringType(), True),
            StructField("low_24h", StringType(), True),
            StructField("last_updated", StringType(), True)
        ])
        
        # Create Spark DataFrame
        df = self.spark.createDataFrame(raw_data, schema)
        
        print(f"📊 Initial dataset: {df.count()} records")
        
        # Data cleaning steps
        print("🔧 Step 1: Converting data types...")
        df = df.withColumn("price_usd", col("price_usd").cast("double")) \
              .withColumn("market_cap", col("market_cap").cast("double")) \
              .withColumn("volume_24h", col("volume_24h").cast("double")) \
              .withColumn("price_change_1h", col("price_change_1h").cast("double")) \
              .withColumn("price_change_24h", col("price_change_24h").cast("double")) \
              .withColumn("price_change_7d", col("price_change_7d").cast("double")) \
              .withColumn("high_24h", col("high_24h").cast("double")) \
              .withColumn("low_24h", col("low_24h").cast("double")) \
              .withColumn("timestamp", to_timestamp(col("timestamp")))
        
        print("🔧 Step 2: Removing invalid records...")
        # Remove records with null or invalid essential fields
        df = df.filter(col("price_usd").isNotNull()) \
              .filter(col("price_usd") > 0) \
              .filter(col("timestamp").isNotNull()) \
              .filter(col("id").isNotNull())
        
        print(f"📊 After removing invalid records: {df.count()} records")
        
        print("🔧 Step 3: Handling missing values...")
        # Fill missing values with appropriate defaults
        df = df.fillna({
            "price_change_1h": 0.0,
            "price_change_24h": 0.0,
            "price_change_7d": 0.0,
            "market_cap": 0.0,
            "volume_24h": 0.0
        })
        
        # Fill high/low prices with current price if missing
        df = df.withColumn("high_24h", 
                          when(col("high_24h").isNull() | (col("high_24h") == 0), 
                               col("price_usd")).otherwise(col("high_24h"))) \
              .withColumn("low_24h", 
                          when(col("low_24h").isNull() | (col("low_24h") == 0), 
                               col("price_usd")).otherwise(col("low_24h")))
        
        print("🔧 Step 4: Removing duplicates...")
        # Remove duplicates based on timestamp and coin id
        df = df.dropDuplicates(["timestamp", "id"])
        
        print(f"📊 After removing duplicates: {df.count()} records")
        
        print("🔧 Step 5: Data quality checks...")
        # Remove outliers (prices that are too extreme)
        df = df.withColumn("price_valid", 
                          when((col("price_usd") >= col("low_24h")) & 
                               (col("price_usd") <= col("high_24h")), True)
                          .otherwise(False))
        
        # Keep only valid price records
        df = df.filter(col("price_valid") == True).drop("price_valid")
        
        print("🔧 Step 6: Creating continuous time series...")
        # Sort by coin and timestamp to ensure continuity
        df = df.orderBy("id", "timestamp")
        
        print(f"📊 Final cleaned dataset: {df.count()} records")
        
        # Add data quality metrics
        coin_counts = df.groupBy("id").count().collect()
        print("📈 Data distribution by coin:")
        for row in coin_counts[:10]:  # Show top 10
            print(f"   {row['id']}: {row['count']} records")
        
        return df

    def save_processed_data(self, df, output_format='json'):
        """Save processed data in multiple formats"""
        print(f"💾 Saving processed data in {output_format} format...")
        
        if df is None:
            print("❌ No data to save")
            return
        
        try:
            # Convert to Pandas for easier handling
            pandas_df = df.toPandas()
            
            # Save as JSON (for web API consumption)
            json_path = './data/clean/processed_crypto_data.json'
            pandas_df.to_json(json_path, orient='records', date_format='iso')
            print(f"✅ Saved JSON data: {json_path}")
            
            # Save as CSV (for backup and analysis)
            csv_path = './data/clean/processed_crypto_data.csv'
            pandas_df.to_csv(csv_path, index=False)
            print(f"✅ Saved CSV data: {csv_path}")
            
            # Save metadata
            metadata = {
                'timestamp': datetime.now().isoformat(),
                'total_records': len(pandas_df),
                'unique_coins': pandas_df['id'].nunique(),
                'date_range': {
                    'start': pandas_df['timestamp'].min().isoformat(),
                    'end': pandas_df['timestamp'].max().isoformat()
                },
                'data_quality': {
                    'completeness': (1 - pandas_df.isnull().sum().sum() / (len(pandas_df) * len(pandas_df.columns))) * 100,
                    'validity': 100.0  # All records passed validation
                }
            }
            
            metadata_path = './data/clean/data_metadata.json'
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            print(f"✅ Saved metadata: {metadata_path}")
            
            return {
                'json_path': json_path,
                'csv_path': csv_path,
                'metadata_path': metadata_path,
                'records_count': len(pandas_df)
            }
            
        except Exception as e:
            print(f"❌ Error saving processed data: {e}")
            return None

    def run_pipeline(self):
        """Run the complete data pipeline"""
        print("🚀 Starting complete data pipeline...")
        start_time = datetime.now()
        
        try:
            # Step 1: Read raw data from MinIO
            raw_data = self.read_raw_data_from_minio(days_back=7)
            
            if not raw_data:
                print("❌ No raw data available for processing")
                return False
            
            # Step 2: Process data with PySpark
            processed_df = self.process_data_with_pyspark(raw_data)
            
            if processed_df is None:
                print("❌ Data processing failed")
                return False
            
            # Step 3: Save processed data
            result = self.save_processed_data(processed_df)
            
            if result is None:
                print("❌ Failed to save processed data")
                return False
            
            # Pipeline completed successfully
            duration = datetime.now() - start_time
            print(f"✅ Pipeline completed successfully in {duration}")
            print(f"📊 Processed {result['records_count']} records")
            print(f"📁 Data saved to: {result['json_path']}")
            
            return True
            
        except Exception as e:
            print(f"❌ Pipeline failed: {e}")
            return False

    def schedule_pipeline(self, interval_hours=1):
        """Schedule the pipeline to run at regular intervals"""
        print(f"⏰ Scheduling pipeline to run every {interval_hours} hour(s)")
        
        def run_scheduled():
            print(f"\n🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - Running scheduled pipeline...")
            self.run_pipeline()
        
        # Schedule the pipeline
        schedule.every(interval_hours).hours.do(run_scheduled)
        
        # Run once immediately
        run_scheduled()
        
        # Keep the scheduler running
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute

    def close(self):
        """Clean up resources"""
        if self.spark:
            self.spark.stop()
        print("🛑 Pipeline resources cleaned up")

def main():
    """Main function to run the data pipeline"""
    pipeline = CryptoDataPipeline()
    
    try:
        if len(sys.argv) > 1 and sys.argv[1] == 'schedule':
            # Run in scheduled mode
            interval = int(sys.argv[2]) if len(sys.argv) > 2 else 1
            pipeline.schedule_pipeline(interval_hours=interval)
        else:
            # Run once
            pipeline.run_pipeline()
    except KeyboardInterrupt:
        print("\n🛑 Pipeline interrupted by user")
    finally:
        pipeline.close()

if __name__ == "__main__":
    main()