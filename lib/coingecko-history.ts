/**
 * CoinGecko Historical Data Service
 * 
 * Provides comprehensive historical price data for AI analysis
 * Supports 1 year (365 days) lookback with detailed OHLCV data
 */

export interface HistoricalDataPoint {
  timestamp: number
  date: string
  price: number
  marketCap?: number
  volume?: number
}

export interface OHLCVData {
  timestamp: number
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface HistoricalDataResponse {
  ok: boolean
  coin: string
  coinId: string
  days: number
  dataPoints: number
  data: HistoricalDataPoint[]
  ohlcv?: OHLCVData[]
  statistics?: {
    currentPrice: number
    highestPrice: number
    lowestPrice: number
    averagePrice: number
    priceChange: number
    priceChangePercent: number
    volatility: number
  }
  error?: string
}

// Common symbol to CoinGecko ID mapping
const SYMBOL_TO_ID_MAP: Record<string, string> = {
  'btc': 'bitcoin',
  'bitcoin': 'bitcoin',
  'eth': 'ethereum',
  'ethereum': 'ethereum',
  'avax': 'avalanche-2',
  'avalanche': 'avalanche-2',
  'wavax': 'wrapped-avax',
  'joe': 'joe',
  'traderjoe': 'joe',
  'png': 'pangolin',
  'pangolin': 'pangolin',
  'qi': 'benqi',
  'benqi': 'benqi',
  'gmx': 'gmx',
  'usdc': 'usd-coin',
  'usdt': 'tether',
  'dai': 'dai',
  'bnb': 'binancecoin',
  'sol': 'solana',
  'ada': 'cardano',
  'xrp': 'ripple',
  'dot': 'polkadot',
  'matic': 'matic-network',
  'link': 'chainlink',
  'uni': 'uniswap',
  'aave': 'aave',
  'curve': 'curve-dao-token',
  'crv': 'curve-dao-token',
}

/**
 * Resolve coin symbol to CoinGecko ID
 */
function resolveCoinId(input: string): string {
  const normalized = input.toLowerCase().trim()
  return SYMBOL_TO_ID_MAP[normalized] || normalized
}

/**
 * Fetch historical data from CoinGecko
 * 
 * @param coin - Coin symbol or CoinGecko ID (e.g., 'bitcoin', 'btc', 'avalanche-2')
 * @param days - Number of days of history (1-365, or 'max' for all available)
 * @param includeOHLCV - Generate OHLCV data from price points
 * @returns Historical data with prices, volumes, and optional OHLCV
 */
export async function fetchHistoricalData(
  coin: string,
  days: number | 'max' = 365,
  includeOHLCV: boolean = true
): Promise<HistoricalDataResponse> {
  const coinId = resolveCoinId(coin)
  const apiKey = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY
  const baseUrl = 'https://api.coingecko.com/api/v3'
  
  try {
    // Build URL with API key if available
    const daysParam = days === 'max' ? 'max' : Math.min(365, Math.max(1, days))
    const url = apiKey
      ? `${baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${daysParam}&x_cg_demo_api_key=${apiKey}`
      : `${baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${daysParam}`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(apiKey ? { 'x-cg-demo-api-key': apiKey } : {})
      },
      cache: 'no-store'
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          ok: false,
          coin,
          coinId,
          days: typeof days === 'number' ? days : 365,
          dataPoints: 0,
          data: [],
          error: `Coin "${coinId}" not found. Try using the full CoinGecko ID (e.g., 'avalanche-2' for AVAX)`
        }
      }
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
    }
    
    const json = await response.json()
    
    // CoinGecko returns: { prices: [[timestamp, price], ...], market_caps: [...], total_volumes: [...] }
    if (!json.prices || json.prices.length === 0) {
      return {
        ok: false,
        coin,
        coinId,
        days: typeof days === 'number' ? days : 365,
        dataPoints: 0,
        data: [],
        error: 'No historical data available for this coin'
      }
    }
    
    // Process price data
    const data: HistoricalDataPoint[] = json.prices.map((item: [number, number], index: number) => ({
      timestamp: item[0],
      date: new Date(item[0]).toISOString(),
      price: item[1],
      marketCap: json.market_caps?.[index]?.[1],
      volume: json.total_volumes?.[index]?.[1]
    }))
    
    // Calculate statistics
    const prices = data.map(d => d.price)
    const currentPrice = prices[prices.length - 1]
    const firstPrice = prices[0]
    const highestPrice = Math.max(...prices)
    const lowestPrice = Math.min(...prices)
    const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length
    const priceChange = currentPrice - firstPrice
    const priceChangePercent = (priceChange / firstPrice) * 100
    
    // Calculate volatility (standard deviation)
    const squaredDiffs = prices.map(price => Math.pow(price - averagePrice, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length
    const volatility = Math.sqrt(variance) / averagePrice * 100 // Coefficient of variation
    
    const statistics = {
      currentPrice,
      highestPrice,
      lowestPrice,
      averagePrice,
      priceChange,
      priceChangePercent,
      volatility
    }
    
    // Generate OHLCV data if requested
    let ohlcv: OHLCVData[] | undefined
    if (includeOHLCV) {
      ohlcv = generateOHLCV(data)
    }
    
    return {
      ok: true,
      coin,
      coinId,
      days: typeof days === 'number' ? days : data.length,
      dataPoints: data.length,
      data,
      ohlcv,
      statistics
    }
    
  } catch (error: any) {
    return {
      ok: false,
      coin,
      coinId,
      days: typeof days === 'number' ? days : 365,
      dataPoints: 0,
      data: [],
      error: error.message || 'Failed to fetch historical data'
    }
  }
}

/**
 * Generate OHLCV (candlestick) data from price points
 * Groups data into daily candles
 */
function generateOHLCV(data: HistoricalDataPoint[]): OHLCVData[] {
  // Group by day
  const dayGroups = new Map<string, HistoricalDataPoint[]>()
  
  data.forEach(point => {
    const dayKey = new Date(point.timestamp).toISOString().split('T')[0]
    if (!dayGroups.has(dayKey)) {
      dayGroups.set(dayKey, [])
    }
    dayGroups.get(dayKey)!.push(point)
  })
  
  // Convert to OHLCV
  const ohlcv: OHLCVData[] = []
  
  dayGroups.forEach((points, dayKey) => {
    if (points.length === 0) return
    
    const sorted = points.sort((a, b) => a.timestamp - b.timestamp)
    const prices = sorted.map(p => p.price)
    
    ohlcv.push({
      timestamp: sorted[0].timestamp,
      date: dayKey,
      open: sorted[0].price,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: sorted[sorted.length - 1].price,
      volume: sorted.reduce((sum, p) => sum + (p.volume || 0), 0)
    })
  })
  
  return ohlcv.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Fetch historical data for a specific date range
 * 
 * @param coin - Coin symbol or CoinGecko ID
 * @param fromDate - Start date (YYYY-MM-DD or Date object)
 * @param toDate - End date (YYYY-MM-DD or Date object)
 */
export async function fetchHistoricalRange(
  coin: string,
  fromDate: string | Date,
  toDate: string | Date = new Date()
): Promise<HistoricalDataResponse> {
  const coinId = resolveCoinId(coin)
  const apiKey = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY
  const baseUrl = 'https://api.coingecko.com/api/v3'
  
  // Convert to Unix timestamps
  const from = typeof fromDate === 'string' ? new Date(fromDate).getTime() / 1000 : fromDate.getTime() / 1000
  const to = typeof toDate === 'string' ? new Date(toDate).getTime() / 1000 : toDate.getTime() / 1000
  
  try {
    const url = apiKey
      ? `${baseUrl}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}&x_cg_demo_api_key=${apiKey}`
      : `${baseUrl}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(apiKey ? { 'x-cg-demo-api-key': apiKey } : {})
      },
      cache: 'no-store'
    })
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }
    
    const json = await response.json()
    
    if (!json.prices || json.prices.length === 0) {
      return {
        ok: false,
        coin,
        coinId,
        days: 0,
        dataPoints: 0,
        data: [],
        error: 'No data available for this date range'
      }
    }
    
    const data: HistoricalDataPoint[] = json.prices.map((item: [number, number], index: number) => ({
      timestamp: item[0],
      date: new Date(item[0]).toISOString(),
      price: item[1],
      marketCap: json.market_caps?.[index]?.[1],
      volume: json.total_volumes?.[index]?.[1]
    }))
    
    const daysDiff = Math.floor((to - from) / 86400)
    
    return {
      ok: true,
      coin,
      coinId,
      days: daysDiff,
      dataPoints: data.length,
      data
    }
    
  } catch (error: any) {
    return {
      ok: false,
      coin,
      coinId,
      days: 0,
      dataPoints: 0,
      data: [],
      error: error.message || 'Failed to fetch historical range'
    }
  }
}

/**
 * Format historical data for AI analysis
 * Creates a concise summary suitable for LLM context
 */
export function formatHistoricalDataForAI(response: HistoricalDataResponse): string {
  if (!response.ok) {
    return `❌ Error: ${response.error}`
  }
  
  const { coin, coinId, dataPoints, statistics } = response
  
  if (!statistics) {
    return `📊 ${coin.toUpperCase()} - ${dataPoints} data points available`
  }
  
  const parts = [
    `📊 **${coin.toUpperCase()} Historical Data (${dataPoints} points)**`,
    '',
    `💰 Current Price: $${statistics.currentPrice.toFixed(6)}`,
    `📈 Highest: $${statistics.highestPrice.toFixed(6)}`,
    `📉 Lowest: $${statistics.lowestPrice.toFixed(6)}`,
    `📊 Average: $${statistics.averagePrice.toFixed(6)}`,
    '',
    `📈 Price Change: ${statistics.priceChange >= 0 ? '+' : ''}${statistics.priceChange.toFixed(6)} (${statistics.priceChangePercent >= 0 ? '+' : ''}${statistics.priceChangePercent.toFixed(2)}%)`,
    `📊 Volatility: ${statistics.volatility.toFixed(2)}%`,
  ]
  
  return parts.join('\n')
}
