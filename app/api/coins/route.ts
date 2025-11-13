import { NextRequest, NextResponse } from 'next/server'
// DISABLED FOR DEPLOYMENT: import { fetchAvailableCoins } from '../../../lib/api'

// GET route to fetch available coins from CoinGecko API - TEMPORARILY DISABLED FOR DEPLOYMENT
export async function GET(request: NextRequest) {
  try {
    // DISABLED: const coins = await fetchAvailableCoins()
    console.log('Coins API disabled for deployment - returning static list')
    
    // Return static list of popular coins instead of fetching from API
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
      count: staticCoins.length
    })
  } catch (error) {
    console.error('Error in coins API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Coins API disabled for deployment',
        coins: [],
        count: 0
      },
      { status: 500 }
    )
  }
}

