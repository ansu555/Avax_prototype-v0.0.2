import { NextResponse } from 'next/server'
import { fetchHistoricalData, fetchHistoricalRange, formatHistoricalDataForAI } from '@/lib/coingecko-history'

export const runtime = 'nodejs'

/**
 * GET /api/history
 * 
 * Query params:
 * - coin: Coin symbol or CoinGecko ID (required)
 * - days: Number of days (1-365) or 'max' (optional, default: 365)
 * - from: Start date YYYY-MM-DD (for range queries)
 * - to: End date YYYY-MM-DD (for range queries)
 * - format: 'json' | 'text' (optional, default: 'json')
 * - includeOHLCV: 'true' | 'false' (optional, default: 'true')
 * 
 * Examples:
 * - /api/history?coin=bitcoin&days=365
 * - /api/history?coin=avax&days=30
 * - /api/history?coin=ethereum&from=2024-01-01&to=2024-12-31
 * - /api/history?coin=btc&days=max (all available data)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const coin = url.searchParams.get('coin')
    const daysParam = url.searchParams.get('days')
    const fromDate = url.searchParams.get('from')
    const toDate = url.searchParams.get('to')
    const format = url.searchParams.get('format') || 'json'
    const includeOHLCV = url.searchParams.get('includeOHLCV') !== 'false'
    
    if (!coin) {
      return NextResponse.json(
        { ok: false, error: 'Missing required parameter: coin' },
        { status: 400 }
      )
    }
    
    // Range query
    if (fromDate) {
      const to = toDate || new Date().toISOString().split('T')[0]
      const result = await fetchHistoricalRange(coin, fromDate, to)
      
      if (format === 'text') {
        return new Response(formatHistoricalDataForAI(result), {
          headers: { 'Content-Type': 'text/plain' }
        })
      }
      
      return NextResponse.json(result)
    }
    
    // Days query
    const days: number | 'max' = daysParam === 'max' ? 'max' : parseInt(daysParam || '365')
    const result = await fetchHistoricalData(coin, days, includeOHLCV)
    
    if (format === 'text') {
      return new Response(formatHistoricalDataForAI(result), {
        headers: { 'Content-Type': 'text/plain' }
      })
    }
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/history
 * 
 * Body:
 * {
 *   coin: string (required)
 *   days?: number | 'max'
 *   from?: string (YYYY-MM-DD)
 *   to?: string (YYYY-MM-DD)
 *   format?: 'json' | 'text'
 *   includeOHLCV?: boolean
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { coin, days = 365, from, to, format = 'json', includeOHLCV = true } = body
    
    if (!coin) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: coin' },
        { status: 400 }
      )
    }
    
    // Range query
    if (from) {
      const toDate = to || new Date().toISOString().split('T')[0]
      const result = await fetchHistoricalRange(coin, from, toDate)
      
      if (format === 'text') {
        return new Response(formatHistoricalDataForAI(result), {
          headers: { 'Content-Type': 'text/plain' }
        })
      }
      
      return NextResponse.json(result)
    }
    
    // Days query
    const result = await fetchHistoricalData(coin, days, includeOHLCV)
    
    if (format === 'text') {
      return new Response(formatHistoricalDataForAI(result), {
        headers: { 'Content-Type': 'text/plain' }
      })
    }
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
