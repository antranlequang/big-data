import { fetchTop50Cryptos } from './api'
import { saveTop50CoinsToMinio, initializeMinio } from './minio-service'

// Data collection service - fetches top 50 coins data from CoinGecko real-time API
class DataCollector {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private readonly FETCH_INTERVAL = 60000 // 1 minute = 60,000ms
  
  constructor() {
    // Force stop any existing intervals that might be running
    this.forceStopAll()
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Data collector is already running')
      return
    }

    console.log('🚀 Starting crypto data collector for top 50 coins...')
    
    // Initialize MinIO connection
    const minioReady = await initializeMinio()
    if (!minioReady) {
      console.error('❌ Failed to initialize MinIO connection')
      return
    }

    this.isRunning = true
    
    // Fetch data immediately
    await this.collectAndSaveData()
    
    // Set up interval for fetching data every minute
    this.intervalId = setInterval(async () => {
      await this.collectAndSaveData()
    }, this.FETCH_INTERVAL)

    console.log(`✅ Data collector started - fetching top 50 coins every ${this.FETCH_INTERVAL / 1000} seconds`)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('🛑 Data collector stopped')
  }

  // Force stop all possible intervals - more aggressive cleanup
  private forceStopAll(): void {
    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    // Clear all timeouts and intervals that might be running
    // This is a more aggressive approach to handle hot reloads
    const maxIntervalId = setTimeout(() => {}, 0) as unknown as number
    for (let i = 1; i <= maxIntervalId; i++) {
      clearInterval(i)
      clearTimeout(i)
    }
    clearTimeout(maxIntervalId)
    
    this.isRunning = false
    console.log('🧹 Forced cleanup of all intervals and timeouts')
  }

  private async collectAndSaveData(): Promise<void> {
    try {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] 🔄 Fetching real-time data for top 50 coins...`)
      
      // Fetch top 50 coins data from CoinGecko real-time API with all metrics
      const coinsData = await fetchTop50Cryptos()
      
      if (!coinsData || coinsData.length === 0) {
        console.log(`⚠️ No data returned from API, retrying...`)
        return
      }

      // Save all coins to MinIO (appends rows to existing file)
      const saveSuccess = await saveTop50CoinsToMinio(coinsData)
      
      if (saveSuccess) {
        console.log(`[${new Date().toISOString()}] ✅ Successfully collected and saved data for ${coinsData.length} coins`)
      } else {
        console.log('❌ Failed to save data to MinIO')
      }
    } catch (error) {
      console.error('💥 Error in data collection:', error)
    }
  }

  isCollecting(): boolean {
    return this.isRunning
  }

  // Public method to force stop all intervals (for emergency cleanup)
  forceStopAllPublic(): void {
    this.forceStopAll()
  }
}

// Create singleton instance
export const dataCollector = new DataCollector()

// Auto-start disabled - now controlled via API
// Data collector will only start when explicitly requested via the control API
console.log('🔧 Data collector initialized - use /api/data-collector to control')