import React, { useState, useEffect } from 'react'

interface PredictionData {
  timestamp: string
  current_price: number
  risk_probability: number
  warning_signal: boolean
  status: 'active' | 'insufficient_data' | 'error'
}

const RiskWarning: React.FC = () => {
  const [prediction, setPrediction] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchPrediction = async () => {
    try {
      const response = await fetch('/api/predictions')
      const result = await response.json()
      
      if (result.success) {
        setPrediction(result.data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching prediction:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchPrediction()
    
    // Update every 30 seconds
    const interval = setInterval(fetchPrediction, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const getRiskLevel = (probability: number) => {
    if (probability >= 0.7) return { level: 'HIGH', color: 'text-red-600', bgColor: 'bg-red-100' }
    if (probability >= 0.4) return { level: 'MEDIUM', color: 'text-yellow-600', bgColor: 'bg-yellow-100' }
    return { level: 'LOW', color: 'text-green-600', bgColor: 'bg-green-100' }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🔮'
      case 'insufficient_data': return '⏳'
      case 'error': return '❌'
      default: return '❓'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'AI Monitoring Active'
      case 'insufficient_data': return 'Collecting Data...'
      case 'error': return 'System Error'
      default: return 'Unknown Status'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  if (!prediction) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">❌</div>
          <div>Unable to load risk predictions</div>
        </div>
      </div>
    )
  }

  const riskInfo = getRiskLevel(prediction.risk_probability)

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          🚨 Risk Warning System
        </h3>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <span>{getStatusIcon(prediction.status)}</span>
          <span>{getStatusText(prediction.status)}</span>
        </div>
      </div>

      {/* Risk Probability Display */}
      <div className={`rounded-lg p-4 mb-4 ${riskInfo.bgColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 mb-1">Risk Probability</div>
            <div className={`text-2xl font-bold ${riskInfo.color}`}>
              {(prediction.risk_probability * 100).toFixed(1)}%
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${riskInfo.color} bg-white`}>
            {riskInfo.level} RISK
          </div>
        </div>
      </div>

      {/* Warning Signal */}
      {prediction.warning_signal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-red-600 text-xl">⚠️</span>
            <div>
              <div className="font-semibold text-red-800">HIGH RISK ALERT</div>
              <div className="text-sm text-red-600">
                Risk probability exceeds 70% threshold. Consider portfolio review.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Price */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600">Current BTC Price</div>
          <div className="text-lg font-semibold text-gray-800">
            ${prediction.current_price.toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600">Model Status</div>
          <div className="text-lg font-semibold text-gray-800 capitalize">
            {prediction.status.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Risk Level Indicator */}
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-2">Risk Level Scale</div>
        <div className="flex space-x-1">
          <div className={`flex-1 h-2 rounded ${prediction.risk_probability >= 0.0 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
          <div className={`flex-1 h-2 rounded ${prediction.risk_probability >= 0.4 ? 'bg-yellow-500' : 'bg-gray-200'}`}></div>
          <div className={`flex-1 h-2 rounded ${prediction.risk_probability >= 0.7 ? 'bg-red-500' : 'bg-gray-200'}`}></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
        </div>
      </div>

      {/* Last Update */}
      <div className="text-xs text-gray-500 text-center">
        Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
        <br />
        Prediction time: {new Date(prediction.timestamp).toLocaleTimeString()}
      </div>
    </div>
  )
}

export default RiskWarning