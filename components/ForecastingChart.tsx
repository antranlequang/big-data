import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface ForecastingChartProps {
  selectedCoin: string
  historicalData: any[]
}

interface PredictionPoint {
  timestamp: string
  actual_price?: number
  predicted_price?: number
  is_future?: boolean
  price_change_percent?: number
}

const ForecastingChart: React.FC<ForecastingChartProps> = ({ selectedCoin, historicalData }) => {
  const [isForecasting, setIsForecasting] = useState(false)
  const [forecastData, setForecastData] = useState<PredictionPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Generate forecast data
  const generateForecast = async () => {
    if (!historicalData || historicalData.length < 20) {
      alert('Need more historical data to generate forecast (minimum 20 points)')
      return
    }

    setLoading(true)
    try {
      console.log('Generating AI forecast with real LSTM model...')
      
      // Call the enhanced forecast API
      const response = await fetch('/api/forecast-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId: selectedCoin,
          historicalData: historicalData
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Forecast generation failed')
      }

      const { predictions, accuracy: modelAccuracy, training_results } = result.data

      // Convert predictions to our format
      const formattedPredictions: PredictionPoint[] = predictions.map((p: any) => ({
        timestamp: p.timestamp,
        actual_price: p.actual_price,
        predicted_price: p.predicted_price,
        is_future: p.is_future,
        price_change_percent: p.actual_price && p.predicted_price ? 
          ((p.predicted_price - p.actual_price) / p.actual_price) * 100 : 0
      }))

      setForecastData(formattedPredictions)
      setAccuracy(modelAccuracy)
      setIsForecasting(true)
      setLastUpdate(new Date())

      console.log(`✅ Forecast completed: ${formattedPredictions.length} predictions, ${modelAccuracy.toFixed(1)}% accuracy`)

    } catch (error) {
      console.error('Error generating forecast:', error)
      alert(`Failed to generate forecast: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const stopForecast = () => {
    setIsForecasting(false)
    setForecastData([])
    setAccuracy(null)
  }

  // Prepare chart data
  const chartData = forecastData.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    }),
    timestamp: point.timestamp,
    actual: point.actual_price,
    predicted: point.predicted_price,
    isFuture: point.is_future
  }))

  // Calculate Y-axis domain
  const allPrices = chartData.flatMap(d => [d.actual, d.predicted]).filter(Boolean) as number[]
  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const padding = (maxPrice - minPrice) * 0.1
  const yAxisMin = Math.max(0, minPrice - padding)
  const yAxisMax = maxPrice + padding

  // Find dividing line between actual and future data
  const futureDivider = chartData.findIndex(d => d.isFuture)

  return (
    <Card className="bg-slate-800/50 border-slate-700 mt-10">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🔮</span>
            AI Price Forecasting Chart
          </div>
          <div className="flex gap-2">
            {!isForecasting ? (
              <Button
                onClick={generateForecast}
                disabled={loading || !historicalData?.length}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Training & Forecasting...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🚀</span>
                    Start Forecast
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={stopForecast}
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-900/20"
              >
                <span className="mr-2">🛑</span>
                Stop Forecast
              </Button>
            )}
          </div>
        </CardTitle>
        
        {isForecasting && (
          <div className="flex items-center gap-4 text-sm">
            <div className="text-slate-300">
              <span className="text-blue-400">●</span> Actual Price
            </div>
            <div className="text-slate-300">
              <span className="text-orange-400">●</span> Predicted Price
            </div>
            <div className="text-slate-300">
              <span className="text-green-400">●</span> Future Forecast
            </div>
            {accuracy !== null && (
              <div className="text-slate-300">
                Model Accuracy: <span className="text-green-400">{accuracy.toFixed(1)}%</span>
              </div>
            )}
            {lastUpdate && (
              <div className="text-slate-400 text-xs">
                Generated: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {!isForecasting ? (
          <div className="h-96 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <div className="text-lg mb-2">AI Price Forecasting</div>
              <div className="text-sm">
                Click "Start Forecast" to train model and generate predictions
              </div>
              <div className="text-xs mt-2 opacity-70">
                • Compares actual vs predicted prices<br/>
                • Forecasts next 5 time periods<br/>
                • Shows model accuracy
              </div>
            </div>
          </div>
        ) : (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b"
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  domain={[yAxisMin, yAxisMax]}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  formatter={(value: any, name: string) => [
                    `$${Number(value).toLocaleString()}`,
                    name === 'actual' ? 'Actual Price' : 
                    name === 'predicted' ? 'Predicted Price' : name
                  ]}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                
                {/* Vertical line separating actual from future predictions */}
                {futureDivider > 0 && (
                  <ReferenceLine 
                    x={chartData[futureDivider - 1]?.time} 
                    stroke="#64748b" 
                    strokeDasharray="5 5"
                    label={{ value: "Now", position: "top" }}
                  />
                )}
                
                {/* Actual price line (past data) */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                  connectNulls={false}
                  name="Actual"
                />
                
                {/* Predicted price line (all data) */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#f97316', strokeWidth: 2, r: 3 }}
                  name="Predicted"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Forecast Summary */}
        {isForecasting && forecastData.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current vs Predicted */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Latest Prediction</div>
              {(() => {
                const latest = forecastData.find(p => !p.is_future && p.actual_price && p.predicted_price)
                if (latest) {
                  const diff = latest.predicted_price! - latest.actual_price!
                  const diffPercent = (diff / latest.actual_price!) * 100
                  return (
                    <div>
                      <div className="text-white">
                        Actual: <span className="text-blue-400">${latest.actual_price!.toFixed(2)}</span>
                      </div>
                      <div className="text-white">
                        Predicted: <span className="text-orange-400">${latest.predicted_price!.toFixed(2)}</span>
                      </div>
                      <div className={`text-sm ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(2)} ({diffPercent >= 0 ? '+' : ''}{diffPercent.toFixed(2)}%)
                      </div>
                    </div>
                  )
                }
                return <div className="text-slate-400">No data available</div>
              })()}
            </div>

            {/* Next Prediction */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Next Hour Forecast</div>
              {(() => {
                const nextPrediction = forecastData.find(p => p.is_future)
                const currentPrice = historicalData[historicalData.length - 1]?.price_usd
                if (nextPrediction && currentPrice) {
                  const change = nextPrediction.predicted_price! - currentPrice
                  const changePercent = (change / currentPrice) * 100
                  return (
                    <div>
                      <div className="text-white">
                        Forecast: <span className="text-green-400">${nextPrediction.predicted_price!.toFixed(2)}</span>
                      </div>
                      <div className={`text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
                      </div>
                      <div className="text-xs text-slate-400">
                        vs current price
                      </div>
                    </div>
                  )
                }
                return <div className="text-slate-400">No forecast available</div>
              })()}
            </div>

            {/* Model Performance */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Model Performance</div>
              <div className="text-white">
                Accuracy: <span className="text-green-400">{accuracy?.toFixed(1) || 'N/A'}%</span>
              </div>
              <div className="text-sm text-slate-400">
                Predictions: {forecastData.filter(p => !p.is_future).length}
              </div>
              <div className="text-sm text-slate-400">
                Forecasts: {forecastData.filter(p => p.is_future).length}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ForecastingChart