import { NextApiRequest, NextApiResponse } from 'next'
import { promises as fs } from 'fs'
import path from 'path'

interface ProcessedCryptoData {
  timestamp: string
  id: string
  symbol: string
  name: string
  price_usd: number
  market_cap: number
  volume_24h: number
  price_change_1h: number
  price_change_24h: number
  price_change_7d: number
  high_24h: number
  low_24h: number
  last_updated: string
}

interface DataMetadata {
  timestamp: string
  total_records: number
  unique_coins: number
  date_range: {
    start: string
    end: string
  }
  data_quality: {
    completeness: number
    validity: number
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const { coinId, limit = '100', format = 'chart' } = req.query

  try {
    // Read processed data
    const dataPath = path.join(process.cwd(), 'data', 'clean', 'processed_crypto_data.json')
    const metadataPath = path.join(process.cwd(), 'data', 'clean', 'data_metadata.json')

    let processedData: ProcessedCryptoData[] = []
    let metadata: DataMetadata | null = null

    // Try to read processed data
    try {
      const dataContent = await fs.readFile(dataPath, 'utf8')
      processedData = JSON.parse(dataContent)
      console.log(`📊 Loaded ${processedData.length} processed records`)
    } catch (error) {
      console.warn('⚠️ No processed data available, may need to run data pipeline')
      return res.status(200).json({
        success: true,
        data: [],
        metadata: null,
        message: 'No processed data available. Run data pipeline first.'
      })
    }

    // Try to read metadata
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8')
      metadata = JSON.parse(metadataContent)
    } catch (error) {
      console.warn('⚠️ No metadata available')
    }

    // Filter by coin if specified
    let filteredData = processedData
    if (coinId && typeof coinId === 'string') {
      filteredData = processedData.filter(item => item.id === coinId)
      console.log(`🔍 Filtered to ${filteredData.length} records for ${coinId}`)
    }

    // Sort by timestamp (newest first)
    filteredData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply limit
    const limitNum = parseInt(limit as string)
    if (limitNum > 0) {
      filteredData = filteredData.slice(0, limitNum)
    }

    // Format data based on request type
    if (format === 'chart') {
      // Format for chart components (historical data format)
      const chartData = filteredData.map(item => ({
        timestamp: item.timestamp,
        price_usd: item.price_usd,
        market_cap: item.market_cap,
        volume_24h: item.volume_24h,
        price_change_1h: item.price_change_1h,
        price_change_24h: item.price_change_24h,
        price_change_7d: item.price_change_7d,
        high_24h: item.high_24h,
        low_24h: item.low_24h
      })).reverse() // Reverse to get chronological order for charts

      return res.status(200).json({
        success: true,
        data: chartData,
        metadata,
        count: chartData.length,
        format: 'chart'
      })
    } else if (format === 'current') {
      // Format for current metrics (latest data point per coin)
      const latestByCoin = new Map<string, ProcessedCryptoData>()
      
      for (const item of filteredData) {
        const existing = latestByCoin.get(item.id)
        if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
          latestByCoin.set(item.id, item)
        }
      }

      const currentData = Array.from(latestByCoin.values()).map(item => ({
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        current_price: item.price_usd,
        market_cap: item.market_cap,
        total_volume: item.volume_24h,
        price_change_percentage_1h_in_currency: item.price_change_1h,
        price_change_percentage_24h_in_currency: item.price_change_24h,
        price_change_percentage_7d_in_currency: item.price_change_7d,
        high_24h: item.high_24h,
        low_24h: item.low_24h,
        last_updated: item.last_updated || item.timestamp
      }))

      return res.status(200).json({
        success: true,
        data: currentData,
        metadata,
        count: currentData.length,
        format: 'current'
      })
    } else {
      // Raw format
      return res.status(200).json({
        success: true,
        data: filteredData,
        metadata,
        count: filteredData.length,
        format: 'raw'
      })
    }

  } catch (error) {
    console.error('Error reading processed data:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to read processed data',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}