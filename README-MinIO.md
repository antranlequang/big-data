# MinIO Setup for Crypto Dashboard

This Next.js application now uses the same architecture as the Streamlit app.py file:

## 🔄 **Data Flow Architecture**
1. **API Fetching**: Fetch crypto data from CoinGecko API every 1 minute
2. **MinIO Storage**: Save all fetched data to MinIO (same as app.py)
3. **Chart Display**: Read data from MinIO for real-time charts

## 🚀 **Starting the Application**

### Option 1: **Docker Deployment (Recommended)** 🐳
```bash
# Deploy everything with one command
npm run deploy

# Or step by step:
npm run docker:build  # Build containers
npm run docker:up     # Start all services
npm run docker:logs   # View logs
npm run docker:down   # Stop all services
```

**What happens automatically:**
- ✅ MinIO server starts with correct credentials
- ✅ MinIO bucket `crypto-data` is created automatically
- ✅ Next.js app connects to MinIO automatically
- ✅ Data collection starts immediately

**Access URLs:**
- **Dashboard**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (bankuser / BankPass123!)

### Option 2: **Manual Development Setup**

### 1. **Start MinIO Server** (same as app.py)
```bash
MINIO_ROOT_USER=bankuser MINIO_ROOT_PASSWORD=BankPass123! \
minio server /Users/ADMIN/minio-data --console-address ":9001"
```

### 2. **Start Next.js Application**
```bash
cd crypto-dashboard
npm run dev
```

## 📊 **How It Works**

### **Background Data Collection** (like app.py main loop)
- Automatically starts when the app launches
- Fetches top 50 cryptocurrencies every 60 seconds
- Saves to MinIO: `crypto-data/crypto_prices/top50_YYYY-MM-DD.csv`
- Same bucket and file structure as Streamlit version

### **Real-time Charts**
- Frontend reads data from MinIO via `/api/crypto` endpoint
- Charts update every 1 minute with latest MinIO data
- Price range automatically adjusts to actual data (no more horizontal charts)
- Percentage changes calculated from real price movements

### **Real-Time Data Collection**
- Automatically fetches data from CoinGecko API every minute
- Saves data to MinIO for selected cryptocurrency
- Data is stored per coin with timestamped entries
- Falls back to generated data if MinIO is unavailable

## 🔗 **API Endpoints**

- `GET /api/crypto` - Read latest data from MinIO
- `POST /api/crypto` - Manually trigger data collection

## 🎯 **Features Matching app.py**

✅ **Same MinIO Configuration**
- Endpoint: 127.0.0.1:9000
- Credentials: bankuser / BankPass123!
- Bucket: crypto-data

✅ **Same Data Structure**
- CSV format with timestamp, price, market cap, volume
- Automatic file appending (same as app.py save_to_minio)
- Daily file rotation (top50_YYYY-MM-DD.csv)

✅ **Same Update Frequency**
- 60-second intervals (same as app.py refresh_interval)
- Background data collection process

✅ **Enhanced Chart Features**
- Proper Y-axis scaling (min/max of actual data)
- Real-time updates from MinIO data
- Multi-cryptocurrency support

The Next.js version now provides the exact same data pipeline as your Streamlit app, but with better performance and no multi-threading limitations!