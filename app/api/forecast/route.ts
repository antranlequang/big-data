import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Store forecast results in memory (in production, use Redis or database)
const forecastCache = new Map<string, any>()

// Python script executor
function runPythonScript(scriptPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use virtual environment if available
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3')
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3'
    
    const pythonProcess = spawn(pythonCmd, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    })
    
    let stdout = ''
    let stderr = ''
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`Python script failed with code ${code}: ${stderr || stdout}`))
      }
    })
    
    // Timeout after 30 seconds
    setTimeout(() => {
      pythonProcess.kill()
      reject(new Error('Python script timeout'))
    }, 30000)
  })
}

// GET route to get forecast for a specific coin
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const coinId = searchParams.get('coinId') || 'bitcoin'
    const source = searchParams.get('source') || 'minio' // 'minio' or 'generate'
    
    // Check cache first (cache for 30 seconds)
    const cacheKey = coinId
    const cached = forecastCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 30000) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
        source: 'cache'
      })
    }
    
    // If source is 'minio', try to read from MinIO first
    if (source === 'minio') {
      try {
        const scriptPath = path.join(process.cwd(), 'lib', 'forecast_reader.py')
        if (fs.existsSync(scriptPath)) {
          const result = await runPythonScript(scriptPath, [coinId])
          const forecastData = JSON.parse(result.trim())
          
          if (forecastData && !forecastData.error) {
            // Cache the result
            forecastCache.set(cacheKey, {
              data: forecastData,
              timestamp: Date.now()
            })
            
            return NextResponse.json({
              success: true,
              data: forecastData,
              cached: false,
              source: 'minio'
            })
          }
        }
      } catch (error) {
        console.log('Reading from MinIO failed, generating new forecast:', error)
        // Fall through to generate new forecast
      }
    }
    
    // Run Python forecasting script to generate new forecast
    const scriptPath = path.join(process.cwd(), 'lib', 'forecast_runner.py')
    
    if (!fs.existsSync(scriptPath)) {
      // If script doesn't exist, return mock data for now
      return NextResponse.json({
        success: true,
        data: {
          coin_id: coinId,
          current_price: 0,
          historical_prices: [],
          historical_timestamps: [],
          recent_prices: [],
          forecasts: [],
          timestamp: new Date().toISOString()
        },
        cached: false,
        source: 'mock'
      })
    }
    
    try {
      const result = await runPythonScript(scriptPath, [coinId])
      const forecastData = JSON.parse(result.trim())
      
      // Cache the result
      forecastCache.set(cacheKey, {
        data: forecastData,
        timestamp: Date.now()
      })
      
      return NextResponse.json({
        success: true,
        data: forecastData,
        cached: false,
        source: 'generated'
      })
    } catch (error) {
      console.error('Forecasting error:', error)
      // Return empty forecast on error
      return NextResponse.json({
        success: true,
        data: {
          coin_id: coinId,
          current_price: 0,
          historical_prices: [],
          historical_timestamps: [],
          recent_prices: [],
          forecasts: [],
          timestamp: new Date().toISOString()
        },
        cached: false,
        source: 'error',
        error: 'Forecasting service temporarily unavailable'
      })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get forecast'
      },
      { status: 500 }
    )
  }
}

