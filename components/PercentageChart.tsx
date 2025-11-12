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
import type { HistoricalDataPoint } from '@/lib/types'

interface PercentageChartProps {
  data: HistoricalDataPoint[]
  selectedPeriod: '1h' | '1d' | '1w'
  title: string
}

export default function PercentageChart({ data, selectedPeriod}: PercentageChartProps) {
  const getDataKey = () => {
    switch (selectedPeriod) {
      case '1h': return 'price_change_1h'
      case '1d': return 'price_change_24h'
      case '1w': return 'price_change_7d'
    }
  }

  const chartData = data.map(item => ({
    time: new Date(item.timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }),
    change: item[getDataKey()] || 0,
    fullTime: item.timestamp
  })).filter(item => item.change !== undefined)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const value = payload[0].value
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm">
            {new Date(data.fullTime).toLocaleString()}
          </p>
          <p className={`font-semibold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Change: {value >= 0 ? '+' : ''}{value.toFixed(2)}%
          </p>
        </div>
      )
    }
    return null
  }

  // Determine line color based on overall trend
  const avgChange = chartData.reduce((sum, item) => sum + item.change, 0) / chartData.length
  const lineColor = avgChange >= 0 ? '#10B981' : '#EF4444'

  return (
    <div className="w-full h-80 chart-container rounded-lg p-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
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
            tickFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="change"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: lineColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}