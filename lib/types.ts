export interface CryptoData {
  id: string
  symbol: string
  name: string
  image?: string
  current_price: number
  market_cap: number
  total_volume: number
  price_change_percentage_1h_in_currency?: number
  price_change_percentage_24h_in_currency?: number
  price_change_percentage_7d_in_currency?: number
  high_24h: number
  low_24h: number
  last_updated: string
}

export interface HistoricalDataPoint {
  timestamp: string
  price_usd: number
  market_cap: number
  volume_24h: number
  price_change_1h?: number
  price_change_24h?: number
  price_change_7d?: number
}

export interface ChartDataPoint {
  time: string
  price: number
  change_1h?: number
  change_24h?: number
  change_7d?: number
}