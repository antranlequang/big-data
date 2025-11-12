'use client'

import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface ForecastData {
  coin_id: string
  current_price: number
  historical_prices: number[]
  historical_timestamps: string[]
  recent_prices: number[]
  recent_timestamps?: string[]
  forecasts: Array<{
    minute: number
    forecast_price: number
    timestamp: string
  }>
  timestamp: string
}

interface PriceForecastChartProps {
  selectedCoin: string
  coinName: string
  className?: string
  forecastData?: any
  countdown?: number
  globalLoading?: boolean
}

export default function PriceForecastChart({ 
  selectedCoin, 
  className,
  forecastData: externalForecastData = null,
  countdown: externalCountdown = 300,
  globalLoading = false
}: PriceForecastChartProps) {
  const [chartData, setChartData] = useState<any[]>([])
  const [showOriginal, setShowOriginal] = useState(true)
  const [showForecast, setShowForecast] = useState(true)

  // Use external data and loading state
  const forecastData = externalForecastData
  const loading = globalLoading
  const countdown = externalCountdown

  // Prepare chart data combining historical (from MinIO) and forecast
  const prepareChartData = (data: ForecastData) => {
    console.log('📊 Preparing chart data:', data)
    const chartPoints: any[] = []
    
    // Validate data structure
    if (!data || typeof data !== 'object') {
      console.error('Invalid forecast data structure:', data)
      setChartData([])
      return
    }
    
    // Only use latest 60 points from MinIO (prefer recent_prices)
    const rawPrices = data.recent_prices && data.recent_prices.length > 0
      ? data.recent_prices
      : data.historical_prices || [];

    const rawTimestamps = data.recent_timestamps && data.recent_timestamps.length > 0
      ? data.recent_timestamps
      : data.historical_timestamps || [];

    const historicalPrices = rawPrices.slice(-60);
    const historicalTimestamps = rawTimestamps.slice(-60);
    
    console.log(`📈 Historical prices: ${historicalPrices.length} points`)
    console.log(`🕐 Historical timestamps: ${historicalTimestamps.length} points`)
    
    if (historicalPrices.length > 0) {
      historicalPrices.forEach((price, index) => {
        if (price != null && !isNaN(price)) {
          const timestamp = historicalTimestamps[index] ? new Date(historicalTimestamps[index]) : null
          const timeLabel = timestamp 
            ? timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : `-${historicalPrices.length - index - 1}m`
          
          chartPoints.push({
            time: timeLabel,
            original: price,
            forecast: null,
            type: 'historical',
            timestamp: timestamp || null
          })
        }
      })
    }
    
    // Add current price (connecting point)
    if (data.current_price != null && !isNaN(data.current_price)) {
      const currentTime = new Date()
      chartPoints.push({
        time: 'Now',
        original: data.current_price,
        forecast: data.current_price,
        type: 'current',
        timestamp: currentTime
      })
      console.log(`💰 Current price: $${data.current_price}`)
    }
    
    // Add forecasted prices (future predictions)
    const forecasts = data.forecasts || []
    console.log(`🔮 Forecasts: ${forecasts.length} points`)
    
    if (forecasts.length > 0) {
      forecasts.forEach((forecast) => {
        if (forecast && forecast.forecast_price != null && !isNaN(forecast.forecast_price)) {
          const forecastTime = new Date(forecast.timestamp)
          chartPoints.push({
            time: `+${forecast.minute}m`,
            original: null,
            forecast: forecast.forecast_price,
            type: 'forecast',
            timestamp: forecastTime
          })
        }
      })
    }
    
    console.log(`📊 Total chart points: ${chartPoints.length}`)
    console.log('Chart points sample:', chartPoints.slice(0, 3))
    
    setChartData(chartPoints)
  }

  // Process forecast data when it changes
  useEffect(() => {
    if (forecastData) {
      prepareChartData(forecastData)
    }
  }, [forecastData])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-800/95 border border-purple-500/50 rounded-lg p-4 shadow-xl backdrop-blur">
          <p className="text-slate-300 text-sm font-medium mb-2">
            {label}
            {data.timestamp && (
              <span className="text-slate-500 ml-2">
                {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            )}
          </p>
          {data.original !== null && (
            <p className="text-green-400 font-semibold text-lg mb-1">
              📊 Original Price: {formatCurrency(data.original)}
            </p>
          )}
          {data.forecast !== null && (
            <p className="text-purple-400 font-semibold text-lg">
              🔮 Forecast Price: {formatCurrency(data.forecast)}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  // Custom Legend with clickable toggles

  const formatCompact = (value: number) => {
    if (isNaN(value)) return value;
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(2);
  };
  const CustomLegend = ({ payload }: any) => {
    if (!payload || payload.length === 0) return null
    
    return (
      <div className="flex items-center justify-center gap-3 mt-0 mb-0">
        {payload.map((entry: any, index: number) => {
          const isOriginal = entry.dataKey === 'original'
          const isVisible = isOriginal ? showOriginal : showForecast
          
          return (
            <div
              key={`legend-${index}`}
              onClick={() => {
                if (isOriginal) {
                  setShowOriginal(!showOriginal)
                } else {
                  setShowForecast(!showForecast)
                }
              }}
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity px-2 py-1 rounded-lg hover:bg-slate-700/50"
              style={{ opacity: isVisible ? 1 : 0.4 }}
            >
              <div
                className="w-4 h-4 rounded"
                style={{
                  backgroundColor: isVisible ? entry.color : '#6B7280',
                  border: entry.dataKey === 'forecast' ? '2px dashed #8B5CF6' : 'none',
                  borderColor: entry.dataKey === 'forecast' ? '#8B5CF6' : 'transparent'
                }}
              />
              <span className={`text-sm font-medium ${isVisible ? 'text-slate-300' : 'text-slate-500'}`}>
                {entry.value}
              </span>
              {!isVisible && (
                <span className="text-xs text-slate-600 ml-1"></span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`bg-gray-950 border-t border-gray-800 ${className || ''} flex flex-col h-full`}>
      <div className="px-4 py-2 border-b border-gray-800/50 bg-gray-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-9">
            <span className="text-blue-400 font-bold text-sm">FORECASTING</span>
            <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30">
              ML MODEL
            </div>
            <div className="ml-0">
              <CustomLegend payload={[
                { dataKey: 'original', color: '#10B981', value: 'Original Price' },
                { dataKey: 'forecast', color: '#3B82F6', value: 'Forecast Price' }
              ]} />
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="text-purple-400">🔮</span>
            <span className={`font-mono ${countdown <= 10 ? 'text-orange-400' : 'text-purple-400'}`}>
              {countdown}s
            </span>
          </div>
        </div>
      </div>
      
      
      <div className="flex-1 p-4">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time"
                stroke="#9CA3AF"
                fontSize={11}
                dy={10}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={11}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
                  return `$${value.toFixed(0)}`
                }}
                domain={chartData.length > 0 ? ['dataMin', 'dataMax'] : [0, 100]}
                dx={-10}
              />
              {chartData.length > 0 && <Tooltip content={<CustomTooltip />} />}
              {chartData.length > 0 && (
                <>
                  {/* Original Price Line (from MinIO data) */}
                  <Line
                    type="monotone"
                    dataKey="original"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Original Price (MinIO)"
                    connectNulls={false}
                    hide={!showOriginal}
                  />
                  {/* Forecast Price Line (from online learning model) */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Forecast Price (Model)"
                    connectNulls={false}
                    hide={!showForecast}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Forecast Details */}
        {forecastData && forecastData.forecasts.length > 0 && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2">
            {forecastData.forecasts.map((forecast, index) => {
              const priceChange = forecast.forecast_price - forecastData.current_price;
              const priceChangePercent = (priceChange / forecastData.current_price * 100);
              const isIncrease = priceChange >= 0;
              
              return (
                <div 
                  key={index} 
                  className={`text-center p-2 rounded-lg border-2 transition-all duration-300 ${
                    isIncrease 
                      ? 'bg-green-900/30 border-green-500/50 shadow-green-500/20' 
                      : 'bg-red-900/30 border-red-500/50 shadow-red-500/20'
                  } shadow-lg`}
                >
                  <div className="text-xs text-slate-400 mb-1">+{forecast.minute} min</div>
                  <div className={`text-base font-bold ${isIncrease ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCompact(forecast.forecast_price)}
                  </div>
                  <div className={`text-xs mt-1 font-medium flex items-center justify-center gap-1 ${
                    isIncrease ? 'text-green-400' : 'text-red-400'
                  }`}>
                    <span>{isIncrease ? '▲' : '▼'}</span>
                    <span>{priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
                  </div>
                  <div className={`text-xs mt-1 ${isIncrease ? 'text-green-500' : 'text-red-500'}`}>
                    {priceChange >= 0 ? '+' : ''}{formatCompact(priceChange)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}
