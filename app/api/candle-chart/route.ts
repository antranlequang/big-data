import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const coinId = searchParams.get('coinId') || 'bitcoin'
    const action = searchParams.get('action') || 'fetch' // fetch, update, indicators, signals
    
    const pythonScriptPath = path.join(process.cwd(), 'lib', 'candle_data_manager.py')
    
    return new Promise<NextResponse>((resolve) => {
      let output = ''
      let error = ''
      
      const python = spawn('python3', [
        '-c',
        `
import sys
sys.path.append('${path.join(process.cwd(), 'lib')}')

from candle_data_manager import CandleDataManager
from candle_technical_indicators import CandleTechnicalIndicators
import json

def main():
    try:
        manager = CandleDataManager()
        
        if '${action}' == 'update':
            # Perform daily update
            success = manager.update_daily_candle_data('${coinId}')
            if success:
                data = manager.get_candle_data_from_minio('${coinId}')
                if data:
                    print(json.dumps({
                        'success': True,
                        'message': 'Data updated successfully',
                        'data': data,
                        'coinId': '${coinId}'
                    }))
                else:
                    print(json.dumps({
                        'success': False,
                        'error': 'Failed to retrieve updated data',
                        'data': None
                    }))
            else:
                print(json.dumps({
                    'success': False,
                    'error': 'Failed to update data',
                    'data': None
                }))
        
        elif '${action}' == 'indicators':
            # Get data with technical indicators
            data = manager.get_candle_data_from_minio('${coinId}')
            if data and data.get('candle_data'):
                calculator = CandleTechnicalIndicators()
                try:
                    processed_data = calculator.calculate_all_indicators(data['candle_data'])
                    if processed_data:
                        print(json.dumps({
                            'success': True,
                            'data': {
                                **data,
                                'candle_data': processed_data,
                                'has_indicators': True
                            },
                            'coinId': '${coinId}'
                        }))
                    else:
                        print(json.dumps({
                            'success': False,
                            'error': 'Failed to calculate indicators',
                            'data': data
                        }))
                finally:
                    calculator.close()
            else:
                print(json.dumps({
                    'success': False,
                    'error': 'No candle data found',
                    'data': None
                }))
        
        elif '${action}' == 'signals':
            # Get trading signals
            data = manager.get_candle_data_from_minio('${coinId}')
            if data and data.get('candle_data'):
                calculator = CandleTechnicalIndicators()
                try:
                    processed_data = calculator.calculate_all_indicators(data['candle_data'])
                    if processed_data:
                        signals = calculator.generate_trading_signals(processed_data)
                        print(json.dumps({
                            'success': True,
                            'data': data,
                            'signals': signals,
                            'coinId': '${coinId}'
                        }))
                    else:
                        print(json.dumps({
                            'success': False,
                            'error': 'Failed to calculate signals',
                            'data': data
                        }))
                finally:
                    calculator.close()
            else:
                print(json.dumps({
                    'success': False,
                    'error': 'No candle data found for signals',
                    'data': None
                }))
        
        else:
            # Default: just fetch data
            data = manager.get_candle_data_from_minio('${coinId}')
            if data:
                print(json.dumps({
                    'success': True,
                    'data': data,
                    'coinId': '${coinId}'
                }))
            else:
                print(json.dumps({
                    'success': False,
                    'error': 'No candle data found',
                    'data': None
                }))
                
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Python execution error: {str(e)}',
            'data': None
        }))

if __name__ == "__main__":
    main()
        `
      ])
      
      python.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      python.stderr.on('data', (data) => {
        error += data.toString()
      })
      
      python.on('close', (code) => {
        try {
          if (code === 0 && output.trim()) {
            const result = JSON.parse(output.trim())
            resolve(NextResponse.json(result))
          } else {
            console.error('Python script error:', error)
            resolve(NextResponse.json({
              success: false,
              error: `Python script failed: ${error || 'Unknown error'}`,
              code,
              data: null
            }, { status: 500 }))
          }
        } catch (parseError) {
          console.error('JSON parse error:', parseError)
          console.error('Raw output:', output)
          resolve(NextResponse.json({
            success: false,
            error: `Failed to parse Python output: ${parseError}`,
            raw_output: output,
            data: null
          }, { status: 500 }))
        }
      })
      
      python.on('error', (err) => {
        resolve(NextResponse.json({
          success: false,
          error: `Failed to execute Python script: ${err.message}`,
          data: null
        }, { status: 500 }))
      })
    })
    
  } catch (error) {
    console.error('Candle chart API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      data: null
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { coinIds, action } = body
    
    if (action === 'bulk_update' && Array.isArray(coinIds)) {
      const pythonScriptPath = path.join(process.cwd(), 'lib', 'candle_data_manager.py')
      
      return new Promise<NextResponse>((resolve) => {
        let output = ''
        let error = ''
        
        const python = spawn('python3', [
          '-c',
          `
import sys
sys.path.append('${path.join(process.cwd(), 'lib')}')

from candle_data_manager import CandleDataManager
import json

def main():
    try:
        manager = CandleDataManager()
        coin_ids = ${JSON.stringify(coinIds)}
        
        # Perform bulk update
        results = manager.bulk_update_candle_data(coin_ids)
        
        success_count = sum(1 for success in results.values() if success)
        
        print(json.dumps({
            'success': True,
            'message': f'Bulk update completed: {success_count}/{len(coin_ids)} successful',
            'results': results,
            'summary': {
                'total': len(coin_ids),
                'successful': success_count,
                'failed': len(coin_ids) - success_count
            }
        }))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Bulk update error: {str(e)}',
            'results': {}
        }))

if __name__ == "__main__":
    main()
          `
        ])
        
        python.stdout.on('data', (data) => {
          output += data.toString()
        })
        
        python.stderr.on('data', (data) => {
          error += data.toString()
        })
        
        python.on('close', (code) => {
          try {
            if (code === 0 && output.trim()) {
              const result = JSON.parse(output.trim())
              resolve(NextResponse.json(result))
            } else {
              resolve(NextResponse.json({
                success: false,
                error: `Bulk update failed: ${error || 'Unknown error'}`,
                results: {}
              }, { status: 500 }))
            }
          } catch (parseError) {
            resolve(NextResponse.json({
              success: false,
              error: `Failed to parse bulk update output: ${parseError}`,
              results: {}
            }, { status: 500 }))
          }
        })
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid request. Supported actions: bulk_update with coinIds array',
        results: {}
      }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Candle chart POST API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      results: {}
    }, { status: 500 })
  }
}