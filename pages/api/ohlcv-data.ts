import { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req

  try {
    switch (method) {
      case 'POST':
        return await handleDataFetch(req, res)
      case 'GET':
        return await handleDataRetrieval(req, res)
      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error) {
    console.error('OHLCV API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleDataFetch(req: NextApiRequest, res: NextApiResponse) {
  const { action, coinId, timePeriod = '1y' } = req.body

  if (action === 'fetch_only') {
    try {
      console.log(`📡 Fetching raw data only for ${coinId} (${timePeriod})`)

      // Create Python script for only fetching data (no processing)
      const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/lib')

from coingecko_fetcher import CoinGeckoFetcher
import json

def main():
    try:
        coin_id = "${coinId}"
        time_period = "${timePeriod}"
        
        # Convert time period to days
        days_map = {
            "1m": 30,
            "3m": 90,
            "6m": 180,
            "1y": 365,
            "2y": 730
        }
        days = days_map.get(time_period, 365)
        
        print(f"📡 Fetching raw data for {coin_id} ({days} days)")
        
        # Only fetch data from CoinGecko (no processing)
        fetcher = CoinGeckoFetcher()
        fetch_success = fetcher.fetch_and_save_coin_data(coin_id, days)
        
        if fetch_success:
            result = {
                "success": True,
                "coin_id": coin_id,
                "time_period": time_period,
                "message": "Raw data fetched and saved to MinIO"
            }
            print("SUCCESS:" + json.dumps(result))
        else:
            print("ERROR: Failed to fetch raw data")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()
`

      // Write and execute Python script
      const tempDir = path.join(process.cwd(), 'temp')
      await fs.mkdir(tempDir, { recursive: true })
      const tempFile = path.join(tempDir, `fetch_only_${coinId}_${Date.now()}.py`)
      await fs.writeFile(tempFile, pythonScript)

      const pythonProcess = spawn('python3', [tempFile], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      let errorOutput = ''

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString()
        console.log('Fetch output:', data.toString())
      })

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.error('Fetch error:', data.toString())
      })

      pythonProcess.on('close', async (code) => {
        // Clean up temp file
        try {
          await fs.unlink(tempFile)
        } catch (e) {
          console.warn('Could not delete temp file:', e)
        }

        console.log(`Fetch process exited with code ${code}`)

        if (code === 0 && output.includes('SUCCESS:')) {
          try {
            const successIndex = output.indexOf('SUCCESS:')
            let jsonStr = output.substring(successIndex + 8).trim()
            
            // Find the end of the JSON
            let jsonEndIndex = -1
            let braceCount = 0
            let inString = false
            let escapeNext = false
            
            for (let i = 0; i < jsonStr.length; i++) {
              const char = jsonStr[i]
              
              if (escapeNext) {
                escapeNext = false
                continue
              }
              
              if (char === '\\') {
                escapeNext = true
                continue
              }
              
              if (char === '"' && !escapeNext) {
                inString = !inString
                continue
              }
              
              if (!inString) {
                if (char === '{') {
                  braceCount++
                } else if (char === '}') {
                  braceCount--
                  if (braceCount === 0) {
                    jsonEndIndex = i + 1
                    break
                  }
                }
              }
            }
            
            if (jsonEndIndex > -1) {
              jsonStr = jsonStr.substring(0, jsonEndIndex)
            }
            
            const result = JSON.parse(jsonStr)

            res.status(200).json({
              success: true,
              data: result
            })
          } catch (parseError) {
            console.error('Parse error:', parseError)
            res.status(500).json({
              success: false,
              error: 'Failed to parse fetch results'
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
      console.error('Fetch error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to start fetch process'
      })
    }
  } else if (action === 'fetch_and_process') {
    try {
      console.log(`🔄 Starting fetch and process for ${coinId} (${timePeriod})`)

      // Create Python script for fetching and processing
      const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/lib')

from coingecko_fetcher import CoinGeckoFetcher
from ohlcv_processor import OHLCVProcessor
import json

def main():
    try:
        coin_id = "${coinId}"
        time_period = "${timePeriod}"
        
        # Convert time period to days
        days_map = {
            "1m": 30,
            "3m": 90,
            "6m": 180,
            "1y": 365,
            "2y": 730
        }
        days = days_map.get(time_period, 365)
        
        print(f"Time period: {time_period} -> {days} days")
        
        print(f"📡 Fetching data for {coin_id} ({days} days)")
        
        # Step 1: Fetch data from CoinGecko
        fetcher = CoinGeckoFetcher()
        fetch_success = fetcher.fetch_and_save_coin_data(coin_id, days)
        
        if not fetch_success:
            print(f"ERROR: Failed to fetch data for {coin_id}")
            return
        
        # Step 2: Process with PySpark
        print(f"🔧 Processing data for {coin_id}")
        processor = OHLCVProcessor()
        
        try:
            process_success = processor.process_coin_data(coin_id, time_period)
            
            if process_success:
                # Get processed data summary
                processed_data = processor.get_processed_data(coin_id, time_period)
                
                result = {
                    "success": True,
                    "coin_id": coin_id,
                    "time_period": time_period,
                    "data_points": processed_data.get("data_points", 0) if processed_data else 0,
                    "date_range": processed_data.get("date_range", {}) if processed_data else {},
                    "technical_indicators": processed_data.get("technical_indicators", []) if processed_data else []
                }
                
                print("SUCCESS:" + json.dumps(result))
            else:
                print("ERROR: Processing failed")
        finally:
            processor.close()
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()
`

      // Write and execute Python script
      const tempDir = path.join(process.cwd(), 'temp')
      await fs.mkdir(tempDir, { recursive: true })
      const tempFile = path.join(tempDir, `ohlcv_${coinId}_${Date.now()}.py`)
      await fs.writeFile(tempFile, pythonScript)

      const pythonProcess = spawn('python3', [tempFile], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      let errorOutput = ''

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString()
        console.log('OHLCV output:', data.toString())
      })

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.error('OHLCV error:', data.toString())
      })

      pythonProcess.on('close', async (code) => {
        // Clean up temp file
        try {
          await fs.unlink(tempFile)
        } catch (e) {
          console.warn('Could not delete temp file:', e)
        }

        console.log(`OHLCV process exited with code ${code}`)

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
              error: 'Failed to parse results'
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
      console.error('Fetch and process error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to start fetch and process'
      })
    }
  } else if (action === 'get_top_coins') {
    try {
      console.log('📋 Fetching top coins list')

      const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/lib')

from coingecko_fetcher import CoinGeckoFetcher
import json

def main():
    try:
        fetcher = CoinGeckoFetcher()
        coins = fetcher.get_top_coins_list(limit=1000)
        
        result = {
            "success": True,
            "coins": coins[:100]  # Return top 100 for dropdown
        }
        
        print("SUCCESS:" + json.dumps(result))
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()
`

      const tempDir = path.join(process.cwd(), 'temp')
      await fs.mkdir(tempDir, { recursive: true })
      const tempFile = path.join(tempDir, `top_coins_${Date.now()}.py`)
      await fs.writeFile(tempFile, pythonScript)

      const pythonProcess = spawn('python3', [tempFile], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString()
      })

      pythonProcess.on('close', async (code) => {
        try {
          await fs.unlink(tempFile)
        } catch (e) {
          console.warn('Could not delete temp file:', e)
        }

        if (code === 0 && output.includes('SUCCESS:')) {
          try {
            const resultJson = output.split('SUCCESS:')[1].trim()
            const result = JSON.parse(resultJson)
            res.status(200).json(result)
          } catch (parseError) {
            res.status(500).json({
              success: false,
              error: 'Failed to parse coins list'
            })
          }
        } else {
          res.status(500).json({
            success: false,
            error: 'Failed to fetch coins list'
          })
        }
      })

    } catch (error) {
      console.error('Get top coins error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get top coins'
      })
    }
  } else if (action === 'process_only') {
    try {
      console.log(`🔧 Processing existing raw data for ${coinId} (${timePeriod})`)

      // Create Python script for only processing existing data
      const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/lib')

from ohlcv_processor import OHLCVProcessor
import json

def main():
    try:
        coin_id = "${coinId}"
        time_period = "${timePeriod}"
        
        print(f"🔧 Processing existing data for {coin_id} ({time_period})")
        
        # Only process existing data with PySpark
        processor = OHLCVProcessor()
        
        try:
            process_success = processor.process_coin_data(coin_id, time_period)
            
            if process_success:
                # Get processed data summary
                processed_data = processor.get_processed_data(coin_id, time_period)
                
                result = {
                    "success": True,
                    "coin_id": coin_id,
                    "time_period": time_period,
                    "data_points": processed_data.get("data_points", 0) if processed_data else 0,
                    "date_range": processed_data.get("date_range", {}) if processed_data else {},
                    "technical_indicators": processed_data.get("technical_indicators", []) if processed_data else []
                }
                
                print("SUCCESS:" + json.dumps(result))
            else:
                print("ERROR: Processing failed")
        finally:
            processor.close()
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()
`

      // Write and execute Python script
      const tempDir = path.join(process.cwd(), 'temp')
      await fs.mkdir(tempDir, { recursive: true })
      const tempFile = path.join(tempDir, `process_only_${coinId}_${Date.now()}.py`)
      await fs.writeFile(tempFile, pythonScript)

      const pythonProcess = spawn('python3', [tempFile], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      let errorOutput = ''

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString()
        console.log('Process output:', data.toString())
      })

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.error('Process error:', data.toString())
      })

      pythonProcess.on('close', async (code) => {
        // Clean up temp file
        try {
          await fs.unlink(tempFile)
        } catch (e) {
          console.warn('Could not delete temp file:', e)
        }

        console.log(`Process exited with code ${code}`)

        if (code === 0 && output.includes('SUCCESS:')) {
          try {
            const successIndex = output.indexOf('SUCCESS:')
            let jsonStr = output.substring(successIndex + 8).trim()
            
            // Find the end of the JSON (same logic as before)
            let jsonEndIndex = -1
            let braceCount = 0
            let inString = false
            let escapeNext = false
            
            for (let i = 0; i < jsonStr.length; i++) {
              const char = jsonStr[i]
              
              if (escapeNext) {
                escapeNext = false
                continue
              }
              
              if (char === '\\') {
                escapeNext = true
                continue
              }
              
              if (char === '"' && !escapeNext) {
                inString = !inString
                continue
              }
              
              if (!inString) {
                if (char === '{') {
                  braceCount++
                } else if (char === '}') {
                  braceCount--
                  if (braceCount === 0) {
                    jsonEndIndex = i + 1
                    break
                  }
                }
              }
            }
            
            if (jsonEndIndex > -1) {
              jsonStr = jsonStr.substring(0, jsonEndIndex)
            }
            
            const result = JSON.parse(jsonStr)

            res.status(200).json({
              success: true,
              data: result
            })
          } catch (parseError) {
            console.error('Parse error:', parseError)
            res.status(500).json({
              success: false,
              error: 'Failed to parse process results'
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
      console.error('Process error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to start process'
      })
    }
  } else if (action === 'bulk_download_all_coins') {
    try {
      console.log('🚀 Starting bulk download for all 50 coins (3 years)')

      // Create Python script for bulk downloading all 50 coins
      const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/lib')

from coingecko_fetcher import CoinGeckoFetcher
from ohlcv_processor import OHLCVProcessor
import json
import time

def main():
    try:
        # Get the top 50 coins from CoinGecko
        print("📋 Fetching top 50 coins list...")
        fetcher = CoinGeckoFetcher()
        
        # Get top 50 coins
        all_coins = fetcher.get_top_coins_list(limit=50)
        if not all_coins:
            print("ERROR: Failed to fetch coins list")
            return
            
        print(f"🎯 Found {len(all_coins)} coins to process")
        
        # 3 years = 1095 days
        days = 1095
        
        results = {
            "success": True,
            "total_coins": len(all_coins),
            "processed_coins": [],
            "failed_coins": [],
            "summary": {}
        }
        
        processor = OHLCVProcessor()
        
        try:
            for i, coin in enumerate(all_coins):
                coin_id = coin['id']
                coin_name = coin['name']
                coin_symbol = coin['symbol']
                
                print(f"\\n[{i+1}/{len(all_coins)}] 📡 Processing {coin_name} ({coin_symbol})...")
                
                try:
                    # Step 1: Fetch raw data from CoinGecko
                    print(f"  📥 Fetching 3 years of data for {coin_id}...")
                    fetch_success = fetcher.fetch_and_save_coin_data(coin_id, days)
                    
                    if not fetch_success:
                        print(f"  ❌ Failed to fetch data for {coin_id}")
                        results["failed_coins"].append({
                            "coin_id": coin_id,
                            "name": coin_name,
                            "symbol": coin_symbol,
                            "error": "Failed to fetch data"
                        })
                        continue
                    
                    # Step 2: Process with PySpark
                    print(f"  🔧 Processing data for {coin_id}...")
                    process_success = processor.process_coin_data(coin_id, "3y")
                    
                    if process_success:
                        # Get summary of processed data
                        processed_data = processor.get_processed_data(coin_id, "3y")
                        
                        coin_result = {
                            "coin_id": coin_id,
                            "name": coin_name,
                            "symbol": coin_symbol,
                            "data_points": processed_data.get("data_points", 0) if processed_data else 0,
                            "date_range": processed_data.get("date_range", {}) if processed_data else {}
                        }
                        
                        results["processed_coins"].append(coin_result)
                        print(f"  ✅ Successfully processed {coin_id}: {coin_result['data_points']} data points")
                    else:
                        print(f"  ❌ Failed to process data for {coin_id}")
                        results["failed_coins"].append({
                            "coin_id": coin_id,
                            "name": coin_name,
                            "symbol": coin_symbol,
                            "error": "Failed to process data"
                        })
                        
                    # Small delay to avoid hitting API limits
                    time.sleep(1)
                    
                except Exception as coin_error:
                    print(f"  💥 Error processing {coin_id}: {coin_error}")
                    results["failed_coins"].append({
                        "coin_id": coin_id,
                        "name": coin_name,
                        "symbol": coin_symbol,
                        "error": str(coin_error)
                    })
                    
        finally:
            processor.close()
        
        # Generate summary
        results["summary"] = {
            "total_processed": len(results["processed_coins"]),
            "total_failed": len(results["failed_coins"]),
            "success_rate": f"{(len(results['processed_coins']) / len(all_coins) * 100):.1f}%"
        }
        
        print(f"\\n🎉 Bulk download completed!")
        print(f"✅ Successfully processed: {results['summary']['total_processed']}")
        print(f"❌ Failed: {results['summary']['total_failed']}")
        print(f"📊 Success rate: {results['summary']['success_rate']}")
        
        print("SUCCESS:" + json.dumps(results))
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()
`

      // Write and execute Python script
      const tempDir = path.join(process.cwd(), 'temp')
      await fs.mkdir(tempDir, { recursive: true })
      const tempFile = path.join(tempDir, `bulk_download_${Date.now()}.py`)
      await fs.writeFile(tempFile, pythonScript)

      const pythonProcess = spawn('python3', [tempFile], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      let errorOutput = ''

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString()
        console.log('Bulk download output:', data.toString())
      })

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.error('Bulk download error:', data.toString())
      })

      pythonProcess.on('close', async (code) => {
        // Clean up temp file
        try {
          await fs.unlink(tempFile)
        } catch (e) {
          console.warn('Could not delete temp file:', e)
        }

        console.log(`Bulk download process exited with code ${code}`)

        if (code === 0 && output.includes('SUCCESS:')) {
          try {
            const successIndex = output.indexOf('SUCCESS:')
            let jsonStr = output.substring(successIndex + 8).trim()
            
            // Find the end of the JSON
            let jsonEndIndex = -1
            let braceCount = 0
            let inString = false
            let escapeNext = false
            
            for (let i = 0; i < jsonStr.length; i++) {
              const char = jsonStr[i]
              
              if (escapeNext) {
                escapeNext = false
                continue
              }
              
              if (char === '\\') {
                escapeNext = true
                continue
              }
              
              if (char === '"' && !escapeNext) {
                inString = !inString
                continue
              }
              
              if (!inString) {
                if (char === '{') {
                  braceCount++
                } else if (char === '}') {
                  braceCount--
                  if (braceCount === 0) {
                    jsonEndIndex = i + 1
                    break
                  }
                }
              }
            }
            
            if (jsonEndIndex > -1) {
              jsonStr = jsonStr.substring(0, jsonEndIndex)
            }
            
            const result = JSON.parse(jsonStr)

            res.status(200).json({
              success: true,
              data: result
            })
          } catch (parseError) {
            console.error('Parse error:', parseError)
            res.status(500).json({
              success: false,
              error: 'Failed to parse bulk download results'
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
      console.error('Bulk download error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to start bulk download process'
      })
    }
  } else {
    res.status(400).json({
      success: false,
      error: 'Invalid action'
    })
  }
}

async function handleDataRetrieval(req: NextApiRequest, res: NextApiResponse) {
  const { coinId, timePeriod = '1y' } = req.query

  if (!coinId) {
    return res.status(400).json({
      success: false,
      error: 'coinId is required'
    })
  }

  try {
    console.log(`📥 Retrieving processed data for ${coinId} (${timePeriod})`)

    const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/lib')

from ohlcv_processor import OHLCVProcessor
import json

def main():
    try:
        processor = OHLCVProcessor()
        
        try:
            data = processor.get_processed_data("${coinId}", "${timePeriod}")
            
            if data:
                print("SUCCESS:" + json.dumps(data))
            else:
                print("ERROR: No processed data found")
        finally:
            processor.close()
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()
`

    const tempDir = path.join(process.cwd(), 'temp')
    await fs.mkdir(tempDir, { recursive: true })
    const tempFile = path.join(tempDir, `retrieve_${coinId}_${Date.now()}.py`)
    await fs.writeFile(tempFile, pythonScript)

    const pythonProcess = spawn('python3', [tempFile], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      console.log('Python stderr:', data.toString())
    })

    pythonProcess.on('close', async (code) => {
      try {
        await fs.unlink(tempFile)
      } catch (e) {
        console.warn('Could not delete temp file:', e)
      }

      console.log('Python process output:', output)
      console.log('Python process exit code:', code)

      if (code === 0 && output.includes('SUCCESS:')) {
        try {
          const successIndex = output.indexOf('SUCCESS:')
          let jsonStr = output.substring(successIndex + 8).trim()
          
          // Find the end of the JSON by looking for the closing brace followed by a newline
          // The JSON should end with '}' and then have other text after it
          const lines = jsonStr.split('\n')
          let jsonEndIndex = -1
          let braceCount = 0
          let inString = false
          let escapeNext = false
          
          for (let i = 0; i < jsonStr.length; i++) {
            const char = jsonStr[i]
            
            if (escapeNext) {
              escapeNext = false
              continue
            }
            
            if (char === '\\') {
              escapeNext = true
              continue
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString
              continue
            }
            
            if (!inString) {
              if (char === '{') {
                braceCount++
              } else if (char === '}') {
                braceCount--
                if (braceCount === 0) {
                  jsonEndIndex = i + 1
                  break
                }
              }
            }
          }
          
          if (jsonEndIndex > -1) {
            jsonStr = jsonStr.substring(0, jsonEndIndex)
          }
          
          const result = JSON.parse(jsonStr)

          res.status(200).json({
            success: true,
            data: result
          })
        } catch (parseError) {
          console.error('Parse error:', parseError)
          console.error('Output was:', output)
          res.status(500).json({
            success: false,
            error: 'Failed to parse processed data'
          })
        }
      } else {
        const errorMsg = output.includes('ERROR:') ? output.split('ERROR:')[1].trim() : 'No processed data found'
        console.error('Python process failed:', errorMsg)
        res.status(404).json({
          success: false,
          error: errorMsg
        })
      }
    })

  } catch (error) {
    console.error('Data retrieval error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve data'
    })
  }
}