import { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req
  const { coinId = 'bitcoin', historicalData } = req.body

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${method} Not Allowed`)
  }

  try {
    console.log(`🔮 Generating forecast chart for ${coinId}`)

    // Create enhanced Python script for chart forecasting
    const pythonScript = `
import sys
import os
import json
import numpy as np
from datetime import datetime, timedelta
sys.path.append('${process.cwd()}/lib')

from simple_forecasting import SimpleCryptoForecaster

def generate_forecast_data(coin_id, historical_prices):
    """Generate forecast data for chart display"""
    try:
        forecaster = SimpleCryptoForecaster(coin_id, sequence_length=10)
        
        # Use provided historical data
        if len(historical_prices) < 20:
            print("Not enough historical data")
            return None
        
        # Train on the provided data
        prices = [float(point.get('price_usd', 0)) for point in historical_prices[-100:]]  # Last 100 points
        
        if len(prices) < 20:
            print("Insufficient price data")
            return None
        
        print(f"Training model with {len(prices)} price points...")
        results = forecaster.train_model(prices)
        
        if results.get('status') != 'completed':
            print("Training failed")
            return None
        
        # Generate predictions for last 15 points + 5 future points
        predictions = []
        
        # Past predictions (for comparison)
        for i in range(10, min(len(prices), len(prices))):
            if i >= len(prices):
                break
                
            # Use model to predict
            recent_prices = prices[max(0, i-10):i]
            if len(recent_prices) >= 10:
                predicted_price = forecaster.predict_next_price(recent_prices)
                if predicted_price:
                    actual_price = prices[i] if i < len(prices) else None
                    
                    # Use corresponding timestamp from historical data
                    timestamp_idx = len(historical_prices) - len(prices) + i
                    if timestamp_idx < len(historical_prices):
                        timestamp = historical_prices[timestamp_idx].get('timestamp')
                    else:
                        timestamp = datetime.now().isoformat()
                    
                    predictions.append({
                        'timestamp': timestamp,
                        'actual_price': actual_price,
                        'predicted_price': predicted_price,
                        'is_future': False
                    })
        
        # Future predictions
        last_timestamp = datetime.fromisoformat(historical_prices[-1]['timestamp'].replace('Z', '+00:00'))
        recent_prices = prices[-10:]  # Last 10 prices for future prediction
        
        for i in range(1, 6):  # Next 5 time periods
            future_time = last_timestamp + timedelta(hours=i)
            
            # Get prediction
            predicted_price = forecaster.predict_next_price(recent_prices)
            if predicted_price:
                predictions.append({
                    'timestamp': future_time.isoformat(),
                    'predicted_price': predicted_price,
                    'is_future': True
                })
                
                # Update recent_prices for next prediction
                recent_prices = recent_prices[1:] + [predicted_price]
        
        # Calculate accuracy
        past_predictions = [p for p in predictions if not p['is_future'] and p.get('actual_price')]
        accuracy = 0
        if past_predictions:
            total_error = sum(abs(p['actual_price'] - p['predicted_price']) / p['actual_price'] 
                            for p in past_predictions)
            accuracy = max(0, (1 - total_error / len(past_predictions)) * 100)
        
        result = {
            'predictions': predictions,
            'accuracy': accuracy,
            'training_results': results,
            'coin_id': coin_id,
            'timestamp': datetime.now().isoformat()
        }
        
        # Save forecast data
        os.makedirs('./data/simple_forecasting', exist_ok=True)
        forecast_path = f'./data/simple_forecasting/{coin_id}_chart_forecast.json'
        with open(forecast_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"✅ Forecast generated: {len(predictions)} predictions, {accuracy:.1f}% accuracy")
        return result
        
    except Exception as e:
        print(f"❌ Forecast generation failed: {e}")
        return None

def main():
    try:
        # Read input data
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        coin_id = data.get('coinId', 'bitcoin')
        historical_data = data.get('historicalData', [])
        
        result = generate_forecast_data(coin_id, historical_data)
        
        if result:
            print("SUCCESS:" + json.dumps(result))
        else:
            print("ERROR:Failed to generate forecast")
            
    except Exception as e:
        print(f"ERROR:{e}")

if __name__ == "__main__":
    main()
`

    // Write temporary Python file
    const tempDir = path.join(process.cwd(), 'temp')
    await fs.mkdir(tempDir, { recursive: true })
    const tempFile = path.join(tempDir, `forecast_chart_${coinId}_${Date.now()}.py`)
    await fs.writeFile(tempFile, pythonScript)

    // Execute Python script
    const pythonProcess = spawn('python3', [tempFile], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Send input data to Python script
    pythonProcess.stdin.write(JSON.stringify({ coinId, historicalData }))
    pythonProcess.stdin.end()

    let output = ''
    let errorOutput = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.error('Python error:', data.toString())
    })

    pythonProcess.on('close', async (code) => {
      // Clean up temp file
      try {
        await fs.unlink(tempFile)
      } catch (e) {
        console.warn('Could not delete temp file:', e)
      }

      console.log(`Forecast process exited with code ${code}`)
      
      if (code === 0 && output.includes('SUCCESS:')) {
        try {
          const resultJson = output.split('SUCCESS:')[1].trim()
          const result = JSON.parse(resultJson)
          
          res.status(200).json({
            success: true,
            data: result
          })
        } catch (parseError) {
          console.error('Error parsing result:', parseError)
          res.status(500).json({
            success: false,
            error: 'Failed to parse forecast results'
          })
        }
      } else {
        const errorMsg = output.includes('ERROR:') ? output.split('ERROR:')[1].trim() : 'Unknown error'
        res.status(500).json({
          success: false,
          error: errorMsg,
          details: errorOutput
        })
      }
    })

  } catch (error) {
    console.error('Forecast chart API error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}