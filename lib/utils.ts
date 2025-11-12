export function formatNumber(num: number): string {
  return '$' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

export function formatPercentage(num: number): string {
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
}

export function formatMarketCap(num: number): string {
  if (num >= 1e12) {
    return `$${(num / 1e12).toFixed(2)}T`
  } else if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`
  } else {
    return formatCurrency(num)
  }
}