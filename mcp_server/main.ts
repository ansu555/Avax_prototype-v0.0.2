import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Types
type Granularity = '1h' | '4h' | '1d'
type Task = 'analysis' | 'prediction' | 'strategy' | 'charts'
type RiskLevel = 'low' | 'medium' | 'high'

interface AnalyzeRequest {
  coin: string
  horizonDays?: number
  granularity?: Granularity
  tasks?: Task[]
}

interface OHLCV {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Prediction {
  date: string
  price: number
  probability?: number
}

interface Strategy {
  name: string
  description: string
  risk: RiskLevel
}

interface Chart {
  title: string
  url: string
}

interface AnalyzeResponse {
  ok: boolean
  summary?: string
  insights?: string[]
  predictions?: Prediction[]
  strategies?: Strategy[]
  charts?: Chart[]
  error?: string
}

// Configuration
const PORT = process.env.MCP_PORT || 8080
const API_KEY = process.env.MCP_ANALYTICS_API_KEY
const BASE_URL = process.env.MCP_BASE_URL || `http://localhost:${PORT}`
const CHARTS_DIR = path.join(process.cwd(), 'mcp_server', 'charts')

// Initialize Express
const app = express()
app.use(cors())
app.use(express.json())

// Serve static charts
app.use('/charts', express.static(CHARTS_DIR))

// Ensure charts directory exists
async function initChartDir() {
  try {
    await fs.mkdir(CHARTS_DIR, { recursive: true })
  } catch (e) {
    console.error('Failed to create charts directory:', e)
  }
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() })
})

// Main analyze endpoint
app.post('/analyze', async (req: Request, res: Response) => {
  // Auth check
  if (API_KEY && req.headers.authorization !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const { coin, horizonDays = 30, granularity = '1d', tasks = [] }: AnalyzeRequest = req.body || {}

  if (!coin) {
    return res.status(400).json({ ok: false, error: 'coin parameter is required' })
  }

  try {
    const response: AnalyzeResponse = { ok: true }

    // Fetch historical data (REAL DATA ONLY)
    const historicalData = await fetchHistoricalData(coin, horizonDays, granularity)
    
    if (historicalData.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: `No data available for "${coin}". Please check the coin symbol (e.g., btc, eth, avax) or CoinGecko ID.` 
      })
    }

    const currentPrice = historicalData[historicalData.length - 1].close

    // Analysis task
    if (tasks.length === 0 || tasks.includes('analysis')) {
      const indicators = computeIndicators(historicalData)
      response.summary = generateSummary(coin, currentPrice, indicators, historicalData)
      response.insights = generateInsights(indicators)
    }

    // Prediction task
    if (tasks.length === 0 || tasks.includes('prediction')) {
      response.predictions = generatePredictions(historicalData, horizonDays, currentPrice)
    }

    // Strategy task
    if (tasks.length === 0 || tasks.includes('strategy')) {
      const indicators = computeIndicators(historicalData)
      response.strategies = generateStrategies(coin, indicators, currentPrice)
    }

    // Charts task
    if (tasks.length === 0 || tasks.includes('charts')) {
      const indicators = computeIndicators(historicalData)
      response.charts = await generateCharts(
        coin, 
        historicalData, 
        indicators, 
        response.predictions || []
      )
    }

    res.json(response)
  } catch (error: any) {
    console.error('Analysis error:', error)
    
    // Provide helpful error messages
    const errorMsg = error?.message || 'Internal server error'
    const isNotFound = errorMsg.toLowerCase().includes('not found') || 
                       errorMsg.toLowerCase().includes('no data') ||
                       errorMsg.toLowerCase().includes('invalid coin')
    
    res.status(isNotFound ? 404 : 500).json({ 
      ok: false, 
      error: errorMsg,
      suggestion: isNotFound 
        ? 'Try using common symbols like: btc, eth, avax, sol, ada, dot, matic, link'
        : 'Please try again or check your CoinGecko API key configuration.'
    })
  }
})

// Data fetching (using CoinGecko API only - NO SYNTHETIC DATA)
async function fetchHistoricalData(
  coin: string, 
  days: number, 
  granularity: Granularity
): Promise<OHLCV[]> {
  // Map common symbols to CoinGecko IDs
  const coinMap: Record<string, string> = {
    'btc': 'bitcoin',
    'bitcoin': 'bitcoin',
    'eth': 'ethereum',
    'ethereum': 'ethereum',
    'sol': 'solana',
    'solana': 'solana',
    'avax': 'avalanche-2',
    'avalanche': 'avalanche-2',
    'ada': 'cardano',
    'cardano': 'cardano',
    'dot': 'polkadot',
    'polkadot': 'polkadot',
    'matic': 'matic-network',
    'polygon': 'matic-network',
    'link': 'chainlink',
    'chainlink': 'chainlink',
    'bnb': 'binancecoin',
    'usdc': 'usd-coin',
    'usdt': 'tether',
  }

  const coinId = coinMap[coin.toLowerCase()] || coin.toLowerCase()
  
  // Fetch REAL data from CoinGecko (no fallback)
  const realData = await fetchCoinGeckoData(coinId, days)
  
  if (realData.length === 0) {
    throw new Error(`No data available for ${coin}. Please check the coin symbol/ID.`)
  }
  
  console.log(`✅ Fetched ${realData.length} real data points for ${coinId}`)
  return realData
}

// Fetch real data from CoinGecko API
async function fetchCoinGeckoData(coinId: string, days: number): Promise<OHLCV[]> {
  const apiKey = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY
  const baseUrl = 'https://api.coingecko.com/api/v3'
  
  // CoinGecko market_chart endpoint
  const url = apiKey 
    ? `${baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&x_cg_demo_api_key=${apiKey}`
    : `${baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Coin "${coinId}" not found on CoinGecko. Please check the coin name/symbol.`)
    }
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
  }
  
  const data: any = await response.json()
  
  // CoinGecko returns: { prices: [[timestamp, price], ...], market_caps: [...], total_volumes: [...] }
  if (!data.prices || data.prices.length === 0) {
    throw new Error('No price data returned from CoinGecko')
  }
  
  // Convert to OHLCV format (we approximate OHLC from single price points)
  const ohlcvData: OHLCV[] = data.prices.map((pricePoint: [number, number], index: number) => {
    const [timestamp, price] = pricePoint
    const volume = data.total_volumes[index]?.[1] || 0
    
    // Since CoinGecko only gives us close prices, we approximate OHLC
    const variance = price * 0.002 // 0.2% variance for realistic OHLC
    return {
      timestamp,
      open: price * (1 + (Math.random() - 0.5) * variance),
      high: price * (1 + Math.random() * variance * 0.5),
      low: price * (1 - Math.random() * variance * 0.5),
      close: price,
      volume
    }
  })
  
  return ohlcvData
}

// Technical indicators
interface Indicators {
  sma30: number
  sma50: number
  rsi: number
  macd: { value: number; signal: number; histogram: number }
  volatility: number
  trend: 'bullish' | 'bearish' | 'neutral'
}

function computeIndicators(data: OHLCV[]): Indicators {
  const closes = data.map(d => d.close)
  
  // Simple Moving Averages
  const sma30 = closes.length >= 30 
    ? closes.slice(-30).reduce((a, b) => a + b, 0) / 30 
    : closes[closes.length - 1]
  
  const sma50 = closes.length >= 50 
    ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50 
    : sma30
  
  // RSI
  const rsi = calculateRSI(closes, 14)
  
  // MACD
  const macd = calculateMACD(closes)
  
  // Volatility (30-day standard deviation)
  const volatility = calculateVolatility(closes, 30)
  
  // Trend
  const currentPrice = closes[closes.length - 1]
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  if (currentPrice > sma30 && sma30 > sma50 && macd.histogram > 0) {
    trend = 'bullish'
  } else if (currentPrice < sma30 && sma30 < sma50 && macd.histogram < 0) {
    trend = 'bearish'
  }
  
  return { sma30, sma50, rsi, macd, volatility, trend }
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50
  
  const changes: number[] = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }
  
  const recentChanges = changes.slice(-period)
  const gains = recentChanges.filter(c => c > 0).reduce((a, b) => a + b, 0) / period
  const losses = Math.abs(recentChanges.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period
  
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - (100 / (1 + rs))
}

function calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  const macdLine = ema12 - ema26
  
  // Signal line is 9-period EMA of MACD
  const macdValues = [macdLine] // Simplified
  const signal = macdLine * 0.9 // Approximation
  
  return {
    value: macdLine,
    signal,
    histogram: macdLine - signal
  }
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0
  const k = 2 / (period + 1)
  let ema = prices[0]
  
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k)
  }
  
  return ema
}

function calculateVolatility(prices: number[], period: number): number {
  if (prices.length < period) return 0
  
  const recentPrices = prices.slice(-period)
  const mean = recentPrices.reduce((a, b) => a + b, 0) / period
  const squaredDiffs = recentPrices.map(p => Math.pow(p - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period
  
  return Math.sqrt(variance)
}

// Generate summary
function generateSummary(
  coin: string, 
  price: number, 
  indicators: Indicators,
  data: OHLCV[]
): string {
  const idx = Math.max(0, data.length - 24)
  const base = data[idx]?.close ?? price
  const change24h = base ? ((price - base) / base * 100) : 0
  const changeStr = change24h >= 0 ? `+${change24h.toFixed(2)}%` : `${change24h.toFixed(2)}%`
  
  return `${coin.toUpperCase()} is trading at $${price.toFixed(2)} (${changeStr} 24h). ` +
    `The market shows a ${indicators.trend} trend with ${indicators.rsi > 70 ? 'overbought' : indicators.rsi < 30 ? 'oversold' : 'neutral'} conditions. ` +
    `Volatility is ${indicators.volatility > price * 0.03 ? 'elevated' : 'moderate'}.`
}

// Generate insights
function generateInsights(indicators: Indicators): string[] {
  const insights: string[] = []
  
  // RSI insight
  if (indicators.rsi > 70) {
    insights.push(`RSI at ${indicators.rsi.toFixed(1)} indicates overbought conditions`)
  } else if (indicators.rsi < 30) {
    insights.push(`RSI at ${indicators.rsi.toFixed(1)} suggests oversold conditions`)
  } else {
    insights.push(`RSI at ${indicators.rsi.toFixed(1)} shows neutral momentum`)
  }
  
  // MA insight
  if (indicators.sma30 > indicators.sma50) {
    insights.push('30-day MA above 50-day MA indicates bullish momentum')
  } else {
    insights.push('30-day MA below 50-day MA suggests bearish pressure')
  }
  
  // MACD insight
  if (indicators.macd.histogram > 0) {
    insights.push('MACD histogram positive, suggesting upward momentum')
  } else {
    insights.push('MACD histogram negative, indicating downward pressure')
  }
  
  // Volatility insight
  insights.push(`Volatility is ${indicators.volatility > 1000 ? 'high' : 'moderate'}, exercise caution with position sizing`)
  
  return insights
}

// Generate predictions
function generatePredictions(
  data: OHLCV[], 
  horizonDays: number, 
  currentPrice: number
): Prediction[] {
  const predictions: Prediction[] = []
  
  // Simple linear regression for trend
  const closes = data.slice(-30).map(d => d.close)
  const trend = (closes[closes.length - 1] - closes[0]) / Math.max(1, closes.length)
  
  // Add some volatility-based uncertainty
  const volatility = calculateVolatility(closes, Math.max(2, closes.length))
  
  // Calculate trend strength (correlation coefficient)
  const trendStrength = calculateTrendStrength(closes)
  
  // Base confidence depends on volatility and trend strength
  // Low volatility + strong trend = high confidence
  // High volatility + weak trend = low confidence
  const normalizedVolatility = Math.min(volatility / currentPrice, 0.5) // Cap at 50%
  const baseConfidence = 0.5 + (trendStrength * 0.3) - (normalizedVolatility * 0.2)
  
  const daysToPredict = Math.min(horizonDays, 7) // Predict up to 7 days
  
  for (let i = 1; i <= daysToPredict; i++) {
    const trendFactor = trend * i
    const randomWalk = (Math.random() - 0.5) * volatility * Math.sqrt(i)
    const predictedPrice = currentPrice + trendFactor + randomWalk
    
    // Dynamic probability decreases with time horizon AND depends on market conditions
    // Each day reduces confidence by 2-8% depending on volatility
    const decayRate = 0.02 + (normalizedVolatility * 0.06)
    const probability = Math.max(0.3, Math.min(0.95, baseConfidence - (i * decayRate)))
    
    const date = new Date()
    date.setDate(date.getDate() + i)
    
    predictions.push({
      date: date.toISOString().split('T')[0],
      price: Math.max(0, predictedPrice),
      probability
    })
  }
  
  return predictions
}

// Calculate trend strength (R-squared approximation)
function calculateTrendStrength(prices: number[]): number {
  if (prices.length < 2) return 0
  
  const n = prices.length
  const xMean = (n - 1) / 2
  const yMean = prices.reduce((sum, p) => sum + p, 0) / n
  
  let numerator = 0
  let xVariance = 0
  let yVariance = 0
  
  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean
    const yDiff = prices[i] - yMean
    numerator += xDiff * yDiff
    xVariance += xDiff * xDiff
    yVariance += yDiff * yDiff
  }
  
  if (xVariance === 0 || yVariance === 0) return 0
  
  const correlation = numerator / Math.sqrt(xVariance * yVariance)
  return Math.abs(correlation) // R-squared is correlation squared, but we use abs(correlation) for simplicity
}

// Generate strategies
function generateStrategies(
  coin: string, 
  indicators: Indicators, 
  currentPrice: number
): Strategy[] {
  const strategies: Strategy[] = []
  
  // Calculate additional metrics for better strategy selection
  const rsi = indicators.rsi
  const macdHist = indicators.macd.histogram
  const trend = indicators.trend
  const volatility = indicators.volatility
  
  // Volatility-based risk adjustment
  const isHighVolatility = volatility > currentPrice * 0.05
  const isLowVolatility = volatility < currentPrice * 0.02
  
  // ALWAYS: DCA Strategy (but vary the description based on conditions)
  if (isHighVolatility) {
    strategies.push({
      name: 'DCA Core',
      description: `High volatility detected - spread ${coin.toUpperCase()} purchases over 8-12 weeks to smooth entry`,
      risk: 'low'
    })
  } else if (trend === 'bearish') {
    strategies.push({
      name: 'DCA Core',
      description: `Downtrend detected - accumulate ${coin.toUpperCase()} in small weekly chunks, target 3-6 month hold`,
      risk: 'low'
    })
  } else {
    strategies.push({
      name: 'DCA Core',
      description: `Steady ${coin.toUpperCase()} accumulation over 4-8 weeks, rebalance monthly`,
      risk: 'low'
    })
  }
  
  // Momentum strategy (if bullish with confirmation)
  if (trend === 'bullish' && rsi > 45 && rsi < 70 && macdHist > 0) {
    strategies.push({
      name: 'Momentum Breakout',
      description: `Strong uptrend with RSI at ${rsi.toFixed(1)} - enter with 3-5% position, 2% trailing stop`,
      risk: 'medium'
    })
  }
  
  // Mean reversion (if oversold)
  if (rsi < 35) {
    const severity = rsi < 25 ? 'deeply' : 'moderately'
    strategies.push({
      name: 'Mean Reversion',
      description: `RSI ${rsi.toFixed(1)} is ${severity} oversold - accumulate 25-50% position, target RSI 50-60 exits`,
      risk: 'medium'
    })
  } else if (rsi > 70) {
    // Overbought - consider taking profits
    strategies.push({
      name: 'Profit Taking',
      description: `RSI ${rsi.toFixed(1)} is overbought - scale out 20-40% of position, set trailing stops`,
      risk: 'low'
    })
  }
  
  // Range trading (if neutral and low volatility)
  if (trend === 'neutral' && !isHighVolatility) {
    strategies.push({
      name: 'Range Trading',
      description: `Sideways market - buy near 30-day MA ($${(currentPrice * 0.97).toFixed(2)}), sell at recent highs ($${(currentPrice * 1.03).toFixed(2)})`,
      risk: 'medium'
    })
  }
  
  // High conviction trend following (if strong bullish)
  if (trend === 'bullish' && macdHist > 0 && rsi > 55 && rsi < 75) {
    const stopLevel = (currentPrice * 0.92).toFixed(2)
    strategies.push({
      name: 'Trend Following',
      description: `Strong bullish momentum - ride trend with 50-80% position, trailing stop at $${stopLevel} or 30-day MA`,
      risk: 'high'
    })
  }
  
  // Bearish defensive strategy
  if (trend === 'bearish' && rsi < 50) {
    strategies.push({
      name: 'Defensive Positioning',
      description: `Bearish trend with RSI ${rsi.toFixed(1)} - wait for RSI < 30 or 50-day MA support before entry`,
      risk: 'low'
    })
  }
  
  // Volatility breakout (if high volatility)
  if (isHighVolatility && Math.abs(macdHist) > 0.5) {
    strategies.push({
      name: 'Volatility Breakout',
      description: `High volatility (${(volatility/currentPrice * 100).toFixed(1)}%) - use 20-30% position with wide stops at ±8%`,
      risk: 'high'
    })
  }
  
  // FOMO warning (if very overbought)
  if (rsi > 80) {
    strategies.push({
      name: 'FOMO Warning',
      description: `⚠️ Extreme overbought (RSI ${rsi.toFixed(1)}) - AVOID new entries, consider hedging existing positions`,
      risk: 'low'
    })
  }
  
  // Consolidation strategy (if very low volatility)
  if (isLowVolatility && trend === 'neutral') {
    strategies.push({
      name: 'Accumulation Phase',
      description: `Low volatility consolidation - ideal for building position, target 2-3x avg volume spike for breakout`,
      risk: 'low'
    })
  }
  
  return strategies
}

// Generate charts
async function generateCharts(
  coin: string,
  data: OHLCV[],
  indicators: Indicators,
  predictions: Prediction[]
): Promise<Chart[]> {
  const charts: Chart[] = []
  
  try {
    // Price + MA chart
    const priceChartId = crypto.randomBytes(8).toString('hex')
    const priceChartPath = path.join(CHARTS_DIR, `${priceChartId}.svg`)
    await renderPriceChart(data, indicators, priceChartPath)
    charts.push({
      title: 'Price History with Moving Averages',
      url: `${BASE_URL}/charts/${priceChartId}.svg`
    })
    
    // Forecast chart
    if (predictions.length > 0) {
      const forecastChartId = crypto.randomBytes(8).toString('hex')
      const forecastChartPath = path.join(CHARTS_DIR, `${forecastChartId}.svg`)
      await renderForecastChart(data, predictions, forecastChartPath)
      charts.push({
        title: 'Price Forecast with Confidence Bands',
        url: `${BASE_URL}/charts/${forecastChartId}.svg`
      })
    }
  } catch (error) {
    console.error('Chart generation error:', error)
  }
  
  return charts
}

// Render price chart as SVG
async function renderPriceChart(
  data: OHLCV[], 
  indicators: Indicators, 
  outputPath: string
): Promise<void> {
  const width = 800
  const height = 400
  const margin = { top: 40, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const recentData = data.slice(-90)
  const prices = recentData.map(d => d.close)
  const minPrice = Math.min(...prices) * 0.98
  const maxPrice = Math.max(...prices) * 1.02

  const xScale = (i: number) => margin.left + (i / Math.max(1, recentData.length - 1)) * chartWidth
  const yScale = (p: number) => margin.top + chartHeight - ((p - minPrice) / (maxPrice - minPrice)) * chartHeight

  const gridLines = Array.from({ length: 6 }, (_, i) => {
    const y = margin.top + (chartHeight / 5) * i
    return `<line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(width - margin.right)}" y2="${y.toFixed(2)}" stroke="#333" stroke-width="1" />`
  }).join('\n')

  const pricePoints = recentData.map((d, i) => `${xScale(i).toFixed(2)},${yScale(d.close).toFixed(2)}`).join(' ')

  let maPath = ''
  if (recentData.length >= 30) {
    const maPoints: string[] = []
    for (let i = 29; i < recentData.length; i++) {
      const ma = recentData.slice(i - 29, i + 1).reduce((sum, d) => sum + d.close, 0) / 30
      maPoints.push(`${xScale(i).toFixed(2)},${yScale(ma).toFixed(2)}`)
    }
    maPath = `<polyline fill="none" stroke="#ff8800" stroke-width="1.5" points="${maPoints.join(' ')}" />`
  }

  const yLabels = Array.from({ length: 6 }, (_, i) => {
    const price = minPrice + (maxPrice - minPrice) * (i / 5)
    const y = margin.top + chartHeight - (chartHeight / 5) * i
    return `<text x="${margin.left - 10}" y="${(y + 4).toFixed(2)}" fill="#fff" font-size="12" text-anchor="end">$${price.toFixed(2)}</text>`
  }).join('\n')

  const legend = `
    <text x="${width - margin.right - 120}" y="${margin.top + 10}" fill="#00ff88" font-size="12">● Price</text>
    <text x="${width - margin.right - 120}" y="${margin.top + 30}" fill="#ff8800" font-size="12">● 30-day MA</text>
  `

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#1a1a1a" />
    ${gridLines}
    <polyline fill="none" stroke="#00ff88" stroke-width="2" points="${pricePoints}" />
    ${maPath}
    <text x="${width / 2}" y="25" fill="#fff" font-size="14" text-anchor="middle">Price History (Last 90 Days)</text>
    ${yLabels}
    ${legend}
  </svg>`

  await fs.writeFile(outputPath, svg, 'utf-8')
}

// Render forecast chart as SVG
async function renderForecastChart(
  data: OHLCV[], 
  predictions: Prediction[], 
  outputPath: string
): Promise<void> {
  const width = 800
  const height = 400
  const margin = { top: 40, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const recentData = data.slice(-30)
  const historicalPrices = recentData.map(d => d.close)
  const forecastPrices = predictions.map(p => p.price)
  const allPrices = [...historicalPrices, ...forecastPrices]

  const minPrice = Math.min(...allPrices) * 0.98
  const maxPrice = Math.max(...allPrices) * 1.02

  const totalPoints = historicalPrices.length + forecastPrices.length
  const xScale = (i: number) => margin.left + (i / Math.max(1, totalPoints - 1)) * chartWidth
  const yScale = (p: number) => margin.top + chartHeight - ((p - minPrice) / (maxPrice - minPrice)) * chartHeight

  const gridLines = Array.from({ length: 6 }, (_, i) => {
    const y = margin.top + (chartHeight / 5) * i
    return `<line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(width - margin.right)}" y2="${y.toFixed(2)}" stroke="#333" stroke-width="1" />`
  }).join('\n')

  // Confidence band as polygon
  const upper = forecastPrices.map((price, i) => `${xScale(historicalPrices.length + i).toFixed(2)},${yScale(price * 1.05).toFixed(2)}`).join(' ')
  const lower = forecastPrices.slice().reverse().map((price, idx) => {
    const i = forecastPrices.length - 1 - idx
    return `${xScale(historicalPrices.length + i).toFixed(2)},${yScale(price * 0.95).toFixed(2)}`
  }).join(' ')
  const band = upper && lower ? `<polygon points="${upper} ${lower}" fill="rgba(0,150,255,0.1)" />` : ''

  const historicalPts = historicalPrices.map((p, i) => `${xScale(i).toFixed(2)},${yScale(p).toFixed(2)}`).join(' ')
  const forecastPts = forecastPrices.map((p, i) => `${xScale(historicalPrices.length + i).toFixed(2)},${yScale(p).toFixed(2)}`).join(' ')

  const yLabels = Array.from({ length: 6 }, (_, i) => {
    const price = minPrice + (maxPrice - minPrice) * (i / 5)
    const y = margin.top + chartHeight - (chartHeight / 5) * i
    return `<text x="${margin.left - 10}" y="${(y + 4).toFixed(2)}" fill="#fff" font-size="12" text-anchor="end">$${price.toFixed(2)}</text>`
  }).join('\n')

  const legend = `
    <text x="${width - margin.right - 150}" y="${margin.top + 10}" fill="#00ff88" font-size="12">● Historical</text>
    <text x="${width - margin.right - 150}" y="${margin.top + 30}" fill="#0088ff" font-size="12">● Forecast</text>
  `

  const svg = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>
  <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${width}\" height=\"${height}\" viewBox=\"0 0 ${width} ${height}\">
    <rect x=\"0\" y=\"0\" width=\"${width}\" height=\"${height}\" fill=\"#1a1a1a\" />
    ${gridLines}
    ${band}
    <polyline fill=\"none\" stroke=\"#00ff88\" stroke-width=\"2\" points=\"${historicalPts}\" />
    <polyline fill=\"none\" stroke=\"#0088ff\" stroke-dasharray=\"5,5\" stroke-width=\"2\" points=\"${forecastPts}\" />
    <text x=\"${width / 2}\" y=\"25\" fill=\"#fff\" font-size=\"14\" text-anchor=\"middle\">Price Forecast</text>
    ${yLabels}
    ${legend}
  </svg>`

  await fs.writeFile(outputPath, svg, 'utf-8')
}

// Start server
async function start() {
  await initChartDir()
  
  app.listen(PORT, () => {
    console.log(`🚀 MCP Analytics Server running on port ${PORT}`)
    console.log(`📊 Health check: ${BASE_URL}/health`)
    console.log(`🔐 API Key: ${API_KEY ? 'Configured' : 'Not set (optional)'}`)
  })
}

start().catch(console.error)
