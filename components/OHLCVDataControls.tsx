import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface OHLCVDataControlsProps {
  selectedCoin: string
  coinName: string
  coinSymbol: string
  onDataFetched: (coinId: string, timePeriod: string) => void
}

const OHLCVDataControls: React.FC<OHLCVDataControlsProps> = ({ selectedCoin, coinName, coinSymbol, onDataFetched }) => {
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string>('1y')
  const [loading, setLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const [fetchStatus, setFetchStatus] = useState<string>('')
  const [bulkStatus, setBulkStatus] = useState<string>('')

  // Auto-fetch data when coin changes (not time period, to avoid too many requests)
  useEffect(() => {
    if (selectedCoin) {
      fetchRawDataForCoin()
    }
  }, [selectedCoin])

  // Check for processed data when time period changes
  useEffect(() => {
    if (selectedCoin) {
      checkForProcessedData()
    }
  }, [selectedTimePeriod])

  // Check for existing processed data
  const checkForProcessedData = async () => {
    if (!selectedCoin) return

    try {
      setFetchStatus(`Checking processed data for ${coinName} (${coinSymbol}) - ${selectedTimePeriod}...`)
      const checkResponse = await fetch(`/api/ohlcv-data?coinId=${selectedCoin}&timePeriod=${selectedTimePeriod}`)
      const checkResult = await checkResponse.json()

      if (checkResult.success) {
        setFetchStatus(`✅ Found processed data: ${checkResult.data.data_points} records`)
        onDataFetched(selectedCoin, selectedTimePeriod)
        console.log(`✅ Auto-loaded processed data for ${selectedCoin} (${selectedTimePeriod})`)
      } else {
        setFetchStatus(`No processed data for ${coinName} (${coinSymbol}) - ${selectedTimePeriod}. Click RUN PROCESS to create it.`)
      }
    } catch (error) {
      setFetchStatus(`Error checking processed data: ${error}`)
    }
  }

  // Fetch raw OHLCV data for the selected coin
  const fetchRawDataForCoin = async () => {
    if (!selectedCoin) return

    try {
      setFetchStatus(`📡 Auto-fetching raw data for ${coinName} (${coinSymbol})...`)
      
      const response = await fetch('/api/ohlcv-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch_only',
          coinId: selectedCoin,
          timePeriod: selectedTimePeriod
        })
      })

      const result = await response.json()

      if (result.success) {
        setFetchStatus(`✅ Raw data fetched for ${coinName}. Click RUN PROCESS to create candlestick data.`)
        console.log(`✅ Raw data fetched for ${selectedCoin}`)
      } else {
        setFetchStatus(`⚠️ Failed to fetch raw data: ${result.error}`)
      }
    } catch (error) {
      setFetchStatus(`❌ Error fetching raw data: ${error}`)
    }
  }

  const timePeriods = [
    { value: '1m', label: '1 Month', days: 30 },
    { value: '3m', label: '3 Months', days: 90 },
    { value: '6m', label: '6 Months', days: 180 },
    { value: '1y', label: '1 Year', days: 365 },
    { value: '2y', label: '2 Years', days: 730 }
  ]


  // Check for existing data first, then fetch if needed
  const fetchOHLCVData = async () => {
    if (!selectedCoin) {
      alert('No coin selected')
      return
    }

    setLoading(true)
    setFetchStatus(`Checking for existing ${coinName} (${coinSymbol}) data...`)

    try {
      // First, try to get existing processed data
      const checkResponse = await fetch(`/api/ohlcv-data?coinId=${selectedCoin}&timePeriod=${selectedTimePeriod}`)
      const checkResult = await checkResponse.json()

      if (checkResult.success) {
        // Data exists, notify parent and show success
        setFetchStatus(`Found existing data: ${checkResult.data.data_points} records`)
        setLastFetch(new Date().toLocaleString())
        onDataFetched(selectedCoin, selectedTimePeriod)
        console.log(`✅ Using existing processed data for ${selectedCoin}`)
        setLoading(false)
        return
      }

      // No existing data, process with PySpark
      setFetchStatus(`No existing data found. Processing ${coinName} (${coinSymbol}) data with PySpark...`)

      const response = await fetch('/api/ohlcv-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_only',
          coinId: selectedCoin,
          timePeriod: selectedTimePeriod
        })
      })

      const result = await response.json()

      if (result.success) {
        setFetchStatus('Data fetched and processed successfully!')
        setLastFetch(new Date().toLocaleString())
        
        // Notify parent component
        onDataFetched(selectedCoin, selectedTimePeriod)
        
        console.log(`✅ Successfully fetched and processed ${selectedCoin} data:`)
        console.log(`   Data points: ${result.data.data_points}`)
        console.log(`   Date range: ${result.data.date_range.start} to ${result.data.date_range.end}`)
        
      } else {
        setFetchStatus(`Error: ${result.error}`)
        console.error('OHLCV fetch failed:', result.error)
      }

    } catch (error) {
      setFetchStatus(`Network error: ${error}`)
      console.error('Error fetching OHLCV data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Bulk download all 50 coins with 3 years of data
  const bulkDownloadAllCoins = async () => {
    setBulkLoading(true)
    setBulkStatus('🚀 Starting bulk download of top 50 coins (3 years data)...')

    try {
      const response = await fetch('/api/ohlcv-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_download_all_coins'
        })
      })

      const result = await response.json()

      if (result.success) {
        const data = result.data
        setBulkStatus(`🎉 Bulk download completed! 
✅ Successfully processed: ${data.summary.total_processed}/${data.total_coins} coins
❌ Failed: ${data.summary.total_failed} coins  
📊 Success rate: ${data.summary.success_rate}
📁 Each coin's 3-year data saved to MinIO as separate files`)
        
        console.log(`✅ Bulk download completed:`)
        console.log(`   Total coins: ${data.total_coins}`)
        console.log(`   Successful: ${data.summary.total_processed}`)
        console.log(`   Failed: ${data.summary.total_failed}`)
        console.log(`   Success rate: ${data.summary.success_rate}`)
        
        // Log details of processed coins
        if (data.processed_coins.length > 0) {
          console.log('📊 Successfully processed coins:')
          data.processed_coins.forEach(coin => {
            console.log(`   ${coin.symbol}: ${coin.data_points} data points`)
          })
        }
        
        if (data.failed_coins.length > 0) {
          console.log('❌ Failed coins:')
          data.failed_coins.forEach(coin => {
            console.log(`   ${coin.symbol}: ${coin.error}`)
          })
        }
        
      } else {
        setBulkStatus(`❌ Error: ${result.error}`)
        console.error('Bulk download failed:', result.error)
      }

    } catch (error) {
      setBulkStatus(`💥 Network error: ${error}`)
      console.error('Error during bulk download:', error)
    } finally {
      setBulkLoading(false)
    }
  }


  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-orange-500 flex items-center gap-1">
          Data Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selected Coin Display */}
        <div className="space-y-3">
          <label className="text-slate-300 font-medium flex items-center gap-2">
            • Selected Cryptocurrency:
          </label>
          <div className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 border border-slate-600">
            <div className="font-semibold text-orange-400">{coinSymbol.toUpperCase()} - {coinName}</div>
            <div className="text-sm text-slate-400 mt-1">
              From main dashboard selection
            </div>
          </div>
        </div>

        {/* Time Period Selection */}
        <div className="space-y-3">
          <label className="text-slate-300 font-medium flex items-center gap-2">
            • Time Period:
          </label>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {timePeriods.map(period => (
              <button
                key={period.value}
                onClick={() => setSelectedTimePeriod(period.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedTimePeriod === period.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
          
          <div className="text-xs text-slate-400">
            Selected: {timePeriods.find(p => p.value === selectedTimePeriod)?.days} days of data
          </div>
        </div>

        {/* Fetch Button */}
        <div className="space-y-3">
          <Button
            onClick={fetchOHLCVData}
            disabled={loading || bulkLoading}
            className="w-full bg-green-600 hover:bg-green-700 text-orange-500 py-3"
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Processing...
              </>
            ) : (
              <>
                RUN PROCESS (Single Coin)
              </>
            )}
          </Button>
          
          {fetchStatus && (
            <div className={`text-sm p-3 rounded-lg ${
              fetchStatus.includes('Error') || fetchStatus.includes('error') 
                ? 'bg-red-900/50 text-red-300' 
                : fetchStatus.includes('successfully')
                ? 'bg-red-900/50 text-green-300'
                : 'bg-blue-900/50 text-blue-300'
            }`}>
              {fetchStatus}
            </div>
          )}
        </div>

        {/* Bulk Download Button */}
        <div className="space-y-3">
          <Button
            onClick={bulkDownloadAllCoins}
            disabled={loading || bulkLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 font-bold"
          >
            {bulkLoading ? (
              <>
                <span className="animate-spin mr-2">🔄</span>
                Downloading All 50 Coins...
              </>
            ) : (
              <>
                🚀 BULK DOWNLOAD ALL 50 COINS (3 YEARS)
              </>
            )}
          </Button>
          
          {bulkStatus && (
            <div className={`text-sm p-3 rounded-lg whitespace-pre-line ${
              bulkStatus.includes('Error') || bulkStatus.includes('error') 
                ? 'bg-red-900/50 text-red-300' 
                : bulkStatus.includes('completed')
                ? 'bg-green-900/50 text-green-300'
                : 'bg-blue-900/50 text-blue-300'
            }`}>
              {bulkStatus}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
          <div className="text-sm text-slate-300 font-medium">📋 Process Overview:</div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="font-medium text-slate-300">Single Coin Process:</div>
            <div>• Fetches OHLCV data from CoinGecko API</div>
            <div>• Saves raw data to MinIO storage</div>
            <div>• Processes with PySpark for continuity</div>
            <div>• Removes gaps and ensures data quality</div>
            <div>• Adds technical indicators (SMA, Bollinger Bands)</div>
            <div>• Overwrites previous data to save space</div>
            
            <div className="font-medium text-purple-300 mt-3">Bulk Download Process:</div>
            <div>• Downloads 3 years of data for ALL top 50 coins</div>
            <div>• Each coin saved as separate file in MinIO</div>
            <div>• Includes full PySpark processing for each coin</div>
            <div>• Shows progress and success rate</div>
            <div>• ⚠️ Takes 10-15 minutes to complete</div>
          </div>
          
          {lastFetch && (
            <div className="text-xs text-slate-500 mt-2">
              Last fetch: {lastFetch}
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  )
}

export default OHLCVDataControls