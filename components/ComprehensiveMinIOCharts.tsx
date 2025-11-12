'use client'

import React from 'react'
import CandleChartAnalysis from './CandleChartAnalysis'

interface ComprehensiveMinIOChartsProps {
  selectedCoin: string
  coinName: string
  coinSymbol?: string
  className?: string
  candleData?: any
  tradingSignals?: any
  globalLoading?: boolean
}

export default function ComprehensiveMinIOCharts({ 
  selectedCoin, 
  coinName, 
  coinSymbol, 
  className,
  candleData,
  tradingSignals,
  globalLoading
}: ComprehensiveMinIOChartsProps) {
  return (
    <CandleChartAnalysis 
      selectedCoin={selectedCoin}
      coinName={coinName}
      className={className}
      candleData={candleData}
      tradingSignals={tradingSignals}
      globalLoading={globalLoading}
    />
  )
}