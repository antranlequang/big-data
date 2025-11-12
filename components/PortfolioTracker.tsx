'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts'

interface PortfolioHolding {
  id: string
  symbol: string
  name: string
  amount: number
  purchasePrice: number
  currentPrice: number
  value: number
  pnl: number
  pnlPercentage: number
}

interface PortfolioTrackerProps {
  cryptoData: any[]
}

export default function PortfolioTracker({ cryptoData }: PortfolioTrackerProps) {
  const [portfolio, setPortfolio] = useState<PortfolioHolding[]>([])
  const [newHolding, setNewHolding] = useState({
    coinId: '',
    amount: '',
    purchasePrice: ''
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [totalValue, setTotalValue] = useState(0)
  const [totalPnL, setTotalPnL] = useState(0)
  const [totalPnLPercentage, setTotalPnLPercentage] = useState(0)

  // Colors for the pie chart
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0', '#ffb347', '#87d68d']

  // Load portfolio from localStorage on mount
  useEffect(() => {
    const savedPortfolio = localStorage.getItem('cryptoPortfolio')
    if (savedPortfolio) {
      try {
        const parsed = JSON.parse(savedPortfolio)
        setPortfolio(parsed)
      } catch (error) {
        console.error('Error loading portfolio:', error)
      }
    }
  }, [])

  // Save portfolio to localStorage whenever it changes
  useEffect(() => {
    if (portfolio.length > 0) {
      localStorage.setItem('cryptoPortfolio', JSON.stringify(portfolio))
    }
  }, [portfolio])

  // Update portfolio with current prices and calculate totals
  useEffect(() => {
    if (portfolio.length > 0 && cryptoData.length > 0) {
      const updatedPortfolio = portfolio.map(holding => {
        const currentCoin = cryptoData.find(coin => coin.id === holding.id)
        if (currentCoin) {
          const currentPrice = currentCoin.current_price
          const value = holding.amount * currentPrice
          const pnl = value - (holding.amount * holding.purchasePrice)
          const pnlPercentage = ((currentPrice - holding.purchasePrice) / holding.purchasePrice) * 100

          return {
            ...holding,
            currentPrice,
            value,
            pnl,
            pnlPercentage
          }
        }
        return holding
      })

      setPortfolio(updatedPortfolio)

      // Calculate totals
      const totalPortfolioValue = updatedPortfolio.reduce((sum, holding) => sum + holding.value, 0)
      const totalPortfolioPnL = updatedPortfolio.reduce((sum, holding) => sum + holding.pnl, 0)
      const totalInvestment = updatedPortfolio.reduce((sum, holding) => sum + (holding.amount * holding.purchasePrice), 0)
      const totalPortfolioPnLPercentage = totalInvestment > 0 ? (totalPortfolioPnL / totalInvestment) * 100 : 0

      setTotalValue(totalPortfolioValue)
      setTotalPnL(totalPortfolioPnL)
      setTotalPnLPercentage(totalPortfolioPnLPercentage)
    }
  }, [cryptoData, portfolio.length])

  const addHolding = () => {
    if (!newHolding.coinId || !newHolding.amount || !newHolding.purchasePrice) {
      alert('Please fill in all fields')
      return
    }

    const selectedCoin = cryptoData.find(coin => coin.id === newHolding.coinId)
    if (!selectedCoin) {
      alert('Selected coin not found')
      return
    }

    const amount = parseFloat(newHolding.amount)
    const purchasePrice = parseFloat(newHolding.purchasePrice)
    const currentPrice = selectedCoin.current_price
    const value = amount * currentPrice
    const pnl = value - (amount * purchasePrice)
    const pnlPercentage = ((currentPrice - purchasePrice) / purchasePrice) * 100

    const holding: PortfolioHolding = {
      id: selectedCoin.id,
      symbol: selectedCoin.symbol.toUpperCase(),
      name: selectedCoin.name,
      amount,
      purchasePrice,
      currentPrice,
      value,
      pnl,
      pnlPercentage
    }

    // Check if holding already exists, if so, update it
    const existingIndex = portfolio.findIndex(h => h.id === holding.id)
    if (existingIndex >= 0) {
      const updatedPortfolio = [...portfolio]
      const existing = updatedPortfolio[existingIndex]
      const totalAmount = existing.amount + amount
      const avgPurchasePrice = ((existing.amount * existing.purchasePrice) + (amount * purchasePrice)) / totalAmount
      
      updatedPortfolio[existingIndex] = {
        ...holding,
        amount: totalAmount,
        purchasePrice: avgPurchasePrice,
        value: totalAmount * currentPrice,
        pnl: (totalAmount * currentPrice) - (totalAmount * avgPurchasePrice),
        pnlPercentage: ((currentPrice - avgPurchasePrice) / avgPurchasePrice) * 100
      }
      setPortfolio(updatedPortfolio)
    } else {
      setPortfolio(prev => [...prev, holding])
    }

    // Reset form
    setNewHolding({ coinId: '', amount: '', purchasePrice: '' })
    setShowAddForm(false)
  }

  const removeHolding = (id: string) => {
    setPortfolio(prev => prev.filter(h => h.id !== id))
    if (portfolio.length === 1) {
      localStorage.removeItem('cryptoPortfolio')
    }
  }

  const clearPortfolio = () => {
    if (confirm('Are you sure you want to clear your entire portfolio?')) {
      setPortfolio([])
      localStorage.removeItem('cryptoPortfolio')
    }
  }

  // Prepare data for charts
  const pieChartData = portfolio.map(holding => ({
    name: holding.symbol,
    value: holding.value,
    percentage: ((holding.value / totalValue) * 100).toFixed(1)
  }))

  const barChartData = portfolio.map(holding => ({
    name: holding.symbol,
    pnl: holding.pnl,
    pnlPercentage: holding.pnlPercentage
  }))

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              ${totalValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${totalPnL.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Total P&L %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnLPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnLPercentage.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {portfolio.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Holdings Controls */}
      <Card className="bg-slate-800/50 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            Portfolio Management
            <div className="flex gap-2">
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {showAddForm ? 'Cancel' : 'Add Holding'}
              </Button>
              {portfolio.length > 0 && (
                <Button
                  onClick={clearPortfolio}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        {showAddForm && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-slate-300 text-sm">Cryptocurrency</label>
                <select
                  value={newHolding.coinId}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, coinId: e.target.value }))}
                  className="w-full bg-slate-600 text-white rounded px-3 py-2 mt-1"
                >
                  <option value="">Select coin...</option>
                  {cryptoData.map(coin => (
                    <option key={coin.id} value={coin.id}>
                      {coin.symbol.toUpperCase()} - {coin.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-300 text-sm">Amount</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.0"
                  value={newHolding.amount}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full bg-slate-600 text-white rounded px-3 py-2 mt-1"
                />
              </div>
              <div>
                <label className="text-slate-300 text-sm">Purchase Price ($)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.0"
                  value={newHolding.purchasePrice}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, purchasePrice: e.target.value }))}
                  className="w-full bg-slate-600 text-white rounded px-3 py-2 mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addHolding}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Add Holding
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {portfolio.length > 0 && (
        <>
          {/* Portfolio Allocation & Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portfolio Allocation Pie Chart */}
            <Card className="bg-slate-800/50 border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-white">Portfolio Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* P&L Performance Chart */}
            <Card className="bg-slate-800/50 border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-white">P&L Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F3F4F6'
                      }}
                      formatter={(value: any, name: string) => [
                        name === 'pnl' ? `$${value.toFixed(2)}` : `${value.toFixed(2)}%`,
                        name === 'pnl' ? 'P&L ($)' : 'P&L (%)'
                      ]}
                    />
                    <Bar dataKey="pnl" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Holdings Table */}
          <Card className="bg-slate-800/50 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white">Holdings Detail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="pb-2 text-slate-300">Asset</th>
                      <th className="pb-2 text-slate-300">Amount</th>
                      <th className="pb-2 text-slate-300">Purchase Price</th>
                      <th className="pb-2 text-slate-300">Current Price</th>
                      <th className="pb-2 text-slate-300">Value</th>
                      <th className="pb-2 text-slate-300">P&L</th>
                      <th className="pb-2 text-slate-300">P&L %</th>
                      <th className="pb-2 text-slate-300">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map(holding => (
                      <tr key={holding.id} className="border-b border-slate-700">
                        <td className="py-3">
                          <div>
                            <div className="font-semibold text-white">{holding.symbol}</div>
                            <div className="text-sm text-slate-400">{holding.name}</div>
                          </div>
                        </td>
                        <td className="py-3 text-white">{holding.amount.toFixed(4)}</td>
                        <td className="py-3 text-white">${holding.purchasePrice.toFixed(2)}</td>
                        <td className="py-3 text-white">${holding.currentPrice.toFixed(2)}</td>
                        <td className="py-3 text-white">${holding.value.toFixed(2)}</td>
                        <td className={`py-3 ${holding.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${holding.pnl.toFixed(2)}
                        </td>
                        <td className={`py-3 ${holding.pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {holding.pnlPercentage.toFixed(2)}%
                        </td>
                        <td className="py-3">
                          <Button
                            onClick={() => removeHolding(holding.id)}
                            className="bg-red-600 hover:bg-red-700 text-xs px-2 py-1"
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {portfolio.length === 0 && !showAddForm && (
        <Card className="bg-slate-800/50 border-purple-500/30">
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Holdings Yet</h3>
            <p className="text-slate-400 mb-4">Start tracking your cryptocurrency portfolio by adding your first holding.</p>
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Add Your First Holding
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}