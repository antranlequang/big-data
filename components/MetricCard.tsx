'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface MetricCardProps {
  title: string
  value: string
  change: number
  icon: React.ReactNode
}

export default function MetricCard({ title, value, change, icon }: MetricCardProps) {
  const isPositive = change >= 0
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400'
  const bgColor = isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
  
  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors mt-10">
      <CardContent className="p-6 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-orange-400">{title}</h3>
          </div>
          <div className={`flex items-center space-x-1 ${bgColor} rounded-full px-2 py-1`}>
            <span className={`text-xs font-medium ${changeColor}`}>
              {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}