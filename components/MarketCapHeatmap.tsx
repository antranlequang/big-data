'use client'

import React, { useState, useEffect } from 'react'

interface CoinData {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  price_change_percentage_24h: number
  market_cap_change_percentage_24h: number
  last_updated: string
}

interface TreemapNode {
  symbol: string
  value: number
  color: string
  marketCapFormatted: string
  priceChangePercent: number
  size: number // percentage of total area
}

interface MarketCapTreemapProps {
  treemapData?: any[]
  globalLoading?: boolean
  lastUpdate?: string
  sizeRatio?: number // Controls the size of the treemap (0.1 to 1.0)
}

const MarketCapTreemap: React.FC<MarketCapTreemapProps> = ({ 
  treemapData: externalData = [], 
  globalLoading = false, 
  lastUpdate: externalLastUpdate = '',
  sizeRatio = 0.8 // Default to 80% of container size
}) => {
  const [treemapNodes, setTreemapNodes] = useState<TreemapNode[]>([])
  const [error, setError] = useState<string | null>(null)

  const formatMarketCap = (value: number): string => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }

  const getColor = (changePercent: number): string => {
    if (changePercent > 0) {
      const intensity = Math.min(Math.abs(changePercent) / 10, 1)
      return `rgba(16, 185, 129, ${0.4 + intensity * 0.4})`
    } else if (changePercent < 0) {
      const intensity = Math.min(Math.abs(changePercent) / 10, 1)
      return `rgba(239, 68, 68, ${0.4 + intensity * 0.4})`
    }
    return 'rgba(107, 114, 128, 0.4)'
  }

  // Treemap squarified layout algorithm
  const createTreemapLayout = (nodes: TreemapNode[], width: number, height: number) => {
    const totalValue = nodes.reduce((sum, node) => sum + node.value, 0)
    const areas = nodes.map(n => (n.value / totalValue) * width * height)
    const layouts: Array<TreemapNode & { x: number, y: number, width: number, height: number }> = []

    let x = 0, y = 0, w = width, h = height
    let row: TreemapNode[] = []
    let rowAreas: number[] = []

    const worst = (rowAreas: number[], w: number) => {
      const sum = rowAreas.reduce((a, b) => a + b, 0)
      const max = Math.max(...rowAreas)
      const min = Math.min(...rowAreas)
      return Math.max((w * w * max) / (sum * sum), (sum * sum) / (w * w * min))
    }

    const layoutRow = (row: TreemapNode[], rowAreas: number[], x: number, y: number, w: number, h: number, horizontal: boolean) => {
      const sum = rowAreas.reduce((a, b) => a + b, 0)
      let offset = 0
      if (horizontal) {
        const rowHeight = sum / w
        for (let i = 0; i < row.length; i++) {
          const nodeWidth = rowAreas[i] / rowHeight
          layouts.push({
            ...row[i],
            x: x + offset,
            y,
            width: nodeWidth,
            height: rowHeight
          })
          offset += nodeWidth
        }
        return { x, y: y + rowHeight, w, h: h - rowHeight }
      } else {
        const colWidth = sum / h
        for (let i = 0; i < row.length; i++) {
          const nodeHeight = rowAreas[i] / colWidth
          layouts.push({
            ...row[i],
            x,
            y: y + offset,
            width: colWidth,
            height: nodeHeight
          })
          offset += nodeHeight
        }
        return { x: x + colWidth, y, w: w - colWidth, h }
      }
    }

    let horizontal = width >= height

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const area = areas[i]
      const newRow = [...row, node]
      const newAreas = [...rowAreas, area]

      if (row.length === 0 || worst(rowAreas, horizontal ? w : h) >= worst(newAreas, horizontal ? w : h)) {
        row = newRow
        rowAreas = newAreas
      } else {
        const result = layoutRow(row, rowAreas, x, y, w, h, horizontal)
        x = result.x
        y = result.y
        w = result.w
        h = result.h
        horizontal = w >= h
        row = [node]
        rowAreas = [area]
      }
    }

    if (row.length > 0) layoutRow(row, rowAreas, x, y, w, h, horizontal)

    return layouts
  }

  // Process external data and create treemap nodes
  useEffect(() => {
    if (externalData && externalData.length > 0) {
      try {
        // Sort by market cap and take top 50
        const sortedData = [...externalData]
          .sort((a, b) => b.market_cap - a.market_cap)
          .slice(0, 50)
        
        // Calculate total market cap for sizing
        const totalMarketCap = sortedData.reduce((sum, item) => sum + item.market_cap, 0)
        
        // Convert to treemap nodes
        const processedNodes: TreemapNode[] = sortedData.map(item => ({
          symbol: item.symbol.toUpperCase(),
          value: item.market_cap,
          size: (item.market_cap / totalMarketCap) * 100,
          marketCapFormatted: formatMarketCap(item.market_cap),
          priceChangePercent: item.price_change_percentage_24h || 0,
          color: getColor(item.price_change_percentage_24h || 0)
        }))

        setTreemapNodes(processedNodes)
        console.log(`📊 Updated treemap data for ${processedNodes.length} coins`)
      } catch (error) {
        setError('Error processing treemap data')
        console.error('❌ Error processing treemap data:', error)
      }
    }
  }, [externalData])

  if (globalLoading && treemapNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-yellow-500 rounded">
        <div className="text-center">
          <div className="animate-spin text-2xl mb-2">⏳</div>
          <div className="text-slate-400 text-sm">Loading...</div>
        </div>
      </div>
    )
  }

  if (error && treemapNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-500">
        <div className="text-center">
          <div className="text-2xl mb-2">❌</div>
          <div className="text-slate-400 text-sm mb-2">{error}</div>
          <div className="text-slate-400 text-xs">Check main data refresh</div>
        </div>
      </div>
    )
  }

  // Calculate container dimensions
  const containerWidth = 1325
  const containerHeight = 750

  // Generate layout for treemap nodes
  const layouts = createTreemapLayout(treemapNodes, containerWidth, containerHeight)

  return (
    <div className="relative w-full h-[90vh] bg-black overflow-hidden flex items-start justify-center mt-3">
      <div 
        className="relative"
        style={{ 
          width: containerWidth,
          height: containerHeight,
          border: '1px solid #374151'
        }}
      >
        {layouts.map((node, index) => (
          <div
            key={node.symbol}
            className="absolute border border-white flex flex-col items-center justify-center text-white cursor-pointer hover:brightness-110 transition-all duration-200"
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              backgroundColor: node.color,
              fontSize: Math.max(8, Math.min(node.width / 8, 14)),
              minHeight: '30px'
            }}
            title={`${node.symbol}: ${node.marketCapFormatted} (${node.priceChangePercent >= 0 ? '+' : ''}${node.priceChangePercent.toFixed(2)}%)`}
          >
            <div className="font-bold text-center leading-tight">
              {node.symbol}
            </div>
            {node.width > 80 && node.height > 40 && (
              <div className="text-xs text-center leading-tight">
                {node.marketCapFormatted}
              </div>
            )}
            {node.width > 100 && node.height > 60 && (
              <div className={`text-xs font-bold ${node.priceChangePercent >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                {node.priceChangePercent >= 0 ? '+' : ''}{node.priceChangePercent.toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>
      
      {globalLoading && (
        <div className="absolute top-2 right-2 bg-gray-800/80 rounded px-2 py-1">
          <div className="animate-spin text-orange-400 text-xs">⟳</div>
        </div>
      )}
    </div>
  )
}

export default MarketCapTreemap