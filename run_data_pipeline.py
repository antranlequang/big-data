#!/usr/bin/env python3
"""
Data Pipeline Runner Script
Run this independently to process data from MinIO and prepare it for the dashboard
"""

import sys
import os
import time
from datetime import datetime
os.environ["PYSPARK_PYTHON"] = "/opt/anaconda3/bin/python"
os.environ["PYSPARK_DRIVER_PYTHON"] = "/opt/anaconda3/bin/python"
# Add the lib directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'lib'))
sys.path.append(os.path.dirname(__file__))

def print_banner():
    """Print a nice banner"""
    print("=" * 60)
    print("🏭 CRYPTO DATA PIPELINE")
    print("📊 MinIO → PySpark → Clean Data → Dashboard")
    print("=" * 60)

def check_requirements():
    """Check if required components are available"""
    print("🔍 Checking requirements...")
    
    try:
        import pyspark
        print("✅ PySpark available")
    except ImportError:
        print("❌ PySpark not found. Install with: pip install pyspark")
        return False
    
    try:
        import minio
        print("✅ MinIO client available")
    except ImportError:
        print("❌ MinIO client not found. Install with: pip install minio")
        return False
    
    try:
        import pandas
        print("✅ Pandas available")
    except ImportError:
        print("❌ Pandas not found. Install with: pip install pandas")
        return False
    
    return True

def run_pipeline_once():
    """Run the data pipeline once"""
    try:
        from data_pipeline import CryptoDataPipeline
        
        print("\n🚀 Initializing data pipeline...")
        pipeline = CryptoDataPipeline()
        
        print("🔄 Running pipeline...")
        success = pipeline.run_pipeline()
        
        pipeline.close()
        
        if success:
            print("\n✅ Pipeline completed successfully!")
            print("📁 Processed data saved to: ./data/clean/")
            print("🌐 Dashboard can now use the clean data")
            return True
        else:
            print("\n❌ Pipeline failed!")
            return False
            
    except Exception as e:
        print(f"\n❌ Pipeline error: {e}")
        return False

def run_pipeline_scheduled(interval_hours=1):
    """Run the pipeline on a schedule"""
    try:
        from lib.data_pipeline import CryptoDataPipeline
        
        print(f"\n⏰ Starting scheduled pipeline (every {interval_hours} hour(s))")
        print("Press Ctrl+C to stop")
        
        pipeline = CryptoDataPipeline()
        pipeline.schedule_pipeline(interval_hours=interval_hours)
        
    except KeyboardInterrupt:
        print("\n🛑 Pipeline stopped by user")
    except Exception as e:
        print(f"\n❌ Scheduled pipeline error: {e}")

def show_data_status():
    """Show current data status"""
    print("\n📊 Data Status:")
    
    # Check if processed data exists
    processed_json = './data/clean/processed_crypto_data.json'
    processed_csv = './data/clean/processed_crypto_data.csv'
    metadata_file = './data/clean/data_metadata.json'
    
    if os.path.exists(processed_json):
        print(f"✅ Processed JSON: {processed_json}")
        file_size = os.path.getsize(processed_json) / 1024 / 1024  # MB
        mod_time = datetime.fromtimestamp(os.path.getmtime(processed_json))
        print(f"   Size: {file_size:.2f} MB, Modified: {mod_time}")
    else:
        print(f"❌ Processed JSON not found: {processed_json}")
    
    if os.path.exists(processed_csv):
        print(f"✅ Processed CSV: {processed_csv}")
    else:
        print(f"❌ Processed CSV not found: {processed_csv}")
    
    if os.path.exists(metadata_file):
        print(f"✅ Metadata: {metadata_file}")
        try:
            import json
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            print(f"   Records: {metadata.get('total_records', 'Unknown')}")
            print(f"   Coins: {metadata.get('unique_coins', 'Unknown')}")
            print(f"   Quality: {metadata.get('data_quality', {}).get('completeness', 0):.1f}%")
        except:
            print("   Could not read metadata details")
    else:
        print(f"❌ Metadata not found: {metadata_file}")

def main():
    """Main function"""
    print_banner()
    
    if not check_requirements():
        print("\n❌ Requirements check failed. Please install missing packages.")
        return
    
    print("\nChoose an option:")
    print("1. Run pipeline once")
    print("2. Run pipeline on schedule (every 1 hour)")
    print("3. Run pipeline on schedule (every 30 minutes)")
    print("4. Show current data status")
    print("5. Exit")
    
    try:
        choice = input("\nEnter your choice (1-5): ").strip()
        
        if choice == '1':
            run_pipeline_once()
        elif choice == '2':
            run_pipeline_scheduled(interval_hours=1)
        elif choice == '3':
            run_pipeline_scheduled(interval_hours=0.5)
        elif choice == '4':
            show_data_status()
        elif choice == '5':
            print("👋 Goodbye!")
        else:
            print("❌ Invalid choice. Please enter 1-5.")
    
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")

if __name__ == "__main__":
    main()