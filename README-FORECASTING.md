# Online Learning Price Forecasting System

This system uses PySpark to read data from MinIO and implements online learning to forecast cryptocurrency prices for the next 5 minutes.

## 🚀 Features

- **PySpark Data Processing**: Reads top50 CSV files from MinIO
- **Online Learning**: Uses SGDRegressor for incremental model updates
- **5-Minute Forecasts**: Predicts prices for the next 5 minutes
- **Continuous Operation**: Runs continuously without stopping
- **Real-Time Comparison**: Displays original vs forecasted prices on charts

## 📋 Requirements

```bash
pip install pyspark pandas numpy scikit-learn minio
```

## 🏃 Running the System

### 1. Start the Continuous Forecasting Service

```bash
python3 run_forecasting_service.py
```

This will:
- Initialize PySpark session
- Connect to MinIO
- Start continuous forecasting for top 20 coins
- Update models every minute
- Run indefinitely until stopped (Ctrl+C)

### 2. Start the Dashboard

```bash
npm run dev
```

The dashboard will automatically:
- Fetch forecasts from the API
- Display comparison charts
- Update every minute

## 📊 How It Works

1. **Data Collection**: System reads `top50_YYYY-MM-DD.csv` files from MinIO
2. **Data Processing**: PySpark processes and cleans the data
3. **Feature Engineering**: Creates features from price sequences and technical indicators
4. **Online Learning**: Updates models incrementally with new data
5. **Forecasting**: Generates 5-minute price forecasts
6. **Visualization**: Charts display original vs forecasted prices

## 🔧 Configuration

Edit `lib/online_forecasting.py` to adjust:
- `sequence_length`: Number of historical data points (default: 10)
- `forecast_horizon`: Minutes to forecast (default: 5)
- Model parameters in `SGDRegressor`

## 📈 API Endpoint

- `GET /api/forecast?coinId=bitcoin` - Get forecast for a specific coin

## 🎯 Model Details

- **Algorithm**: SGDRegressor (Stochastic Gradient Descent)
- **Features**: Price sequences, technical indicators, volume, trends
- **Learning**: Incremental (partial_fit) for continuous updates
- **Forecast Method**: Trend-based extrapolation with exponential dampening

