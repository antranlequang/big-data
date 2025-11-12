import { NextApiRequest, NextApiResponse } from 'next'
import { promises as fs } from 'fs'
import path from 'path'

interface PredictionData {
  timestamp: string
  current_price: number
  risk_probability: number
  warning_signal: boolean
  status: 'active' | 'insufficient_data' | 'error'
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      // Read latest prediction from Python forecasting system
      const predictionPath = path.join(process.cwd(), 'data', 'predictions', 'latest_prediction.json')
      
      try {
        const predictionData = await fs.readFile(predictionPath, 'utf8')
        const prediction: PredictionData = JSON.parse(predictionData)
        
        res.status(200).json({
          success: true,
          data: prediction
        })
      } catch (fileError) {
        // If no prediction file exists, return default state
        res.status(200).json({
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            current_price: 0,
            risk_probability: 0,
            warning_signal: false,
            status: 'insufficient_data'
          }
        })
      }
    } catch (error) {
      console.error('Error reading predictions:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to read prediction data'
      })
    }
  } else {
    res.setHeader('Allow', ['GET'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}