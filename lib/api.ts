import type { CryptoData, HistoricalDataPoint } from './types'

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'

// Fetch single coin data from CoinGecko real-time API with all metrics
export async function fetchCoinData(coinId: string): Promise<CryptoData | null> {
  try {
    const url = `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&ids=${coinId}&sparkline=false&price_change_percentage=1h,24h,7d`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch data for ${coinId}`)
    const data = await response.json()
    return data.length > 0 ? data[0] : null
  } catch (error) {
    console.error(`Error fetching data for ${coinId}:`, error)
    return null
  }
}

// Fetch list of available coins from CoinGecko for dropdown (top 50 to match data collector)
export async function fetchAvailableCoins(): Promise<{id: string, name: string, symbol: string}[]> {
  try {
    const url = `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch available coins')
    const data = await response.json()
    return data.map((coin: CryptoData) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol
    }))
  } catch (error) {
    console.error('Error fetching available coins:', error)
    return []
  }
}

export async function fetchTop50Cryptos(): Promise<CryptoData[]> {
  try {
    const url = `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=1h,24h,7d`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch crypto data')
    return await response.json()
  } catch (error) {
    console.error('Error fetching crypto data:', error)
    return []
  }
}

export async function fetchBitcoinData(): Promise<CryptoData[]> {
  try {
    const url = `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&ids=bitcoin&sparkline=false&price_change_percentage=1h,24h,7d`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch Bitcoin data')
    return await response.json()
  } catch (error) {
    console.error('Error fetching Bitcoin data:', error)
    return []
  }
}

export async function fetchCryptoHistory(coinId: string, days: number = 1): Promise<HistoricalDataPoint[]> {
  try {
    const url = `${COINGECKO_API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=${days <= 1 ? 'hourly' : 'daily'}`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch historical data')
    const data = await response.json()
    
    const { prices, market_caps, total_volumes } = data
    
    return prices.map((price: [number, number], index: number) => ({
      timestamp: new Date(price[0]).toISOString(),
      price_usd: price[1],
      market_cap: market_caps[index] ? market_caps[index][1] : 0,
      volume_24h: total_volumes[index] ? total_volumes[index][1] : 0
    }))
  } catch (error) {
    console.error('Error fetching historical data:', error)
    return []
  }
}

export async function fetchBitcoinHistory(days: number = 1): Promise<HistoricalDataPoint[]> {
  return fetchCryptoHistory('bitcoin', days)
}

// Bitcoin real-time price fetcher
export async function fetchBitcoinRealTimePrice(): Promise<number> {
  try {
    const url = `${COINGECKO_API_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch real-time Bitcoin price')
    const data = await response.json()
    return data.bitcoin.usd
  } catch (error) {
    console.error('Error fetching real-time Bitcoin price:', error)
    return 0
  }
}

