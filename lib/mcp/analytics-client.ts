// Note: Avoid Next.js-specific imports here so this can run via tsx as a standalone server.

type MCPConfig = {  
  baseUrl: string
  apiKey?: string
}

export type AnalysisRequest = {
  coin: string
  horizonDays?: number
  granularity?: '1h' | '4h' | '1d'
  tasks?: Array<'analysis' | 'prediction' | 'strategy' | 'charts'>
  chartType?: 'line' | 'bar' | 'candlestick' | 'area'
}

export type AnalysisResponse = {
  ok: boolean
  summary?: string
  insights?: string[]
  predictions?: Array<{ date: string; price: number; probability?: number }>
  strategies?: Array<{ name: string; description: string; risk: 'low' | 'medium' | 'high' }>
  charts?: Array<{ title: string; url: string }>
  methodology?: {
    dataPoints: number
    timeframe: string
    method: string
    indicators: string[]
    confidenceFactors: string
  }
  overallAnalysis?: string
  raw?: any
  error?: string
}

function getConfig(): MCPConfig {
  const baseUrl = process.env.MCP_ANALYTICS_URL || ''
  const apiKey = process.env.MCP_ANALYTICS_API_KEY || ''
  if (!baseUrl) {
    throw new Error('MCP_ANALYTICS_URL is not configured')
  }
  return { baseUrl, apiKey }
}

export async function mcpHealth(): Promise<{ ok: boolean; message?: string }> {
  try {
    const { baseUrl, apiKey } = getConfig()
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) }
  }
}

export async function analyzeCoin(req: AnalysisRequest): Promise<AnalysisResponse> {
  try {
    const { baseUrl, apiKey } = getConfig()
    const body = {
      coin: req.coin,
      horizonDays: req.horizonDays ?? 30,
      granularity: req.granularity ?? '1d',
      tasks: req.tasks ?? ['analysis', 'prediction', 'strategy', 'charts'],
      chartType: req.chartType ?? 'line',
    }

    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `MCP analyze failed ${res.status}: ${text}` }
    }
    const json = await res.json().catch(() => ({}))
    // Normalize the response into our shape
    const normalized: AnalysisResponse = {
      ok: true,
      summary: json.summary || json.overview || undefined,
      insights: Array.isArray(json.insights) ? json.insights : undefined,
      predictions: Array.isArray(json.predictions) ? json.predictions : undefined,
      strategies: Array.isArray(json.strategies) ? json.strategies : undefined,
      charts: Array.isArray(json.charts) ? json.charts : undefined,
      methodology: json.methodology || undefined,
      raw: json,
    }
    return normalized
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}



