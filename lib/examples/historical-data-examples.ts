/**
 * Historical Data Usage Examples
 * 
 * This file demonstrates various ways to use the historical data integration
 */

import { fetchHistoricalData, fetchHistoricalRange, formatHistoricalDataForAI } from '@/lib/coingecko-history'

// ============================================================================
// EXAMPLE 1: Basic Historical Data Fetch
// ============================================================================

export async function example1_BasicFetch() {
  console.log('Example 1: Fetching 1 year of Bitcoin data')
  
  const result = await fetchHistoricalData('bitcoin', 365)
  
  if (result.ok) {
    console.log(`✅ Successfully fetched ${result.dataPoints} data points`)
    console.log(`Current Price: $${result.statistics?.currentPrice}`)
    console.log(`1Y Change: ${result.statistics?.priceChangePercent}%`)
    console.log(`Volatility: ${result.statistics?.volatility}%`)
  } else {
    console.error(`❌ Error: ${result.error}`)
  }
  
  return result
}

// ============================================================================
// EXAMPLE 2: Maximum Available History
// ============================================================================

export async function example2_MaxHistory() {
  console.log('Example 2: Fetching all available Ethereum data')
  
  const result = await fetchHistoricalData('ethereum', 'max')
  
  if (result.ok) {
    const firstPoint = result.data[0]
    const lastPoint = result.data[result.data.length - 1]
    
    console.log(`✅ Data from ${firstPoint.date} to ${lastPoint.date}`)
    console.log(`Total data points: ${result.dataPoints}`)
    console.log(`Price then: $${firstPoint.price}`)
    console.log(`Price now: $${lastPoint.price}`)
    
    const totalChange = ((lastPoint.price - firstPoint.price) / firstPoint.price) * 100
    console.log(`Total change: ${totalChange.toFixed(2)}%`)
  }
  
  return result
}

// ============================================================================
// EXAMPLE 3: Custom Date Range
// ============================================================================

export async function example3_DateRange() {
  console.log('Example 3: Fetching data for specific date range')
  
  const result = await fetchHistoricalRange(
    'avalanche-2',
    '2024-01-01',
    '2024-06-30'
  )
  
  if (result.ok) {
    console.log(`✅ Fetched ${result.dataPoints} points for 6 months`)
    console.log(`Data covers ${result.days} days`)
  }
  
  return result
}

// ============================================================================
// EXAMPLE 4: Using OHLCV Data for Charting
// ============================================================================

export async function example4_OHLCVData() {
  console.log('Example 4: Getting OHLCV candlestick data')
  
  const result = await fetchHistoricalData('bitcoin', 90, true) // includeOHLCV = true
  
  if (result.ok && result.ohlcv) {
    console.log(`✅ ${result.ohlcv.length} candlesticks available`)
    
    // Get last 5 candles
    const recentCandles = result.ohlcv.slice(-5)
    console.log('\nRecent candles:')
    recentCandles.forEach(candle => {
      console.log(`${candle.date}: O:$${candle.open.toFixed(2)} H:$${candle.high.toFixed(2)} L:$${candle.low.toFixed(2)} C:$${candle.close.toFixed(2)}`)
    })
    
    // Can be used with charting libraries
    return result.ohlcv
  }
}

// ============================================================================
// EXAMPLE 5: AI-Ready Format
// ============================================================================

export async function example5_AIFormat() {
  console.log('Example 5: Formatting data for AI consumption')
  
  const result = await fetchHistoricalData('avalanche-2', 365)
  const formatted = formatHistoricalDataForAI(result)
  
  console.log('Formatted for AI:')
  console.log(formatted)
  
  // This format is perfect for including in LLM prompts
  return formatted
}

// ============================================================================
// EXAMPLE 6: Trend Analysis
// ============================================================================

export async function example6_TrendAnalysis() {
  console.log('Example 6: Analyzing price trends')
  
  const result = await fetchHistoricalData('ethereum', 180) // 6 months
  
  if (result.ok && result.statistics) {
    const { statistics } = result
    
    // Determine trend
    const trend = statistics.priceChangePercent > 0 ? 'BULLISH 📈' : 'BEARISH 📉'
    
    // Determine volatility level
    let volatilityLevel = 'LOW'
    if (statistics.volatility > 10) volatilityLevel = 'HIGH'
    else if (statistics.volatility > 5) volatilityLevel = 'MEDIUM'
    
    console.log(`\n=== TREND ANALYSIS ===`)
    console.log(`Trend: ${trend}`)
    console.log(`Volatility: ${volatilityLevel} (${statistics.volatility.toFixed(2)}%)`)
    console.log(`Current: $${statistics.currentPrice.toFixed(2)}`)
    console.log(`High: $${statistics.highestPrice.toFixed(2)}`)
    console.log(`Low: $${statistics.lowestPrice.toFixed(2)}`)
    console.log(`Change: ${statistics.priceChangePercent >= 0 ? '+' : ''}${statistics.priceChangePercent.toFixed(2)}%`)
    
    return {
      trend,
      volatilityLevel,
      statistics
    }
  }
}

// ============================================================================
// EXAMPLE 7: Comparative Analysis
// ============================================================================

export async function example7_CompareCoins() {
  console.log('Example 7: Comparing multiple cryptocurrencies')
  
  const coins = ['bitcoin', 'ethereum', 'avalanche-2']
  const results = await Promise.all(
    coins.map(coin => fetchHistoricalData(coin, 90))
  )
  
  console.log('\n=== 90-DAY COMPARISON ===')
  
  results.forEach((result, index) => {
    if (result.ok && result.statistics) {
      const coin = coins[index].toUpperCase()
      const change = result.statistics.priceChangePercent
      const emoji = change >= 0 ? '📈' : '📉'
      
      console.log(`\n${coin} ${emoji}`)
      console.log(`  Price: $${result.statistics.currentPrice.toFixed(2)}`)
      console.log(`  Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`)
      console.log(`  Volatility: ${result.statistics.volatility.toFixed(2)}%`)
    }
  })
  
  // Find best performer
  const validResults = results.filter(r => r.ok && r.statistics)
  const bestPerformer = validResults.reduce((best, current) => {
    if (!best.statistics || !current.statistics) return best
    return current.statistics.priceChangePercent > best.statistics.priceChangePercent
      ? current
      : best
  })
  
  console.log(`\n🏆 Best Performer: ${bestPerformer.coin.toUpperCase()}`)
  console.log(`   Return: +${bestPerformer.statistics?.priceChangePercent.toFixed(2)}%`)
  
  return validResults
}

// ============================================================================
// EXAMPLE 8: Moving Average Calculation
// ============================================================================

export async function example8_MovingAverage() {
  console.log('Example 8: Calculating moving averages')
  
  const result = await fetchHistoricalData('bitcoin', 30)
  
  if (result.ok && result.data.length >= 7) {
    const prices = result.data.map(d => d.price)
    
    // 7-day moving average
    const sma7 = calculateSMA(prices, 7)
    console.log(`7-day SMA: $${sma7.toFixed(2)}`)
    
    // 14-day moving average
    const sma14 = calculateSMA(prices, 14)
    console.log(`14-day SMA: $${sma14.toFixed(2)}`)
    
    // Current price vs SMA
    const currentPrice = prices[prices.length - 1]
    const signal = currentPrice > sma7 ? 'ABOVE' : 'BELOW'
    console.log(`\nCurrent price is ${signal} 7-day SMA`)
    
    return { sma7, sma14, currentPrice }
  }
}

// Helper: Simple Moving Average
function calculateSMA(prices: number[], period: number): number {
  const recentPrices = prices.slice(-period)
  return recentPrices.reduce((a, b) => a + b, 0) / period
}

// ============================================================================
// EXAMPLE 9: Support/Resistance Levels
// ============================================================================

export async function example9_SupportResistance() {
  console.log('Example 9: Finding support and resistance levels')
  
  const result = await fetchHistoricalData('ethereum', 90)
  
  if (result.ok && result.statistics) {
    const { statistics, data } = result
    
    // Calculate price levels
    const priceRange = statistics.highestPrice - statistics.lowestPrice
    const resistance = statistics.highestPrice
    const support = statistics.lowestPrice
    const midPoint = (resistance + support) / 2
    
    console.log('\n=== PRICE LEVELS ===')
    console.log(`Resistance: $${resistance.toFixed(2)}`)
    console.log(`Mid-point:  $${midPoint.toFixed(2)}`)
    console.log(`Support:    $${support.toFixed(2)}`)
    console.log(`Range:      $${priceRange.toFixed(2)}`)
    
    // Current position
    const current = statistics.currentPrice
    const position = ((current - support) / priceRange) * 100
    console.log(`\nCurrent price is ${position.toFixed(1)}% within range`)
    
    return { resistance, support, midPoint, current, position }
  }
}

// ============================================================================
// EXAMPLE 10: Error Handling
// ============================================================================

export async function example10_ErrorHandling() {
  console.log('Example 10: Proper error handling')
  
  const coins = ['bitcoin', 'invalid-coin-xyz', 'ethereum']
  
  for (const coin of coins) {
    const result = await fetchHistoricalData(coin, 30)
    
    if (result.ok) {
      console.log(`✅ ${coin}: ${result.dataPoints} points`)
    } else {
      console.log(`❌ ${coin}: ${result.error}`)
      
      // Handle specific error types
      if (result.error?.includes('not found')) {
        console.log(`   → Try checking the coin name or use CoinGecko ID`)
      }
    }
  }
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

export async function runAllExamples() {
  console.log('\n🚀 Running all historical data examples...\n')
  
  const examples = [
    example1_BasicFetch,
    example2_MaxHistory,
    example3_DateRange,
    example4_OHLCVData,
    example5_AIFormat,
    example6_TrendAnalysis,
    example7_CompareCoins,
    example8_MovingAverage,
    example9_SupportResistance,
    example10_ErrorHandling
  ]
  
  for (const example of examples) {
    console.log('\n' + '='.repeat(60))
    await example()
    console.log('='.repeat(60))
    await delay(1000) // Rate limiting
  }
  
  console.log('\n✅ All examples completed!\n')
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// USAGE IN API ROUTES
// ============================================================================

// Example: Using in Next.js API route
export async function apiRouteExample(req: Request) {
  const url = new URL(req.url)
  const coin = url.searchParams.get('coin') || 'bitcoin'
  
  const data = await fetchHistoricalData(coin, 365)
  
  if (data.ok) {
    return Response.json({
      success: true,
      coin: data.coin,
      summary: formatHistoricalDataForAI(data),
      statistics: data.statistics
    })
  } else {
    return Response.json({
      success: false,
      error: data.error
    }, { status: 400 })
  }
}

// ============================================================================
// USAGE IN CHAT/AI CONTEXT
// ============================================================================

export async function enrichAIPrompt(userQuery: string) {
  // Detect coin mention
  const coinMatch = userQuery.match(/\b(bitcoin|ethereum|avax|btc|eth)\b/i)
  
  if (coinMatch) {
    const coin = coinMatch[1].toLowerCase()
    const data = await fetchHistoricalData(coin, 90) // 3 months context
    
    if (data.ok) {
      const context = formatHistoricalDataForAI(data)
      
      // Enhanced prompt with historical context
      return `
User Query: ${userQuery}

Historical Data Context:
${context}

Please provide analysis based on this historical data.
      `.trim()
    }
  }
  
  return userQuery
}
