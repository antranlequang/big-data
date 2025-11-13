'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import RealTimePriceChart from '../components/RealTimePriceChart'
import ComprehensiveMinIOCharts from '../components/ComprehensiveMinIOCharts'
import PriceForecastChart from '../components/PriceForecastChart'
import MarketCapTreemap from '../components/MarketCapHeatmap'
import MetricCard from '../components/MetricCard'
import NewsAnalysis from '../components/NewsAnalysis'
import { fetchCoinData } from '../lib/api'
import { formatCurrency, formatMarketCap } from '../lib/utils'
import type { CryptoData, HistoricalDataPoint } from '../lib/types'

export default function CryptoDashboard() {
  const [cryptoData, setCryptoData] = useState<CryptoData | null>(null)
  const [selectedCoin, setSelectedCoin] = useState<string>('bitcoin')
  const [loading, setLoading] = useState<boolean>(false)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  const [availableCoins, setAvailableCoins] = useState<{id: string, name: string, symbol: string}[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false)
  const [loadingCoins, setLoadingCoins] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>('price')
  const [treemapData, setTreemapData] = useState<any[]>([])
  const [globalDataLoading, setGlobalDataLoading] = useState<boolean>(false)
  const [realTimeChartData, setRealTimeChartData] = useState<any[]>([])
  const [forecastData, setForecastData] = useState<any>(null)
  const [candleData, setCandleData] = useState<any>(null)
  const [tradingSignals, setTradingSignals] = useState<any>(null)
  const [priceCountdown, setPriceCountdown] = useState<number>(60)
  const [forecastCountdown, setForecastCountdown] = useState<number>(300)
  const [lastCandleFetchDate, setLastCandleFetchDate] = useState<string>('')
  const [newsData, setNewsData] = useState<any>(null)
  const [recommendation, setRecommendation] = useState<{
    action: 'BUY' | 'SELL' | 'NEUTRAL'
    confidence: number
    breakdown: {
      news: number
      technical: number
      forecast: number
    }
    reasoning: string[]
  } | null>(null)

  // Fetch available coins from CoinGecko API - TEMPORARILY DISABLED FOR DEPLOYMENT
  const fetchAvailableCoins = async () => {
    setLoadingCoins(true)
    try {
      // DISABLED: const response = await fetch('/api/coins')
      // Use hardcoded top coins instead of fetching from API
      const staticCoins = [
        { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
        { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
        { id: 'tether', name: 'Tether', symbol: 'usdt' },
        { id: 'bnb', name: 'BNB', symbol: 'bnb' },
        { id: 'solana', name: 'Solana', symbol: 'sol' },
        { id: 'usdc', name: 'USD Coin', symbol: 'usdc' },
        { id: 'xrp', name: 'XRP', symbol: 'xrp' }
      ]
      
      setAvailableCoins(staticCoins)
      // Set default coin if not already set
      if (!selectedCoin && staticCoins.length > 0) {
        setSelectedCoin(staticCoins[0].id)
      }
    } catch (error) {
      console.error('Error setting available coins:', error)
    } finally {
      setLoadingCoins(false)
    }
  }

  // Fetch current coin data from CoinGecko API - TEMPORARILY DISABLED FOR DEPLOYMENT
  const fetchCurrentCoinData = async () => {
    if (!selectedCoin) return
    
    setLoading(true)
    try {
      // DISABLED: const coinData = await fetchCoinData(selectedCoin)
      console.log('CoinGecko API disabled for deployment - using MinIO data only')
      setLastUpdate(new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Error fetching coin data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch coin data from MinIO
  const fetchMinIOData = async () => {
    if (!selectedCoin) return
    
    try {
      const response = await fetch(`/api/crypto?coinId=${selectedCoin}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data.length > 0) {
          // Get latest data point for metrics
          const latestData = result.data[result.data.length - 1]
          setCryptoData({
            id: latestData.id,
            symbol: latestData.symbol,
            name: latestData.name,
            current_price: latestData.price_usd,
            market_cap: latestData.market_cap,
            total_volume: latestData.volume_24h,
            price_change_percentage_1h_in_currency: latestData.price_change_1h,
            price_change_percentage_24h_in_currency: latestData.price_change_24h,
            price_change_percentage_7d_in_currency: latestData.price_change_7d,
            high_24h: latestData.high_24h,
            low_24h: latestData.low_24h,
            last_updated: latestData.last_updated
          })
          setLastUpdate(new Date().toLocaleTimeString())
        } else {
          // No MinIO data - API disabled for deployment
          console.log('No MinIO data available, API calls disabled for deployment')
        }
      }
    } catch (error) {
      console.error('Error fetching MinIO data:', error)
      // API fallback disabled for deployment
      console.log('API fallback disabled for deployment')
    }
  }

  // Fetch real-time chart data from MinIO
  const fetchRealTimeChartData = async () => {
    try {
      const response = await fetch(`/api/crypto?coinId=${selectedCoin}`)
      if (response.ok) {
        const result = await response.json()
        
        if (result.success && result.data.length > 0) {
          const coinData = result.data
            .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          
          if (coinData.length > 0) {
            setRealTimeChartData(coinData)
            console.log(`📊 Updated real-time chart data for ${selectedCoin}: ${coinData.length} points`)
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching real-time chart data:', error)
    }
  }

  // Check if candle data needs daily update
  const shouldUpdateCandleData = () => {
    const today = new Date().toDateString()
    return lastCandleFetchDate !== today || !candleData
  }

  // Fetch candle data from MinIO (only once per day)
  const fetchCandleData = async () => {
    try {
      console.log(`🕯️ Fetching candle data for ${selectedCoin}...`)
      
      // Check if data update is needed (daily refresh)
      const shouldUpdate = !candleData || (candleData && new Date(candleData.fetched_at).getDate() !== new Date().getDate())
      
      if (shouldUpdate) {
        console.log('🔄 Updating candle data (daily refresh)...')
        const updateResponse = await fetch(`/api/candle-chart?coinId=${selectedCoin}&action=update`)
        const updateResult = await updateResponse.json()
        
        if (!updateResult.success) {
          console.warn('⚠️ Candle update failed, proceeding with existing data:', updateResult.error)
        }
      }
      
      // Fetch data with technical indicators
      const response = await fetch(`/api/candle-chart?coinId=${selectedCoin}&action=indicators`)
      const result = await response.json()
      
      if (result.success && result.data) {
        setCandleData(result.data)
        setLastCandleFetchDate(new Date().toDateString()) // Mark as fetched today
        console.log(`🕯️ Updated candle data for ${selectedCoin}: ${result.data.data_points} points`)
        
        // Also fetch trading signals
        const signalsResponse = await fetch(`/api/candle-chart?coinId=${selectedCoin}&action=signals`)
        const signalsResult = await signalsResponse.json()
        
        if (signalsResult.success && signalsResult.signals) {
          setTradingSignals(signalsResult.signals)
        }
      } else {
        console.error('❌ Failed to fetch candle data:', result.error)
        setCandleData(null)
      }
    } catch (error) {
      console.error('❌ Error fetching candle data:', error)
      setCandleData(null)
    }
  }

  // Daily candle data check function
  const checkAndUpdateCandleData = async () => {
    if (shouldUpdateCandleData()) {
      console.log('📅 Daily candle data refresh needed')
      await fetchCandleData()
    } else {
      console.log('📅 Candle data is up to date for today')
    }
  }

  // Reset candle data when switching coins
  useEffect(() => {
    if (selectedCoin) {
      setLastCandleFetchDate('') // Reset to force fetch for new coin
      setCandleData(null) // Clear existing data
      setTradingSignals(null) // Clear existing signals
    }
  }, [selectedCoin])

  // Fetch forecast data from MinIO
  const fetchForecastData = async () => {
    try {
      console.log(`🔍 Fetching forecast for ${selectedCoin}...`)
      
      // First try to read from MinIO
      const response = await fetch(`/api/forecast?coinId=${selectedCoin}&source=minio`)
      
      if (response.ok) {
        const result = await response.json()
        
        if (result.success && result.data && !result.data.error) {
          console.log(`📊 Updated forecast from MinIO for ${selectedCoin}`)
          setForecastData(result.data)
          return
        }
      }
      
      // If no data in MinIO, generate new forecast
      console.log('🔮 Generating new forecast...')
      const generateResponse = await fetch(`/api/forecast?coinId=${selectedCoin}&source=generate`)
      
      if (generateResponse.ok) {
        const generateResult = await generateResponse.json()
        
        if (generateResult.success && generateResult.data && !generateResult.data.error) {
          console.log(`🆕 Generated new forecast for ${selectedCoin}`)
          setForecastData(generateResult.data)
        } else {
          console.error('Forecast generation failed:', generateResult.error)
          setForecastData(null)
        }
      }
    } catch (error) {
      console.error('❌ Error fetching forecast data:', error)
      setForecastData(null)
    }
  }

  // Fetch treemap data from MinIO - KEPT ACTIVE (using MinIO only)
  const fetchTreemapData = async () => {
    try {
      const coinIds = [
        'bitcoin', 'ethereum', 'tether', 'bnb', 'solana', 'usdc', 'xrp', 'steth', 'cardano', 'dogecoin',
        'avalanche-2', 'tron', 'shiba-inu', 'chainlink', 'wrapped-bitcoin', 'polkadot', 'bitcoin-cash',
        'uniswap', 'near', 'litecoin', 'polygon', 'internet-computer', 'dai', 'kaspa', 'ethereum-classic',
        'monero', 'stellar', 'okb', 'filecoin', 'cosmos', 'cronos', 'hedera-hashgraph', 'mantle',
        'arbitrum', 'vechain', 'render-token', 'immutable-x', 'optimism', 'first-digital-usd',
        'maker', 'injective-protocol', 'celestia', 'sei-network', 'bittensor', 'thorchain',
        'the-graph', 'fantom', 'rocket-pool-eth', 'lido-dao', 'aave'
      ]

      const promises = coinIds.map(async (coinId) => {
        try {
          const response = await fetch(`/api/crypto?coinId=${coinId}`)
          const result = await response.json()
          
          if (result.success && result.data && result.data.length >= 2) {
            const latestData = result.data[result.data.length - 1]
            const previousData = result.data[result.data.length - 2]
            
            const priceChange = ((latestData.price_usd - previousData.price_usd) / previousData.price_usd) * 100
            
            return {
              id: latestData.id,
              symbol: latestData.symbol,
              name: latestData.name,
              market_cap: latestData.market_cap,
              current_price: latestData.price_usd,
              price_change_percentage_24h: priceChange,
              last_updated: latestData.last_updated
            }
          }
          return null
        } catch (error) {
          console.warn(`Failed to fetch MinIO data for ${coinId}:`, error)
          return null
        }
      })

      const results = await Promise.all(promises)
      const validCoins = results.filter((coin): coin is NonNullable<typeof coin> => coin !== null)
      
      if (validCoins.length > 0) {
        const sortedCoins = validCoins.sort((a, b) => b.market_cap - a.market_cap).slice(0, 50)
        setTreemapData(sortedCoins)
        console.log(`📊 Updated treemap data for ${sortedCoins.length} coins (MinIO only)`)
      } else {
        console.log('📊 No treemap data available from MinIO')
      }
    } catch (error) {
      console.error('❌ Error fetching treemap data from MinIO:', error)
    }
  }

  // Centralized data refresh function
  const refreshAllData = async () => {
    setGlobalDataLoading(true)
    try {
      // Fetch all data in parallel (excluding candle data - that's handled separately)
      await Promise.all([
        fetchMinIOData(),
        fetchRealTimeChartData(),
        fetchTreemapData()
      ])
      
      // Reset price countdown
      setPriceCountdown(60)
      
      setLastUpdate(new Date().toLocaleTimeString())
      console.log('🔄 Regular data refreshed at:', new Date().toLocaleTimeString())
    } catch (error) {
      console.error('❌ Error refreshing data:', error)
    } finally {
      setGlobalDataLoading(false)
    }
  }

  // Refresh forecast data every 5 minutes
  const refreshForecastData = async () => {
    try {
      await fetchForecastData()
      setForecastCountdown(300) // Reset forecast countdown
      console.log('🔮 Forecast data refreshed at:', new Date().toLocaleTimeString())
    } catch (error) {
      console.error('❌ Error refreshing forecast data:', error)
    }
  }

  // Fetch news data for recommendation
  const fetchNewsDataForRecommendation = async () => {
    try {
      const response = await fetch('/api/news-analysis?days=1') // Get recent news
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setNewsData(result.data)
          return result.data
        }
      }
      return null
    } catch (error) {
      console.error('❌ Error fetching news data:', error)
      return null
    }
  }

  // Calculate comprehensive trading recommendation
  const calculateRecommendation = async () => {
    try {
      const newsAnalysisData = await fetchNewsDataForRecommendation()
      
      // Calculate news sentiment score
      let newsScore = 0
      let newsReasoning: string[] = []
      
      if (newsAnalysisData && newsAnalysisData.total > 0) {
        const { positive_count, negative_count, neutral_count } = newsAnalysisData.summary
        const positiveRatio = positive_count / newsAnalysisData.total
        const negativeRatio = negative_count / newsAnalysisData.total
        
        if (positiveRatio > 0.6) {
          newsScore = 75 + (positiveRatio * 25) // 75-100 for strong positive
          newsReasoning.push(`${Math.round(positiveRatio * 100)}% positive news sentiment`)
        } else if (negativeRatio > 0.6) {
          newsScore = 25 - (negativeRatio * 25) // 0-25 for strong negative  
          newsReasoning.push(`${Math.round(negativeRatio * 100)}% negative news sentiment`)
        } else {
          newsScore = 40 + ((positiveRatio - negativeRatio) * 20) // 20-60 for mixed/neutral
          newsReasoning.push(`Mixed news sentiment (${Math.round(positiveRatio * 100)}% positive, ${Math.round(negativeRatio * 100)}% negative)`)
        }
      } else {
        newsScore = 50 // Neutral if no news data
        newsReasoning.push('No recent news data available')
      }

      // Calculate technical analysis score
      let technicalScore = 50
      let technicalReasoning: string[] = []
      
      if (tradingSignals && tradingSignals.signals) {
        const signals = tradingSignals.signals
        let bullishSignals = 0
        let bearishSignals = 0
        
        // Count bullish/bearish signals
        if (signals.rsi_signal === 'BUY') bullishSignals++
        if (signals.rsi_signal === 'SELL') bearishSignals++
        if (signals.macd_signal === 'BUY') bullishSignals++  
        if (signals.macd_signal === 'SELL') bearishSignals++
        if (signals.moving_average_signal === 'BUY') bullishSignals++
        if (signals.moving_average_signal === 'SELL') bearishSignals++
        if (signals.bollinger_signal === 'BUY') bullishSignals++
        if (signals.bollinger_signal === 'SELL') bearishSignals++
        
        const totalSignals = bullishSignals + bearishSignals
        if (totalSignals > 0) {
          const bullishRatio = bullishSignals / totalSignals
          technicalScore = bullishRatio * 100
          technicalReasoning.push(`${bullishSignals}/${totalSignals} technical indicators bullish`)
        } else {
          technicalReasoning.push('Technical indicators neutral')
        }
      } else {
        technicalReasoning.push('No technical analysis data available')
      }

      // Calculate forecast score
      let forecastScore = 50
      let forecastReasoning: string[] = []
      
      if (forecastData && forecastData.predictions && cryptoData) {
        const currentPrice = cryptoData.current_price
        const predictions = forecastData.predictions
        
        // Use the nearest future prediction (next few hours/day)
        const shortTermPrediction = predictions.find((p: any) => p.minutes_ahead <= 1440) // Within 24 hours
        
        if (shortTermPrediction) {
          const predictedPrice = shortTermPrediction.predicted_price
          const changePercent = ((predictedPrice - currentPrice) / currentPrice) * 100
          
          if (changePercent > 5) {
            forecastScore = 75 + Math.min(changePercent, 25) // Cap at 100
            forecastReasoning.push(`Forecast predicts +${changePercent.toFixed(1)}% price increase`)
          } else if (changePercent < -5) {
            forecastScore = 25 + Math.max(changePercent, -25) // Floor at 0
            forecastReasoning.push(`Forecast predicts ${changePercent.toFixed(1)}% price decrease`)
          } else {
            forecastScore = 50 + (changePercent * 5) // Small changes around neutral
            forecastReasoning.push(`Forecast predicts ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% price change`)
          }
        } else {
          forecastReasoning.push('No short-term forecast available')
        }
      } else {
        forecastReasoning.push('No forecast data available')
      }

      // Calculate overall recommendation
      const overallScore = (newsScore * 0.3) + (technicalScore * 0.4) + (forecastScore * 0.3)
      let action: 'BUY' | 'SELL' | 'NEUTRAL'
      let confidence: number
      
      if (overallScore >= 70) {
        action = 'BUY'
        confidence = Math.min(overallScore, 95)
      } else if (overallScore <= 30) {
        action = 'SELL'  
        confidence = Math.min(100 - overallScore, 95)
      } else {
        action = 'NEUTRAL'
        confidence = Math.abs(50 - overallScore) * 2
      }

      setRecommendation({
        action,
        confidence: Math.round(confidence),
        breakdown: {
          news: Math.round(newsScore),
          technical: Math.round(technicalScore),
          forecast: Math.round(forecastScore)
        },
        reasoning: [...newsReasoning, ...technicalReasoning, ...forecastReasoning]
      })

    } catch (error) {
      console.error('❌ Error calculating recommendation:', error)
      setRecommendation(null)
    }
  }

  // Auto-refresh all data every 1 minute (centralized)
  useEffect(() => {
    refreshAllData()
    refreshForecastData() // Initial forecast fetch
    checkAndUpdateCandleData() // Initial candle data check
    
    const dataInterval = setInterval(refreshAllData, 60000) // 1 minute
    const forecastInterval = setInterval(refreshForecastData, 300000) // 5 minutes
    const candleCheckInterval = setInterval(checkAndUpdateCandleData, 3600000) // 1 hour check for daily update
    
    return () => {
      clearInterval(dataInterval)
      clearInterval(forecastInterval)
      clearInterval(candleCheckInterval)
    }
  }, [selectedCoin])

  // Countdown timers (independent of data fetching)
  useEffect(() => {
    const priceCountdownTimer = setInterval(() => {
      setPriceCountdown(prev => {
        if (prev <= 1) {
          return 60 // Reset to 60 when it reaches 0
        }
        return prev - 1
      })
    }, 1000)

    const forecastCountdownTimer = setInterval(() => {
      setForecastCountdown(prev => {
        if (prev <= 1) {
          return 300 // Reset to 300 when it reaches 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(priceCountdownTimer)
      clearInterval(forecastCountdownTimer)
    }
  }, [])

  // Calculate recommendation when relevant data changes
  useEffect(() => {
    // Only calculate if we have basic data
    if (cryptoData) {
      calculateRecommendation()
    }
  }, [cryptoData, forecastData, tradingSignals])

  // Fetch available coins on mount
  useEffect(() => {
    fetchAvailableCoins()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (isDropdownOpen && target && !target.closest('.dropdown-container')) {
        setIsDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  // Data collector - TEMPORARILY DISABLED FOR DEPLOYMENT
  useEffect(() => {
    const startDataCollector = async () => {
      try {
        console.log('📝 Data collector disabled for deployment - using existing MinIO data only')
        // DISABLED: Auto-starting background data collector
        // This prevents CoinGecko API calls during deployment
      } catch (error) {
        console.error('❌ Error in data collector setup:', error)
      }
    }
    
    startDataCollector()
  }, [])

  const selectedCoinInfo = availableCoins.find(coin => coin.id === selectedCoin)

  return (
    <div className="h-screen bg-gray-950 text-white overflow-hidden flex flex-col">
      {/* Professional Trading Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Brand & Ticker */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold">₿</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">CryptoTerm</h1>
                <p className="text-xs text-gray-400">Professional Trading Terminal</p>
              </div>
            </div>
            
            {/* Live Ticker */}
            {cryptoData && (
              <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-400">{cryptoData.symbol.toUpperCase()}</span>
                  <span className="text-lg font-bold text-white">${cryptoData.current_price.toLocaleString()}</span>
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  (cryptoData.price_change_percentage_24h_in_currency || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  <span>{(cryptoData.price_change_percentage_24h_in_currency || 0) >= 0 ? '▲' : '▼'}</span>
                  <span>{(cryptoData.price_change_percentage_24h_in_currency || 0).toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Controls & Status */}
          <div className="flex items-center gap-4">
            {/* Coin Selector */}
            <div className="relative dropdown-container">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDropdownOpen(!isDropdownOpen)
                }}
                disabled={loadingCoins}
                className="bg-gray-800 border border-gray-600 hover:border-emerald-500 text-white rounded-lg px-4 py-2 flex items-center gap-2 transition-all duration-200 disabled:opacity-50 min-w-[180px]"
              >
                {loadingCoins ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <span className="text-xs text-gray-400">PAIR:</span>
                    <span className="font-bold text-emerald-400">{selectedCoinInfo?.symbol || 'BTC'}</span>
                    <span className="text-gray-300">/USD</span>
                    <span className={`ml-auto transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                  </>
                )}
              </button>
              
              {isDropdownOpen && availableCoins.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto">
                  {availableCoins.map(coin => (
                    <button
                      key={coin.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCoin(coin.id)
                        setIsDropdownOpen(false)
                        fetchMinIOData()
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-emerald-900/30 flex items-center gap-3 transition-colors ${
                        selectedCoin === coin.id ? 'bg-emerald-900/30 text-white' : 'text-gray-300'
                      }`}
                    >
                      <span className="font-bold text-emerald-400">{coin.symbol}</span>
                      <span className="flex-1">{coin.name}</span>
                      {selectedCoin === coin.id && <span className="text-emerald-400">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* System Status */}
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-emerald-400">LIVE</span>
              </div>
              <div className="w-px h-4 bg-gray-600"></div>
              <div className="text-xs text-gray-400">
                {lastUpdate ? `${lastUpdate}` : 'Connecting...'}
              </div>
              {globalDataLoading && (
                <div className="w-px h-4 bg-gray-600 ml-2"></div>
              )}
              {globalDataLoading && (
                <div className="animate-spin text-orange-400 text-xs ml-2">⟳</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Trading Interface */}
      <div className="flex-1 flex h-full">
        
        {/* Left Panel - Market Data */}
        <div className="w-80 border-r border-gray-800 bg-gray-900/50 flex flex-col">
          
          {/* Price Overview */}
          {cryptoData && (
            <div className="p-4 border-b border-gray-800">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">CURRENT PRICE</div>
                  <div className="text-2xl font-bold text-white mb-1">
                    ${cryptoData.current_price.toLocaleString()}
                  </div>
                  <div className={`text-sm font-medium flex items-center justify-center gap-2 ${
                    (cryptoData.price_change_percentage_24h_in_currency || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    <span>{(cryptoData.price_change_percentage_24h_in_currency || 0) >= 0 ? '▲' : '▼'}</span>
                    <span>{(cryptoData.price_change_percentage_24h_in_currency || 0) >= 0 ? '+' : ''}{(cryptoData.price_change_percentage_24h_in_currency || 0).toFixed(2)}%</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-gray-800/50 rounded border border-gray-700">
                    <div className="text-xs text-gray-400">24H HIGH</div>
                    <div className="text-sm font-bold text-emerald-400">${cryptoData.high_24h.toLocaleString()}</div>
                  </div>
                  <div className="text-center p-2 bg-gray-800/50 rounded border border-gray-700">
                    <div className="text-xs text-gray-400">24H LOW</div>
                    <div className="text-sm font-bold text-red-400">${cryptoData.low_24h.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Market Statistics */}
          {cryptoData && (
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">Market Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Market Cap</span>
                  <span className="text-sm font-medium text-white">{formatMarketCap(cryptoData.market_cap)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">24h Volume</span>
                  <span className="text-sm font-medium text-white">{formatCurrency(cryptoData.total_volume)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">1h Change</span>
                  <span className={`text-sm font-medium ${(cryptoData.price_change_percentage_1h_in_currency || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(cryptoData.price_change_percentage_1h_in_currency || 0) >= 0 ? '+' : ''}{(cryptoData.price_change_percentage_1h_in_currency || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">7d Change</span>
                  <span className={`text-sm font-medium ${(cryptoData.price_change_percentage_7d_in_currency || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(cryptoData.price_change_percentage_7d_in_currency || 0) >= 0 ? '+' : ''}{(cryptoData.price_change_percentage_7d_in_currency || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Trading Recommendation */}
          {recommendation && (
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">Recommendation</h3>
              
              {/* Main Recommendation */}
              <div className="text-center mb-4">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-lg border-2 ${
                  recommendation.action === 'BUY' 
                    ? 'bg-emerald-900/30 border-emerald-600 text-emerald-400'
                    : recommendation.action === 'SELL'
                    ? 'bg-red-900/30 border-red-600 text-red-400'  
                    : 'bg-yellow-900/30 border-yellow-600 text-yellow-400'
                }`}>
                  <span className={`w-3 h-3 rounded-full ${
                    recommendation.action === 'BUY' ? 'bg-emerald-400'
                    : recommendation.action === 'SELL' ? 'bg-red-400'
                    : 'bg-yellow-400'
                  }`}></span>
                  {recommendation.action}
                </div>
              </div>

              {/* Analysis Breakdown */}
              {/* <div className="space-y-2 mb-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Analysis Breakdown</div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">News Sentiment</span>
                  <span className={`text-xs font-medium ${
                    recommendation.breakdown.news >= 60 ? 'text-emerald-400' 
                    : recommendation.breakdown.news <= 40 ? 'text-red-400' 
                    : 'text-yellow-400'
                  }`}>
                    {recommendation.breakdown.news}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Technical Signals</span>
                  <span className={`text-xs font-medium ${
                    recommendation.breakdown.technical >= 60 ? 'text-emerald-400' 
                    : recommendation.breakdown.technical <= 40 ? 'text-red-400' 
                    : 'text-yellow-400'
                  }`}>
                    {recommendation.breakdown.technical}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Price Forecast</span>
                  <span className={`text-xs font-medium ${
                    recommendation.breakdown.forecast >= 60 ? 'text-emerald-400' 
                    : recommendation.breakdown.forecast <= 40 ? 'text-red-400' 
                    : 'text-yellow-400'
                  }`}>
                    {recommendation.breakdown.forecast}%
                  </span>
                </div>
              </div> */}

              {/* Key Factors */}
              {/* <div className="space-y-1">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Key Factors</div>
                {recommendation.reasoning.slice(0, 3).map((reason, index) => (
                  <div key={index} className="text-xs text-gray-400 leading-relaxed">
                    • {reason}
                  </div>
                ))}
              </div> */}

              {/* Disclaimer */}
              <div className="mt-3 pt-2 border-t border-gray-800">
                <div className="text-xs text-gray-500 text-center">
                  ⚠️ This is algorithmic analysis, not financial advice
                </div>
              </div>
            </div>
          )}

          {/* System Info */}
          <div className="p-4 flex-1">
            <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">System Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Data Source</span>
                <span className="text-xs font-medium text-emerald-400">CoinGecko API</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Storage</span>
                <span className="text-xs font-medium text-blue-400">MinIO</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Auto-Collector</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-emerald-400">Active</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Update Frequency</span>
                <span className="text-xs font-medium text-gray-300">1 min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="flex-1 flex flex-col h-full">
          
          {/* Chart Navigation Tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-gray-800 bg-gray-900/30">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setActiveTab('price')}
                className={`px-3 py-1.5 text-xs font-medium rounded border ${
                  activeTab === 'price' 
                    ? 'bg-emerald-600 text-white border-emerald-500' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'
                }`}
              >
                PRICE
              </button>
              <button 
                onClick={() => setActiveTab('treemap')}
                className={`px-3 py-1.5 text-xs font-medium rounded border ${
                  activeTab === 'treemap' 
                    ? 'bg-emerald-600 text-white border-emerald-500' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'
                }`}
              >
                TREEMAP
              </button>
              <button 
                onClick={() => setActiveTab('analysis')}
                className={`px-3 py-1.5 text-xs font-medium rounded border ${
                  activeTab === 'analysis' 
                    ? 'bg-emerald-600 text-white border-emerald-500' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'
                }`}
              >
                ANALYSIS
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
              {activeTab === 'treemap' && (
                <span>Top 50 Market Cap • Real-time</span>
              )}
            </div>
          </div>
          
          {/* Charts Content */}
          {activeTab === 'price' && (
            <div className="flex-1 grid grid-cols-2 grid-rows-[1fr_1fr] gap-0.5 bg-gray-800 p-0.5 h-full overflow-hidden">
              {/* Main Price Chart - occupies the full first row */}
              <div className="col-span-2 row-span-1 bg-gray-950 h-full">
                <RealTimePriceChart 
                  selectedCoin={selectedCoin}
                  coinName={cryptoData?.name || selectedCoinInfo?.name || 'Cryptocurrency'}
                  className="w-full h-full"
                  realTimeData={realTimeChartData}
                  countdown={priceCountdown}
                  globalLoading={globalDataLoading}
                />
              </div>
              {/* Price Forecast Chart - left of second row */}
              <div className="bg-gray-950 h-full">
                <PriceForecastChart 
                  selectedCoin={selectedCoin}
                  coinName={cryptoData?.name || selectedCoinInfo?.name || 'Cryptocurrency'}
                  className="w-full h-full"
                  forecastData={forecastData}
                  countdown={forecastCountdown}
                  globalLoading={globalDataLoading}
                />
              </div>
              {/* Comprehensive MinIO Charts - right of second row */}
              <div className="bg-gray-950 h-full">
                <ComprehensiveMinIOCharts 
                  selectedCoin={selectedCoin}
                  coinName={cryptoData?.name || selectedCoinInfo?.name || 'Cryptocurrency'}
                  className="w-full h-full"
                  candleData={candleData}
                  tradingSignals={tradingSignals}
                  globalLoading={globalDataLoading}
                />
              </div>
            </div>
          )}

          {activeTab === 'treemap' && (
            <div className="flex-1 bg-gray-950">
              <MarketCapTreemap 
                treemapData={treemapData} 
                globalLoading={globalDataLoading} 
                lastUpdate={lastUpdate}
                sizeRatio={0.9} // Adjust this value (0.1 - 1.0) to control treemap size
              />
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="flex-1">
              <NewsAnalysis className="w-full h-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
