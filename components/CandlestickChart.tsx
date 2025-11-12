import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface OHLCVData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  sma_7?: number
  sma_20?: number
  sma_50?: number
  bb_upper?: number
  bb_lower?: number
  daily_return_pct?: number
  volatility_7d?: number
}

interface CandlestickChartProps {
  coinId: string | null
  timePeriod: string
  onDataNeeded: () => void
}

const CandlestickChart: React.FC<CandlestickChartProps> = ({ 
  coinId, 
  timePeriod, 
  onDataNeeded 
}) => {
  const [chartData, setChartData] = useState<OHLCVData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [showIndicators, setShowIndicators] = useState({
    sma: true,
    bb: false,
    volume: true
  })
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick')

  // Load processed OHLCV data
  const loadChartData = async () => {
    if (!coinId) {
      setError('No coin selected')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log(`📊 Loading chart data for ${coinId} (${timePeriod})`)
      
      const response = await fetch(`/api/ohlcv-data?coinId=${coinId}&timePeriod=${timePeriod}`)
      const result = await response.json()

      if (result.success && result.data) {
        const data = result.data
        setChartData(data.ohlcv_data || [])
        setMetadata(data)
        console.log(`✅ Loaded ${data.ohlcv_data?.length || 0} chart records`)
      } else {
        setError(result.error || 'Failed to load chart data')
        console.error('Chart data loading failed:', result.error)
      }

    } catch (error) {
      setError(`Network error: ${error}`)
      console.error('Error loading chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load data when coin or period changes
  useEffect(() => {
    if (coinId) {
      loadChartData()
    }
  }, [coinId, timePeriod])

  // Create SVG candlestick chart
  const renderCandlestickChart = () => {
    if (!chartData || chartData.length === 0) return null

    const width = 800
    const height = 400
    const margin = { top: 20, right: 50, bottom: 60, left: 60 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Calculate price range
    const prices = chartData.flatMap(d => [d.open, d.high, d.low, d.close])
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice
    const padding = priceRange * 0.1

    // Scale functions
    const xScale = (index: number) => (index / (chartData.length - 1)) * chartWidth
    const yScale = (price: number) => ((maxPrice + padding - price) / (priceRange + 2 * padding)) * chartHeight

    // Volume scale (for bottom section)
    const volumeHeight = 80
    const volumes = chartData.map(d => d.volume)
    const maxVolume = Math.max(...volumes)
    const volumeScale = (volume: number) => (volume / maxVolume) * volumeHeight

    return (
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height + volumeHeight} className="bg-transparent rounded-lg">
          {/* Background grid */}
          {/* <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="1" opacity="0.3"/>
            </pattern>
          </defs> */}
          <rect width={width} height={height + volumeHeight} fill="transparent"/>
          
          {/* Main chart area */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            
            {/* Price Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
              const y = ratio * chartHeight
              const price = maxPrice + padding - (ratio * (priceRange + 2 * padding))
              return (
                <g key={ratio}>
                  <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="#475569" strokeWidth="1" opacity="0.5"/>
                  <text x="-10" y={y + 4} fill="#94a3b8" fontSize="12" textAnchor="end">
                    ${price.toFixed(price > 1 ? 0 : 4)}
                  </text>
                </g>
              )
            })}

            {/* Bollinger Bands (if enabled) */}
            {showIndicators.bb && (
              <g>
                {chartData.map((d, i) => {
                  if (!d.bb_upper || !d.bb_lower || i === 0) return null
                  const x = xScale(i)
                  const prevX = xScale(i - 1)
                  const upperY = yScale(d.bb_upper)
                  const lowerY = yScale(d.bb_lower)
                  const prevUpperY = yScale(chartData[i - 1].bb_upper || d.bb_upper)
                  const prevLowerY = yScale(chartData[i - 1].bb_lower || d.bb_lower)
                  
                  return (
                    <g key={`bb-${i}`}>
                      <line x1={prevX} y1={prevUpperY} x2={x} y2={upperY} stroke="#8b5cf6" strokeWidth="1" opacity="0.6"/>
                      <line x1={prevX} y1={prevLowerY} x2={x} y2={lowerY} stroke="#8b5cf6" strokeWidth="1" opacity="0.6"/>
                    </g>
                  )
                })}
              </g>
            )}

            {/* Moving Averages (if enabled) */}
            {showIndicators.sma && (
              <g>
                {/* SMA 20 */}
                {chartData.map((d, i) => {
                  if (!d.sma_20 || i === 0) return null
                  const x = xScale(i)
                  const y = yScale(d.sma_20)
                  const prevX = xScale(i - 1)
                  const prevY = yScale(chartData[i - 1].sma_20 || d.sma_20)
                  
                  return (
                    <line key={`sma20-${i}`} x1={prevX} y1={prevY} x2={x} y2={y} 
                          stroke="#f59e0b" strokeWidth="2" opacity="0.8"/>
                  )
                })}
                
                {/* SMA 50 */}
                {chartData.map((d, i) => {
                  if (!d.sma_50 || i === 0) return null
                  const x = xScale(i)
                  const y = yScale(d.sma_50)
                  const prevX = xScale(i - 1)
                  const prevY = yScale(chartData[i - 1].sma_50 || d.sma_50)
                  
                  return (
                    <line key={`sma50-${i}`} x1={prevX} y1={prevY} x2={x} y2={y} 
                          stroke="#06b6d4" strokeWidth="2" opacity="0.8"/>
                  )
                })}
              </g>
            )}

            {/* Candlesticks */}
            {chartType === 'candlestick' && chartData.map((d, i) => {
              const x = xScale(i)
              const openY = yScale(d.open)
              const highY = yScale(d.high)
              const lowY = yScale(d.low)
              const closeY = yScale(d.close)
              
              const isGreen = d.close > d.open
              const bodyHeight = Math.abs(closeY - openY)
              const bodyY = Math.min(openY, closeY)
              
              const candleWidth = Math.max(2, chartWidth / chartData.length * 0.6)
              
              return (
                <g key={`candle-${i}`}>
                  {/* Wick */}
                  <line 
                    x1={x} y1={highY} x2={x} y2={lowY}
                    stroke={isGreen ? "#10b981" : "#ef4444"} 
                    strokeWidth="1"
                  />
                  
                  {/* Body */}
                  <rect 
                    x={x - candleWidth/2} 
                    y={bodyY}
                    width={candleWidth}
                    height={Math.max(1, bodyHeight)}
                    fill={isGreen ? "#10b981" : "#ef4444"}
                    stroke={isGreen ? "#059669" : "#dc2626"}
                    strokeWidth="1"
                  />
                </g>
              )
            })}

            {/* Line chart (alternative) */}
            {chartType === 'line' && chartData.map((d, i) => {
              if (i === 0) return null
              const x = xScale(i)
              const y = yScale(d.close)
              const prevX = xScale(i - 1)
              const prevY = yScale(chartData[i - 1].close)
              
              return (
                <line key={`line-${i}`} x1={prevX} y1={prevY} x2={x} y2={y} 
                      stroke="#3b82f6" strokeWidth="2"/>
              )
            })}

            {/* X-axis labels */}
            {chartData.map((d, i) => {
              if (i % Math.ceil(chartData.length / 8) !== 0) return null
              const x = xScale(i)
              return (
                <text key={`xlabel-${i}`} x={x} y={chartHeight + 20} 
                      fill="#94a3b8" fontSize="11" textAnchor="middle">
                  {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </text>
              )
            })}
          </g>

          {/* Volume bars (bottom section) */}
          {showIndicators.volume && (
            <g transform={`translate(${margin.left}, ${height + 10})`}>
              {chartData.map((d, i) => {
                const x = xScale(i)
                const barHeight = volumeScale(d.volume)
                const barWidth = Math.max(1, chartWidth / chartData.length * 0.8)
                
                return (
                  <rect 
                    key={`volume-${i}`}
                    x={x - barWidth/2} 
                    y={volumeHeight - barHeight}
                    width={barWidth}
                    height={barHeight}
                    fill="#6366f1"
                    opacity="0.6"
                  />
                )
              })}
              
              {/* Volume label */}
              <text x="0" y={volumeHeight + 15} fill="#94a3b8" fontSize="12">Volume</text>
            </g>
          )}
        </svg>
      </div>
    )
  }

  const coinName = metadata?.coin_id?.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || coinId

  return (
    <Card className="bg-transparent border-0">
      <CardHeader className="mb-4">
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="border border-orange-400 px-3 py-2 rounded-2xl inline-block font-semibold">
              <span className="text-white">Candlestick Chart of </span>
              <span className="text-orange-400">{coinName}</span>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Chart Type Toggle */}
            <div className="flex bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setChartType('candlestick')}
                className={`px-3 py-1 rounded text-sm ${
                  chartType === 'candlestick' ? 'bg-orange-500 text-white' : 'text-slate-300'
                }`}
              >
                Candles
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1 rounded text-sm ${
                  chartType === 'line' ? 'bg-orange-500 text-white' : 'text-slate-300'
                }`}
              >
                Line
              </button>
            </div>
            
            {/* Indicators Toggle */}
            <div className="flex gap-1">
              <button
                onClick={() => setShowIndicators(prev => ({ ...prev, sma: !prev.sma }))}
                className={`px-2 py-1 rounded text-xs ${
                  showIndicators.sma ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                SMA
              </button>
              <button
                onClick={() => setShowIndicators(prev => ({ ...prev, bb: !prev.bb }))}
                className={`px-2 py-1 rounded text-xs ${
                  showIndicators.bb ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                BB
              </button>
              <button
                onClick={() => setShowIndicators(prev => ({ ...prev, volume: !prev.volume }))}
                className={`px-2 py-1 rounded text-xs ${
                  showIndicators.volume ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                Vol
              </button>
            </div>
          </div>
        </CardTitle>
        
        {metadata && (
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>• {metadata.data_points} data points </span>
            <span>• From {metadata.date_range?.start} to {metadata.date_range?.end}</span>
            <span>• Processed: {new Date(metadata.processed_at).toLocaleDateString()}</span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <div className="text-slate-300">Loading chart data...</div>
            </div>
          </div>
        ) : error ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">❌</div>
              <div className="text-slate-300 mb-4">{error}</div>
              {coinId && (
                <Button onClick={onDataNeeded} className="bg-blue-600 hover:bg-blue-700">
                  <span className="mr-2">📡</span>
                  Fetch Data for {coinId}
                </Button>
              )}
            </div>
          </div>
        ) : !coinId ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="text-4xl mb-4">📊</div>
              <div>Select a coin and fetch data to view the candlestick chart</div>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">📭</div>
              <div className="text-slate-300 mb-4">No chart data available for {coinId}</div>
              <Button onClick={onDataNeeded} className="bg-green-600 hover:bg-green-700">
                <span className="mr-2">🚀</span>
                Fetch & Process Data
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chart */}
            {renderCandlestickChart()}
            
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Bullish Candle</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Bearish Candle</span>
              </div>
              {showIndicators.sma && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-amber-500"></div>
                    <span>SMA 20</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-cyan-500"></div>
                    <span>SMA 50</span>
                  </div>
                </>
              )}
              {showIndicators.bb && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-purple-500"></div>
                  <span>Bollinger Bands</span>
                </div>
              )}
              {showIndicators.volume && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-indigo-500 rounded opacity-60"></div>
                  <span>Volume</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default CandlestickChart