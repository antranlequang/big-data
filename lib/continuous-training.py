#!/usr/bin/env python3
"""
Continuous Training (CT) Pipeline for Real-time Crypto Risk Prediction
Implements Phase 3: Continuous Training (CT - Real-time Loop)
"""

import os
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
import requests
import time
import json
import joblib
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Optional
import logging
from collections import deque
import threading
import queue

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ContinuousTrainingPipeline:
    def __init__(self, model_path='./models/crypto_risk_base_model.h5', 
                 scaler_path='./data/processed/feature_scaler.pkl',
                 sequence_length=24, update_interval=60):
        """
        Initialize Continuous Training Pipeline
        
        Args:
            model_path: Path to the base LSTM model
            scaler_path: Path to the feature scaler
            sequence_length: Number of timesteps for LSTM input
            update_interval: Seconds between updates (default: 60s = 1 minute)
        """
        self.model_path = model_path
        self.scaler_path = scaler_path
        self.sequence_length = sequence_length
        self.update_interval = update_interval
        
        # Model and preprocessing
        self.model = None
        self.scaler = None
        
        # Real-time data storage
        self.historic_df = pd.DataFrame()
        self.data_buffer = deque(maxlen=1000)  # Keep last 1000 data points
        
        # CT tracking
        self.ct_metrics = {
            'updates_count': 0,
            'losses': [],
            'accuracies': [],
            'training_times': [],
            'last_update': None
        }
        
        # Threading
        self.is_running = False
        self.data_queue = queue.Queue()
        
        # Feature columns (must match ETL pipeline)
        self.feature_columns = [
            'price', 'volume', 'log_return', 'volatility_24h', 
            'price_change_1h', 'price_change_24h', 'sentiment_score',
            'sp500_price', 'gold_price', 'vix', 'dxy', 'oil_price',
            'btc_sp500_ratio', 'gold_btc_ratio', 'rsi_signal'
        ]
        
        logger.info("🤖 Continuous Training Pipeline initialized")

    def load_base_model(self) -> bool:
        """Load the pre-trained base model and scaler"""
        try:
            # Load LSTM model
            self.model = keras.models.load_model(self.model_path)
            logger.info(f"✅ Base model loaded from {self.model_path}")
            
            # Load feature scaler
            self.scaler = joblib.load(self.scaler_path)
            logger.info(f"✅ Feature scaler loaded from {self.scaler_path}")
            
            return True
        except Exception as e:
            logger.error(f"❌ Error loading model/scaler: {e}")
            return False

    def collect_real_time_data(self) -> Optional[Dict]:
        """
        3.1 Collect real-time data from CoinGecko API
        Get latest price, timestamp, and sentiment data
        """
        try:
            # Fetch real-time crypto data
            crypto_url = "https://api.coingecko.com/api/v3/simple/price"
            crypto_params = {
                "ids": "bitcoin",
                "vs_currencies": "usd",
                "include_24hr_change": "true",
                "include_24hr_vol": "true"
            }
            
            crypto_response = requests.get(crypto_url, params=crypto_params, timeout=10)
            crypto_data = crypto_response.json()
            
            # Fetch additional market data (simplified)
            # In production, you'd fetch real sentiment and macro data
            timestamp = datetime.now(timezone.utc)
            
            btc_price = crypto_data['bitcoin']['usd']
            btc_volume = crypto_data['bitcoin']['usd_24h_vol']
            btc_change_24h = crypto_data['bitcoin']['usd_24h_change']
            
            # Create synthetic data for features not available in real-time
            # In production, replace with real data sources
            data_point = {
                'timestamp': timestamp,
                'price': btc_price,
                'volume': btc_volume,
                'price_change_24h': btc_change_24h,
                'price_change_1h': btc_change_24h * 0.1,  # Approximate
                'sentiment_score': 0.5 + np.random.normal(0, 0.1),  # Synthetic sentiment
                'sp500_price': 4500 + np.random.normal(0, 10),  # Synthetic S&P 500
                'gold_price': 2000 + np.random.normal(0, 5),   # Synthetic gold
                'vix': 20 + np.random.normal(0, 2),            # Synthetic VIX
                'dxy': 100 + np.random.normal(0, 1),           # Synthetic DXY
                'oil_price': 80 + np.random.normal(0, 2)       # Synthetic oil
            }
            
            logger.info(f"📡 Real-time data collected: BTC ${btc_price:,.2f}")
            return data_point
            
        except Exception as e:
            logger.error(f"❌ Error collecting real-time data: {e}")
            return None

    def update_historic_data(self, new_data: Dict):
        """
        3.2 Update History
        Append new data to historical dataset and maintain buffer
        """
        try:
            # Add calculated features
            if len(self.data_buffer) > 0:
                prev_price = self.data_buffer[-1]['price']
                new_data['log_return'] = np.log(new_data['price'] / prev_price) if prev_price > 0 else 0
            else:
                new_data['log_return'] = 0
            
            # Calculate additional features
            if len(self.data_buffer) >= 24:
                # Rolling volatility (24-hour window)
                recent_returns = [item.get('log_return', 0) for item in list(self.data_buffer)[-24:]]
                new_data['volatility_24h'] = np.std(recent_returns) if len(recent_returns) > 1 else 0
            else:
                new_data['volatility_24h'] = 0
            
            # Technical indicators
            new_data['btc_sp500_ratio'] = new_data['price'] / new_data['sp500_price']
            new_data['gold_btc_ratio'] = new_data['gold_price'] / new_data['price']
            new_data['rsi_signal'] = 1.0 if new_data['price_change_24h'] > 5 else (-1.0 if new_data['price_change_24h'] < -5 else 0.0)
            
            # Add to buffer
            self.data_buffer.append(new_data)
            
            # Update historic DataFrame
            new_row = pd.DataFrame([new_data])
            self.historic_df = pd.concat([self.historic_df, new_row], ignore_index=True)
            
            # Keep only recent data to prevent memory issues
            if len(self.historic_df) > 10000:
                self.historic_df = self.historic_df.tail(5000).reset_index(drop=True)
            
            logger.info(f"📊 Historic data updated: {len(self.data_buffer)} points in buffer")
            
        except Exception as e:
            logger.error(f"❌ Error updating historic data: {e}")

    def prepare_training_batch(self, batch_size: int = 32) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        """
        Prepare training batch from recent data
        Create sequences and target variables for incremental training
        """
        try:
            if len(self.data_buffer) < self.sequence_length + 1:
                logger.warning(f"⚠️ Not enough data for training batch: {len(self.data_buffer)} < {self.sequence_length + 1}")
                return None, None
            
            # Convert buffer to DataFrame for easier manipulation
            recent_df = pd.DataFrame(list(self.data_buffer))
            
            # Ensure all feature columns are present
            for col in self.feature_columns:
                if col not in recent_df.columns:
                    recent_df[col] = 0  # Fill missing features with 0
            
            # Create risk flags (synthetic for demo - in production, calculate from actual future returns)
            recent_df['risk_flag'] = (recent_df['log_return'] < -0.02).astype(int)
            
            # Prepare sequences
            feature_data = recent_df[self.feature_columns].values
            
            # Normalize features
            if self.scaler is not None:
                try:
                    normalized_features = self.scaler.transform(feature_data)
                except:
                    # If scaling fails, use raw features
                    normalized_features = feature_data
                    logger.warning("⚠️ Feature scaling failed, using raw features")
            else:
                normalized_features = feature_data
            
            # Create training sequences
            X_batch = []
            y_batch = []
            
            # Use the most recent sequences for training
            num_sequences = min(batch_size, len(normalized_features) - self.sequence_length)
            
            for i in range(num_sequences):
                start_idx = len(normalized_features) - self.sequence_length - num_sequences + i
                end_idx = start_idx + self.sequence_length
                
                if start_idx >= 0 and end_idx < len(normalized_features):
                    X_batch.append(normalized_features[start_idx:end_idx])
                    y_batch.append(recent_df['risk_flag'].iloc[end_idx])
            
            if len(X_batch) == 0:
                return None, None
            
            X_batch = np.array(X_batch)
            y_batch = np.array(y_batch)
            
            logger.info(f"🔄 Training batch prepared: X={X_batch.shape}, y={y_batch.shape}")
            return X_batch, y_batch
            
        except Exception as e:
            logger.error(f"❌ Error preparing training batch: {e}")
            return None, None

    def incremental_training(self, X_batch: np.ndarray, y_batch: np.ndarray, epochs: int = 1) -> Optional[float]:
        """
        3.3 Incremental Training
        Train model on latest data batch with small epochs
        """
        try:
            if self.model is None:
                logger.error("❌ Model not loaded")
                return None
            
            start_time = time.time()
            
            # Perform incremental training
            history = self.model.fit(
                X_batch, y_batch,
                epochs=epochs,
                batch_size=min(32, len(X_batch)),
                verbose=0,  # Silent training
                shuffle=True
            )
            
            training_time = time.time() - start_time
            final_loss = history.history['loss'][-1]
            final_accuracy = history.history['accuracy'][-1] if 'accuracy' in history.history else 0
            
            # Update CT metrics
            self.ct_metrics['updates_count'] += 1
            self.ct_metrics['losses'].append(final_loss)
            self.ct_metrics['accuracies'].append(final_accuracy)
            self.ct_metrics['training_times'].append(training_time)
            self.ct_metrics['last_update'] = datetime.now()
            
            # Keep only recent metrics
            max_history = 100
            for key in ['losses', 'accuracies', 'training_times']:
                if len(self.ct_metrics[key]) > max_history:
                    self.ct_metrics[key] = self.ct_metrics[key][-max_history:]
            
            logger.info(f"🔄 Incremental training completed: Loss={final_loss:.4f}, Accuracy={final_accuracy:.4f}, Time={training_time:.2f}s")
            return final_loss
            
        except Exception as e:
            logger.error(f"❌ Error in incremental training: {e}")
            return None

    def track_model_drift(self) -> Dict:
        """
        3.4 Model Drift Tracking
        Monitor CT model quality and performance degradation
        """
        if len(self.ct_metrics['losses']) == 0:
            return {'status': 'no_data'}
        
        recent_losses = self.ct_metrics['losses'][-10:]  # Last 10 updates
        recent_accuracies = self.ct_metrics['accuracies'][-10:]
        
        # Calculate drift metrics
        loss_trend = np.polyfit(range(len(recent_losses)), recent_losses, 1)[0] if len(recent_losses) > 1 else 0
        accuracy_trend = np.polyfit(range(len(recent_accuracies)), recent_accuracies, 1)[0] if len(recent_accuracies) > 1 else 0
        
        avg_loss = np.mean(recent_losses)
        avg_accuracy = np.mean(recent_accuracies)
        loss_volatility = np.std(recent_losses) if len(recent_losses) > 1 else 0
        
        # Determine drift status
        drift_status = 'stable'
        if loss_trend > 0.01:  # Loss increasing
            drift_status = 'degrading'
        elif loss_volatility > 0.5:  # High volatility
            drift_status = 'unstable'
        elif avg_accuracy < 0.6:  # Low accuracy
            drift_status = 'poor_performance'
        
        drift_metrics = {
            'status': drift_status,
            'updates_count': self.ct_metrics['updates_count'],
            'avg_loss': avg_loss,
            'avg_accuracy': avg_accuracy,
            'loss_trend': loss_trend,
            'accuracy_trend': accuracy_trend,
            'loss_volatility': loss_volatility,
            'last_update': self.ct_metrics['last_update']
        }
        
        logger.info(f"📊 Model drift status: {drift_status}, Avg Loss: {avg_loss:.4f}, Avg Acc: {avg_accuracy:.4f}")
        return drift_metrics

    def continuous_training_loop(self):
        """
        Main continuous training loop
        Runs data collection, training, and drift monitoring
        """
        logger.info("🚀 Starting continuous training loop...")
        
        while self.is_running:
            try:
                # 3.1 Collect real-time data
                new_data = self.collect_real_time_data()
                if new_data is None:
                    time.sleep(self.update_interval)
                    continue
                
                # 3.2 Update historic data
                self.update_historic_data(new_data)
                
                # 3.3 Incremental training (only if we have enough data)
                if len(self.data_buffer) >= self.sequence_length + 10:
                    X_batch, y_batch = self.prepare_training_batch(batch_size=16)
                    
                    if X_batch is not None and y_batch is not None:
                        loss = self.incremental_training(X_batch, y_batch, epochs=1)
                        
                        # 3.4 Track model drift
                        drift_metrics = self.track_model_drift()
                        
                        # Save updated model periodically
                        if self.ct_metrics['updates_count'] % 10 == 0:
                            self.save_updated_model()
                    else:
                        logger.warning("⚠️ Could not prepare training batch")
                else:
                    logger.info(f"📊 Collecting data... ({len(self.data_buffer)}/{self.sequence_length + 10})")
                
                # Wait for next update
                time.sleep(self.update_interval)
                
            except Exception as e:
                logger.error(f"❌ Error in continuous training loop: {e}")
                time.sleep(self.update_interval)

    def start_continuous_training(self):
        """Start the continuous training process in a separate thread"""
        if not self.load_base_model():
            logger.error("❌ Cannot start continuous training without base model")
            return False
        
        if self.is_running:
            logger.warning("⚠️ Continuous training already running")
            return False
        
        self.is_running = True
        self.training_thread = threading.Thread(target=self.continuous_training_loop, daemon=True)
        self.training_thread.start()
        
        logger.info("✅ Continuous training started")
        return True

    def stop_continuous_training(self):
        """Stop the continuous training process"""
        self.is_running = False
        if hasattr(self, 'training_thread'):
            self.training_thread.join(timeout=5)
        logger.info("🛑 Continuous training stopped")

    def save_updated_model(self):
        """Save the continuously trained model"""
        try:
            if self.model is not None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                model_path = f"./models/crypto_risk_ct_{timestamp}.h5"
                self.model.save(model_path)
                
                # Also save as latest
                latest_path = "./models/crypto_risk_ct_latest.h5"
                self.model.save(latest_path)
                
                logger.info(f"💾 Updated model saved: {model_path}")
        except Exception as e:
            logger.error(f"❌ Error saving updated model: {e}")

    def get_training_status(self) -> Dict:
        """Get current training status and metrics"""
        drift_metrics = self.track_model_drift()
        
        status = {
            'is_running': self.is_running,
            'data_points': len(self.data_buffer),
            'updates_count': self.ct_metrics['updates_count'],
            'last_update': self.ct_metrics['last_update'],
            'drift_metrics': drift_metrics,
            'recent_performance': {
                'avg_loss': np.mean(self.ct_metrics['losses'][-5:]) if len(self.ct_metrics['losses']) >= 5 else None,
                'avg_accuracy': np.mean(self.ct_metrics['accuracies'][-5:]) if len(self.ct_metrics['accuracies']) >= 5 else None
            }
        }
        
        return status

if __name__ == "__main__":
    # Example usage
    ct_pipeline = ContinuousTrainingPipeline(
        update_interval=60  # Update every 60 seconds
    )
    
    try:
        # Start continuous training
        if ct_pipeline.start_continuous_training():
            print("🚀 Continuous training started successfully!")
            print("Press Ctrl+C to stop...")
            
            # Monitor training
            while True:
                time.sleep(30)  # Check status every 30 seconds
                status = ct_pipeline.get_training_status()
                print(f"📊 Training Status: {status['updates_count']} updates, {status['data_points']} data points")
                
    except KeyboardInterrupt:
        print("\n🛑 Stopping continuous training...")
        ct_pipeline.stop_continuous_training()
        print("✅ Continuous training stopped")