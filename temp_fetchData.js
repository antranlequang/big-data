  // Fetch crypto data using the new data pipeline
  const fetchData = async () => {
    setLoading(true)
    try {
      if (useDemo) {
        // Demo mode - use generated data
        console.log('📊 Using demo data mode')
        const demoData = generateDemoData(240)
        setHistoricalData(demoData)
        setDataSource('demo')
        
        // Create mock current data for metrics
        if (demoData.length > 0) {
          const latest = demoData[demoData.length - 1]
          const mockCoins = [
            { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
            { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
            { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
            { id: 'solana', name: 'Solana', symbol: 'SOL' },
            { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' }
          ]
          setAvailableCoins(mockCoins)
          
          setCryptoData([{
            id: selectedCoin,
            symbol: mockCoins.find(c => c.id === selectedCoin)?.symbol || 'BTC',
            name: mockCoins.find(c => c.id === selectedCoin)?.name || 'Bitcoin',
            current_price: latest.price_usd,
            market_cap: latest.market_cap,
            total_volume: latest.volume_24h,
            price_change_percentage_1h_in_currency: latest.price_change_1h || 0,
            price_change_percentage_24h_in_currency: latest.price_change_24h || 0,
            price_change_percentage_7d_in_currency: latest.price_change_7d || 0,
            high_24h: latest.price_usd * 1.05,
            low_24h: latest.price_usd * 0.95,
            last_updated: latest.timestamp
          }])
        }
      } else {
        // Use processed clean data from PySpark pipeline
        console.log('🏭 Using processed pipeline data')
        try {
          // First try to get processed data
          const processedResponse = await fetch(`/api/processed-data?coinId=${selectedCoin}&limit=200&format=chart`)
          const processedResult = await processedResponse.json()
          
          if (processedResult.success && processedResult.data.length > 0) {
            console.log(`✅ Loaded ${processedResult.data.length} processed records for ${selectedCoin}`)
            
            // Set historical data for charts
            setHistoricalData(processedResult.data)
            setDataMetadata(processedResult.metadata)
            setDataSource('processed')
            
            // Get current data for all coins
            const currentResponse = await fetch('/api/processed-data?format=current&limit=50')
            const currentResult = await currentResponse.json()
            
            if (currentResult.success && currentResult.data.length > 0) {
              setCryptoData(currentResult.data)
              
              // Update available coins dropdown
              const uniqueCoins = currentResult.data.map((item: any) => ({
                id: item.id,
                name: item.name,
                symbol: item.symbol
              }))
              setAvailableCoins(uniqueCoins)
              
              console.log(`📈 Loaded current data for ${uniqueCoins.length} coins`)
            }
            
          } else {
            console.log('⚠️ No processed data available, falling back to MinIO')
            throw new Error('No processed data')
          }
          
        } catch (processedError) {
          console.log('🔄 Falling back to MinIO data...')
          setDataSource('minio')
          
          // Fallback to MinIO data
          try {
            const response = await fetch('/api/crypto')
            if (response.ok) {
              const result = await response.json()
              if (result.success && result.data.length > 0) {
                const minioData = result.data
                
                // Filter data for selected coin
                const coinData = minioData.filter((item: any) => item.id === selectedCoin)
                
                if (coinData.length > 0) {
                  // Convert to historical data format
                  const historicalData = coinData.map((item: any) => ({
                    timestamp: item.timestamp,
                    price_usd: item.price_usd,
                    market_cap: item.market_cap,
                    volume_24h: item.volume_24h,
                    price_change_1h: item.price_change_1h,
                    price_change_24h: item.price_change_24h,
                    price_change_7d: item.price_change_7d
                  }))
                  
                  setHistoricalData(historicalData)
                  
                  // Create current crypto data
                  const latestData = coinData[coinData.length - 1]
                  setCryptoData([{
                    id: latestData.id,
                    symbol: latestData.symbol,
                    name: latestData.name,
                    current_price: latestData.price_usd,
                    market_cap: latestData.market_cap,
                    total_volume: latestData.volume_24h,
                    price_change_percentage_1h_in_currency: latestData.price_change_1h,
                    price_change_percentage_24h_in_currency: latestData.price_change_24h,
                    price_change_percentage_7d_in_currency: latestData.price_change_7d,
                    high_24h: latestData.high_24h,
                    low_24h: latestData.low_24h,
                    last_updated: latestData.last_updated
                  }])
                  
                  // Update available coins
                  const uniqueCoins = Array.from(
                    new Map(minioData.map((item: any) => [item.id, item])).values()
                  )
                  const uniqueCoinsForDropdown = uniqueCoins.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    symbol: item.symbol
                  }))
                  setAvailableCoins(uniqueCoinsForDropdown)
                  
                } else {
                  console.log('No data found for selected coin, using demo')
                  setHistoricalData(generateDemoData(24))
                  setDataSource('demo')
                }
              } else {
                console.log('No MinIO data available, using demo')
                setHistoricalData(generateDemoData(24))
                setDataSource('demo')
              }
            } else {
              console.log('MinIO API failed, using demo')
              setHistoricalData(generateDemoData(24))
              setDataSource('demo')
            }
          } catch (minioError) {
            console.error('MinIO error, using demo:', minioError)
            setHistoricalData(generateDemoData(24))
            setDataSource('demo')
          }
        }
      }
      
      setLastUpdate(new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Error fetching data:', error)
      setHistoricalData(generateDemoData(24))
      setDataSource('demo')
    } finally {
      setLoading(false)
    }
  }