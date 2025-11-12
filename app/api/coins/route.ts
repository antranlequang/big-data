import { NextRequest, NextResponse } from 'next/server'
import { fetchAvailableCoins } from '@/lib/api'

// GET route to fetch available coins from CoinGecko API
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
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch available coins',
        coins: [],
        count: 0
      },
      { status: 500 }
    )
  }
}

