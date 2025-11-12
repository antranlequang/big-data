# Crypto Price Tracker - Next.js Dashboard

A beautiful, real-time cryptocurrency price tracking dashboard built with Next.js, React, and TypeScript. This application provides an elegant alternative to the Streamlit version with enhanced performance and better multi-threading support.

## 🚀 Features

- **Real-time Price Tracking**: Live cryptocurrency price updates every 60 seconds
- **Interactive Charts**: Beautiful price and percentage change visualizations using Recharts
- **Multi-Crypto Support**: Track top 50 cryptocurrencies by market cap
- **Real-Time Data**: Fetches live data from CoinGecko API every minute and stores in MinIO
- **Responsive Design**: Modern, mobile-friendly interface with dark theme
- **Performance Optimized**: Built with Next.js for optimal loading and rendering

## 🛠️ Technology Stack

- **Framework**: Next.js 14 with App Router
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + Custom UI Components
- **Charts**: Recharts for interactive data visualization
- **Icons**: Lucide React
- **API**: CoinGecko API for cryptocurrency data

## 📦 Installation

1. **Navigate to the project directory**:
   ```bash
   cd crypto-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and visit: `http://localhost:3000`

## 🎯 Usage

### Main Dashboard Features

1. **Settings Panel**:
   - Select cryptocurrency from dropdown (fetched from CoinGecko API)
   - Start/Stop automatic data collection from CoinGecko API
   - Manual refresh button for instant updates

2. **Price Chart**: 
   - Interactive line chart showing price trends over time
   - Hover tooltips with detailed information
   - Responsive design that adapts to screen size

3. **Metrics Cards**:
   - Current price with 24h change percentage
   - Market capitalization with trend indicators
   - 24-hour trading volume with change tracking

4. **Percentage Change Chart**:
   - Toggle between 1h, 24h, and 7d change periods
   - Color-coded trends (green for positive, red for negative)
   - Interactive tooltips with precise change values

### Real-Time Data Collection

- **Automatic Collection**: System automatically fetches data from CoinGecko API every minute
- **MinIO Storage**: All price data is saved to MinIO with timestamped entries
- **Coin Selection**: Select any cryptocurrency from the dropdown to view its real-time data
- **Live Updates**: Charts and metrics update automatically as new data is collected

## 🔧 Configuration

### Environment Variables (Optional)

Create a `.env.local` file for any custom configurations:

```env
# API Configuration (if needed)
NEXT_PUBLIC_API_BASE_URL=https://api.coingecko.com/api/v3

# Update intervals (in milliseconds)
NEXT_PUBLIC_UPDATE_INTERVAL=60000
```

### Customization

- **Update Intervals**: Modify the refresh interval in `app/page.tsx`
- **Chart Colors**: Customize colors in the chart components
- **Coin Selection**: Add or modify tracked cryptocurrencies in the API calls

## 📁 Project Structure

```
crypto-dashboard/
├── app/                    # Next.js App Router pages
│   ├── globals.css        # Global styles and CSS variables
│   ├── layout.tsx         # Root layout component
│   └── page.tsx           # Main dashboard page
├── components/            # Reusable React components
│   ├── ui/               # Base UI components (Card, Button)
│   ├── MetricCard.tsx    # Price/volume metric display
│   ├── PercentageChart.tsx # Percentage change visualization
│   └── PriceChart.tsx    # Main price chart component
├── lib/                  # Utility functions and types
│   ├── api.ts           # API functions and demo data generator
│   ├── types.ts         # TypeScript type definitions
│   └── utils.ts         # Helper functions and formatters
└── public/              # Static assets
```

## 🎨 Design Features

- **Dark Theme**: Modern dark interface optimized for extended viewing
- **Gradient Backgrounds**: Beautiful purple-to-blue gradients
- **Glass Morphism**: Semi-transparent cards with backdrop blur effects
- **Smooth Animations**: Subtle hover effects and loading states
- **Responsive Layout**: Adapts seamlessly to desktop, tablet, and mobile

## 🔄 Auto-Refresh

The dashboard automatically refreshes data every 60 seconds when in view. The refresh can be:
- Manually triggered using the refresh button
- Automatically paused when the tab is not active (browser optimization)
- Customized by modifying the interval in the main component

## 🚀 Production Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start the production server**:
   ```bash
   npm start
   ```

3. **Deploy** to your preferred platform (Vercel, Netlify, etc.)

## 🤝 Contributing

Feel free to contribute by:
- Adding new chart types
- Implementing additional cryptocurrencies
- Enhancing the UI/UX
- Optimizing performance

## 📊 Comparison with Streamlit Version

| Feature | Streamlit | Next.js |
|---------|-----------|---------|
| Multi-threading | Limited | Full Support |
| Performance | Good | Excellent |
| Customization | Limited | Extensive |
| Mobile Support | Basic | Native |
| Real-time Updates | Basic | Advanced |
| Deployment | Simple | Flexible |

The Next.js version provides better performance, enhanced user experience, and superior support for complex operations without the threading limitations of Streamlit.

python run_forecasting_service.py

python start_candle_service.py