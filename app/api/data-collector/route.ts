import { NextRequest, NextResponse } from 'next/server'
import { dataCollector } from '@/lib/data-collector'

// GET route to check data collector status
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      isRunning: dataCollector.isCollecting(),
      status: dataCollector.isCollecting() ? 'running' : 'stopped',
      message: dataCollector.isCollecting() ? 'Collecting data for top 50 coins' : 'Stopped'
    })
  } catch (error) {
    console.error('Data Collector Status Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get data collector status'
      },
      { status: 500 }
    )
  }
}

// POST route to control data collector (start/stop)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'start') {
      if (!dataCollector.isCollecting()) {
        await dataCollector.start()
        console.log('🚀 Data collector started via API for top 50 coins')
      }
      return NextResponse.json({
        success: true,
        message: 'Data collector started for top 50 coins',
        isRunning: dataCollector.isCollecting()
      })
    } else if (action === 'stop') {
      if (dataCollector.isCollecting()) {
        dataCollector.stop()
        console.log('🛑 Data collector stopped via API')
      }
      return NextResponse.json({
        success: true,
        message: 'Data collector stopped',
        isRunning: dataCollector.isCollecting()
      })
    } else if (action === 'force-stop') {
      // Emergency stop - clears all intervals
      dataCollector.forceStopAllPublic()
      console.log('🧹 Force stopped all data collector intervals via API')
      return NextResponse.json({
        success: true,
        message: 'All data collector intervals force stopped',
        isRunning: dataCollector.isCollecting()
      })
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid action. Use "start", "stop", or "force-stop"'
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Data Collector Control Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to control data collector'
      },
      { status: 500 }
    )
  }
}