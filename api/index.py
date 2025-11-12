#!/usr/bin/env python3
"""
Vercel Python API Handler
Main entry point for Python services on Vercel
"""

import os
import sys
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add lib directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))

app = Flask(__name__)
CORS(app)

# Import your modules
try:
    from data_pipeline import CryptoDataPipeline
    from continuous_training import ContinuousTrainingPipeline  
    from real_time_forecasting import RealTimeForecastingSystem
    from coingecko_fetcher import CoinGeckoFetcher
except ImportError as e:
    print(f"Import error: {e}")

@app.route('/api/data-pipeline', methods=['POST'])
def run_data_pipeline():
    """Run data pipeline"""
    try:
        pipeline = CryptoDataPipeline()
        result = pipeline.run_pipeline()
        pipeline.close()
        
        return jsonify({
            'success': True,
            'message': 'Data pipeline completed',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/continuous-training/start', methods=['POST'])
def start_continuous_training():
    """Start continuous training"""
    try:
        ct_pipeline = ContinuousTrainingPipeline()
        success = ct_pipeline.start_continuous_training()
        
        return jsonify({
            'success': success,
            'message': 'Continuous training started' if success else 'Failed to start continuous training',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/continuous-training/status', methods=['GET'])
def get_training_status():
    """Get training status"""
    try:
        ct_pipeline = ContinuousTrainingPipeline()
        status = ct_pipeline.get_training_status()
        
        return jsonify({
            'success': True,
            'status': status,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/real-time-forecast', methods=['GET'])
def get_real_time_forecast():
    """Get real-time forecast"""
    try:
        forecaster = RealTimeForecastingSystem()
        prediction = forecaster.get_latest_prediction()
        
        return jsonify({
            'success': True,
            'prediction': prediction,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/collect-data', methods=['POST'])
def collect_crypto_data():
    """Collect crypto data"""
    try:
        fetcher = CoinGeckoFetcher()
        result = fetcher.fetch_and_store()
        
        return jsonify({
            'success': True,
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'python_version': sys.version,
        'environment': os.environ.get('VERCEL_ENV', 'development')
    })

if __name__ == '__main__':
    app.run(debug=True)