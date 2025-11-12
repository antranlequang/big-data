#!/usr/bin/env python3
"""
Online Linear Regression Forecasting System
Reads top50 data from MinIO, processes with PySpark, and forecasts prices for next 5 minutes
Uses incremental linear regression for continuous model updates with normal equation approach
"""

import os
import sys
import json
import io
import time
import tempfile
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pyspark.sql import SparkSession
from pyspark.sql.functions import col
from pyspark.sql.types import *
from minio import Minio
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import pickle
import threading
from collections import deque

class OnlineLinearRegression:
    """Online Linear Regression using incremental least squares updates"""
    
    def __init__(self, learning_rate=0.01, regularization=0.001):
        self.learning_rate = learning_rate
        self.regularization = regularization
        self.weights = None
        self.bias = 0.0
        self.n_features = None
        self.n_samples = 0
        self.sum_xx = None  # Sum of X^T * X for normal equation approach
        self.sum_xy = None  # Sum of X^T * y for normal equation approach
        
    def partial_fit(self, X, y):
        """Incrementally fit the linear regression model"""
        X = np.array(X)
        y = np.array(y)
        
        if len(X.shape) == 1:
            X = X.reshape(1, -1)
        if len(y.shape) == 0:
            y = np.array([y])
        
        n_samples, n_features = X.shape
        
        # Initialize weights and matrices on first call
        if self.weights is None:
            self.n_features = n_features
            self.weights = np.zeros(n_features)
            self.sum_xx = np.zeros((n_features, n_features))
            self.sum_xy = np.zeros(n_features)
        
        # Update running sums for normal equation approach
        self.sum_xx += X.T @ X
        self.sum_xy += X.T @ y
        self.n_samples += n_samples
        
        # Solve normal equation with regularization: (X^T*X + lambda*I) * w = X^T*y
        try:
            A = self.sum_xx + self.regularization * np.eye(self.n_features)
            self.weights = np.linalg.solve(A, self.sum_xy)
        except np.linalg.LinAlgError:
            # Fallback to pseudo-inverse if matrix is singular
            A = self.sum_xx + (self.regularization + 1e-6) * np.eye(self.n_features)
            self.weights = np.linalg.pinv(A) @ self.sum_xy
        
        # Update bias (mean of residuals approach)
        predictions = X @ self.weights
        residuals = y - predictions
        self.bias = np.mean(residuals)
        
    def predict(self, X):
        """Make predictions using the linear regression model"""
        if self.weights is None:
            return np.zeros(len(X))
        
        X = np.array(X)
        if len(X.shape) == 1:
            X = X.reshape(1, -1)
        
        return X @ self.weights + self.bias
    
    def get_weights(self):
        """Get current model weights"""
        return self.weights, self.bias
    
    def get_equation_summary(self):
        """Get a summary of the linear equation"""
        if self.weights is None:
            return "No model trained yet"
        
        equation_parts = []
        for i, weight in enumerate(self.weights):
            if weight != 0:
                sign = "+" if weight >= 0 and len(equation_parts) > 0 else ""
                equation_parts.append(f"{sign}{weight:.4f}*x{i}")
        
        bias_sign = "+" if self.bias >= 0 and len(equation_parts) > 0 else ""
        equation_parts.append(f"{bias_sign}{self.bias:.4f}")
        
        return f"y = {' '.join(equation_parts)}"

class OnlineForecastingService:
    def __init__(self, quiet_mode=False):
        """Initialize the online forecasting service"""
        self.quiet_mode = quiet_mode
        
        # MinIO Configuration
        self.minio_client = Minio(
            '127.0.0.1:9000',
            access_key='bankuser',
            secret_key='BankPass123!',
            secure=False
        )
        self.bucket_name = 'crypto-data'
        
        # Initialize Spark
        self.spark = SparkSession.builder \
            .appName("OnlineForecasting") \
            .config("spark.driver.bindAddress", "127.0.0.1") \
            .config("spark.driver.host", "127.0.0.1") \
            .config("spark.sql.adaptive.enabled", "true") \
            .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
            .getOrCreate()
        
        self.spark.sparkContext.setLogLevel("ERROR" if quiet_mode else "WARN")
        
        # Store models per coin (for incremental learning)
        self.models = {}  # {coin_id: OnlineLinearRegression}
        self.scalers = {}  # {coin_id: StandardScaler}
        self.price_history = {}  # {coin_id: deque of recent prices}
        
        # Model configuration
        self.sequence_length = 20  # Use last 60 minutes of data for prediction
        self.forecast_horizon = 5  # Forecast next 5 minutes
        
        if not quiet_mode:
            print("✅ Online Forecasting Service initialized")
    
    def read_data_from_minio(self, coin_id: str = None):
        """Read top50 data from MinIO using PySpark"""
        try:
            date_str = datetime.now().strftime('%Y-%m-%d')
            filename = f'crypto_prices/top50_{date_str}.csv'
            
            # Create temp directory if it doesn't exist
            temp_dir = tempfile.gettempdir()
            temp_file = os.path.join(temp_dir, os.path.basename(filename))
            
            local_file = None
            
            # Download file from MinIO
            try:
                self.minio_client.fget_object(self.bucket_name, filename, temp_file)
                local_file = temp_file
            except Exception as e:
                print(f"⚠️ File not found for today: {filename}")
                # Try yesterday's file
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                filename_yesterday = f'crypto_prices/top50_{yesterday}.csv'
                temp_file_yesterday = os.path.join(temp_dir, os.path.basename(filename_yesterday))
                try:
                    self.minio_client.fget_object(self.bucket_name, filename_yesterday, temp_file_yesterday)
                    local_file = temp_file_yesterday
                    filename = filename_yesterday
                except Exception as e2:
                    print(f"⚠️ File not found for yesterday: {filename_yesterday}")
                    return None
            
            # Check if local_file was successfully set
            if local_file is None or not os.path.exists(local_file):
                print(f"❌ Local file not found: {local_file}")
                return None
            
            # Read CSV with Spark
            df = self.spark.read \
                .option("header", "true") \
                .option("inferSchema", "true") \
                .csv(local_file)
            
            # Filter by coin_id if provided
            if coin_id:
                df = df.filter(col("id") == coin_id)
            
            # Convert to Pandas for easier processing
            pandas_df = df.toPandas()
            
            # Clean data
            pandas_df['timestamp'] = pd.to_datetime(pandas_df['timestamp'])
            pandas_df = pandas_df.sort_values('timestamp')
            
            # Convert numeric columns
            numeric_cols = ['price_usd', 'market_cap', 'volume_24h', 'price_change_1h', 
                           'price_change_24h', 'price_change_7d', 'high_24h', 'low_24h']
            for col_name in numeric_cols:
                if col_name in pandas_df.columns:
                    pandas_df[col_name] = pd.to_numeric(pandas_df[col_name], errors='coerce')
            
            pandas_df = pandas_df.dropna(subset=['price_usd'])
            
            return pandas_df
            
        except Exception as e:
            print(f"❌ Error reading data from MinIO: {e}")
            return None
    
    def prepare_features(self, df: pd.DataFrame):
        """Prepare features for forecasting with normalization"""
        if df is None or len(df) < 2:
            return None, None
        
        # Create features
        features = []
        targets = []
        
        # Use rolling window approach
        for i in range(self.sequence_length, len(df)):
            # Get sequence of prices
            sequence = df['price_usd'].iloc[i-self.sequence_length:i].values
            
            # Calculate technical indicators
            current_price = df['price_usd'].iloc[i-1]
            price_change = df['price_usd'].iloc[i] - current_price
            
            # Technical indicators
            price_mean = np.mean(sequence)
            price_std = np.std(sequence) if len(sequence) > 1 else 0
            price_trend = sequence[-1] - sequence[0] if len(sequence) > 0 else 0
            
            # Normalize all features to current price to prevent scaling issues
            normalized_sequence = sequence / current_price if current_price > 0 else sequence
            normalized_change = price_change / current_price if current_price > 0 else 0
            normalized_mean = price_mean / current_price if current_price > 0 else 1.0
            normalized_std = price_std / current_price if current_price > 0 else 0
            normalized_trend = price_trend / current_price if current_price > 0 else 0
            
            # Create simplified, normalized feature vector
            feature_vector = np.concatenate([
                normalized_sequence,
                [1.0, normalized_change, normalized_mean, normalized_std, normalized_trend]
            ])
            
            features.append(feature_vector)
            
            # Normalize target as well (next price relative to current price)
            target_price = df['price_usd'].iloc[i]
            normalized_target = target_price / current_price if current_price > 0 else 1.0
            targets.append(normalized_target)
        
        if len(features) == 0:
            return None, None
        
        return np.array(features), np.array(targets)
    
    def train_incremental_model(self, coin_id: str, features: np.ndarray, targets: np.ndarray):
        """Train or update model using incremental linear regression"""
        if coin_id not in self.models:
            # Initialize new linear regression model with conservative settings
            self.models[coin_id] = OnlineLinearRegression(
                learning_rate=0.001,  # Small learning rate for stability
                regularization=0.01   # Regularization to prevent overfitting
            )
            self.scalers[coin_id] = StandardScaler()
            self.price_history[coin_id] = deque(maxlen=100)  # Keep last 100 prices
        
        # Scale features
        if len(features) == 1:
            # Single sample - partial fit
            self.scalers[coin_id].partial_fit(features)
            features_scaled = self.scalers[coin_id].transform(features)
            self.models[coin_id].partial_fit(features_scaled, targets)
        else:
            # Multiple samples - fit scaler first time, then partial fit
            if not hasattr(self.scalers[coin_id], 'mean_') or self.scalers[coin_id].mean_ is None:
                # First time - fit scaler
                features_scaled = self.scalers[coin_id].fit_transform(features)
            else:
                # Update scaler incrementally
                self.scalers[coin_id].partial_fit(features)
                features_scaled = self.scalers[coin_id].transform(features)
            self.models[coin_id].partial_fit(features_scaled, targets)
        
        if not self.quiet_mode:
            weights, bias = self.models[coin_id].get_weights()
            equation = self.models[coin_id].get_equation_summary()
            print(f"✅ Linear regression model updated for {coin_id} with {len(features)} samples")
            print(f"   Features shape: {features.shape}, Weights norm: {np.linalg.norm(weights):.4f}")
            print(f"   Linear equation: {equation[:100]}{'...' if len(equation) > 100 else ''}")
    
    def forecast_prices(self, coin_id: str, current_price: float, recent_prices: list):
        """Forecast prices for next 5 minutes with conservative approach"""
        if not self.quiet_mode:
            print(f"🔮 Forecasting for {coin_id}: current_price={current_price}, recent_prices_count={len(recent_prices)}")
        
        if coin_id not in self.models or len(recent_prices) < 5:
            if not self.quiet_mode:
                print(f"❌ Using fallback forecast - no model or insufficient data")
            return self.simple_trend_forecast(current_price, recent_prices)
        
        # Use only the most recent prices (last 30 minutes for stability)
        sequence = np.array(recent_prices[-30:]) if len(recent_prices) >= 30 else np.array(recent_prices)
        
        # Calculate basic statistics
        price_mean = np.mean(sequence)
        price_std = np.std(sequence)
        current_price = float(current_price)
        
        if not self.quiet_mode:
            print(f"📊 Price stats: mean={price_mean:.2f}, std={price_std:.2f}, current={current_price:.2f}")
        
        # Calculate short-term trend (last 5 prices)
        short_trend = np.mean(np.diff(sequence[-5:])) if len(sequence) >= 5 else 0
        
        # Calculate medium-term trend (last 15 prices)
        medium_trend = np.mean(np.diff(sequence[-15:])) if len(sequence) >= 15 else short_trend
        
        # Prepare conservative features
        if len(sequence) < self.sequence_length:
            # Pad with current price instead of mean to avoid distortion
            padded_sequence = np.full(self.sequence_length, current_price)
            if len(sequence) > 0:
                padded_sequence[-len(sequence):] = sequence
            sequence = padded_sequence
        else:
            sequence = sequence[-self.sequence_length:]
        
        # Create simplified feature vector with normalized values
        feature_vector = np.concatenate([
            sequence / current_price,  # Normalize sequence to current price
            [1.0, short_trend/current_price, medium_trend/current_price, price_mean/current_price, price_std/current_price]
        ]).reshape(1, -1)
        
        if not self.quiet_mode:
            print(f"🔧 Feature vector shape: {feature_vector.shape}, sample values: {feature_vector[0][:5]}")
        
        # Scale features safely
        try:
            feature_vector_scaled = self.scalers[coin_id].transform(feature_vector)
            normalized_prediction = self.models[coin_id].predict(feature_vector_scaled)[0]
            
            # Convert back from normalized prediction (ratio relative to current price)
            next_price_prediction = normalized_prediction * current_price
            
            if not self.quiet_mode:
                print(f"🤖 Normalized prediction: {normalized_prediction:.6f}, scaled to price: {next_price_prediction:.2f}")
            
            # Validate prediction - normalized prediction should be close to 1.0
            if normalized_prediction < 0.5 or normalized_prediction > 2.0:
                if not self.quiet_mode:
                    print(f"⚠️  Invalid normalized prediction ({normalized_prediction:.6f}), using fallback")
                return self.simple_trend_forecast(current_price, recent_prices)
                
        except Exception as e:
            if not self.quiet_mode:
                print(f"❌ Model prediction failed: {e}")
            return self.simple_trend_forecast(current_price, recent_prices)
        
        # Apply strict outlier prevention
        max_change_pct = 2.0  # Maximum 2% change per minute (even more conservative)
        max_price = current_price * (1 + max_change_pct / 100)
        min_price = current_price * (1 - max_change_pct / 100)
        
        # Clip prediction to reasonable range
        next_price = np.clip(next_price_prediction, min_price, max_price)
        
        if not self.quiet_mode:
            print(f"📏 Price bounds: [{min_price:.2f}, {max_price:.2f}], clipped to: {next_price:.2f}")
        
        # If prediction is still unreasonable, use trend-based approach
        if abs(next_price - current_price) / current_price > 0.01:  # More than 1% change
            if not self.quiet_mode:
                print(f"⚠️  Prediction too large ({abs(next_price - current_price) / current_price * 100:.2f}%), using fallback")
            return self.simple_trend_forecast(current_price, recent_prices)
        
        # Generate conservative 5-minute forecast
        forecasts = []
        last_price = current_price
        
        # Calculate very conservative trend
        base_trend = (next_price - current_price) / current_price
        
        if not self.quiet_mode:
            print(f"📈 Base trend: {base_trend * 100:.4f}%")
        
        for i in range(self.forecast_horizon):
            # Apply strong dampening (trend reduces quickly)
            dampening = 0.3 ** (i + 1)  # Even stronger dampening
            trend_factor = base_trend * dampening
            
            # Limit individual minute changes to 0.5%
            trend_factor = np.clip(trend_factor, -0.005, 0.005)
            
            forecast_price = last_price * (1 + trend_factor)
            
            # Final safety check - 7% bounds as requested
            forecast_price = np.clip(
                forecast_price,
                current_price * 0.93,  # No more than 7% below current
                current_price * 1.07   # No more than 7% above current
            )
            
            forecasts.append({
                'minute': i + 1,
                'forecast_price': float(forecast_price),
                'timestamp': (datetime.now() + timedelta(minutes=i+1)).isoformat()
            })
            last_price = forecast_price
        
        if not self.quiet_mode:
            forecast_prices_list = [f['forecast_price'] for f in forecasts]
            print(f"✅ Generated forecasts: {forecast_prices_list}")
        
        return forecasts
    
    def simple_trend_forecast(self, current_price: float, recent_prices: list):
        """Simple trend-based forecasting as fallback"""
        if len(recent_prices) < 3:
            # No trend data, return flat forecast
            forecasts = []
            for i in range(self.forecast_horizon):
                forecasts.append({
                    'minute': i + 1,
                    'forecast_price': float(current_price),
                    'timestamp': (datetime.now() + timedelta(minutes=i+1)).isoformat()
                })
            return forecasts
        
        # Calculate very conservative trend
        recent_changes = np.diff(recent_prices[-10:]) if len(recent_prices) >= 10 else np.diff(recent_prices)
        avg_change = np.mean(recent_changes)
        
        # Limit trend to 0.5% per minute maximum
        max_change = current_price * 0.005
        avg_change = np.clip(avg_change, -max_change, max_change)
        
        forecasts = []
        last_price = current_price
        
        for i in range(self.forecast_horizon):
            # Apply diminishing trend
            dampening = 0.7 ** i
            change = avg_change * dampening
            forecast_price = last_price + change
            
            # Ensure forecast stays within 7% bounds
            forecast_price = np.clip(
                forecast_price,
                current_price * 0.93,  # No more than 7% below current
                current_price * 1.07   # No more than 7% above current
            )
            
            forecasts.append({
                'minute': i + 1,
                'forecast_price': float(forecast_price),
                'timestamp': (datetime.now() + timedelta(minutes=i+1)).isoformat()
            })
            last_price = forecast_price
        
        return forecasts
    
    def process_and_forecast(self, coin_id: str):
        """Process data and generate forecasts for a specific coin"""
        # Clear existing models to migrate to linear regression (temporary migration)
        # TODO: Remove this after all models are migrated to linear regression
        if coin_id in self.models and not hasattr(self, '_linear_models_migrated'):
            if not self.quiet_mode:
                print(f"🔄 Migrating model for {coin_id} to use linear regression")
            del self.models[coin_id]
            del self.scalers[coin_id]
            if coin_id in self.price_history:
                self.price_history[coin_id].clear()
            self._linear_models_migrated = True
        
        # Read data from MinIO (this is the source of training data)
        df = self.read_data_from_minio(coin_id)
        
        if df is None or len(df) < self.sequence_length + 1:
            return None
        
        # Prepare features from MinIO data
        features, targets = self.prepare_features(df)
        
        if features is None or len(features) == 0:
            return None
        
        # Train/update model incrementally using MinIO data
        self.train_incremental_model(coin_id, features, targets)
        
        # Filter data to get latest 60 minutes (1 data point per minute)
        current_time = df['timestamp'].iloc[-1]
        sixty_minutes_ago = current_time - timedelta(minutes=60)
        
        # Filter to last 60 minutes of data
        recent_df = df[df['timestamp'] >= sixty_minutes_ago].copy()
        
        if len(recent_df) < 10:  # Need at least 10 data points
            # Fallback to last available data points
            recent_df = df.tail(max(10, min(60, len(df)))).copy()
        
        # Get historical prices for display (last 60 minutes)
        historical_prices = recent_df['price_usd'].tolist()
        recent_prices = recent_df['price_usd'].tolist()
        current_price = recent_df['price_usd'].iloc[-1]
        
        # Get timestamps for historical prices
        historical_timestamps = recent_df['timestamp'].tolist()
        
        # Update price history
        self.price_history[coin_id].extend(recent_prices)
        
        # Generate forecast using the trained model
        forecasts = self.forecast_prices(coin_id, current_price, recent_prices)
        
        result = {
            'coin_id': coin_id,
            'current_price': float(current_price),
            'historical_prices': [float(p) for p in historical_prices],
            'historical_timestamps': [str(ts) for ts in historical_timestamps],
            'recent_prices': [float(p) for p in recent_prices],
            'forecasts': forecasts,
            'timestamp': datetime.now().isoformat()
        }
        
        # Save forecast data to MinIO
        self.save_forecast_to_minio(result)
        
        return result
    
    def get_top_50_coin_ids(self):
        """Get list of top 50 coin IDs from MinIO data"""
        try:
            date_str = datetime.now().strftime('%Y-%m-%d')
            filename = f'crypto_prices/top50_{date_str}.csv'
            
            try:
                # Try today's file first
                objectStream = self.minio_client.get_object(self.bucket_name, filename)
                csvContent = objectStream.read().decode('utf-8')
                objectStream.close()
                objectStream.release_conn()
            except:
                # Try yesterday's file
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                filename = f'crypto_prices/top50_{yesterday}.csv'
                objectStream = self.minio_client.get_object(self.bucket_name, filename)
                csvContent = objectStream.read().decode('utf-8')
                objectStream.close()
                objectStream.release_conn()
            
            if not csvContent.strip():
                return []
            
            # Parse CSV to get unique coin IDs
            lines = csvContent.strip().split('\\n')
            if len(lines) < 2:
                return []
            
            # Get coin IDs from the data
            coin_ids = set()
            for line in lines[1:]:  # Skip header
                parts = line.split(',')
                if len(parts) >= 2:
                    coin_id = parts[1].strip('\"')  # Remove quotes
                    if coin_id:
                        coin_ids.add(coin_id)
            
            coin_list = list(coin_ids)[:50]  # Ensure max 50 coins
            print(f"📋 Found {len(coin_list)} coins in MinIO data")
            return coin_list
            
        except Exception as e:
            print(f"⚠️ Error getting coin IDs: {e}")
            # Fallback to common coins
            return ['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana']
    
    def run_continuous_forecasting(self, coin_ids: list = None, interval_seconds: int = 60):
        """Run continuous forecasting service for 50 coins at a time"""
        print(f"🚀 Starting continuous forecasting service...")
        
        while True:
            try:
                # Get coin list (either provided or fetch from MinIO)
                if coin_ids is None:
                    current_coins = self.get_top_50_coin_ids()
                else:
                    current_coins = coin_ids[:50]  # Limit to 50 coins
                
                if not current_coins:
                    print("⚠️ No coins found, waiting...")
                    time.sleep(interval_seconds)
                    continue
                
                print(f"🔮 Processing forecasts for {len(current_coins)} coins...")
                successful_forecasts = 0
                
                # Process 50 coins in batches
                for i, coin_id in enumerate(current_coins):
                    try:
                        result = self.process_and_forecast(coin_id)
                        if result:
                            successful_forecasts += 1
                            forecast_count = len(result.get('forecasts', []))
                            print(f"📊 [{i+1}/{len(current_coins)}] {coin_id}: ${result['current_price']:.2f} → {forecast_count} forecasts ✅")
                        else:
                            print(f"⚠️ [{i+1}/{len(current_coins)}] {coin_id}: No data available")
                    except Exception as e:
                        print(f"❌ [{i+1}/{len(current_coins)}] {coin_id}: Error - {e}")
                        continue
                
                print(f"\\n✅ Batch complete: {successful_forecasts}/{len(current_coins)} successful forecasts")
                print(f"⏱️ Waiting {interval_seconds} seconds before next batch...\\n")
                time.sleep(interval_seconds)
                
            except Exception as e:
                print(f"❌ Error in continuous forecasting: {e}")
                time.sleep(interval_seconds)
    
    def save_forecast_to_minio(self, forecast_result: dict):
        """Save forecast data to MinIO with forecast_price filename"""
        try:
            coin_id = forecast_result['coin_id']
            timestamp = datetime.now()
            date_str = timestamp.strftime('%Y-%m-%d')
            
            # Save individual forecast as JSON
            filename = f'forecasts/{coin_id}_forecast_{date_str}.json'
            
            # Prepare forecast data
            forecast_data = {
                'coin_id': coin_id,
                'timestamp': forecast_result['timestamp'],
                'current_price': forecast_result['current_price'],
                'forecasts': forecast_result['forecasts'],
                'historical_prices': forecast_result['historical_prices'],
                'historical_timestamps': forecast_result['historical_timestamps']
            }
            
            # Convert to JSON
            json_data = json.dumps(forecast_data, indent=2, default=str)
            json_bytes = json_data.encode('utf-8')
            
            # Upload to MinIO
            self.minio_client.put_object(
                self.bucket_name,
                filename,
                io.BytesIO(json_bytes),
                len(json_bytes),
                content_type='application/json'
            )
            
            # Also save to CSV format with forecast_price filename for aggregated storage
            self.save_forecast_prices_to_csv(forecast_result)
            
            if not self.quiet_mode:
                print(f"💾 Saved forecast data to MinIO: {filename}")
                print(f"   File size: {len(json_bytes)} bytes")
                print(f"   Forecasts: {len(forecast_result.get('forecasts', []))} points")
            return True
            
        except Exception as e:
            print(f"⚠️ Error saving forecast to MinIO: {e}")
            return False
    
    def save_forecast_prices_to_csv(self, forecast_result: dict):
        """Save forecast prices to CSV file with forecast_price filename"""
        try:
            coin_id = forecast_result['coin_id']
            timestamp = datetime.now()
            date_str = timestamp.strftime('%Y-%m-%d')
            filename = f'crypto_prices/forecast_price_{date_str}.csv'
            
            # Prepare forecast data for CSV
            csv_rows = []
            for forecast in forecast_result.get('forecasts', []):
                record = {
                    'timestamp': forecast['timestamp'],
                    'coin_id': coin_id,
                    'forecast_minute': forecast['minute'],
                    'forecast_price': forecast['forecast_price'],
                    'current_price': forecast_result['current_price'],
                    'generated_at': forecast_result['timestamp']
                }
                
                csv_row = ','.join([
                    f'"{record["timestamp"]}"',
                    f'"{record["coin_id"]}"',
                    str(record['forecast_minute']),
                    str(record['forecast_price']),
                    str(record['current_price']),
                    f'"{record["generated_at"]}"'
                ])
                csv_rows.append(csv_row)
            
            # Define headers
            headers = 'timestamp,coin_id,forecast_minute,forecast_price,current_price,generated_at'
            
            # Try to read existing file and append/overwrite
            try:
                existing_object = self.minio_client.get_object(self.bucket_name, filename)
                existing_data = existing_object.read().decode('utf-8')
                existing_object.close()
                existing_object.release_conn()
                
                # Parse existing data to check for same coin/time combinations
                existing_lines = existing_data.strip().split('\n')
                if len(existing_lines) > 1:  # Has headers and data
                    data_lines = existing_lines[1:]
                    
                    # Filter out old forecasts for the same coin and similar timestamps
                    filtered_lines = []
                    current_time = timestamp
                    
                    for line in data_lines:
                        if line.strip():
                            parts = line.split(',')
                            if len(parts) >= 6:
                                line_coin_id = parts[1].strip('"')
                                line_generated_at = parts[5].strip('"')
                                
                                # Keep if different coin or older than 5 minutes
                                try:
                                    line_time = datetime.fromisoformat(line_generated_at.replace('Z', '+00:00'))
                                    time_diff = (current_time - line_time).total_seconds()
                                    
                                    # Keep if different coin or old forecast (>5 minutes)
                                    if line_coin_id != coin_id or time_diff > 300:
                                        filtered_lines.append(line)
                                except:
                                    # Keep if timestamp parsing fails
                                    filtered_lines.append(line)
                    
                    # Combine filtered existing data with new data
                    all_lines = [headers] + filtered_lines + csv_rows
                    final_csv_content = '\n'.join(all_lines)
                else:
                    # Empty or header-only file
                    final_csv_content = '\n'.join([headers] + csv_rows)
                    
            except Exception as e:
                # File doesn't exist, create new
                final_csv_content = '\n'.join([headers] + csv_rows)
            
            # Save to MinIO
            buffer = final_csv_content.encode('utf-8')
            self.minio_client.put_object(
                self.bucket_name,
                filename,
                io.BytesIO(buffer),
                len(buffer),
                content_type='text/csv'
            )
            
            if not self.quiet_mode:
                print(f"📊 Saved forecast prices to CSV: {filename} ({len(csv_rows)} forecasts)")
            return True
            
        except Exception as e:
            print(f"⚠️ Error saving forecast prices to CSV: {e}")
            return False
    
    def read_forecast_from_minio(self, coin_id: str):
        """Read forecast data from MinIO"""
        try:
            
            date_str = datetime.now().strftime('%Y-%m-%d')
            filename = f'forecasts/{coin_id}_forecast_{date_str}.json'
            
            try:
                # Try today's file
                response = self.minio_client.get_object(self.bucket_name, filename)
                data = json.loads(response.read().decode('utf-8'))
                response.close()
                response.release_conn()
                return data
            except Exception as e:
                # Try yesterday's file
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                filename_yesterday = f'forecasts/{coin_id}_forecast_{yesterday}.json'
                try:
                    response = self.minio_client.get_object(self.bucket_name, filename_yesterday)
                    data = json.loads(response.read().decode('utf-8'))
                    response.close()
                    response.release_conn()
                    return data
                except:
                    return None
                    
        except Exception as e:
            print(f"⚠️ Error reading forecast from MinIO: {e}")
            return None
    
    def close(self):
        """Clean up resources"""
        self.spark.stop()
        print("🛑 Online Forecasting Service stopped")

# Global instance
_forecasting_service = None

def get_forecasting_service(quiet_mode=False):
    """Get or create global forecasting service instance"""
    global _forecasting_service
    if _forecasting_service is None:
        _forecasting_service = OnlineForecastingService(quiet_mode=quiet_mode)
    return _forecasting_service

