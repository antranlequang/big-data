import { Client as MinioClient } from 'minio'
import type { CryptoData } from './types'

// MinIO connection configuration (same as app.py)
const minioClient = new MinioClient({
  endPoint: '127.0.0.1',
  port: 9000,
  useSSL: false,
  accessKey: 'bankuser',
  secretKey: 'BankPass123!'
})

const BUCKET_NAME = 'crypto-data'

// Initialize MinIO bucket
export async function initializeMinio(): Promise<boolean> {
  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME)
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME)
      console.log('✅ MinIO bucket created successfully')
    }
    return true
  } catch (error) {
    console.error('❌ MinIO connection error:', error)
    return false
  }
}

// Save top 50 coins data to MinIO - appends all coins as rows to one file per day
export async function saveTop50CoinsToMinio(coinsData: CryptoData[]): Promise<boolean> {
  try {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
    const timestamp = now.toISOString()
    const filename = `crypto_prices/top50_${dateStr}.csv`

    // Convert all coins data to CSV rows
    const csvRows = coinsData.map(coinData => {
      const record = {
        timestamp,
        id: coinData.id,
        symbol: coinData.symbol,
        name: coinData.name,
        price_usd: coinData.current_price,
        market_cap: coinData.market_cap,
        volume_24h: coinData.total_volume,
        price_change_1h: coinData.price_change_percentage_1h_in_currency || 0,
        price_change_24h: coinData.price_change_percentage_24h_in_currency || 0,
        price_change_7d: coinData.price_change_percentage_7d_in_currency || 0,
        high_24h: coinData.high_24h,
        low_24h: coinData.low_24h,
        last_updated: coinData.last_updated
      }
      
      return Object.values(record).map(value => 
        typeof value === 'string' ? `"${value}"` : value
      ).join(',')
    })

    // Define headers (same for all records)
    const headers = ['timestamp', 'id', 'symbol', 'name', 'price_usd', 'market_cap', 'volume_24h', 
                     'price_change_1h', 'price_change_24h', 'price_change_7d', 'high_24h', 'low_24h', 'last_updated'].join(',')

    // Try to read existing file and append
    let finalCsvContent: string
    try {
      const existingObject = await minioClient.getObject(BUCKET_NAME, filename)
      const existingData = await streamToString(existingObject)
      
      if (existingData.trim()) {
        // Append new rows without headers
        finalCsvContent = existingData.trim() + '\n' + csvRows.join('\n')
        console.log(`📈 Appended ${csvRows.length} rows (one per coin) to existing file`)
      } else {
        // Empty file, add headers and rows
        finalCsvContent = [headers, ...csvRows].join('\n')
        console.log(`🆕 Creating new file with ${csvRows.length} coins`)
      }
    } catch (error) {
      // File doesn't exist, create new with headers
      finalCsvContent = [headers, ...csvRows].join('\n')
      console.log(`🆕 Creating new file with ${csvRows.length} coins`)
    }

    // Save to MinIO
    const buffer = Buffer.from(finalCsvContent, 'utf8')
    await minioClient.putObject(BUCKET_NAME, filename, buffer, buffer.length, {
      'Content-Type': 'text/csv'
    })

    console.log(`✅ Saved data for ${coinsData.length} coins to MinIO: ${filename}`)
    return true
  } catch (error) {
    console.error('❌ Error saving to MinIO:', error)
    return false
  }
}

// Save single coin data to MinIO (legacy function - kept for backward compatibility)
export async function saveCoinDataToMinio(coinData: CryptoData): Promise<boolean> {
  try {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
    const timestamp = now.toISOString()
    const filename = `crypto_prices/${coinData.id}_${dateStr}.csv`

    // Convert single coin data to CSV format
    const record = {
      timestamp,
      id: coinData.id,
      symbol: coinData.symbol,
      name: coinData.name,
      price_usd: coinData.current_price,
      market_cap: coinData.market_cap,
      volume_24h: coinData.total_volume,
      price_change_1h: coinData.price_change_percentage_1h_in_currency || 0,
      price_change_24h: coinData.price_change_percentage_24h_in_currency || 0,
      price_change_7d: coinData.price_change_percentage_7d_in_currency || 0,
      high_24h: coinData.high_24h,
      low_24h: coinData.low_24h,
      last_updated: coinData.last_updated
    }

    // Convert to CSV string
    const headers = Object.keys(record).join(',')
    const csvRow = Object.values(record).map(value => 
      typeof value === 'string' ? `"${value}"` : value
    ).join(',')

    // Try to read existing file and append
    let finalCsvContent: string
    try {
      const existingObject = await minioClient.getObject(BUCKET_NAME, filename)
      const existingData = await streamToString(existingObject)
      
      if (existingData.trim()) {
        // Append new data without headers
        finalCsvContent = existingData.trim() + '\n' + csvRow
        console.log(`📈 Appended new row for ${coinData.id} to existing file`)
      } else {
        // Empty file, add headers and row
        finalCsvContent = [headers, csvRow].join('\n')
        console.log(`🆕 Creating new file for ${coinData.id}`)
      }
    } catch (error) {
      // File doesn't exist, create new with headers
      finalCsvContent = [headers, csvRow].join('\n')
      console.log(`🆕 Creating new file for ${coinData.id}`)
    }

    // Save to MinIO
    const buffer = Buffer.from(finalCsvContent, 'utf8')
    await minioClient.putObject(BUCKET_NAME, filename, buffer, buffer.length, {
      'Content-Type': 'text/csv'
    })

    console.log(`✅ Saved data for ${coinData.name} (${coinData.symbol}) to MinIO: ${filename}`)
    return true
  } catch (error) {
    console.error('❌ Error saving to MinIO:', error)
    return false
  }
}

// Save crypto data to MinIO (legacy function - kept for backward compatibility)
export async function saveCryptoDataToMinio(cryptoData: CryptoData[]): Promise<boolean> {
  try {
    // Save each coin individually
    for (const coin of cryptoData) {
      await saveCoinDataToMinio(coin)
    }
    return true
  } catch (error) {
    console.error('❌ Error saving to MinIO:', error)
    return false
  }
}

// Read crypto data for a specific coin from MinIO (filters from top50 file)
export async function readCoinDataFromMinio(coinId: string): Promise<any[]> {
  try {
    const dateStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `crypto_prices/top50_${dateStr}.csv`

    try {
      const objectStream = await minioClient.getObject(BUCKET_NAME, filename)
      const csvContent = await streamToString(objectStream)
      
      if (!csvContent.trim()) {
        return []
      }

      // Parse CSV content
      const lines = csvContent.trim().split('\n')
      const headers = lines[0].split(',')
      
      // Parse all data and filter by coin ID
      const allData = lines.slice(1).map(line => {
        const values = parseCSVLine(line)
        const record: any = {}
        headers.forEach((header, index) => {
          const value = values[index]
          // Convert numeric fields
          if (['price_usd', 'market_cap', 'volume_24h', 'price_change_1h', 'price_change_24h', 'price_change_7d', 'high_24h', 'low_24h'].includes(header)) {
            record[header] = parseFloat(value) || 0
          } else {
            record[header] = value?.replace(/"/g, '') || ''
          }
        })
        return record
      })

      // Filter data for the selected coin
      const coinData = allData.filter(record => record.id === coinId)

      console.log(`📥 Read ${coinData.length} records for ${coinId} from MinIO (filtered from ${allData.length} total records)`)
      return coinData
    } catch (error) {
      // File doesn't exist for today
      console.log(`📥 No data file found for top50 on ${dateStr}`)
      return []
    }
  } catch (error) {
    console.error(`❌ Error reading ${coinId} from MinIO:`, error)
    return []
  }
}

// Read crypto data from MinIO (reads all coins from today's top50 file)
export async function readCryptoDataFromMinio(): Promise<any[]> {
  try {
    const dateStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `crypto_prices/top50_${dateStr}.csv`

    try {
      const objectStream = await minioClient.getObject(BUCKET_NAME, filename)
      const csvContent = await streamToString(objectStream)
      
      if (!csvContent.trim()) {
        return []
      }

      // Parse CSV content
      const lines = csvContent.trim().split('\n')
      const headers = lines[0].split(',')
      
      // Parse all data
      const allData = lines.slice(1).map(line => {
        const values = parseCSVLine(line)
        const record: any = {}
        headers.forEach((header, index) => {
          const value = values[index]
          // Convert numeric fields
          if (['price_usd', 'market_cap', 'volume_24h', 'price_change_1h', 'price_change_24h', 'price_change_7d', 'high_24h', 'low_24h'].includes(header)) {
            record[header] = parseFloat(value) || 0
          } else {
            record[header] = value?.replace(/"/g, '') || ''
          }
        })
        return record
      })

      console.log(`📥 Read ${allData.length} total records from MinIO`)
      return allData
    } catch (error) {
      // File doesn't exist for today
      console.log(`📥 No data file found for top50 on ${dateStr}`)
      return []
    }
  } catch (error) {
    console.error('❌ Error reading from MinIO:', error)
    return []
  }
}

// Helper function to convert stream to string
async function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    stream.on('data', (chunk: any) => chunks.push(new Uint8Array(chunk)))
    stream.on('error', reject)
    stream.on('end', () => {
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      resolve(new TextDecoder().decode(result))
    })
  })
}

// Read forecast prices from MinIO
export async function readForecastPricesFromMinio(coinId?: string): Promise<any[]> {
  try {
    const dateStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const filename = `crypto_prices/forecast_price_${dateStr}.csv`

    try {
      const objectStream = await minioClient.getObject(BUCKET_NAME, filename)
      const csvContent = await streamToString(objectStream)
      
      if (!csvContent.trim()) {
        return []
      }

      // Parse CSV content
      const lines = csvContent.trim().split('\n')
      const headers = lines[0].split(',')
      
      // Parse all data
      const allData = lines.slice(1).map(line => {
        const values = parseCSVLine(line)
        const record: any = {}
        headers.forEach((header, index) => {
          const value = values[index]
          // Convert numeric fields
          if (['forecast_minute', 'forecast_price', 'current_price'].includes(header)) {
            record[header] = parseFloat(value) || 0
          } else {
            record[header] = value?.replace(/"/g, '') || ''
          }
        })
        return record
      })

      // Filter data for the selected coin if provided
      let filteredData = allData
      if (coinId) {
        filteredData = allData.filter(record => record.coin_id === coinId)
        console.log(`📥 Read ${filteredData.length} forecast records for ${coinId} from MinIO (filtered from ${allData.length} total records)`)
      } else {
        console.log(`📥 Read ${allData.length} total forecast records from MinIO`)
      }
      
      return filteredData
    } catch (error) {
      // File doesn't exist for today, try yesterday
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      const yesterdayFilename = `crypto_prices/forecast_price_${yesterdayStr}.csv`
      
      try {
        const objectStream = await minioClient.getObject(BUCKET_NAME, yesterdayFilename)
        const csvContent = await streamToString(objectStream)
        
        if (!csvContent.trim()) {
          return []
        }

        const lines = csvContent.trim().split('\n')
        const headers = lines[0].split(',')
        
        const allData = lines.slice(1).map(line => {
          const values = parseCSVLine(line)
          const record: any = {}
          headers.forEach((header, index) => {
            const value = values[index]
            if (['forecast_minute', 'forecast_price', 'current_price'].includes(header)) {
              record[header] = parseFloat(value) || 0
            } else {
              record[header] = value?.replace(/"/g, '') || ''
            }
          })
          return record
        })

        let filteredData = allData
        if (coinId) {
          filteredData = allData.filter(record => record.coin_id === coinId)
        }
        
        console.log(`📥 Read ${filteredData.length} forecast records from yesterday's file`)
        return filteredData
      } catch (error2) {
        console.log(`📥 No forecast price file found for ${dateStr} or ${yesterdayStr}`)
        return []
      }
    }
  } catch (error) {
    console.error(`❌ Error reading forecast prices from MinIO:`, error)
    return []
  }
}

// Helper function to parse CSV line with quoted strings
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}