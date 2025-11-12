import { NextRequest, NextResponse } from 'next/server'
import { readCoinDataFromMinio, readCryptoDataFromMinio, initializeMinio } from '@/lib/minio-service'
import { dataCollector } from '@/lib/data-collector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET route to read crypto data from MinIO for a specific coin
export async function GET(request: NextRequest) {
  try {
    // Ensure MinIO is initialized
    await initializeMinio()
    
    // Get coin ID from query parameter
    const searchParams = request.nextUrl.searchParams
    const coinId = searchParams.get('coinId')
    
    // If coin ID is provided, read data for that specific coin
    if (coinId) {
      const data = await readCoinDataFromMinio(coinId)
      
      return NextResponse.json({
        success: true,
        data,
        count: data.length,
        coinId,
        source: 'minio',
        collectorRunning: dataCollector.isCollecting(),
        lastUpdate: new Date().toISOString()
      })
    } else {
      // No coin ID provided, read all data (legacy behavior)
      const data = await readCryptoDataFromMinio()
      
      return NextResponse.json({
        success: true,
        data,
        count: data.length,
        source: 'minio',
        collectorRunning: dataCollector.isCollecting(),
        lastUpdate: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch data from MinIO',
        data: [],
        count: 0,
        collectorRunning: false
      },
      { status: 500 }
    )
  }
}