'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchBitcoinRealTimePrice } from '@/lib/api'

interface BitcoinRealTimePriceProps {
  onPriceUpdate?: (price: number) => void
}

export default function BitcoinRealTimePrice({ onPriceUpdate }: BitcoinRealTimePriceProps) {
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [previousPrice, setPreviousPrice] = useState<number>(0)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral')

  const fetchPrice = async () => {
    try {
      setIsLoading(true)
      const price = await fetchBitcoinRealTimePrice()
      
      if (price > 0) {
        setPreviousPrice(currentPrice || price)
        setCurrentPrice(price)
        
        // Calculate price change
        if (currentPrice > 0) {
          const change = ((price - currentPrice) / currentPrice) * 100
          setPriceChange(change)
          
          // Set direction
          if (price > currentPrice) {
            setPriceDirection('up')
          } else if (price < currentPrice) {
            setPriceDirection('down')
          } else {
            setPriceDirection('neutral')
          }
        }
        
        setLastUpdate(new Date().toLocaleTimeString())
        
        // Callback to parent component
        if (onPriceUpdate) {
          onPriceUpdate(price)
        }
      }
    } catch (error) {
      console.error('Error fetching real-time price:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch price every 30 seconds for real-time updates
  useEffect(() => {
    fetchPrice() // Initial fetch
    const interval = setInterval(fetchPrice, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getPriceColorClass = () => {
    switch (priceDirection) {
      case 'up':
        return 'text-green-400'
      case 'down':
        return 'text-red-400'
      default:
        return 'text-orange-400'
    }
  }

  const getPriceIcon = () => {
    switch (priceDirection) {
      case 'up':
        return '📈'
      case 'down':
        return '📉'
      default:
        return '₿'
    }
  }

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-orange-500/50 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-2xl">{getPriceIcon()}</span>
            Bitcoin Real-Time Price
          </span>
          <div className="flex items-center gap-2">
            <span className="animate-pulse text-red-500 text-sm">🔴 LIVE</span>
            {isLoading && <span className="animate-spin text-sm">⏳</span>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Price */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${getPriceColorClass()} transition-colors duration-300`}>
              ${currentPrice.toLocaleString()}
            </div>
            {priceChange !== 0 && (
              <div className={`text-sm mt-1 ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(4)}% from last update
              </div>
            )}
          </div>

          {/* Price Comparison */}
          {previousPrice > 0 && currentPrice !== previousPrice && (
            <div className="flex justify-between items-center text-sm bg-slate-700/50 rounded-lg p-3">
              <span className="text-slate-300">Previous:</span>
              <span className="text-slate-400">${previousPrice.toLocaleString()}</span>
              <span className="text-slate-300">Change:</span>
              <span className={currentPrice > previousPrice ? 'text-green-400' : 'text-red-400'}>
                ${Math.abs(currentPrice - previousPrice).toFixed(2)}
              </span>
            </div>
          )}

          {/* Update Info */}
          <div className="text-center text-xs text-slate-400">
            {lastUpdate ? `Last updated: ${lastUpdate}` : 'Fetching...'}
            <br />
            <span className="text-slate-500">Updates every 30 seconds</span>
          </div>

          {/* Price Visualization */}
          <div className="flex justify-center">
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              priceDirection === 'up' ? 'bg-green-400' : 
              priceDirection === 'down' ? 'bg-red-400' : 'bg-orange-400'
            }`}></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}