'use client'

import React, { useState, useEffect } from 'react'
import { Chart, CategoryScale, LinearScale, Tooltip, TimeScale, PointElement, LineElement } from 'chart.js'
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial'
import { Chart as ReactChart } from 'react-chartjs-2'
import 'chartjs-adapter-date-fns'

// ⚙️ Phải đăng ký để ChartJS hiểu loại dữ liệu (conditional registration to prevent SSR issues)
if (typeof window !== 'undefined') {
  Chart.register(CategoryScale, LinearScale, TimeScale, Tooltip, PointElement, LineElement, CandlestickController, CandlestickElement)
}

interface CandleData {
  timestamp: number
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  // Technical indicators
  sma_20?: number
  sma_50?: number
  rsi?: number
  macd_line?: number
  macd_signal?: number
  bb_upper?: number
  bb_middle?: number
  bb_lower?: number
  stoch_k?: number
  stoch_d?: number
}

interface CandleChartData {
  coin_id: string
  period: string
  data_points: number
  date_range: {
    start: string
    end: string
  }
  fetched_at: string
  next_update: string
  candle_data: CandleData[]
  has_indicators?: boolean
}

interface TradingSignals {
  timestamp: number
  price: number
  signals: {
    trend: any
    momentum: any
    volume: any
    support_resistance: any
    overall_sentiment: string
  }
}

interface CandleChartAnalysisProps {
  selectedCoin: string
  coinName: string
  className?: string
  candleData?: any
  tradingSignals?: any
  globalLoading?: boolean
}

export default function CandleChartAnalysis({ 
  selectedCoin, 
  coinName, 
  className,
  candleData: externalCandleData,
  tradingSignals: externalTradingSignals,
  globalLoading = false
}: CandleChartAnalysisProps) {
  const [error, setError] = useState<string | null>(null)
  const [activeIndicator, setActiveIndicator] = useState<string>('sma')
  const [lastUpdate, setLastUpdate] = useState<string>('')
  
  // Use external data when available
  const candleData = externalCandleData
  const tradingSignals = externalTradingSignals
  const loading = globalLoading

  // Update last update time when data changes
  React.useEffect(() => {
    if (candleData) {
      setLastUpdate(new Date().toLocaleTimeString())
    }
  }, [candleData])

  // Manual refresh function (triggers global refresh)
  const handleManualRefresh = () => {
    // Since this component now uses centralized data,
    // manual refresh should trigger the global refresh
    // This will be handled by the parent component
    console.log('🔄 Manual refresh requested for candle data')
  }

  // Register Chart.js components once (client-side only)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        Chart.register(
          CategoryScale,
          LinearScale,
          Tooltip,
          TimeScale,
          PointElement,
          LineElement,
          CandlestickController,
          CandlestickElement
        )
      } catch (error) {
        console.warn('Chart.js registration error:', error)
      }
    }
  }, [])
  // Prepare chart data for react-chartjs-2
  const getCandleChartData = () => {
    if (!candleData?.candle_data) return null
    // Show last 120 candles for better performance
    const candles = candleData.candle_data.slice(-120)
    const candlestick = candles.map(d => ({
      x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(),
      o: d.open,
      h: d.high,
      l: d.low,
      c: d.close,
      volume: d.volume,
      raw: d,
    }))

    // Prepare overlays for indicators
    let datasets: any[] = [
      {
        label: 'Candles',
        data: candlestick,
        type: 'candlestick',
        yAxisID: 'y',
        borderColor: '#8884d8',
        color: {
          up: '#10B981',
          down: '#EF4444',
          unchanged: '#F59E0B',
        },
        borderSkipped: false,
      },
    ]

    // Add Volume as bar chart, using y2 axis
    const volumeData = candles.map(d => ({
      x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(),
      y: d.volume,
      // For coloring: green if close >= open, red if close < open
      backgroundColor: d.close >= d.open ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
      borderColor: d.close >= d.open ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
      raw: d,
    }))
    datasets.push({
      label: 'Volume',
      data: volumeData,
      type: 'bar',
      yAxisID: 'y2',
      backgroundColor: volumeData.map(v => v.backgroundColor),
      borderColor: volumeData.map(v => v.borderColor),
      borderWidth: 1,
      barPercentage: 1,
      categoryPercentage: 1,
      order: -1, // Put volume behind candles
    })

    if (activeIndicator === 'sma') {
      // SMA 20
      datasets.push({
        label: 'SMA 20',
        data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.sma_20 })),
        type: 'line',
        borderColor: '#8B5CF6',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y',
      })
      // SMA 50
      datasets.push({
        label: 'SMA 50',
        data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.sma_50 })),
        type: 'line',
        borderColor: '#06B6D4',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y',
      })
    } else if (activeIndicator === 'bollinger') {
      datasets.push(
        {
          label: 'BB Upper',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.bb_upper })),
          type: 'line',
          borderColor: '#8B5CF6',
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
          yAxisID: 'y',
        },
        {
          label: 'BB Middle',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.bb_middle })),
          type: 'line',
          borderColor: '#A3A3A3',
          borderWidth: 1,
          borderDash: [2, 2],
          pointRadius: 0,
          fill: false,
          yAxisID: 'y',
        },
        {
          label: 'BB Lower',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.bb_lower })),
          type: 'line',
          borderColor: '#8B5CF6',
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: '-1',
          yAxisID: 'y',
        }
      )
    } else if (activeIndicator === 'rsi') {
      datasets.push({
        label: 'RSI',
        data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.rsi })),
        type: 'line',
        borderColor: '#F59E0B',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        yAxisID: 'y1', // nên thêm yAxis thứ 2 cho RSI để scale riêng
      });
    } else if (activeIndicator === 'macd') {
      datasets.push(
        {
          label: 'MACD Line',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.macd_line })),
          type: 'line',
          borderColor: '#10B981',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y1',
        },
        {
          label: 'MACD Signal',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.macd_signal })),
          type: 'line',
          borderColor: '#EF4444',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y1',
        }
      );
    } else if (activeIndicator === 'stochastic') {
      datasets.push(
        {
          label: '%K',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.stoch_k })),
          type: 'line',
          borderColor: '#8B5CF6',
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y1',
        },
        {
          label: '%D',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.stoch_d })),
          type: 'line',
          borderColor: '#F59E0B',
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y1',
        }
      );
    } else if (activeIndicator === 'ema') {
      datasets.push(
        {
          label: 'EMA 12',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.ema_12 })),
          type: 'line',
          borderColor: '#06B6D4',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y',
        },
        {
          label: 'EMA 26',
          data: candles.map(d => ({ x: typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp || d.date).getTime(), y: d.ema_26 })),
          type: 'line',
          borderColor: '#F59E0B',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y',
        }
      );
    }
    return { datasets }
  }

  // Chart options
  const candleChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: 'nearest',
        intersect: false,
        callbacks: {
          label: function (context: any) {
            const d = context.raw?.raw || context.raw
            if (context.dataset.type === 'candlestick' && d) {
              return [
                `Open: $${d.open}`,
                `High: $${d.high}`,
                `Low:  $${d.low}`,
                `Close: $${d.close}`,
                `Volume: ${d.volume?.toLocaleString()}`
              ]
            }
            // Volume bar
            if (context.dataset.label === 'Volume' && d) {
              return `Volume: ${d.volume?.toLocaleString()}`
            }
            if (typeof context.parsed.y === 'number') {
              return `${context.dataset.label}: $${context.parsed.y}`
            }
            return context.dataset.label
          }
        }
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          parser: false,
          unit: 'day',
          tooltipFormat: 'MMM dd, yyyy',
          displayFormats: { day: 'MMM dd' },
        },
        grid: { color: '#222' },
        ticks: { color: '#9CA3AF', maxTicksLimit: 7, padding: 8 },
      },
      y: {
        position: 'left' as const,
        grid: { color: '#222' },
        ticks: { color: '#9CA3AF' },
        title: { display: true, text: 'Price', color: '#9CA3AF', font: { size: 12 } },
        // Make main chart take 2/3 height
        weight: 1,
        // min/max left default for auto scaling
      },
      // Add y2 axis for Volume
      y2: {
        position: 'right' as const,
        // Hide y2 grid, ticks, and title
        grid: { color: 'rgba(0,0,0,0)', drawOnChartArea: false },
        ticks: { display: false },
        title: { display: false },
        beginAtZero: true,
        // Make volume chart take 1/3 height
        weight: 1,
        // Ensure y2 does not overlap with y
        // min/max left default for auto scaling
        // stacked: false,
      },
    },
    interaction: {
      mode: 'nearest' as const,
      intersect: false,
    },
    elements: {
      candlestick: {
        color: {
          up: '#10B981',
          down: '#EF4444',
          unchanged: '#F59E0B',
        },
        borderColor: '#8884d8',
        borderWidth: 1,
      },
    },
  }

  const getSignalColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-green-400'
      case 'bearish': return 'text-red-400'
      default: return 'text-yellow-400'
    }
  }

  const getSignalIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return '📈'
      case 'bearish': return '📉'
      default: return '⚪'
    }
  }

  return (
    <div className={`bg-gray-950 border border-gray-800 ${className || ''} flex flex-col h-full`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800/50 bg-gray-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-purple-400 font-bold text-sm">CANDLE CHART</span>
            <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-600/20 text-purple-400 border border-purple-600/30">
              6 MONTH
            </div>
            {candleData?.has_indicators && (
              <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-600/20 text-green-400 border border-green-600/30">
                INDICATORS
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Indicator selector */}
            <select
              value={activeIndicator}
              onChange={(e) => setActiveIndicator(e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1"
            >
              <option value="sma">SMA (20/50)</option>
              <option value="bollinger">Bollinger Bands</option>
              <option value="rsi">RSI</option>
              <option value="macd">MACD</option>
              <option value="stochastic">Stochastic Oscillator</option>
              <option value="ema">EMA (12/26)</option>
              <option value="none">No Indicators</option>
            </select>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? '⏳' : '🔄'}
            </button>
          </div>
        </div>
      </div>
      {/* Chart Area */}
      <div className="flex-1 flex flex-row">
        {/* Main Chart */}
        <div className="flex-1 p-4 flex flex-col">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-400">
                <div className="text-xl mb-2">❌</div>
                <div className="text-sm">{error}</div>
                <button
                  onClick={handleManualRefresh}
                  className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-purple-400">
                <div className="text-xl mb-2 animate-spin">⏳</div>
                <div className="text-sm">Loading candle data...</div>
              </div>
            </div>
          ) : candleData ? (
            <div className="w-full h-[330px]">
              <CandleChart
                data={getCandleChartData()}
                options={candleChartOptions}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-xl mb-2">📊</div>
                <div className="text-sm">No candle data available</div>
              </div>
            </div>
          )}
        </div>

      </div>
      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-gray-800/50 bg-gray-900/20">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div>
            {candleData ? `${candleData.data_points} candles • ${candleData.date_range.start} to ${candleData.date_range.end}` : 'No data'}
          </div>
          <div>
            {lastUpdate ? `Last: ${lastUpdate}` : 'Not updated'} • Next: Daily at midnight
          </div>
        </div>
      </div>
    </div>
  )
}

// Separate CandleChart component for clarity
function CandleChart({ data, options }: { data: any, options: any }) {
  // Only render if data is valid and we're on client side
  if (!data || typeof window === 'undefined') {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        {typeof window === 'undefined' ? 'Loading...' : 'No data'}
      </div>
    )
  }
  
  try {
    return (
      <ReactChart
        type="candlestick"
        data={data}
        options={options}
        style={{ width: '100%', height: '100%' }}
      />
    )
  } catch (error) {
    console.error('Chart rendering error:', error)
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        Chart error - please refresh
      </div>
    )
  }
}