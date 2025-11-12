#!/usr/bin/env python3
"""
Complete ML Pipeline Runner
Executes all 4 phases of the Continuous Training Process
"""

import os
import sys
import time
import threading
from datetime import datetime

def run_phase_1_etl():
    """Phase 1: PySpark ETL for historical data processing"""
    print("🚀 Starting Phase 1: PySpark ETL...")
    try:
        from lib.spark_etl import CryptoDataETL
        
        etl = CryptoDataETL()
        X, y, scaler, metadata = etl.run_full_etl_pipeline(
            days=365,  # 1 year of data
            risk_threshold=-0.02,  # 2% drop threshold
            sequence_length=24  # 24-hour sequences
        )
        etl.close()
        print("✅ Phase 1 completed successfully!")
        return True
    except Exception as e:
        print(f"❌ Phase 1 failed: {e}")
        return False

def run_phase_2_training():
    """Phase 2: LSTM model training"""
    print("🚀 Starting Phase 2: LSTM Training...")
    try:
        from lib.lstm_model import train_complete_pipeline
        
        model, results = train_complete_pipeline()
        if model and results:
            print("✅ Phase 2 completed successfully!")
            return True
        else:
            print("❌ Phase 2 failed: Model training unsuccessful")
            return False
    except Exception as e:
        print(f"❌ Phase 2 failed: {e}")
        return False

def run_phase_3_continuous_training():
    """Phase 3: Start continuous training in background"""
    print("🚀 Starting Phase 3: Continuous Training...")
    try:
        from lib.continuous_training import ContinuousTrainingSystem
        
        ct_system = ContinuousTrainingSystem()
        ct_system.start_continuous_training(
            update_interval=300,  # 5 minutes
            retrain_threshold=100  # Retrain after 100 new samples
        )
        print("✅ Phase 3 started successfully!")
        return ct_system
    except Exception as e:
        print(f"❌ Phase 3 failed: {e}")
        return None

def run_phase_4_forecasting():
    """Phase 4: Start real-time forecasting"""
    print("🚀 Starting Phase 4: Real-time Forecasting...")
    try:
        from lib.real_time_forecasting import RealTimeForecastingSystem
        
        forecaster = RealTimeForecastingSystem()
        forecaster.start_background_forecasting(update_interval=60)  # 1 minute
        print("✅ Phase 4 started successfully!")
        return forecaster
    except Exception as e:
        print(f"❌ Phase 4 failed: {e}")
        return None

def main():
    """Run the complete ML pipeline"""
    print("🤖 Starting Complete Continuous Training ML Pipeline")
    print("=" * 60)
    
    # Ensure directories exist
    os.makedirs('./data/processed', exist_ok=True)
    os.makedirs('./data/predictions', exist_ok=True)
    os.makedirs('./models', exist_ok=True)
    
    # Phase 1: ETL
    if not run_phase_1_etl():
        print("❌ Pipeline failed at Phase 1")
        return
    
    # Phase 2: Base Model Training
    if not run_phase_2_training():
        print("❌ Pipeline failed at Phase 2")
        return
    
    # Phase 3: Continuous Training (background)
    ct_system = run_phase_3_continuous_training()
    if ct_system is None:
        print("⚠️  Phase 3 failed, continuing without continuous training")
    
    # Phase 4: Real-time Forecasting (background)
    forecaster = run_phase_4_forecasting()
    if forecaster is None:
        print("❌ Pipeline failed at Phase 4")
        return
    
    print("✅ All phases completed successfully!")
    print("=" * 60)
    print("🎯 ML Pipeline Status:")
    print("   📊 Phase 1 (ETL): ✅ Completed")
    print("   🧠 Phase 2 (Base Model): ✅ Completed")
    print("   🔄 Phase 3 (Continuous Training): 🔄 Running in background")
    print("   🔮 Phase 4 (Real-time Forecasting): 🔄 Running in background")
    print()
    print("📱 Web Application:")
    print("   - Start Next.js: cd crypto-dashboard && npm run dev")
    print("   - Risk warnings will appear in the dashboard")
    print()
    print("🛑 Press Ctrl+C to stop all processes")
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(30)
            print(f"🕐 {datetime.now().strftime('%H:%M:%S')} - ML Pipeline running...")
    except KeyboardInterrupt:
        print("\n🛑 Shutting down ML Pipeline...")
        
        # Stop systems
        if forecaster:
            forecaster.stop_forecasting()
        if ct_system:
            ct_system.stop_continuous_training()
        
        print("✅ ML Pipeline shut down successfully")

if __name__ == "__main__":
    main()