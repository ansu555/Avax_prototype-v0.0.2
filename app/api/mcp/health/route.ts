import { NextResponse } from "next/server"

export const runtime = 'nodejs'

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8080'

export async function GET() {
  try {
    const response = await fetch(`${MCP_BASE_URL}/health`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'MCP server not reachable' },
      { status: 503 }
    )
  }
}
