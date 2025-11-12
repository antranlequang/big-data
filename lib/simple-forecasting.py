#!/usr/bin/env python3
"""
Simple Single-Variable Price Forecasting System
Real-time training and prediction based on current coin price data
"""

import os
import numpy as np
import pandas as pd
import json
import time
import threading
from datetime import datetime, timedelta
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
import requests
from typing import List, Dict, Optional, Tuple

class SimpleCryptoForecaster:
    def __init__(self, coin_id='bitcoin', sequence_length=10):
        """
        Initialize simple forecasting system
        
        Args:
            coin_id: Cryptocurrency to forecast (bitcoin, ethereum, etc.)
            sequence_length: Number of time steps to look back
        """
        self.coin_id = coin_id
        self.sequence_length = sequence_length
        self.model = None
        self.scaler = None
        self.is_training = False
        self.is_forecasting = False
        self.price_history = []
        self.predictions = []
        self.training_results = {}
        
        # Ensure directories exist
        os.makedirs('./data/simple_forecasting', exist_ok=True)
        
        print(f"🔮 Simple Forecaster initialized for {coin_id}")

    def fetch_historical_prices(self, days=7) -> List[float]:
        """Fetch historical price data from CoinGecko API"""
        try:
            url = f"https://api.coingecko.com/api/v3/coins/{self.coin_id}/market_chart"
            params = {
                'vs_currency': 'usd',
                'days': days,
                'interval': 'hourly'
            }
            
            response = requests.get(url, params=params, timeout=30)
            data = response.json()
            
            if 'prices' in data:
                # Extract just the price values (ignore timestamps)
                prices = [price[1] for price in data['prices']]
                print(f"✅ Fetched {len(prices)} price points for {self.coin_id}")
                return prices
            else:
                print(f"❌ No price data found for {self.coin_id}")
                return []
                
        except Exception as e:
            print(f"❌ Error fetching prices: {e}")
            return []

    def fetch_current_price(self) -> Optional[float]:
        """Fetch current price for the selected coin"""
        try:
            url = f"https://api.coingecko.com/api/v3/simple/price"
            params = {
                'ids': self.coin_id,
                'vs_currencies': 'usd'
            }
            
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            
            if self.coin_id in data:
                return data[self.coin_id]['usd']
            return None
            
        except Exception as e:
            print(f"❌ Error fetching current price: {e}")
            return None

    def prepare_data(self, prices: List[float]) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare price data for LSTM training"""
        if len(prices) < self.sequence_length + 1:
            raise ValueError(f"Need at least {self.sequence_length + 1} price points")
        
        # Normalize prices
        prices_array = np.array(prices).reshape(-1, 1)
        self.scaler = MinMaxScaler()
        normalized_prices = self.scaler.fit_transform(prices_array)
        
        # Create sequences
        X, y = [], []
        for i in range(len(normalized_prices) - self.sequence_length):
            X.append(normalized_prices[i:(i + self.sequence_length), 0])
            y.append(normalized_prices[i + self.sequence_length, 0])
        
        return np.array(X), np.array(y)

    def build_model(self, input_shape: tuple) -> Sequential:
        """Build simple LSTM model for price prediction"""
        model = Sequential([
            LSTM(50, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(50, return_sequences=False),
            Dropout(0.2),
            Dense(25),
            Dense(1)
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        return model

    def train_model(self, prices: List[float]) -> Dict:
        """Train the forecasting model"""
        print(f"🚀 Starting training with {len(prices)} price points...")
        self.is_training = True
        
        try:
            # Prepare data
            X, y = self.prepare_data(prices)
            print(f"📊 Created {len(X)} training sequences")
            
            # Split into train/test
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, shuffle=False
            )
            
            # Reshape for LSTM [samples, timesteps, features]
            X_train = X_train.reshape((X_train.shape[0], X_train.shape[1], 1))
            X_test = X_test.reshape((X_test.shape[0], X_test.shape[1], 1))
            
            print(f"📈 Training set: {X_train.shape}, Test set: {X_test.shape}")
            
            # Build and train model
            self.model = self.build_model((X_train.shape[1], 1))
            
            print("🧠 Training model...")
            history = self.model.fit(
                X_train, y_train,
                validation_data=(X_test, y_test),
                epochs=50,
                batch_size=16,
                verbose=1,
                shuffle=False
            )
            
            # Evaluate model
            train_pred = self.model.predict(X_train)
            test_pred = self.model.predict(X_test)
            
            # Calculate metrics (denormalized)
            train_pred_denorm = self.scaler.inverse_transform(train_pred.reshape(-1, 1))
            test_pred_denorm = self.scaler.inverse_transform(test_pred.reshape(-1, 1))
            y_train_denorm = self.scaler.inverse_transform(y_train.reshape(-1, 1))
            y_test_denorm = self.scaler.inverse_transform(y_test.reshape(-1, 1))
            
            train_mse = mean_squared_error(y_train_denorm, train_pred_denorm)
            test_mse = mean_squared_error(y_test_denorm, test_pred_denorm)
            train_mae = mean_absolute_error(y_train_denorm, train_pred_denorm)
            test_mae = mean_absolute_error(y_test_denorm, test_pred_denorm)
            
            # Store results
            self.training_results = {
                'timestamp': datetime.now().isoformat(),
                'coin_id': self.coin_id,
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'train_mse': float(train_mse),
                'test_mse': float(test_mse),
                'train_mae': float(train_mae),
                'test_mae': float(test_mae),
                'sequence_length': self.sequence_length,
                'status': 'completed'
            }
            
            # Save model and scaler
            model_path = f'./data/simple_forecasting/{self.coin_id}_model.h5'
            scaler_path = f'./data/simple_forecasting/{self.coin_id}_scaler.pkl'
            
            self.model.save(model_path)
            
            import joblib
            joblib.dump(self.scaler, scaler_path)
            
            print(f"✅ Training completed!")
            print(f"   📊 Test MSE: {test_mse:.2f}")
            print(f"   📊 Test MAE: {test_mae:.2f}")
            print(f"   💾 Model saved to {model_path}")
            
            return self.training_results
            
        except Exception as e:
            print(f"❌ Training failed: {e}")
            self.training_results = {
                'timestamp': datetime.now().isoformat(),
                'status': 'failed',
                'error': str(e)
            }
            return self.training_results
        finally:
            self.is_training = False

    def load_model(self) -> bool:
        """Load pre-trained model and scaler"""
        try:
            model_path = f'./data/simple_forecasting/{self.coin_id}_model.h5'
            scaler_path = f'./data/simple_forecasting/{self.coin_id}_scaler.pkl'
            
            if os.path.exists(model_path):
                self.model = tf.keras.models.load_model(model_path)
                print(f"✅ Model loaded from {model_path}")
                
                # Try to load scaler
                if os.path.exists(scaler_path):
                    import joblib
                    self.scaler = joblib.load(scaler_path)
                    print(f"✅ Scaler loaded from {scaler_path}")
                else:
                    print("⚠️ Scaler not found, will create new one if needed")
                
                return True
            else:
                print(f"❌ Model not found at {model_path}")
                return False
                
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            return False

    def predict_next_price(self, recent_prices: List[float]) -> Optional[float]:
        """Predict next price based on recent prices"""
        if self.model is None:
            if not self.load_model():
                return None
        
        if self.scaler is None:
            return None
        
        try:
            # Take last sequence_length prices
            if len(recent_prices) < self.sequence_length:
                return None
            
            last_sequence = recent_prices[-self.sequence_length:]
            
            # Normalize
            last_sequence_array = np.array(last_sequence).reshape(-1, 1)
            last_sequence_norm = self.scaler.transform(last_sequence_array)
            
            # Reshape for prediction
            prediction_input = last_sequence_norm.reshape((1, self.sequence_length, 1))
            
            # Predict
            prediction_norm = self.model.predict(prediction_input, verbose=0)
            prediction = self.scaler.inverse_transform(prediction_norm.reshape(-1, 1))
            
            return float(prediction[0][0])
            
        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return None

    def start_forecasting(self, update_interval=60):
        """Start real-time forecasting loop"""
        if self.is_forecasting:
            print("⚠️ Forecasting already running")
            return
        
        if self.model is None:
            print("❌ No trained model available")
            return
        
        print(f"🔮 Starting real-time forecasting (update every {update_interval}s)")
        self.is_forecasting = True
        
        def forecasting_loop():
            while self.is_forecasting:
                try:
                    # Get current price
                    current_price = self.fetch_current_price()
                    if current_price:
                        self.price_history.append({
                            'timestamp': datetime.now().isoformat(),
                            'price': current_price
                        })
                        
                        # Keep only recent history (last 100 points)
                        if len(self.price_history) > 100:
                            self.price_history = self.price_history[-50:]
                        
                        # Make prediction if we have enough data
                        if len(self.price_history) >= self.sequence_length:
                            recent_prices = [p['price'] for p in self.price_history]
                            next_price = self.predict_next_price(recent_prices)
                            
                            if next_price:
                                prediction_result = {
                                    'timestamp': datetime.now().isoformat(),
                                    'current_price': current_price,
                                    'predicted_next_price': next_price,
                                    'price_change': next_price - current_price,
                                    'price_change_percent': ((next_price - current_price) / current_price) * 100,
                                    'coin_id': self.coin_id
                                }
                                
                                # Save prediction
                                self.save_prediction(prediction_result)
                                
                                print(f"🔮 {self.coin_id}: ${current_price:.2f} → ${next_price:.2f} ({prediction_result['price_change_percent']:+.2f}%)")
                    
                    time.sleep(update_interval)
                    
                except Exception as e:
                    print(f"❌ Forecasting error: {e}")
                    time.sleep(update_interval)
        
        # Start in background thread
        forecast_thread = threading.Thread(target=forecasting_loop, daemon=True)
        forecast_thread.start()

    def stop_forecasting(self):
        """Stop real-time forecasting"""
        self.is_forecasting = False
        print("🛑 Forecasting stopped")

    def save_prediction(self, prediction: Dict):
        """Save prediction result"""
        try:
            # Save latest prediction
            prediction_path = f'./data/simple_forecasting/{self.coin_id}_latest_prediction.json'
            with open(prediction_path, 'w') as f:
                json.dump(prediction, f, indent=2)
            
            # Append to history
            history_path = f'./data/simple_forecasting/{self.coin_id}_prediction_history.jsonl'
            with open(history_path, 'a') as f:
                json.dump(prediction, f)
                f.write('\n')
                
        except Exception as e:
            print(f"❌ Error saving prediction: {e}")

    def get_training_status(self) -> Dict:
        """Get current training status"""
        return {
            'is_training': self.is_training,
            'is_forecasting': self.is_forecasting,
            'results': self.training_results,
            'coin_id': self.coin_id
        }

    def get_latest_prediction(self) -> Optional[Dict]:
        """Get latest prediction"""
        try:
            prediction_path = f'./data/simple_forecasting/{self.coin_id}_latest_prediction.json'
            with open(prediction_path, 'r') as f:
                return json.load(f)
        except:
            return None

def main():
    """Test the forecasting system"""
    forecaster = SimpleCryptoForecaster('bitcoin')
    
    # Fetch historical data and train
    prices = forecaster.fetch_historical_prices(days=7)
    if prices:
        results = forecaster.train_model(prices)
        print("Training results:", results)
        
        # Start forecasting
        forecaster.start_forecasting(update_interval=30)
        
        try:
            time.sleep(300)  # Run for 5 minutes
        except KeyboardInterrupt:
            pass
        finally:
            forecaster.stop_forecasting()

if __name__ == "__main__":
    main()