'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { HistoricalDataPoint } from '@/lib/types'

interface PriceChartProps {
  data: HistoricalDataPoint[]
  title: React.ReactNode
  className?: string
}

export default function PriceChart({ data, title, className }: PriceChartProps) {
  const chartData = data.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }),
    price: item.price_usd,
    fullTime: item.timestamp
  }))

  // Calculate min and max prices for proper Y-axis range
  const prices = chartData.map(item => item.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const padding = (maxPrice - minPrice) * 0.05 // 5% padding
  const yAxisMin = Math.max(0, minPrice - padding)
  const yAxisMax = maxPrice + padding

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm">
            {new Date(data.fullTime).toLocaleString()}
          </p>
          <p className="text-orange-400 font-semibold text-lg">
            Price: {formatCurrency(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className={`w-auto h-80 chart-container rounded-lg mx-auto ${className || ''}`}>
      <h3 className="text-2xl font-semibold text-white mb-4">
        <span className="border border-orange-400 px-3 py-1 rounded-2xl inline-block">
          {title}
        </span>
      </h3>      
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
            data={chartData}
            margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
          >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time"
            stroke="#9CA3AF"
            fontSize={12}
            tick={{ fill: "#9CA3AF" }}
            interval={Math.max(0, Math.floor(chartData.length / 10))} 
          />
          <YAxis 
            stroke="#9CA3AF"
            fontSize={12}
            domain={[yAxisMin, yAxisMax]}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#F97316"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#F97316' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}