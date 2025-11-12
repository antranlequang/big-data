#!/usr/bin/env python3
"""
Real-time Forecasting & Risk Warning System
Implements Phase 4: Real-time Forecasting & Warning
"""

import os
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
import requests
import joblib
from datetime import datetime, timedelta
import json
import time
import threading
from typing import Dict, List, Tuple, Optional

class RealTimeForecastingSystem:
    def __init__(self, model_path=None, scaler_path=None, sequence_length=24):
        """
        Initialize real-time forecasting system
        
        Args:
            model_path: Path to trained LSTM model
            scaler_path: Path to feature scaler
            sequence_length: Number of time steps for prediction
        """
        self.sequence_length = sequence_length
        self.model = None
        self.scaler = None
        self.is_running = False
        self.latest_data = []
        self.risk_threshold = 0.7  # Warning threshold for risk probability
        
        # Load model and scaler
        self.load_model_and_scaler(model_path, scaler_path)
        
        print("🔮 Real-time forecasting system initialized")

    def load_model_and_scaler(self, model_path=None, scaler_path=None):
        """4.1 Load the post-CT model and scaler"""
        try:
            # Use default paths if not provided
            if model_path is None:
                model_path = './models/crypto_risk_base_model_base_model.h5'
            if scaler_path is None:
                scaler_path = './data/processed/feature_scaler.pkl'
            
            # Load trained model
            self.model = keras.models.load_model(model_path)
            print(f"✅ Loaded model from {model_path}")
            
            # Load feature scaler
            self.scaler = joblib.load(scaler_path)
            print(f"✅ Loaded scaler from {scaler_path}")
            
            return True
        except Exception as e:
            print(f"❌ Error loading model/scaler: {e}")
            return False

    def fetch_current_crypto_data(self):
        """Fetch current crypto data from CoinGecko API"""
        try:
            url = "https://api.coingecko.com/api/v3/coins/markets"
            params = {
                'vs_currency': 'usd',
                'ids': 'bitcoin',
                'order': 'market_cap_desc',
                'per_page': 1,
                'page': 1,
                'sparkline': False,
                'price_change_percentage': '1h,24h,7d'
            }
            
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            
            if data and len(data) > 0:
                coin = data[0]
                return {
                    'timestamp': datetime.now(),
                    'price': coin.get('current_price', 0),
                    'volume': coin.get('total_volume', 0),
                    'market_cap': coin.get('market_cap', 0),
                    'high_24h': coin.get('high_24h', 0),
                    'low_24h': coin.get('low_24h', 0),
                    'price_change_1h': coin.get('price_change_percentage_1h_in_currency', 0),
                    'price_change_24h': coin.get('price_change_percentage_24h_in_currency', 0),
                    'price_change_7d': coin.get('price_change_percentage_7d_in_currency', 0)
                }
        except Exception as e:
            print(f"❌ Error fetching crypto data: {e}")
            return None

    def fetch_macro_data(self):
        """Fetch basic macro indicators (simplified for real-time)"""
        # In production, these would come from financial APIs
        # For now, using reasonable synthetic values
        return {
            'sp500_price': 4500 + 50 * np.random.normal(),
            'gold_price': 2000 + 20 * np.random.normal(),
            'vix': 15 + 5 * abs(np.random.normal()),
            'dxy': 100 + 2 * np.random.normal(),
            'oil_price': 80 + 10 * np.random.normal(),
            'sentiment_score': 0.5 + 0.1 * np.random.normal()
        }

    def calculate_features(self, current_data: Dict, historical_data: List[Dict]) -> Dict:
        """Calculate required features for prediction"""
        if len(historical_data) < 2:
            # Not enough data for calculations
            return None
        
        # Get previous price for log return calculation
        prev_price = historical_data[-1]['price']
        log_return = np.log(current_data['price'] / prev_price) if prev_price > 0 else 0
        
        # Calculate rolling volatility (simplified)
        recent_returns = []
        for i in range(1, min(len(historical_data), 24)):
            if historical_data[-i-1]['price'] > 0:
                ret = np.log(historical_data[-i]['price'] / historical_data[-i-1]['price'])
                recent_returns.append(ret)
        
        volatility_24h = np.std(recent_returns) if recent_returns else 0
        
        # Calculate moving averages
        recent_prices = [d['price'] for d in historical_data[-24:]]
        recent_volumes = [d['volume'] for d in historical_data[-24:]]
        price_ma_24h = np.mean(recent_prices) if recent_prices else current_data['price']
        volume_ma_24h = np.mean(recent_volumes) if recent_volumes else current_data['volume']
        
        # Calculate RSI signal (simplified)
        rsi_signal = 1.0 if current_data['price_change_24h'] > 5 else (-1.0 if current_data['price_change_24h'] < -5 else 0.0)
        
        # Get macro data
        macro_data = self.fetch_macro_data()
        
        return {
            'price': current_data['price'],
            'volume': current_data['volume'],
            'log_return': log_return,
            'volatility_24h': volatility_24h,
            'price_change_1h': current_data['price_change_1h'],
            'price_change_24h': current_data['price_change_24h'],
            'sentiment_score': macro_data['sentiment_score'],
            'sp500_price': macro_data['sp500_price'],
            'gold_price': macro_data['gold_price'],
            'vix': macro_data['vix'],
            'dxy': macro_data['dxy'],
            'oil_price': macro_data['oil_price'],
            'btc_sp500_ratio': current_data['price'] / macro_data['sp500_price'],
            'gold_btc_ratio': macro_data['gold_price'] / current_data['price'],
            'rsi_signal': rsi_signal
        }

    def make_prediction(self, features_sequence: np.ndarray) -> Tuple[float, bool]:
        """
        4.2 Make instantaneous forecast using post-CT model
        
        Returns:
            risk_probability: Probability of risk event (0-1)
            warning_signal: True if risk > threshold
        """
        if self.model is None:
            return 0.0, False
        
        try:
            # Make prediction
            prediction = self.model.predict(features_sequence, verbose=0)
            risk_probability = float(prediction[0][0])
            
            # Generate warning signal
            warning_signal = risk_probability > self.risk_threshold
            
            return risk_probability, warning_signal
        except Exception as e:
            print(f"❌ Error making prediction: {e}")
            return 0.0, False

    def prepare_sequence_for_prediction(self, historical_features: List[Dict]) -> Optional[np.ndarray]:
        """Prepare feature sequence for LSTM prediction"""
        if len(historical_features) < self.sequence_length:
            return None
        
        # Get latest sequence
        recent_features = historical_features[-self.sequence_length:]
        
        # Convert to feature array
        feature_columns = [
            'price', 'volume', 'log_return', 'volatility_24h', 
            'price_change_1h', 'price_change_24h', 'sentiment_score',
            'sp500_price', 'gold_price', 'vix', 'dxy', 'oil_price',
            'btc_sp500_ratio', 'gold_btc_ratio', 'rsi_signal'
        ]
        
        feature_matrix = []
        for features in recent_features:
            row = [features.get(col, 0) for col in feature_columns]
            feature_matrix.append(row)
        
        feature_array = np.array(feature_matrix)
        
        # Normalize using saved scaler
        if self.scaler is not None:
            try:
                normalized_features = self.scaler.transform(feature_array)
            except:
                # If scaler fails, return raw features
                normalized_features = feature_array
        else:
            normalized_features = feature_array
        
        # Reshape for LSTM: [1, sequence_length, n_features]
        sequence = normalized_features.reshape(1, self.sequence_length, len(feature_columns))
        
        return sequence

    def save_prediction_result(self, result: Dict):
        """Save prediction result for web app consumption"""
        try:
            os.makedirs('./data/predictions', exist_ok=True)
            
            result_path = './data/predictions/latest_prediction.json'
            with open(result_path, 'w') as f:
                json.dump(result, f, indent=2, default=str)
            
            # Also maintain a history
            history_path = './data/predictions/prediction_history.jsonl'
            with open(history_path, 'a') as f:
                json.dump(result, f, default=str)
                f.write('\n')
                
        except Exception as e:
            print(f"❌ Error saving prediction: {e}")

    def run_real_time_forecasting(self, update_interval=60):
        """
        4.3 Run continuous real-time forecasting
        Main loop for real-time predictions
        """
        print(f"🚀 Starting real-time forecasting (update every {update_interval}s)")
        self.is_running = True
        
        historical_features = []
        
        while self.is_running:
            try:
                # Fetch current data
                current_crypto = self.fetch_current_crypto_data()
                if current_crypto is None:
                    time.sleep(update_interval)
                    continue
                
                # Calculate features
                current_features = self.calculate_features(current_crypto, self.latest_data)
                if current_features is None:
                    # Add to historical data and continue
                    self.latest_data.append(current_crypto)
                    time.sleep(update_interval)
                    continue
                
                # Add to historical features
                historical_features.append(current_features)
                
                # Keep only recent data
                if len(historical_features) > 100:
                    historical_features = historical_features[-50:]
                if len(self.latest_data) > 100:
                    self.latest_data = self.latest_data[-50:]
                
                # Make prediction if we have enough data
                prediction_result = {
                    'timestamp': datetime.now().isoformat(),
                    'current_price': current_crypto['price'],
                    'risk_probability': 0.0,
                    'warning_signal': False,
                    'status': 'insufficient_data'
                }
                
                if len(historical_features) >= self.sequence_length:
                    sequence = self.prepare_sequence_for_prediction(historical_features)
                    if sequence is not None:
                        risk_prob, warning = self.make_prediction(sequence)
                        
                        prediction_result.update({
                            'risk_probability': risk_prob,
                            'warning_signal': warning,
                            'status': 'active'
                        })
                        
                        # Log prediction
                        warning_text = "⚠️  HIGH RISK" if warning else "✅ Normal"
                        print(f"🔮 Prediction: {risk_prob:.3f} | {warning_text} | Price: ${current_crypto['price']:,.2f}")
                
                # Save result for web app
                self.save_prediction_result(prediction_result)
                
                # Update historical data
                self.latest_data.append(current_crypto)
                
                # Wait for next update
                time.sleep(update_interval)
                
            except KeyboardInterrupt:
                print("\n🛑 Stopping real-time forecasting...")
                break
            except Exception as e:
                print(f"❌ Error in forecasting loop: {e}")
                time.sleep(update_interval)
        
        self.is_running = False
        print("✅ Real-time forecasting stopped")

    def start_background_forecasting(self, update_interval=60):
        """Start forecasting in background thread"""
        if self.is_running:
            print("⚠️  Forecasting already running")
            return
        
        forecast_thread = threading.Thread(
            target=self.run_real_time_forecasting,
            args=(update_interval,),
            daemon=True
        )
        forecast_thread.start()
        print("🎯 Background forecasting started")

    def stop_forecasting(self):
        """Stop real-time forecasting"""
        self.is_running = False
        print("🛑 Forecasting stop signal sent")

    def get_latest_prediction(self) -> Optional[Dict]:
        """Get latest prediction for web app"""
        try:
            with open('./data/predictions/latest_prediction.json', 'r') as f:
                return json.load(f)
        except:
            return None

def main():
    """Main function to run real-time forecasting"""
    print("🔮 Starting Real-time Crypto Risk Forecasting System")
    
    # Initialize forecasting system
    forecaster = RealTimeForecastingSystem()
    
    if forecaster.model is None:
        print("❌ Model not loaded. Please train the model first.")
        return
    
    try:
        # Run real-time forecasting
        forecaster.run_real_time_forecasting(update_interval=60)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
    finally:
        forecaster.stop_forecasting()

if __name__ == "__main__":
    main()