'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { fetchBitcoinHistory } from '@/lib/api'
import type { HistoricalDataPoint } from '@/lib/types'

interface BitcoinAdvancedMetricsProps {
  currentPrice: number
}

export default function BitcoinAdvancedMetrics({ currentPrice }: BitcoinAdvancedMetricsProps) {
  const [timeframe, setTimeframe] = useState<'1' | '7' | '30' | '90'>('7')
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    volatility: 0,
    rsi: 0,
    support: 0,
    resistance: 0,
    trend: 'neutral' as 'bullish' | 'bearish' | 'neutral'
  })

  const fetchAdvancedData = async () => {
    setLoading(true)
    try {
      const days = parseInt(timeframe)
      const data = await fetchBitcoinHistory(days)
      setHistoricalData(data)
      
      if (data.length > 0) {
        calculateAdvancedMetrics(data)
      }
    } catch (error) {
      console.error('Error fetching advanced data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateAdvancedMetrics = (data: HistoricalDataPoint[]) => {
    if (data.length < 14) return

    const prices = data.map(d => d.price_usd)
    
    // Calculate volatility (standard deviation)
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length
    const volatility = Math.sqrt(variance) / mean * 100

    // Calculate simple RSI
    let gains = 0, losses = 0
    for (let i = 1; i < Math.min(15, prices.length); i++) {
      const change = prices[i] - prices[i - 1]
      if (change > 0) gains += change
      else losses -= change
    }
    const avgGain = gains / 14
    const avgLoss = losses / 14
    const rs = avgGain / avgLoss
    const rsi = 100 - (100 / (1 + rs))

    // Calculate support and resistance (simple min/max)
    const support = Math.min(...prices)
    const resistance = Math.max(...prices)

    // Determine trend
    const recentPrices = prices.slice(-5)
    const olderPrices = prices.slice(-10, -5)
    const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length
    const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length
    
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    if (recentAvg > olderAvg * 1.02) trend = 'bullish'
    else if (recentAvg < olderAvg * 0.98) trend = 'bearish'

    setMetrics({
      volatility,
      rsi,
      support,
      resistance,
      trend
    })
  }

  useEffect(() => {
    fetchAdvancedData()
  }, [timeframe])

  const chartData = historicalData.map(item => ({
    time: new Date(item.timestamp).toLocaleDateString(),
    price: item.price_usd,
    volume: item.volume_24h / 1e9, // Convert to billions
    marketCap: item.market_cap / 1e12 // Convert to trillions
  }))

  const getTrendColor = () => {
    switch (metrics.trend) {
      case 'bullish': return 'text-green-400'
      case 'bearish': return 'text-red-400'
      default: return 'text-yellow-400'
    }
  }

  const getTrendIcon = () => {
    switch (metrics.trend) {
      case 'bullish': return '🚀'
      case 'bearish': return '🐻'
      default: return '⚖️'
    }
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Selector */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Advanced Analytics Timeframe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(['1', '7', '30', '90'] as const).map(period => (
              <Button
                key={period}
                onClick={() => setTimeframe(period)}
                className={`${
                  timeframe === period
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-slate-600 hover:bg-slate-500'
                } text-white`}
              >
                {period === '1' ? '24H' : `${period}D`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Volatility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {metrics.volatility.toFixed(2)}%
            </div>
            <div className="text-xs text-slate-400">Price variance</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">RSI (14)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              metrics.rsi > 70 ? 'text-red-400' : 
              metrics.rsi < 30 ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {metrics.rsi.toFixed(1)}
            </div>
            <div className="text-xs text-slate-400">
              {metrics.rsi > 70 ? 'Overbought' : metrics.rsi < 30 ? 'Oversold' : 'Neutral'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Support Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              ${metrics.support.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Period low</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Resistance Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              ${metrics.resistance.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Period high</div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Analysis */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            Trend Analysis
            <span className="text-2xl">{getTrendIcon()}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-xl font-bold ${getTrendColor()}`}>
                {metrics.trend.toUpperCase()}
              </div>
              <div className="text-sm text-slate-400">
                Based on {timeframe}-day moving average
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-300">Current vs Support</div>
              <div className={`font-bold ${
                currentPrice > metrics.support * 1.1 ? 'text-green-400' : 'text-red-400'
              }`}>
                {(((currentPrice - metrics.support) / metrics.support) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price & Volume Chart */}
      {!loading && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Price Movement</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#F3F4F6'
                    }}
                    formatter={(value: any) => [`$${value.toLocaleString()}`, 'Price']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#F59E0B" 
                    fill="#F59E0B" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Trading Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#F3F4F6'
                    }}
                    formatter={(value: any) => [`${value.toFixed(2)}B`, 'Volume']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="volume" 
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <span className="animate-spin text-2xl">⏳</span>
          <div className="text-slate-400 mt-2">Loading advanced metrics...</div>
        </div>
      )}
    </div>
  )
}