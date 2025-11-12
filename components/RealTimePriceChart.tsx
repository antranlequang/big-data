'use client'

import React, { useState, useEffect } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface RealTimeDataPoint {
  timestamp: string
  price_usd: number
  id: string
  symbol: string
  name: string
  volume_24h: number
  market_cap: number
}

interface RealTimePriceChartProps {
  selectedCoin: string
  coinName: string
  className?: string
  realTimeData?: any[]
  countdown?: number
  globalLoading?: boolean
}

export default function RealTimePriceChart({ 
  selectedCoin, 
  coinName, 
  className,
  realTimeData: externalData = [],
  countdown: externalCountdown = 60,
  globalLoading = false
}: RealTimePriceChartProps) {
  const [dataSource, setDataSource] = useState<'minio' | 'fallback'>('minio')

  // Use external data when available
  const realTimeData = externalData && externalData.length > 0 ? externalData : []
  const countdown = externalCountdown
  const loading = globalLoading

  // Prepare chart data with proper time formatting
  const chartData = realTimeData.map(item => {
    const date = new Date(item.timestamp)
    return {
      time: date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      price: item.price_usd,
      volume: item.volume_24h / 1e9, // Convert to billions
      marketCap: item.market_cap / 1e12, // Convert to trillions
      fullTimestamp: item.timestamp,
      formattedDate: date.toLocaleString(),
      symbol: item.symbol
    }
  })

  // Debug logging
  console.log('🔍 RealTimePriceChart Debug:', {
    selectedCoin,
    realTimeDataLength: realTimeData.length,
    chartDataLength: chartData.length,
    sampleData: chartData.slice(0, 2),
    dataSource,
    loading
  })

  // Calculate price statistics
  const prices = chartData.map(item => item.price).filter(price => price && !isNaN(price))
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 100
  const currentPrice = prices[prices.length - 1] || 0
  const firstPrice = prices[0] || 0
  const priceChange = currentPrice - firstPrice

  // Calculate dynamic Y-axis range - start from data minimum instead of 0
  const padding = prices.length > 1 ? (maxPrice - minPrice) * 0.05 : maxPrice * 0.05
  const yAxisMin = prices.length > 0 ? minPrice - padding : 0
  const yAxisMax = prices.length > 0 ? maxPrice + padding : 100

  console.log('📊 Chart Statistics:', {
    pricesCount: prices.length,
    minPrice,
    maxPrice,
    yAxisMin,
    yAxisMax,
    currentPrice
  })

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-800/95 border border-green-500/50 rounded-lg p-3 shadow-xl backdrop-blur">
          <p className="text-gray-300 text-sm font-medium mb-1">
            📅 {data.formattedDate}
          </p>
          <p className="text-green-400 font-semibold text-lg mb-1">
            💰 Price: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-gray-400 text-sm">
            📊 Volume: ${(data.volume).toFixed(2)}B
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className={`bg-gray-950 border-t border-gray-800 ${className || ''} flex flex-col h-full`}>
      <div className="px-4 py-2 border-b border-gray-800/50 bg-gray-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold text-sm">PRICE CHART</span>
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              dataSource === 'minio' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' : 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
            }`}>
              {dataSource === 'minio' ? 'LIVE' : 'BACKUP'}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Real-Time • Auto-Refresh</span>
            <div className="flex items-center gap-1">
              <span className="text-blue-400">⏱</span>
              <span className={`font-mono ${countdown <= 10 ? 'text-orange-400' : 'text-blue-400'}`}>
                {countdown}s
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time"
                stroke="#9CA3AF"
                fontSize={11}
                interval={chartData.length > 0 ? Math.max(0, Math.floor(chartData.length / 8)) : 0}
                dy={15}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={11}
                domain={chartData.length > 0 ? [yAxisMin, yAxisMax] : [0, 100]}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
                  return `$${value.toFixed(0)}`
                }}
                dx={-15}
              />
              {chartData.length > 0 && <Tooltip content={<CustomTooltip />} />}
              {chartData.length > 0 && (
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#10B981"
                  fill="url(#priceGradient)"
                  strokeWidth={2}
                />
              )}
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Information */}
        {/* <div className="mt-2 flex items-center justify-between text-xs text-gray-600 px-1">
          <div className="flex items-center gap-2">
            {loading ? (
              <>
                <span className="animate-pulse">Loading...</span>
              </>
            ) : chartData.length > 0 ? (
              <>
                <span>{chartData.length} points</span>
              </>
            ) : (
              <>
                <span>No data</span>
              </>
            )}
          </div>
          <div>
            {lastUpdate ? <span>{lastUpdate}</span> : <span>Connecting...</span>}
          </div>
        </div> */}
      </div>
    </div>
  )
}