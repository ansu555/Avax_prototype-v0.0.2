import { NextResponse } from "next/server"

export const runtime = 'nodejs'

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8080'
const MCP_API_KEY = process.env.MCP_ANALYTICS_API_KEY

interface AnalyzeRequest {
  coin: string
  horizonDays?: number
  granularity?: '1h' | '4h' | '1d'
  tasks?: ('analysis' | 'prediction' | 'strategy' | 'charts')[]
}

export async function POST(req: Request) {
  try {
    const body: AnalyzeRequest = await req.json()

    if (!body.coin) {
      return NextResponse.json(
        { ok: false, error: 'coin parameter is required' },
        { status: 400 }
      )
    }

    // Forward request to MCP server
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (MCP_API_KEY) {
      headers['Authorization'] = `Bearer ${MCP_API_KEY}`
    }

    const mcpResponse = await fetch(`${MCP_BASE_URL}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!mcpResponse.ok) {
      const errorData = await mcpResponse.json().catch(() => ({}))
      return NextResponse.json(
        { ok: false, error: errorData.error || 'MCP server error' },
        { status: mcpResponse.status }
      )
    }

    const data = await mcpResponse.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('MCP proxy error:', error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to connect to MCP server' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'MCP Analytics Proxy',
    usage: 'POST with { coin, horizonDays?, granularity?, tasks? }',
    endpoint: MCP_BASE_URL,
    authenticated: !!MCP_API_KEY
  })
}
