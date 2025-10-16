# MCP Analytics Integration - Visual Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                              │
│                      (Next.js Frontend)                             │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   Trading   │  │    Chat     │  │  Portfolio  │                │
│  │   Interface │  │  Interface  │  │    View     │                │
│  └─────────────┘  └──────┬──────┘  └─────────────┘                │
│                          │                                          │
│                          │ "Analyze BTC"                            │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CHAT AGENT (Backend)                             │
│                  app/api/agent/chat/route.ts                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. Intent Detection                                         │  │
│  │     ├─ Regex: /(analyze|predict|forecast|strategy)/i        │  │
│  │     └─ Extract: coin symbol (BTC, ETH, SOL, etc.)          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  2. Call MCP Client                                          │  │
│  │     analyzeCoin({ coin: 'btc', horizonDays: 30 })          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS PROXY LAYER                              │
│                  app/api/mcp/analyze/route.ts                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  • Validates request                                         │  │
│  │  • Adds Bearer token authentication                          │  │
│  │  • Forwards to MCP server                                    │  │
│  │  • Returns response to chat agent                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────────┘
                           │ HTTP POST
                           │ {coin: "btc", horizonDays: 30}
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MCP ANALYTICS SERVER                             │
│                     mcp_server/main.ts                              │
│                      Express :8080                                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Step 1: Fetch Historical Data                              │  │
│  │  └─ Currently: Synthetic data for demo                      │  │
│  │  └─ Future: CoinGecko / CoinMarketCap API                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Step 2: Compute Technical Indicators                       │  │
│  │  ├─ RSI (Relative Strength Index)                           │  │
│  │  ├─ MACD (Moving Average Convergence Divergence)            │  │
│  │  ├─ SMA 30 & 50 (Simple Moving Averages)                    │  │
│  │  ├─ Volatility (Standard Deviation)                         │  │
│  │  └─ Trend Detection (Bullish/Bearish/Neutral)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Step 3: Generate Predictions                               │  │
│  │  ├─ Method: Linear regression + volatility                  │  │
│  │  ├─ Horizon: 1-7 days                                       │  │
│  │  └─ Output: Price + confidence score                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Step 4: Generate Trading Strategies                        │  │
│  │  ├─ DCA (Always available, low risk)                        │  │
│  │  ├─ Momentum (If bullish trend)                             │  │
│  │  ├─ Mean Reversion (If oversold)                            │  │
│  │  └─ Trend Following (If strong bullish)                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Step 5: Render Charts                                      │  │
│  │  ├─ Price History + Moving Averages (SVG)                   │  │
│  │  └─ Forecast + Confidence Bands (SVG)                       │  │
│  │  📁 Saved to: mcp_server/charts/*.svg                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Return JSON Response                                        │  │
│  │  {                                                           │  │
│  │    ok: true,                                                 │  │
│  │    summary: "BTC is trading at $64,250...",                 │  │
│  │    insights: [...],                                          │  │
│  │    predictions: [...],                                       │  │
│  │    strategies: [...],                                        │  │
│  │    charts: [...]                                             │  │
│  │  }                                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RESPONSE FORMATTING                              │
│                    Chat Agent formats data                          │
│                                                                     │
│  📊 Market Analysis                                                 │
│  BTC is trading at $64,250.00 (+2.45% 24h). Bullish trend...       │
│                                                                     │
│  💡 Key Insights:                                                   │
│  • RSI at 58.3 shows neutral momentum                              │
│  • 30-day MA above 50-day MA indicates bullish momentum            │
│                                                                     │
│  🔮 Price Predictions:                                              │
│  • 2025-10-17: $64,800.25 (68% confidence)                         │
│  • 2025-10-18: $65,200.50 (66% confidence)                         │
│                                                                     │
│  📈 Recommended Strategies:                                         │
│  🟢 DCA Core (low risk)                                             │
│     Weekly DCA into BTC over 4-8 weeks, rebalance monthly          │
│                                                                     │
│  📉 Charts:                                                         │
│  • Price History with Moving Averages                              │
│  • Price Forecast with Confidence Bands                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
User → Chat UI → Chat Agent → MCP Proxy → MCP Server → Analysis → Charts → Response
  ↓       ↓         ↓            ↓           ↓           ↓         ↓        ↓
Text   WebSocket  Intent    HTTP POST    Indicators  Generate   Store    Format
Input   Message  Detection  with Auth   Calculation   SVGs      Files    Display
```

## File Structure

```
Avax_prototype-v0.0.2/
│
├── 🌐 Frontend & Chat
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/chat/route.ts     ← Chat agent with MCP integration
│   │   │   └── mcp/
│   │   │       ├── analyze/route.ts    ← MCP proxy endpoint
│   │   │       └── health/route.ts     ← Health check
│   │   └── page.tsx
│   └── components/
│
├── 📚 Libraries & Utilities
│   └── lib/
│       ├── mcp/
│       │   ├── client.ts               ← MCP client utilities (NEW)
│       │   └── analytics-client.ts     ← Server-side MCP calls
│       └── agent.ts
│
├── 🧠 MCP Analytics Server
│   └── mcp_server/                     ← (NEW)
│       ├── main.ts                     ← Core analytics engine
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       ├── README.md
│       └── charts/                     ← Generated SVG files
│
├── 📖 Documentation
│   ├── README.md                       ← Updated with MCP section
│   ├── SYSTEM_ARCHITECTURE.md          ← Updated with MCP architecture
│   ├── MCP_INTEGRATION.md              ← Integration guide (NEW)
│   ├── INTEGRATION_SUMMARY.md          ← Visual summary (NEW)
│   └── .env.example                    ← Updated with MCP vars
│
└── 🛠️ Scripts
    └── scripts/
        ├── setup-mcp.sh                ← Automated setup (NEW)
        └── test-mcp.sh                 ← Testing script (NEW)
```

## API Flow

### Request Path
```
POST /api/agent/chat
{
  "messages": [{"role": "user", "content": "Analyze Bitcoin"}]
}
    ↓
Chat Agent detects: mcpIntent=true, coin="bitcoin"
    ↓
POST /api/mcp/analyze
{
  "coin": "btc",
  "horizonDays": 30,
  "granularity": "1d",
  "tasks": ["analysis", "prediction", "strategy", "charts"]
}
    ↓
Next.js Proxy adds: Authorization: Bearer API_KEY
    ↓
POST http://localhost:8080/analyze
{...same body...}
    ↓
MCP Server processes & returns JSON
    ↓
Proxy returns to Chat Agent
    ↓
Chat Agent formats for display
    ↓
Response sent to user
```

### Response Structure
```json
{
  "ok": true,
  "summary": "BTC is trading at $64,250 (+2.45% 24h)...",
  "insights": [
    "RSI at 58.3 shows neutral momentum",
    "30-day MA above 50-day MA indicates bullish momentum"
  ],
  "predictions": [
    {
      "date": "2025-10-17",
      "price": 64800.25,
      "probability": 0.68
    }
  ],
  "strategies": [
    {
      "name": "DCA Core",
      "description": "Weekly DCA into BTC...",
      "risk": "low"
    }
  ],
  "charts": [
    {
      "title": "Price History with Moving Averages",
      "url": "http://localhost:8080/charts/abc123.svg"
    }
  ]
}
```

## Component Interaction

```
┌────────────────┐
│   User Chat    │
└───────┬────────┘
        │
        ▼
┌────────────────┐       ┌─────────────────┐
│  Chat Agent    │◄─────►│  0xGasless Kit  │
│  (LangChain)   │       │  (Blockchain)   │
└───────┬────────┘       └─────────────────┘
        │
        │ (For analysis requests)
        ▼
┌────────────────┐
│   MCP Client   │
│   Library      │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  Next.js Proxy │
│  /api/mcp/*    │
└───────┬────────┘
        │
        ▼
┌────────────────────────────────┐
│   MCP Server (Express)         │
│   ┌─────────────────────────┐  │
│   │  Analysis Engine        │  │
│   │  • Technical Indicators │  │
│   │  • Predictions          │  │
│   │  • Strategies           │  │
│   │  • Chart Generation     │  │
│   └─────────────────────────┘  │
└────────────────────────────────┘
```

## Technology Stack

### MCP Server
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Charts**: SVG generation
- **Port**: 8080 (configurable)

### Integration
- **Framework**: Next.js 15
- **AI**: LangChain + 0xGasless
- **Proxy**: Next.js API Routes
- **Client**: Fetch API

### Analysis
- **Indicators**: RSI, MACD, SMA, Volatility
- **Predictions**: Linear regression + volatility
- **Strategies**: Rule-based generation
- **Charts**: SVG (scalable vector graphics)

## Environment Variables

### Main App (.env.local)
```env
MCP_ANALYTICS_URL=http://localhost:8080
MCP_ANALYTICS_API_KEY=your-secret-key
```

### MCP Server (mcp_server/.env)
```env
MCP_PORT=8080
MCP_BASE_URL=http://localhost:8080
MCP_ANALYTICS_API_KEY=your-secret-key
```

## Deployment Options

### Development
```
Local Machine
├── Next.js :3000
└── MCP Server :8080
```

### Production Option 1: Separate Services
```
Vercel (Next.js) ──→ Railway/Render (MCP)
     ↓                      ↓
   Users              Analytics Engine
```

### Production Option 2: Unified Docker
```
Docker Container
├── Next.js :3000
└── MCP Server :8080
```

### Production Option 3: Serverless
```
Vercel Functions
└── MCP as API Route (may have timeout limits)
```

## Key Features Summary

| Feature | Description | Status |
|---------|-------------|--------|
| Technical Analysis | RSI, MACD, SMA, Volatility | ✅ Implemented |
| Price Predictions | 7-day forecast with confidence | ✅ Implemented |
| Trading Strategies | DCA, Momentum, Mean Reversion, Trend | ✅ Implemented |
| Chart Generation | SVG price/forecast charts | ✅ Implemented |
| Chat Integration | Auto-detect analysis requests | ✅ Implemented |
| API Security | Bearer token authentication | ✅ Implemented |
| Real Data | CoinGecko/CoinMarketCap | ⏳ TODO |
| ML Models | Prophet, LSTM, Ensemble | ⏳ TODO |
| Caching | Redis/Database caching | ⏳ TODO |
| Backtesting | Strategy simulation | ⏳ TODO |

---

**Ready to analyze the markets with AI! 🚀📊**
