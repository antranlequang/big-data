#!/usr/bin/env python3
"""
PySpark ETL for Crypto Historical Data Processing
Implements Phase 1: Processing Historical Data (Offline - PySpark ETL)
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
from pyspark.ml.feature import MinMaxScaler, VectorAssembler
from sklearn.preprocessing import MinMaxScaler as SKMinMaxScaler
import yfinance as yf
import requests

class CryptoDataETL:
    def __init__(self):
        """Initialize Spark session and configuration"""
        self.spark = SparkSession.builder \
            .appName("CryptoHistoricalDataETL") \
            .config("spark.sql.adaptive.enabled", "true") \
            .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
            .getOrCreate()
        
        self.spark.sparkContext.setLogLevel("WARN")
        print("✅ PySpark ETL initialized successfully")

    def create_synthetic_historical_dataset(self, days=365):
        """
        1.1 Creating a synthetic historical dataset
        Combine data from multiple sources using PySpark
        """
        print(f"📊 Creating synthetic historical dataset for {days} days...")
        
        # Generate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        date_range = pd.date_range(start=start_date, end=end_date, freq='H')
        
        # 1. Crypto prices data (synthetic with realistic patterns)
        crypto_data = []
        base_price = 30000.0
        
        for i, timestamp in enumerate(date_range):
            # Simulate realistic price movement with trends and volatility
            trend = 0.0001 * np.sin(i / (24 * 7))  # Weekly trend
            volatility = 0.02 * np.random.normal(0, 1)
            shock = 0.001 * np.random.choice([-1, 1]) * np.random.exponential(1)
            
            price_change = trend + volatility + shock
            base_price *= (1 + price_change)
            
            volume = np.random.lognormal(21, 0.5)  # Log-normal volume distribution
            
            crypto_data.append({
                'timestamp': timestamp,
                'price': base_price,
                'volume': volume,
                'high_24h': base_price * (1 + abs(np.random.normal(0, 0.01))),
                'low_24h': base_price * (1 - abs(np.random.normal(0, 0.01)))
            })
        
        # 2. Historical sentiment scores (synthetic NLP-like data)
        sentiment_data = []
        sentiment_trend = 0.5  # Start neutral
        
        for i, timestamp in enumerate(date_range):
            # Sentiment follows market with some lag and noise
            price_change = crypto_data[i]['price'] / crypto_data[max(0, i-1)]['price'] - 1 if i > 0 else 0
            sentiment_change = 0.3 * price_change + 0.1 * np.random.normal(0, 1)
            sentiment_trend = np.clip(sentiment_trend + sentiment_change, 0, 1)
            
            sentiment_data.append({
                'timestamp': timestamp,
                'sentiment_score': sentiment_trend,
                'news_volume': np.random.poisson(10),
                'social_mentions': np.random.poisson(50)
            })
        
        # 3. Macro/intermarket variables (fetch some real data, supplement with synthetic)
        macro_data = []
        
        try:
            # Try to fetch real S&P 500 data
            sp500 = yf.download('^GSPC', start=start_date, end=end_date, interval='1d')
            if not sp500.empty:
                sp500_prices = sp500['Close'].values
                # Interpolate to hourly
                sp500_hourly = np.interp(range(len(date_range)), 
                                       np.linspace(0, len(date_range)-1, len(sp500_prices)), 
                                       sp500_prices)
            else:
                raise Exception("No S&P data")
        except:
            # Fallback to synthetic S&P data
            sp500_hourly = [4500 * (1 + 0.0001 * i + 0.01 * np.random.normal()) for i in range(len(date_range))]
        
        # Generate other macro indicators
        for i, timestamp in enumerate(date_range):
            macro_data.append({
                'timestamp': timestamp,
                'sp500_price': sp500_hourly[i],
                'gold_price': 2000 + 50 * np.sin(i / (24 * 30)) + 10 * np.random.normal(),  # Monthly cycle
                'vix': 15 + 10 * abs(np.random.normal()),  # Volatility index
                'dxy': 100 + 5 * np.sin(i / (24 * 90)) + 2 * np.random.normal(),  # Dollar index
                'oil_price': 80 + 20 * np.sin(i / (24 * 60)) + 5 * np.random.normal()  # Oil price
            })
        
        # Convert to Spark DataFrames
        crypto_schema = StructType([
            StructField("timestamp", TimestampType(), True),
            StructField("price", DoubleType(), True),
            StructField("volume", DoubleType(), True),
            StructField("high_24h", DoubleType(), True),
            StructField("low_24h", DoubleType(), True)
        ])
        
        sentiment_schema = StructType([
            StructField("timestamp", TimestampType(), True),
            StructField("sentiment_score", DoubleType(), True),
            StructField("news_volume", IntegerType(), True),
            StructField("social_mentions", IntegerType(), True)
        ])
        
        macro_schema = StructType([
            StructField("timestamp", TimestampType(), True),
            StructField("sp500_price", DoubleType(), True),
            StructField("gold_price", DoubleType(), True),
            StructField("vix", DoubleType(), True),
            StructField("dxy", DoubleType(), True),
            StructField("oil_price", DoubleType(), True)
        ])
        
        crypto_df = self.spark.createDataFrame(crypto_data, crypto_schema)
        sentiment_df = self.spark.createDataFrame(sentiment_data, sentiment_schema)
        macro_df = self.spark.createDataFrame(macro_data, macro_schema)
        
        # Join all datasets on timestamp
        combined_df = crypto_df \
            .join(sentiment_df, "timestamp", "inner") \
            .join(macro_df, "timestamp", "inner")
        
        print(f"✅ Created synthetic dataset with {combined_df.count()} records")
        return combined_df

    def foundational_feature_engineering(self, df):
        """
        1.2 Foundational feature engineering
        Calculate log returns, volatility, and other time metrics
        """
        print("🔧 Performing foundational feature engineering...")
        
        # Sort by timestamp
        df = df.orderBy("timestamp")
        
        # Add window functions for time-based calculations
        from pyspark.sql.window import Window
        window_spec = Window.orderBy("timestamp")
        
        # Calculate log returns
        df = df.withColumn("prev_price", lag("price").over(window_spec))
        df = df.withColumn("log_return", 
                          when(col("prev_price").isNotNull(), 
                               log(col("price") / col("prev_price")))
                          .otherwise(0.0))
        
        # Calculate rolling volatility (24-hour window)
        rolling_window = Window.orderBy("timestamp").rowsBetween(-23, 0)
        df = df.withColumn("volatility_24h", stddev("log_return").over(rolling_window))
        
        # Price momentum indicators
        df = df.withColumn("price_ma_24h", avg("price").over(rolling_window))
        df = df.withColumn("volume_ma_24h", avg("volume").over(rolling_window))
        
        # Price change percentages
        df = df.withColumn("price_change_1h", 
                          (col("price") - lag("price", 1).over(window_spec)) / lag("price", 1).over(window_spec) * 100)
        df = df.withColumn("price_change_24h", 
                          (col("price") - lag("price", 24).over(window_spec)) / lag("price", 24).over(window_spec) * 100)
        
        # Technical indicators
        df = df.withColumn("rsi_signal", 
                          when(col("price_change_24h") > 5, 1.0)
                          .when(col("price_change_24h") < -5, -1.0)
                          .otherwise(0.0))
        
        # Macro correlation features
        df = df.withColumn("btc_sp500_ratio", col("price") / col("sp500_price"))
        df = df.withColumn("gold_btc_ratio", col("gold_price") / col("price"))
        
        print("✅ Feature engineering completed")
        return df

    def define_target_variable(self, df, risk_threshold=-0.02):
        """
        1.3 Define target variable (Y) - Risk Flag
        Target: 1 when next period log return drops by more than X%
        """
        print(f"🎯 Defining target variable with risk threshold: {risk_threshold}")
        
        from pyspark.sql.window import Window
        window_spec = Window.orderBy("timestamp")
        
        # Calculate next period log return
        df = df.withColumn("next_log_return", lead("log_return").over(window_spec))
        
        # Create risk flag (1 if next return drops more than threshold)
        df = df.withColumn("risk_flag", 
                          when(col("next_log_return") < risk_threshold, 1)
                          .otherwise(0))
        
        # Additional risk indicators
        df = df.withColumn("extreme_volatility", 
                          when(col("volatility_24h") > 0.05, 1).otherwise(0))
        
        df = df.withColumn("sentiment_risk", 
                          when(col("sentiment_score") < 0.3, 1).otherwise(0))
        
        risk_count = df.filter(col("risk_flag") == 1).count()
        total_count = df.count()
        risk_ratio = risk_count / total_count if total_count > 0 else 0
        
        print(f"✅ Risk events: {risk_count}/{total_count} ({risk_ratio:.2%})")
        return df

    def normalize_and_reshape_data(self, df, feature_columns, target_column="risk_flag", sequence_length=24):
        """
        1.4 Normalize and reshape data for LSTM
        Create 3D tensor: [samples, timesteps, features]
        """
        print(f"📐 Normalizing and reshaping data for LSTM (sequence_length={sequence_length})...")
        
        # Convert to Pandas for easier manipulation (for smaller datasets)
        # For production, use PySpark ML pipelines
        pandas_df = df.select(["timestamp"] + feature_columns + [target_column]).toPandas()
        pandas_df = pandas_df.dropna().sort_values('timestamp').reset_index(drop=True)
        
        # Normalize features using MinMaxScaler
        scaler = SKMinMaxScaler()
        feature_data = pandas_df[feature_columns].values
        normalized_features = scaler.fit_transform(feature_data)
        
        # Create sequences for LSTM
        X_sequences = []
        y_sequences = []
        
        for i in range(sequence_length, len(normalized_features)):
            # Input sequence: previous 'sequence_length' time steps
            X_sequences.append(normalized_features[i-sequence_length:i])
            # Target: risk flag at current time step
            y_sequences.append(pandas_df[target_column].iloc[i])
        
        X_array = np.array(X_sequences)
        y_array = np.array(y_sequences)
        
        print(f"✅ Created sequences: X shape {X_array.shape}, y shape {y_array.shape}")
        print(f"   Sequence format: [samples={X_array.shape[0]}, timesteps={X_array.shape[1]}, features={X_array.shape[2]}]")
        
        return X_array, y_array, scaler, pandas_df

    def save_processed_data(self, X, y, scaler, metadata_df, output_path="./data/processed"):
        """Save processed data for model training"""
        os.makedirs(output_path, exist_ok=True)
        
        np.save(f"{output_path}/X_sequences.npy", X)
        np.save(f"{output_path}/y_sequences.npy", y)
        
        # Save scaler
        import joblib
        joblib.dump(scaler, f"{output_path}/feature_scaler.pkl")
        
        # Save metadata
        metadata_df.to_csv(f"{output_path}/metadata.csv", index=False)
        
        print(f"✅ Processed data saved to {output_path}")

    def run_full_etl_pipeline(self, days=365, risk_threshold=-0.02, sequence_length=24):
        """Run the complete ETL pipeline"""
        print("🚀 Starting complete ETL pipeline...")
        
        # Step 1.1: Create synthetic historical dataset
        raw_df = self.create_synthetic_historical_dataset(days)
        
        # Step 1.2: Feature engineering
        featured_df = self.foundational_feature_engineering(raw_df)
        
        # Step 1.3: Define target variable
        target_df = self.define_target_variable(featured_df, risk_threshold)
        
        # Step 1.4: Normalize and reshape for LSTM
        feature_columns = [
            'price', 'volume', 'log_return', 'volatility_24h', 
            'price_change_1h', 'price_change_24h', 'sentiment_score',
            'sp500_price', 'gold_price', 'vix', 'dxy', 'oil_price',
            'btc_sp500_ratio', 'gold_btc_ratio', 'rsi_signal'
        ]
        
        X, y, scaler, metadata = self.normalize_and_reshape_data(
            target_df, feature_columns, sequence_length=sequence_length
        )
        
        # Save processed data
        self.save_processed_data(X, y, scaler, metadata)
        
        print("✅ ETL Pipeline completed successfully!")
        return X, y, scaler, metadata

    def close(self):
        """Clean up Spark session"""
        self.spark.stop()
        print("🛑 Spark session closed")

if __name__ == "__main__":
    # Run ETL pipeline
    etl = CryptoDataETL()
    try:
        X, y, scaler, metadata = etl.run_full_etl_pipeline(
            days=365,  # 1 year of data
            risk_threshold=-0.02,  # 2% drop threshold
            sequence_length=24  # 24-hour sequences
        )
        print(f"Final dataset shape: X={X.shape}, y={y.shape}")
    finally:
        etl.close()