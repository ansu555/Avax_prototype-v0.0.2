# MCP Analytics Server - Integration Guide

This guide explains how the MCP (Market Context Protocol) Analytics Server integrates with your 10xSwap platform.

## Architecture Overview

```
User Message → Chat Agent → Intent Detection → MCP Call → Analysis → Formatted Response
```

### Components

1. **MCP Server** (`mcp_server/main.ts`)
   - Standalone Express server
   - Runs on port 8080
   - Provides analysis, predictions, strategies, and charts

2. **Next.js Proxy** (`app/api/mcp/analyze/route.ts`)
   - Server-side proxy to MCP
   - Handles authentication
   - Prevents CORS issues

3. **Chat Integration** (`app/api/agent/chat/route.ts`)
   - Detects analysis intents
   - Extracts coin symbols
   - Formats MCP responses for chat

4. **Client Utilities** (`lib/mcp/client.ts`)
   - Type-safe API calls
   - Response formatting
   - Intent detection helpers

## Quick Start

### 1. Setup MCP Server

```bash
# Run the setup script
./scripts/setup-mcp.sh

# Or manually:
cd mcp_server
npm install
cp .env.example .env
# Edit .env with your settings
```

### 2. Configure Environment

Add to your main `.env.local`:

```env
# MCP Server Connection
MCP_ANALYTICS_URL=http://localhost:8080
MCP_BASE_URL=http://localhost:8080

# Optional: API Key for security
MCP_ANALYTICS_API_KEY=your-secret-key-here
```

Add to `mcp_server/.env`:

```env
MCP_PORT=8080
MCP_BASE_URL=http://localhost:8080
MCP_ANALYTICS_API_KEY=your-secret-key-here
```

### 3. Start Both Servers

```bash
# Terminal 1: Start MCP Server
cd mcp_server
npm run dev

# Terminal 2: Start Next.js
bun run dev
```

### 4. Test Integration

Ask in the chat:
- "Analyze BTC"
- "Forecast ETH for 30 days"
- "Trading strategy for AVAX"

## How It Works

### Intent Detection

The chat agent detects analysis requests using regex patterns:

```typescript
// In app/api/agent/chat/route.ts
const mcpIntent = /(analy[sz]e|prediction|predict|forecast|strategy|strategies|portfolio\s+strategy|chart|charts|graph|graphs)/i.test(message)
const coinMatch = message.match(/(?:of|for|on|about)\s+([a-z0-9\-]{2,40})/i)
```

**Triggers:**
- analyze, analysis, predict, prediction, forecast
- strategy, strategies, chart, charts, graph, graphs

### Coin Extraction

Supported formats:
- "Analyze **Bitcoin**" → btc
- "Forecast for **ETH**" → eth
- "Strategy on **AVAX**" → avax

Supported coins (can be extended):
- BTC (Bitcoin)
- ETH (Ethereum)
- SOL (Solana)
- AVAX (Avalanche)
- ADA (Cardano)
- DOT (Polkadot)
- MATIC (Polygon)
- LINK (Chainlink)

### Request Flow

1. **User**: "Analyze BTC"
2. **Chat Agent**: Detects intent + coin symbol
3. **Agent**: Calls `analyzeCoin({ coin: 'btc', horizonDays: 30 })`
4. **MCP Client**: Sends POST to `/api/mcp/analyze`
5. **Next.js Proxy**: Forwards to `http://localhost:8080/analyze`
6. **MCP Server**: 
   - Fetches historical data (synthetic for demo)
   - Computes technical indicators
   - Generates predictions
   - Creates strategies
   - Renders SVG charts
7. **Response**: Returns JSON with analysis
8. **Chat Agent**: Formats response with markdown
9. **User**: Sees formatted analysis in chat

### Response Format

```typescript
{
  ok: true,
  summary: "BTC is trading at $64250.00 (+2.45% 24h)...",
  insights: [
    "RSI at 58.3 shows neutral momentum",
    "30-day MA above 50-day MA indicates bullish momentum"
  ],
  predictions: [
    { date: "2025-10-17", price: 64800.25, probability: 0.68 }
  ],
  strategies: [
    {
      name: "DCA Core",
      description: "Weekly DCA into BTC over 4-8 weeks",
      risk: "low"
    }
  ],
  charts: [
    {
      title: "Price History with Moving Averages",
      url: "http://localhost:8080/charts/abc123.svg"
    }
  ]
}
```

## Customization

### Adding New Coins

In `mcp_server/main.ts`, extend the `coinMap`:

```typescript
const coinMap: Record<string, string> = {
  'btc': 'bitcoin',
  'eth': 'ethereum',
  // Add more:
  'doge': 'dogecoin',
  'xrp': 'ripple',
}
```

### Adjusting Analysis Parameters

Users can specify:
- **Horizon**: "forecast for **30 days**" → horizonDays: 30
- **Granularity**: "**1h** analysis" → granularity: '1h'
- **Tasks**: All by default, or specific: analysis, prediction, strategy, charts

### Custom Indicators

Extend the `computeIndicators` function in `mcp_server/main.ts`:

```typescript
function computeIndicators(data: OHLCV[]): Indicators {
  // Add your custom indicators
  const bollingerBands = calculateBollingerBands(data)
  const stochastic = calculateStochastic(data)
  
  return { 
    ...existingIndicators,
    bollingerBands,
    stochastic
  }
}
```

## Production Deployment

### MCP Server Deployment Options

#### Option 1: Same Server (Recommended for Vercel)
- Deploy MCP as a separate Express app on Railway/Render/Fly.io
- Set `MCP_ANALYTICS_URL` to the deployed URL

#### Option 2: Docker Container
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY mcp_server/package*.json ./
RUN npm install
COPY mcp_server/ ./
EXPOSE 8080
CMD ["npm", "start"]
```

#### Option 3: Serverless Function
- Convert MCP endpoints to Next.js API routes
- May have cold start latency and timeout limits

### Environment Variables for Production

```env
# Production MCP Server
MCP_ANALYTICS_URL=https://mcp.yourdomain.com
MCP_ANALYTICS_API_KEY=strong-random-key-here

# Enable CORS if needed
CORS_ORIGIN=https://yourapp.vercel.app
```

### Security Considerations

1. **API Key**: Always use `MCP_ANALYTICS_API_KEY` in production
2. **Rate Limiting**: Add rate limiting to MCP endpoints
3. **HTTPS**: Always use HTTPS for production
4. **Input Validation**: Sanitize all user inputs
5. **Error Handling**: Don't expose internal errors to users

### Monitoring

Monitor these metrics:
- **Request Count**: Number of analysis requests
- **Response Time**: MCP server latency
- **Error Rate**: Failed analyses
- **Chart Storage**: Disk usage for generated charts
- **Cache Hit Rate**: If you add caching

## Troubleshooting

### MCP Server Not Reachable

**Problem**: Chat shows "MCP server not reachable"

**Solutions**:
1. Check if MCP server is running: `curl http://localhost:8080/health`
2. Verify `MCP_ANALYTICS_URL` in `.env.local`
3. Check firewall/network settings
4. Look at MCP server logs for errors

### Analysis Returns Empty Data

**Problem**: Analysis completes but no predictions/strategies

**Solutions**:
1. Check coin symbol is supported
2. Verify data generation in `fetchHistoricalData()`
3. Check MCP server logs for errors
4. Ensure sufficient historical data points

### Charts Not Displaying

**Problem**: Chart URLs return 404

**Solutions**:
1. Check `mcp_server/charts/` directory exists and is writable
2. Verify `MCP_BASE_URL` matches server URL
3. Check that charts are being generated (log file creation)
4. Ensure static file serving is configured

### API Key Mismatch

**Problem**: 401 Unauthorized from MCP

**Solutions**:
1. Verify `MCP_ANALYTICS_API_KEY` matches in both `.env.local` and `mcp_server/.env`
2. Check Bearer token format in headers
3. Temporarily disable API key to isolate issue

## API Reference

### POST /analyze

**Request:**
```typescript
{
  coin: string                    // Required: btc, eth, sol, etc.
  horizonDays?: number            // Optional: 1-365, default 30
  granularity?: '1h'|'4h'|'1d'   // Optional: default '1d'
  tasks?: Task[]                  // Optional: default all tasks
}
```

**Response:**
```typescript
{
  ok: boolean
  summary?: string
  insights?: string[]
  predictions?: Prediction[]
  strategies?: Strategy[]
  charts?: Chart[]
  error?: string
}
```

### GET /health

**Response:**
```json
{
  "ok": true,
  "timestamp": "2025-10-16T10:30:00.000Z"
}
```

## Support

For issues or questions:
1. Check [MCP Server README](./mcp_server/README.md)
2. Review [System Architecture](./SYSTEM_ARCHITECTURE.md#mcp-analytics-server-integration)
3. Check server logs in `mcp_server/` directory
4. Verify environment variables are correctly set

## Next Steps

1. ✅ Set up MCP server
2. ✅ Configure environment variables
3. ✅ Test basic analysis request
4. 🔄 Integrate real market data APIs
5. 🔄 Add advanced ML models
6. 🔄 Implement caching layer
7. 🔄 Deploy to production
