#!/usr/bin/env python3
"""
MinIO Client for Vercel Deployment
Handles MinIO connections and data operations for cloud deployment
"""

import os
import json
import tempfile
from datetime import datetime
from typing import Optional, Dict, List
from minio import Minio
from minio.error import S3Error
import pandas as pd
import io

class VercelMinIOClient:
    def __init__(self):
        """Initialize MinIO client for Vercel deployment"""
        # Get MinIO configuration from environment
        self.endpoint = os.getenv('MINIO_ENDPOINT', 'play.min.io')
        self.access_key = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
        self.secret_key = os.getenv('MINIO_SECRET_KEY', 'minioadmin')
        self.use_ssl = os.getenv('MINIO_USE_SSL', 'true').lower() == 'true'
        self.bucket_name = os.getenv('MINIO_BUCKET', 'crypto-data')
        
        # Initialize MinIO client
        try:
            self.client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.use_ssl
            )
            
            # Create bucket if it doesn't exist
            self.ensure_bucket_exists()
            print(f"✅ Connected to MinIO at {self.endpoint}")
            
        except Exception as e:
            print(f"❌ Failed to connect to MinIO: {e}")
            raise

    def ensure_bucket_exists(self):
        """Ensure the bucket exists, create if it doesn't"""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                print(f"✅ Created bucket: {self.bucket_name}")
            else:
                print(f"✅ Bucket exists: {self.bucket_name}")
        except S3Error as e:
            print(f"❌ Error with bucket operations: {e}")
            raise

    def upload_dataframe(self, df: pd.DataFrame, object_name: str, format: str = 'csv') -> bool:
        """Upload DataFrame to MinIO in specified format"""
        try:
            # Convert DataFrame to bytes
            buffer = io.BytesIO()
            
            if format.lower() == 'csv':
                df.to_csv(buffer, index=False)
                content_type = 'text/csv'
            elif format.lower() == 'json':
                df.to_json(buffer, orient='records', date_format='iso')
                content_type = 'application/json'
            else:
                raise ValueError(f"Unsupported format: {format}")
            
            # Reset buffer position
            buffer.seek(0)
            
            # Upload to MinIO
            self.client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=buffer,
                length=buffer.getbuffer().nbytes,
                content_type=content_type
            )
            
            print(f"✅ Uploaded {object_name} to MinIO")
            return True
            
        except Exception as e:
            print(f"❌ Failed to upload {object_name}: {e}")
            return False

    def download_dataframe(self, object_name: str, format: str = 'csv') -> Optional[pd.DataFrame]:
        """Download DataFrame from MinIO"""
        try:
            # Get object from MinIO
            response = self.client.get_object(self.bucket_name, object_name)
            
            # Read data
            if format.lower() == 'csv':
                df = pd.read_csv(io.BytesIO(response.read()))
            elif format.lower() == 'json':
                df = pd.read_json(io.BytesIO(response.read()))
            else:
                raise ValueError(f"Unsupported format: {format}")
            
            print(f"✅ Downloaded {object_name} from MinIO")
            return df
            
        except Exception as e:
            print(f"❌ Failed to download {object_name}: {e}")
            return None
        finally:
            if 'response' in locals():
                response.close()
                response.release_conn()

    def upload_json(self, data: Dict, object_name: str) -> bool:
        """Upload JSON data to MinIO"""
        try:
            json_bytes = json.dumps(data, indent=2, default=str).encode('utf-8')
            
            self.client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=io.BytesIO(json_bytes),
                length=len(json_bytes),
                content_type='application/json'
            )
            
            print(f"✅ Uploaded JSON {object_name} to MinIO")
            return True
            
        except Exception as e:
            print(f"❌ Failed to upload JSON {object_name}: {e}")
            return False

    def download_json(self, object_name: str) -> Optional[Dict]:
        """Download JSON data from MinIO"""
        try:
            response = self.client.get_object(self.bucket_name, object_name)
            data = json.loads(response.read().decode('utf-8'))
            
            print(f"✅ Downloaded JSON {object_name} from MinIO")
            return data
            
        except Exception as e:
            print(f"❌ Failed to download JSON {object_name}: {e}")
            return None
        finally:
            if 'response' in locals():
                response.close()
                response.release_conn()

    def list_objects(self, prefix: str = '') -> List[str]:
        """List objects in the bucket with optional prefix filter"""
        try:
            objects = self.client.list_objects(self.bucket_name, prefix=prefix)
            object_names = [obj.object_name for obj in objects]
            
            print(f"✅ Found {len(object_names)} objects with prefix '{prefix}'")
            return object_names
            
        except Exception as e:
            print(f"❌ Failed to list objects: {e}")
            return []

    def delete_object(self, object_name: str) -> bool:
        """Delete object from MinIO"""
        try:
            self.client.remove_object(self.bucket_name, object_name)
            print(f"✅ Deleted {object_name} from MinIO")
            return True
            
        except Exception as e:
            print(f"❌ Failed to delete {object_name}: {e}")
            return False

    def get_object_url(self, object_name: str, expires_in_seconds: int = 3600) -> Optional[str]:
        """Get presigned URL for object"""
        try:
            from datetime import timedelta
            
            url = self.client.presigned_get_object(
                self.bucket_name, 
                object_name, 
                expires=timedelta(seconds=expires_in_seconds)
            )
            
            print(f"✅ Generated URL for {object_name}")
            return url
            
        except Exception as e:
            print(f"❌ Failed to generate URL for {object_name}: {e}")
            return None

    def backup_processed_data(self, data: pd.DataFrame, data_type: str = 'crypto') -> str:
        """Backup processed data with timestamp"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        object_name = f"backups/{data_type}_processed_{timestamp}.csv"
        
        if self.upload_dataframe(data, object_name, 'csv'):
            return object_name
        else:
            raise Exception(f"Failed to backup {data_type} data")

    def store_model_artifacts(self, model_path: str, scaler_path: str, metadata: Dict) -> bool:
        """Store ML model artifacts"""
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            # Upload model file
            with open(model_path, 'rb') as model_file:
                self.client.put_object(
                    bucket_name=self.bucket_name,
                    object_name=f"models/crypto_model_{timestamp}.h5",
                    data=model_file,
                    length=os.path.getsize(model_path),
                    content_type='application/octet-stream'
                )
            
            # Upload scaler file
            with open(scaler_path, 'rb') as scaler_file:
                self.client.put_object(
                    bucket_name=self.bucket_name,
                    object_name=f"models/scaler_{timestamp}.pkl",
                    data=scaler_file,
                    length=os.path.getsize(scaler_path),
                    content_type='application/octet-stream'
                )
            
            # Upload metadata
            self.upload_json(metadata, f"models/metadata_{timestamp}.json")
            
            print(f"✅ Stored model artifacts with timestamp {timestamp}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to store model artifacts: {e}")
            return False

    def get_latest_processed_data(self, data_type: str = 'crypto') -> Optional[pd.DataFrame]:
        """Get the latest processed data"""
        try:
            # List all processed data files
            objects = self.list_objects(f'processed/{data_type}')
            
            if not objects:
                # Try backup location
                objects = self.list_objects(f'backups/{data_type}')
            
            if not objects:
                print(f"❌ No processed {data_type} data found")
                return None
            
            # Get the latest file (assuming timestamp in filename)
            latest_object = sorted(objects)[-1]
            
            # Download and return
            return self.download_dataframe(latest_object, 'csv')
            
        except Exception as e:
            print(f"❌ Failed to get latest {data_type} data: {e}")
            return None

# Example usage for testing
if __name__ == "__main__":
    # Test MinIO connection
    try:
        client = VercelMinIOClient()
        
        # Test with sample data
        sample_data = pd.DataFrame({
            'timestamp': [datetime.now()],
            'price': [50000.0],
            'volume': [1000000.0]
        })
        
        # Test upload
        success = client.upload_dataframe(sample_data, 'test/sample_data.csv')
        print(f"Upload test: {'✅ Success' if success else '❌ Failed'}")
        
        # Test download
        downloaded = client.download_dataframe('test/sample_data.csv')
        print(f"Download test: {'✅ Success' if downloaded is not None else '❌ Failed'}")
        
        # Test JSON operations
        metadata = {'test': True, 'timestamp': datetime.now().isoformat()}
        json_success = client.upload_json(metadata, 'test/metadata.json')
        print(f"JSON upload test: {'✅ Success' if json_success else '❌ Failed'}")
        
        downloaded_json = client.download_json('test/metadata.json')
        print(f"JSON download test: {'✅ Success' if downloaded_json else '❌ Failed'}")
        
    except Exception as e:
        print(f"❌ MinIO test failed: {e}")