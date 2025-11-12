import { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

// Store active forecasting processes
const activeProcesses = new Map<string, any>()

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req
  const { action, coinId = 'bitcoin' } = req.body

  try {
    switch (method) {
      case 'POST':
        if (action === 'start_training') {
          return await startTraining(req, res, coinId)
        } else if (action === 'start_forecasting') {
          return await startForecasting(req, res, coinId)
        } else if (action === 'stop_forecasting') {
          return await stopForecasting(req, res, coinId)
        } else {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid action' 
          })
        }
        
      case 'GET':
        return await getForecastingStatus(req, res, coinId)
        
      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('Forecasting API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function startTraining(req: NextApiRequest, res: NextApiResponse, coinId: string) {
  try {
    console.log(`🚀 Starting training for ${coinId}`)
    
    // Create Python script to run training
    const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/lib')

from simple_forecasting import SimpleCryptoForecaster
import json

def main():
    try:
        forecaster = SimpleCryptoForecaster('${coinId}')
        
        # Fetch historical data and train
        print(f"Fetching historical data for {coinId}...")
        prices = forecaster.fetch_historical_prices(days=7)
        
        if not prices:
            print("No price data available")
            return
        
        print(f"Training model with {len(prices)} price points...")
        results = forecaster.train_model(prices)
        
        # Save results
        results_path = f'./data/simple_forecasting/{coinId}_training_results.json'
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        print("Training completed successfully!")
        
    except Exception as e:
        print(f"Training failed: {e}")
        results = {
            'status': 'failed',
            'error': str(e),
            'coin_id': '${coinId}'
        }
        results_path = f'./data/simple_forecasting/${coinId}_training_results.json'
        with open(results_path, 'w') as f:
            json.dump(results, f, indent=2)

if __name__ == "__main__":
    main()
`

    // Write temporary Python file
    const tempDir = path.join(process.cwd(), 'temp')
    await fs.mkdir(tempDir, { recursive: true })
    const tempFile = path.join(tempDir, `train_${coinId}_${Date.now()}.py`)
    await fs.writeFile(tempFile, pythonScript)

    // Execute Python script
    const pythonProcess = spawn('python3', [tempFile], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let errorOutput = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
      console.log('Training output:', data.toString())
    })

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.error('Training error:', data.toString())
    })

    pythonProcess.on('close', async (code) => {
      // Clean up temp file
      try {
        await fs.unlink(tempFile)
      } catch (e) {
        console.warn('Could not delete temp file:', e)
      }
      
      console.log(`Training process exited with code ${code}`)
    })

    // Don't wait for completion, return immediately
    res.status(200).json({
      success: true,
      message: `Training started for ${coinId}`,
      coinId
    })

  } catch (error) {
    console.error('Start training error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to start training'
    })
  }
}

async function startForecasting(req: NextApiRequest, res: NextApiResponse, coinId: string) {
  try {
    // Check if already running
    if (activeProcesses.has(coinId)) {
      return res.status(400).json({
        success: false,
        error: `Forecasting already running for ${coinId}`
      })
    }

    console.log(`🔮 Starting forecasting for ${coinId}`)

    // Create Python script for forecasting
    const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/lib')

from simple_forecasting import SimpleCryptoForecaster
import time
import signal

forecaster = None

def signal_handler(sig, frame):
    global forecaster
    if forecaster:
        forecaster.stop_forecasting()
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

def main():
    global forecaster
    try:
        forecaster = SimpleCryptoForecaster('${coinId}')
        
        # Load trained model
        model_path = f'./data/simple_forecasting/${coinId}_model.h5'
        if not os.path.exists(model_path):
            print("No trained model found. Please train first.")
            return
        
        # Load the model (we'll implement model loading in the forecaster)
        print(f"Starting forecasting for ${coinId}...")
        forecaster.start_forecasting(update_interval=30)
        
        # Keep running
        while True:
            time.sleep(1)
            
    except Exception as e:
        print(f"Forecasting error: {e}")

if __name__ == "__main__":
    main()
`

    // Write and execute forecasting script
    const tempDir = path.join(process.cwd(), 'temp')
    await fs.mkdir(tempDir, { recursive: true })
    const tempFile = path.join(tempDir, `forecast_${coinId}_${Date.now()}.py`)
    await fs.writeFile(tempFile, pythonScript)

    const pythonProcess = spawn('python3', [tempFile], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Forecasting output [${coinId}]:`, data.toString())
    })

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Forecasting error [${coinId}]:`, data.toString())
    })

    pythonProcess.on('close', async (code) => {
      console.log(`Forecasting process [${coinId}] exited with code ${code}`)
      activeProcesses.delete(coinId)
      
      // Clean up temp file
      try {
        await fs.unlink(tempFile)
      } catch (e) {
        console.warn('Could not delete temp file:', e)
      }
    })

    // Store process reference
    activeProcesses.set(coinId, pythonProcess)

    res.status(200).json({
      success: true,
      message: `Forecasting started for ${coinId}`,
      coinId
    })

  } catch (error) {
    console.error('Start forecasting error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to start forecasting'
    })
  }
}

async function stopForecasting(req: NextApiRequest, res: NextApiResponse, coinId: string) {
  try {
    const process = activeProcesses.get(coinId)
    
    if (!process) {
      return res.status(400).json({
        success: false,
        error: `No active forecasting process for ${coinId}`
      })
    }

    // Kill the process
    process.kill('SIGTERM')
    activeProcesses.delete(coinId)

    res.status(200).json({
      success: true,
      message: `Forecasting stopped for ${coinId}`,
      coinId
    })

  } catch (error) {
    console.error('Stop forecasting error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to stop forecasting'
    })
  }
}

async function getForecastingStatus(req: NextApiRequest, res: NextApiResponse, coinId: string) {
  try {
    const isRunning = activeProcesses.has(coinId)
    
    // Try to read latest prediction
    let latestPrediction = null
    try {
      const predictionPath = path.join(process.cwd(), 'data', 'simple_forecasting', `${coinId}_latest_prediction.json`)
      const predictionData = await fs.readFile(predictionPath, 'utf8')
      latestPrediction = JSON.parse(predictionData)
    } catch (e) {
      // No prediction file yet
    }

    // Try to read training results
    let trainingResults = null
    try {
      const resultsPath = path.join(process.cwd(), 'data', 'simple_forecasting', `${coinId}_training_results.json`)
      const resultsData = await fs.readFile(resultsPath, 'utf8')
      trainingResults = JSON.parse(resultsData)
    } catch (e) {
      // No training results yet
    }

    res.status(200).json({
      success: true,
      coinId,
      isRunning,
      latestPrediction,
      trainingResults
    })

  } catch (error) {
    console.error('Get status error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    })
  }
}