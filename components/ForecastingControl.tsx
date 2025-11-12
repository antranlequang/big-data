import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ForecastingData {
  isRunning: boolean
  latestPrediction?: {
    timestamp: string
    current_price: number
    predicted_next_price: number
    price_change: number
    price_change_percent: number
    coin_id: string
  }
  trainingResults?: {
    timestamp: string
    status: string
    train_mse?: number
    test_mse?: number
    train_mae?: number
    test_mae?: number
    training_samples?: number
    test_samples?: number
    error?: string
  }
}

interface ForecastingControlProps {
  selectedCoin: string
}

const ForecastingControl: React.FC<ForecastingControlProps> = ({ selectedCoin }) => {
  const [forecastingData, setForecastingData] = useState<ForecastingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [training, setTraining] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Fetch forecasting status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/forecasting?coinId=${selectedCoin}`)
      const result = await response.json()
      
      if (result.success) {
        setForecastingData({
          isRunning: result.isRunning,
          latestPrediction: result.latestPrediction,
          trainingResults: result.trainingResults
        })
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching forecasting status:', error)
    }
  }

  // Start training
  const startTraining = async () => {
    setTraining(true)
    try {
      const response = await fetch('/api/forecasting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_training',
          coinId: selectedCoin
        })
      })
      
      const result = await response.json()
      if (result.success) {
        console.log('Training started successfully')
        // Poll for training completion
        const checkTraining = setInterval(async () => {
          await fetchStatus()
          if (forecastingData?.trainingResults?.status === 'completed' || 
              forecastingData?.trainingResults?.status === 'failed') {
            clearInterval(checkTraining)
            setTraining(false)
          }
        }, 3000)
        
        // Stop checking after 5 minutes
        setTimeout(() => {
          clearInterval(checkTraining)
          setTraining(false)
        }, 300000)
      }
    } catch (error) {
      console.error('Error starting training:', error)
      setTraining(false)
    }
  }

  // Start forecasting
  const startForecasting = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/forecasting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_forecasting',
          coinId: selectedCoin
        })
      })
      
      const result = await response.json()
      if (result.success) {
        await fetchStatus()
      }
    } catch (error) {
      console.error('Error starting forecasting:', error)
    } finally {
      setLoading(false)
    }
  }

  // Stop forecasting
  const stopForecasting = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/forecasting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop_forecasting',
          coinId: selectedCoin
        })
      })
      
      const result = await response.json()
      if (result.success) {
        await fetchStatus()
      }
    } catch (error) {
      console.error('Error stopping forecasting:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh when coin changes
  useEffect(() => {
    fetchStatus()
  }, [selectedCoin])

  // Auto-refresh forecasting data
  useEffect(() => {
    if (forecastingData?.isRunning) {
      const interval = setInterval(fetchStatus, 10000) // Every 10 seconds
      return () => clearInterval(interval)
    }
  }, [forecastingData?.isRunning])

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      default: return 'text-yellow-600'
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return '✅'
      case 'failed': return '❌'
      default: return '⏳'
    }
  }

  return (
    <Card className="bg-white shadow-md">
      <CardHeader>
        <CardTitle className="text-gray-800 flex items-center gap-2">
          <span>🔮</span>
          AI Price Forecasting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Training Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700">Model Training</h4>
            <span className="text-sm text-gray-500">
              {selectedCoin.charAt(0).toUpperCase() + selectedCoin.slice(1)}
            </span>
          </div>
          
          {forecastingData?.trainingResults ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>{getStatusIcon(forecastingData.trainingResults.status)}</span>
                <span className={`font-medium ${getStatusColor(forecastingData.trainingResults.status)}`}>
                  {forecastingData.trainingResults.status === 'completed' ? 'Training Complete' : 
                   forecastingData.trainingResults.status === 'failed' ? 'Training Failed' : 'Training...'}
                </span>
              </div>
              
              {forecastingData.trainingResults.status === 'completed' && (
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Train Samples: {forecastingData.trainingResults.training_samples}</div>
                  <div>Test Samples: {forecastingData.trainingResults.test_samples}</div>
                  <div>Train MAE: {forecastingData.trainingResults.train_mae?.toFixed(2)}</div>
                  <div>Test MAE: {forecastingData.trainingResults.test_mae?.toFixed(2)}</div>
                </div>
              )}
              
              {forecastingData.trainingResults.error && (
                <div className="text-xs text-red-600">
                  Error: {forecastingData.trainingResults.error}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No training data available</div>
          )}
          
          <Button
            onClick={startTraining}
            disabled={training || loading}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
          >
            {training ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Training Model...
              </>
            ) : (
              <>
                <span className="mr-2">🧠</span>
                Start Training
              </>
            )}
          </Button>
        </div>

        {/* Forecasting Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700">Real-time Forecasting</h4>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              forecastingData?.isRunning ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {forecastingData?.isRunning ? '🔄 Running' : '⏸️ Stopped'}
            </div>
          </div>

          {/* Latest Prediction */}
          {forecastingData?.latestPrediction && (
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Latest Prediction</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Current: </span>
                  <span className="font-medium">${forecastingData.latestPrediction.current_price.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Predicted: </span>
                  <span className="font-medium">${forecastingData.latestPrediction.predicted_next_price.toFixed(2)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Change: </span>
                  <span className={`font-medium ${
                    forecastingData.latestPrediction.price_change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {forecastingData.latestPrediction.price_change >= 0 ? '+' : ''}
                    {forecastingData.latestPrediction.price_change_percent.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {new Date(forecastingData.latestPrediction.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="space-y-2">
            {!forecastingData?.isRunning ? (
              <Button
                onClick={startForecasting}
                disabled={loading || !forecastingData?.trainingResults || training}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">🔄</span>
                    Starting...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🚀</span>
                    Start Forecasting
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={stopForecasting}
                disabled={loading}
                variant="outline"
                className="w-full border-red-500 text-red-600 hover:bg-red-50"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">🔄</span>
                    Stopping...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🛑</span>
                    Stop Forecasting
                  </>
                )}
              </Button>
            )}
            
            {!forecastingData?.trainingResults && (
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ Train a model first before starting forecasting
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="text-xs text-gray-500 text-center">
          Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
        </div>
      </CardContent>
    </Card>
  )
}

export default ForecastingControl