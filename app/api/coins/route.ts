import { NextRequest, NextResponse } from 'next/server'
import { fetchAvailableCoins } from '../../../lib/api'

// GET route to fetch available coins from CoinGecko API - RE-ENABLED WITH 5-MINUTE INTERVALS
export async function GET(request: NextRequest) {
  try {
    const coins = await fetchAvailableCoins()
    
    return NextResponse.json({
      success: true,
      coins,
      count: coins.length
    })
  } catch (error) {
    console.error('Error fetching available coins:', error)
    
    // Fallback to static list if API fails
    const staticCoins = [
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
      { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
      { id: 'tether', name: 'Tether', symbol: 'usdt' },
      { id: 'bnb', name: 'BNB', symbol: 'bnb' },
      { id: 'solana', name: 'Solana', symbol: 'sol' },
      { id: 'usdc', name: 'USD Coin', symbol: 'usdc' },
      { id: 'xrp', name: 'XRP', symbol: 'xrp' }
    ]
    
    return NextResponse.json({
      success: true,
      coins: staticCoins,
      count: staticCoins.length,
      fallback: true
    })
  }
}

