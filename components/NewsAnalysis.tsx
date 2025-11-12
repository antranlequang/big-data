'use client'

import React, { useState, useEffect } from 'react'

interface NewsItem {
  id: number
  title: string
  url: string
  source: string
  content: string
  publishedAt: string
  sentiment_category: string
  sentiment_score: number
  sentiment_label: string
}

interface NewsData {
  positive: NewsItem[]
  neutral: NewsItem[]
  negative: NewsItem[]
  total: number
  summary: {
    positive_count: number
    neutral_count: number
    negative_count: number
  }
}

interface NewsAnalysisProps {
  className?: string
}

export default function NewsAnalysis({ className }: NewsAnalysisProps) {
  const [newsData, setNewsData] = useState<NewsData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchNewsData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/news-analysis?days=3') // Get news from last 3 days
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setNewsData(result.data)
          setLastUpdate(new Date().toLocaleTimeString())
          console.log('Fetched news data:', result.data)
        } else {
          console.error('API returned error:', result.error)
        }
      } else {
        console.error('Failed to fetch news:', response.status)
      }
    } catch (error) {
      console.error('Error fetching news data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNewsData()
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchNewsData, 300000)
    return () => clearInterval(interval)
  }, [])

  const getSentimentColor = (sentiment_category: string) => {
    switch (sentiment_category) {
      case 'positive': return 'text-emerald-400'
      case 'neutral': return 'text-yellow-400'  
      case 'negative': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getSentimentBg = (sentiment_category: string) => {
    switch (sentiment_category) {
      case 'positive': return 'bg-emerald-900/20 border-emerald-600/30'
      case 'neutral': return 'bg-yellow-900/20 border-yellow-600/30'
      case 'negative': return 'bg-red-900/20 border-red-600/30'
      default: return 'bg-gray-900/20 border-gray-600/30'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const publishedDate = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) { // 24 hours
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  const NewsCard = ({ news }: { news: NewsItem }) => (
    <div className={`p-4 rounded-lg border ${getSentimentBg(news.sentiment_category)} hover:bg-gray-800/50 transition-colors`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500 font-medium">{news.source}</span>
        <span className={`text-xs font-bold ${getSentimentColor(news.sentiment_category)}`}>
          {news.sentiment_label}
        </span>
      </div>
      
      <h3 className="text-sm font-medium text-white mb-2 line-clamp-3 leading-relaxed">
        {news.title}
      </h3>
      
      <div className="text-xs text-gray-400 mb-3">
        📅 {formatTimeAgo(news.publishedAt)}
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Score:</span>
          <span className={`text-sm font-bold ${getSentimentColor(news.sentiment_category)}`}>
            {(news.sentiment_score * 100).toFixed(0)}%
          </span>
        </div>
        <a 
          href={news.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Read More →
        </a>
      </div>
    </div>
  )

  if (loading && !newsData) {
    return (
      <div className={`bg-gray-950 ${className || ''} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-gray-400">Loading news analysis...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-950 ${className || ''} flex flex-col h-full`}>
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-800/50 bg-gray-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold text-sm">NEWS SENTIMENT ANALYSIS</span>
            {loading && (
              <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Real-time • Auto-refresh</span>
            {lastUpdate && (
              <div className="text-xs text-gray-400">
                Updated: {lastUpdate}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {newsData && (
        <div className="px-4 py-3 border-b border-gray-800/50 bg-gray-900/20">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-emerald-400 font-bold text-lg">{newsData.summary.positive_count}</div>
              <div className="text-xs text-gray-400">Positive</div>
            </div>
            <div>
              <div className="text-yellow-400 font-bold text-lg">{newsData.summary.neutral_count}</div>
              <div className="text-xs text-gray-400">Neutral</div>
            </div>
            <div>
              <div className="text-red-400 font-bold text-lg">{newsData.summary.negative_count}</div>
              <div className="text-xs text-gray-400">Negative</div>
            </div>
            <div>
              <div className="text-white font-bold text-lg">{newsData.total}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
          </div>
        </div>
      )}

      {/* Three Column Layout */}
      {newsData && (
        <div className="flex-1 grid grid-cols-3 gap-0.5 bg-gray-800 p-0.5 h-full overflow-y-auto">
          {/* Positive News */}
          <div className="bg-gray-950 flex flex-col h-full">
            <div className="px-4 py-2 border-b border-emerald-600/30 bg-emerald-900/20">
              <h2 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-400 rounded-full"></span>
                POSITIVE NEWS
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-emerald">
              {newsData.positive.map((news) => (
                <NewsCard key={news.id} news={news} />
              ))}
              {newsData.positive.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No positive news available
                </div>
              )}
            </div>
          </div>

          {/* Neutral News */}
          <div className="bg-gray-950 flex flex-col h-full">
            <div className="px-4 py-2 border-b border-yellow-600/30 bg-yellow-900/20">
              <h2 className="text-yellow-400 font-bold text-sm flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                NEUTRAL NEWS
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-yellow">
              {newsData.neutral.map((news) => (
                <NewsCard key={news.id} news={news} />
              ))}
              {newsData.neutral.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No neutral news available
                </div>
              )}
            </div>
          </div>

          {/* Negative News */}
          <div className="bg-gray-950 flex flex-col h-full">
            <div className="px-4 py-2 border-b border-red-600/30 bg-red-900/20">
              <h2 className="text-red-400 font-bold text-sm flex items-center gap-2">
                <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                NEGATIVE NEWS
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-red">
              {newsData.negative.map((news) => (
                <NewsCard key={news.id} news={news} />
              ))}
              {newsData.negative.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No negative news available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}