# 🚀 Crypto Dashboard - Vercel Deployment Guide

Complete guide to deploy your crypto dashboard platform on Vercel with MinIO data management and parallel Python services.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [MinIO Setup](#minio-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Python Services Configuration](#python-services-configuration)
6. [Environment Variables](#environment-variables)
7. [Deployment Process](#deployment-process)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL CLOUD PLATFORM                   │
├─────────────────────┬───────────────────┬───────────────────┤
│   Next.js Frontend  │  TypeScript APIs  │   Python Services │
│                     │                   │                   │
│ • Dashboard UI      │ • /api/coins      │ • Data Pipeline   │
│ • Real-time Charts  │ • /api/forecast   │ • ML Training     │
│ • Analytics         │ • /api/crypto     │ • Forecasting     │
│ • Portfolio         │ • /api/candle     │ • Risk Analysis   │
└─────────────────────┴───────────────────┴───────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    MinIO OBJECT STORAGE                     │
├─────────────────────┬───────────────────┬───────────────────┤
│   Raw Data Store    │  Processed Data   │   ML Artifacts    │
│                     │                   │                   │
│ • Historical Prices │ • Clean Datasets  │ • Trained Models  │
│ • Market Data       │ • Feature Vectors │ • Scalers/Encoders│
│ • News/Sentiment    │ • Time Series     │ • Model Metadata  │
│ • Technical Indic.  │ • Analytics Data  │ • Predictions     │
└─────────────────────┴───────────────────┴───────────────────┘
```

### Key Components:

- **Frontend**: Next.js 13+ with App Router
- **APIs**: TypeScript serverless functions
- **Python Services**: ML pipeline, forecasting, data processing
- **Data Storage**: MinIO for scalable object storage
- **Deployment**: Vercel for global CDN and serverless compute

## 📚 Prerequisites

### Required Accounts & Services

1. **Vercel Account** - [vercel.com](https://vercel.com)
2. **MinIO Cloud Account** - [min.io](https://min.io) or self-hosted MinIO
3. **GitHub Repository** - For code storage and CI/CD
4. **Domain** (Optional) - For custom domain

### Required Tools

```bash
# Install Vercel CLI
npm i -g vercel

# Install dependencies
npm install

# Python dependencies (for local testing)
pip install -r requirements-vercel.txt
```

## 🗄️ MinIO Setup

### Option 1: MinIO Cloud (Recommended)

1. **Create MinIO Account**
   ```bash
   # Visit https://min.io/signup
   # Create account and get your credentials
   ```

2. **Create Access Keys**
   ```bash
   # In MinIO Console:
   # 1. Go to Access Keys
   # 2. Create New Access Key
   # 3. Save Access Key and Secret Key
   ```

3. **Create Bucket**
   ```bash
   # Create bucket named 'crypto-data'
   # Set bucket policy to public read if needed
   ```

### Option 2: Self-Hosted MinIO

1. **Deploy MinIO Server**
   ```bash
   # Using Docker
   docker run -p 9000:9000 -p 9001:9001 \
     --name minio \
     -e "MINIO_ROOT_USER=minioadmin" \
     -e "MINIO_ROOT_PASSWORD=minioadmin" \
     minio/minio server /data --console-address ":9001"
   ```

2. **Configure Public Access**
   ```bash
   # Install MinIO Client
   curl https://dl.min.io/client/mc/release/linux-amd64/mc \
     --create-dirs -o $HOME/minio-binaries/mc
   
   # Configure alias
   mc alias set myminio http://localhost:9000 minioadmin minioadmin
   
   # Create bucket
   mc mb myminio/crypto-data
   
   # Set public policy
   mc policy set public myminio/crypto-data
   ```

### Option 3: Cloud Provider MinIO

#### AWS S3 Compatible
```bash
# Use AWS S3 credentials
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_ACCESS_KEY=your-aws-access-key
MINIO_SECRET_KEY=your-aws-secret-key
MINIO_USE_SSL=true
```

#### Google Cloud Storage
```bash
# Use GCS HMAC keys
MINIO_ENDPOINT=storage.googleapis.com
MINIO_ACCESS_KEY=your-gcs-access-key
MINIO_SECRET_KEY=your-gcs-secret-key
MINIO_USE_SSL=true
```

## 🚀 Vercel Deployment

### Step 1: Prepare Repository

1. **Clone and Configure**
   ```bash
   git clone https://github.com/yourusername/crypto-dashboard.git
   cd crypto-dashboard
   
   # Install dependencies
   npm install
   
   # Copy environment template
   cp .env.example .env.local
   ```

2. **Update Environment Variables**
   ```bash
   # Edit .env.local with your MinIO credentials
   nano .env.local
   ```

### Step 2: Deploy to Vercel

1. **Using Vercel CLI**
   ```bash
   # Login to Vercel
   vercel login
   
   # Deploy
   vercel --prod
   
   # Follow prompts to configure project
   ```

2. **Using Vercel Dashboard**
   ```bash
   # 1. Go to https://vercel.com/dashboard
   # 2. Click "New Project"
   # 3. Import from GitHub
   # 4. Select your crypto-dashboard repository
   # 5. Configure environment variables
   # 6. Deploy
   ```

### Step 3: Configure Environment Variables in Vercel

1. **In Vercel Dashboard**
   ```bash
   # Go to Project Settings > Environment Variables
   # Add the following variables:
   ```

   | Variable | Value | Environment |
   |----------|-------|-------------|
   | `MINIO_ENDPOINT` | `your-minio-endpoint.com` | Production |
   | `MINIO_ACCESS_KEY` | `your-access-key` | Production |
   | `MINIO_SECRET_KEY` | `your-secret-key` | Production |
   | `MINIO_USE_SSL` | `true` | Production |
   | `MINIO_BUCKET` | `crypto-data` | Production |
   | `NODE_ENV` | `production` | Production |

## 🐍 Python Services Configuration

### Parallel Execution Strategy

The Python services are designed to run in parallel on Vercel:

1. **Data Pipeline** (`lib/data_pipeline.py`)
   - Runs on cron: Every hour
   - Processes raw crypto data
   - Stores in MinIO

2. **Continuous Training** (`lib/continuous-training.py`)
   - Runs on cron: Every 30 minutes
   - Updates ML models
   - Saves artifacts to MinIO

3. **Real-time Forecasting** (`lib/real-time-forecasting.py`)
   - Runs on demand via API
   - Provides predictions
   - Reads from MinIO

4. **Data Collection** (`lib/coingecko_fetcher.py`)
   - Runs on cron: Every hour
   - Fetches market data
   - Stores raw data in MinIO

### API Endpoints

```typescript
// Available Python API endpoints
/api/data-pipeline          // POST - Run data pipeline
/api/continuous-training/start // POST - Start training
/api/continuous-training/status // GET - Get training status  
/api/real-time-forecast     // GET - Get predictions
/api/collect-data          // POST - Collect market data
/api/health               // GET - Health check
```

## 🔧 Environment Variables

### Complete Environment Variables List

Create these in your Vercel project settings:

```bash
# MinIO Configuration
MINIO_ENDPOINT=your-minio-endpoint.com
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_USE_SSL=true
MINIO_BUCKET=crypto-data

# Python Service URLs (for microservice architecture)
PYTHON_SERVICE_URL=https://your-python-backend.vercel.app

# API Keys (Optional but recommended)
COINGECKO_API_KEY=your-coingecko-api-key
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-key

# Application Configuration
NODE_ENV=production
VERCEL_ENV=production
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app

# Security (Optional)
JWT_SECRET=your-jwt-secret-key
API_RATE_LIMIT=100
```

### Setting Environment Variables

#### Via Vercel CLI
```bash
# Set production environment variables
vercel env add MINIO_ENDPOINT production
vercel env add MINIO_ACCESS_KEY production  
vercel env add MINIO_SECRET_KEY production

# Set preview environment variables
vercel env add MINIO_ENDPOINT preview
vercel env add MINIO_ACCESS_KEY preview
vercel env add MINIO_SECRET_KEY preview
```

#### Via Vercel Dashboard
1. Go to Project Settings
2. Click Environment Variables
3. Add each variable for Production, Preview, and Development

## 📦 Deployment Process

### Complete Deployment Steps

1. **Pre-deployment Checks**
   ```bash
   # Test build locally
   npm run build
   
   # Test Python services locally
   python api/index.py
   
   # Verify MinIO connection
   python lib/minio_client.py
   ```

2. **Initial Deployment**
   ```bash
   # Deploy to Vercel
   vercel --prod
   
   # Verify deployment
   curl https://your-domain.vercel.app/api/health
   ```

3. **Set Up Cron Jobs**
   ```bash
   # The vercel.json file configures automatic cron jobs:
   # - Data collection: Every hour
   # - Forecasting: Every 30 minutes
   
   # Verify cron jobs in Vercel dashboard
   ```

4. **Initialize Data Pipeline**
   ```bash
   # Trigger initial data collection
   curl -X POST https://your-domain.vercel.app/api/collect-data
   
   # Run data pipeline
   curl -X POST https://your-domain.vercel.app/api/data-pipeline
   
   # Start continuous training
   curl -X POST https://your-domain.vercel.app/api/continuous-training/start
   ```

### Deployment Checklist

- [ ] MinIO bucket created and accessible
- [ ] Environment variables configured in Vercel
- [ ] Repository connected to Vercel
- [ ] Build succeeds without errors
- [ ] API health check passes
- [ ] Python services respond correctly
- [ ] Cron jobs configured
- [ ] Data pipeline runs successfully
- [ ] Frontend displays data correctly

## 📊 Monitoring & Maintenance

### Monitoring Tools

1. **Vercel Dashboard**
   - Function logs
   - Performance metrics
   - Error tracking
   - Usage analytics

2. **MinIO Console**
   - Storage usage
   - Object access logs
   - Bucket policies
   - Performance metrics

3. **Health Check Endpoints**
   ```bash
   # API health
   curl https://your-domain.vercel.app/api/health
   
   # Python services health
   curl https://your-domain.vercel.app/api/python/health
   
   # Database connectivity
   curl https://your-domain.vercel.app/api/minio/status
   ```

### Maintenance Tasks

#### Daily
- Check error logs in Vercel dashboard
- Verify data collection is running
- Monitor API response times

#### Weekly  
- Review MinIO storage usage
- Check ML model performance
- Update dependencies if needed

#### Monthly
- Backup critical data from MinIO
- Review and optimize cron job schedules
- Update API keys and secrets

### Setting Up Alerts

1. **Vercel Integrations**
   ```bash
   # Set up Slack notifications
   # Go to Vercel Dashboard > Integrations > Slack
   
   # Set up email alerts for failed deployments
   # Go to Project Settings > Notifications
   ```

2. **Custom Monitoring**
   ```typescript
   // Add to your API routes for custom monitoring
   import { sendAlert } from '../lib/monitoring';
   
   if (error) {
     await sendAlert({
       type: 'error',
       service: 'data-pipeline',
       message: error.message,
       timestamp: new Date()
     });
   }
   ```

## 🔍 Troubleshooting

### Common Issues

#### 1. MinIO Connection Failed
```bash
# Symptoms: 500 errors, "Failed to connect to MinIO"
# Solutions:
- Verify MINIO_ENDPOINT is correct (no http:// prefix)
- Check MINIO_ACCESS_KEY and MINIO_SECRET_KEY
- Ensure MINIO_USE_SSL matches your MinIO setup
- Test connection locally:

python -c "
from lib.minio_client import VercelMinIOClient
client = VercelMinIOClient()
print('✅ MinIO connection successful')
"
```

#### 2. Python Service Errors
```bash
# Symptoms: Python API returning 500 errors
# Solutions:
- Check Vercel function logs
- Verify Python dependencies in requirements-vercel.txt
- Test imports locally:

python -c "
import sys
sys.path.append('lib')
from data_pipeline import CryptoDataPipeline
print('✅ Python imports successful')
"
```

#### 3. Build Failures
```bash
# Symptoms: Deployment fails during build
# Solutions:
- Check package.json dependencies
- Verify Node.js version compatibility
- Test build locally:

npm run build
```

#### 4. Data Pipeline Issues
```bash
# Symptoms: No data in dashboard, API errors
# Solutions:
- Check if initial data collection ran
- Verify MinIO bucket permissions
- Run manual data collection:

curl -X POST https://your-domain.vercel.app/api/collect-data
```

### Debug Commands

#### Local Testing
```bash
# Test Next.js app locally
npm run dev

# Test Python services locally  
cd api && python index.py

# Test MinIO connection
python lib/minio_client.py

# Test data pipeline
python lib/data_pipeline.py
```

#### Production Debug
```bash
# Check Vercel logs
vercel logs --follow

# Test API endpoints
curl https://your-domain.vercel.app/api/health
curl https://your-domain.vercel.app/api/python/health

# Check environment variables
vercel env ls
```

### Performance Optimization

#### 1. Function Optimization
```javascript
// Optimize API routes for better performance
export const config = {
  runtime: 'edge', // Use edge runtime for faster cold starts
  regions: ['iad1'], // Deploy to specific region
}
```

#### 2. Caching Strategy
```typescript
// Add caching headers to API responses
export async function GET() {
  const data = await fetchData();
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    },
  });
}
```

#### 3. MinIO Optimization
```bash
# Use appropriate storage class
mc ilm add myminio/crypto-data --transition-days 30 --storage-class IA

# Enable versioning for critical data
mc version enable myminio/crypto-data
```

## 🔒 Security Best Practices

### Environment Variables Security
- Never commit secrets to repository
- Use Vercel's encrypted environment variables
- Rotate keys regularly
- Use separate keys for different environments

### API Security
```typescript
// Add rate limiting to API routes
import rateLimit from '../lib/rateLimit';

export async function POST(req: Request) {
  await rateLimit(req); // Check rate limit
  
  // Validate API key if needed
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !validateApiKey(apiKey)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Process request...
}
```

### MinIO Security
- Use IAM policies for fine-grained access control
- Enable bucket encryption
- Use HTTPS/TLS for all connections
- Regular security audits

## 📈 Scaling Considerations

### Horizontal Scaling
- Use Vercel's automatic scaling
- Implement caching strategies
- Optimize database queries
- Use CDN for static assets

### Vertical Scaling
- Monitor function memory usage
- Optimize algorithm efficiency
- Use streaming for large datasets
- Implement data pagination

### Cost Optimization
- Monitor Vercel function usage
- Optimize MinIO storage classes
- Implement data lifecycle policies
- Use preview deployments efficiently

## 🆘 Support & Resources

### Documentation
- [Vercel Documentation](https://vercel.com/docs)
- [MinIO Documentation](https://min.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)

### Community Support
- [Vercel Discord](https://discord.gg/vercel)
- [MinIO Slack](https://slack.min.io/)
- [GitHub Issues](https://github.com/yourusername/crypto-dashboard/issues)

### Professional Support
- Vercel Pro/Enterprise support
- MinIO Enterprise support
- Custom consulting services

---

## 🎉 Congratulations!

Your crypto dashboard is now deployed and running on Vercel with MinIO data management. The platform includes:

✅ **Real-time cryptocurrency data collection**  
✅ **Advanced ML forecasting and risk analysis**  
✅ **Scalable data pipeline with PySpark**  
✅ **Interactive dashboard with live charts**  
✅ **Automated data processing and model training**  
✅ **Cloud-native architecture with global CDN**

### Next Steps

1. **Customize the dashboard** with your specific requirements
2. **Add more data sources** and indicators
3. **Implement additional ML models** for better predictions
4. **Set up monitoring and alerting** for production use
5. **Scale the infrastructure** as your data grows

**Enjoy your crypto dashboard! 🚀📈**