# 10xSwap:

10xSwap is a modern web application that allows users to explore cryptocurrency markets, manage assets on  Avalanche. It features an AI-powered chat agent that can understand natural language commands to perform actions like checking balances, getting token prices, and executing swaps and transfers.

## Table of Contents

- [🏗️ System Architecture](#️-system-architecture)
- [⚙️ Backend Architecture](#️-backend-architecture)
- [🚀 How It Works](#-how-it-works-project-architecture)
- [🛠️ Getting Started](#️-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#1-installation)
  - [Environment Setup](#2-environment-setup)
  - [Running the Application](#3-running-the-application)
- [🔧 API Keys & Configuration](#-api-keys--configuration)
- [📡 API Endpoints](#-api-endpoints)
- [🤖 AI Agent Features](#-ai-agent-features)
- [📖 Documentation](#-documentation)

## 🏗️ System Architecture

For a comprehensive overview of the system design, multi-chain infrastructure, and technology stack, see:
**[📋 System Architecture Documentation](./SYSTEM_ARCHITECTURE.md)**

## ⚙️ Backend Architecture

For detailed technical implementation details, agent factory patterns, transaction pipeline, and performance optimization strategies, see:
**[🔧 Backend Architecture Documentation](./BACKEND_ARCHITECTURE.md)**

## 🚀 How It Works: Project Architecture

The project is built on **Next.js** using the App Router, providing a fast, server-rendered frontend with serverless API endpoints for backend logic. It supports multiple blockchain networks including **Base** and **Avalanche** mainnet with gasless transaction capabilities.

-   **`app/`**: Contains the main pages (`/`, `/cryptocurrencies`, etc.) and the primary UI layout.
-   **`components/`**: Houses all reusable React components, including the chat interface, data tables, and UI primitives from `shadcn/ui`.
-   **`lib/`**: The core of the backend logic resides here.
    -   `lib/agent.ts`: Configures the 0xGasless Agentkit for multi-chain support, defines all blockchain interaction functions (e.g., `getBalance`, `smartSwap`), and sets up the AI agent's tools.
    -   `lib/tokens.ts`: A registry for supported ERC-20 tokens across Base and Avalanche networks.
-   **`app/api/`**: Contains all backend serverless functions. The most important is `/api/agent/chat`, which serves as the brain for the AI chat.

The application supports **Base** (8453) and **Avalanche** (43114) mainnets, as well as Fuji testnet (43113), leveraging their unique advantages and fast transaction times.

## 🛠️ Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

-   [Node.js](https://nodejs.org/en) (v18 or later)
-   [Bun](https://bun.sh/) (for package management and running scripts)

### 1. Installation

Clone the repository and install the dependencies using Bun:

```bash
git clone <repository-url>
cd 10x_Swap
bun install
```

### 2. Environment Setup

Create a `.env.local` file in the root of the project by copying from `.env.example`. This file will store all your secret keys and configuration variables.

```bash
cp .env.example .env.local
```

For detailed setup instructions and API key sources, see the [🔧 API Keys & Configuration](#-api-keys--configuration) section below.

### 3. Running the Application

Once your `.env.local` file is configured, you can start the development server:

```bash
bun run dev
```

The application will be available at `http://localhost:3000`.

## 🔧 API Keys & Configuration

The application requires several API keys for full functionality. Here's where to obtain each one:

### 🔑 Required API Keys

| Service | Environment Variable | Where to Get | Purpose |
|---------|---------------------|--------------|---------|
| **0xGasless** | `GASLESS_API_KEY_*` | [0xGasless Dashboard](https://dashboard.0xgasless.com/) | Gasless transaction sponsorship |
| **0xGasless Paymaster** | `GASLESS_PAYMASTER_URL_*` | [0xGasless Dashboard](https://dashboard.0xgasless.com/) | Per-chain paymaster endpoints |
| **OpenRouter** | `OPENROUTER_API_KEY` | [OpenRouter Platform](https://openrouter.ai/keys) | AI/LLM services (recommended) |
| **OpenAI** | `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | Alternative AI provider |
| **CoinRanking** | `COINRANKING_API_KEY` | [CoinRanking API](https://developers.coinranking.com/api) | Cryptocurrency market data |
| **0x Protocol** | `OX_API_KEY` | [0x API Dashboard](https://0x.org/api) | Token swap price quotes |

### 🔗 RPC Endpoints

| Network | Environment Variable | Free Options | Premium Options |
|---------|---------------------|--------------|-----------------|
| **Fuji Testnet** | `RPC_URL_FUJI` | [Fuji Public RPC](https://api.avax-test.network/ext/bc/C/rpc) | [Alchemy](https://alchemy.com), [Infura](https://infura.io) |


The application supports per-chain configuration. Each chain requires its own set of API keys and endpoints:

- **Avalanche Mainnet (43114)**: `*_AVALANCHE` suffix  
- **Fuji Testnet (43113)**: `*_FUJI` suffix

Example configuration pattern:
```env

# Avalanche Mainnet
GASLESS_API_KEY_AVALANCHE="your_avalanche_api_key"
GASLESS_PAYMASTER_URL_AVALANCHE="your_avalanche_paymaster_url"
RPC_URL_AVALANCHE="your_avalanche_rpc_url"
```

### 🔐 Security Notes

- **NEVER** use a private key with significant real funds for `PRIVATE_KEY`
- Use a dedicated wallet for testing and development
- Keep your `.env.local` file secure and never commit it to version control
- Consider using different API keys for development and production environments

## 📡 API Endpoints

The project's backend is primarily centered around a single, powerful API endpoint that drives the AI chat.

### `POST /api/agent/chat`

This is the main endpoint for all user interactions with the AI agent.

-   **Responsibility**: It receives chat messages, determines user intent, and orchestrates calls to the appropriate backend functions or the AI agent. It supports both a fast, regex-based fallback for simple commands and a full LLM-based agent for complex queries.
-   **File Location**: `app/api/agent/chat/route.ts`

#### Request Body

```json
{
  "messages": [
    { "role": "user", "content": "what's my address?" }
  ],
  "threadId": "optional-session-id",
  "walletAddress": "0x... (optional, from user's connected wallet)",
  "chainId": 8453
}
}
```

#### Response Body

```json
{
  "ok": true,
  "content": "Smart Account (gasless): 0x...",
  "threadId": "session-id"
}
```

## 🤖 AI Agent Features

### 0xGasless & AI Agent Implementation

The core of this project is the integration of gasless transactions via **0xGasless Agentkit** and natural language processing with an AI agent across multiple blockchain networks.

### 📊 Historical Price Data & Analysis (NEW!)

The AI agent now has access to comprehensive historical price data from CoinGecko, enabling advanced market analysis and predictions:

**Features:**
- ✅ **1 year of historical data** for any cryptocurrency
- ✅ **Complete price history** using `days=max` (can be years!)
- ✅ **Automatic trend analysis** (volatility, price changes, highs/lows)
- ✅ **OHLCV candlestick data** for technical analysis
- ✅ **Natural language queries** - just ask in chat!

**Example Queries:**
```
"Show me Bitcoin price history"
"Get 1 year data for Ethereum"
"AVAX historical prices"
"Analyze Bitcoin with 12 months context"
```

**API Access:**
```bash
# Get 1 year of Bitcoin data
curl "http://localhost:3000/api/history?coin=bitcoin&days=365"

# Get all available data
curl "http://localhost:3000/api/history?coin=ethereum&days=max"
```

📖 **[Complete Historical Data Guide →](./HISTORICAL_DATA_GUIDE.md)**  
🚀 **[Quick Start Guide →](./HISTORICAL_DATA_QUICKSTART.md)**  
💡 **[Code Examples →](./lib/examples/historical-data-examples.ts)**

### 0xGasless Smart Account

We use an ERC-4337 Smart Account to execute transactions on behalf of the user without requiring them to pay for gas directly. The system supports multiple chains with per-chain configuration.

1.  **Multi-Chain Initialization**: In `lib/agent.ts`, we configure the `Agentkit` with chain-specific parameters. Each chain has its own API keys, paymaster URLs, and RPC endpoints.

    ```typescript
    // lib/agent.ts
    import { Agentkit } from '@0xgasless/agentkit';

    // ... inside buildAgent(chainId)
    const agentkit = await Agentkit.configureWithWallet({
      privateKey: PRIVATE_KEY,
      rpcUrl: getRpcUrl(chainId),
      apiKey: getGaslessApiKey(chainId),
      chainID: chainId,
      paymasterUrl: getPaymasterUrl(chainId),
    });

    // The smart account is accessed via agentkit.smartAccount
    const smartAccountAddress = await agentkit.smartAccount.getAddress();
    ```

2.  **Executing Transactions**: All on-chain actions like `smartTransfer` and `smartSwap` are executed through the `agentkit.smartAccount` instance. This ensures they are routed through the paymaster for gas sponsorship.

    ```typescript
    // lib/agent.ts
    async function smartTransfer(opts) {
      const sa = agentkit.smartAccount;
      // For native ETH transfer
      const tx = await sa.sendTransaction({ to: destination, value });
      // For ERC20 transfer
      const tx = await sa.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [destination, value],
      });
      return { hash: tx };
    }
    ```

### AI Agent Actions & Triggers

The AI chat understands a variety of commands. For speed and cost-efficiency, simple commands are handled by a regex-based parser in `app/api/agent/chat/route.ts`. More complex requests are passed to a LangChain agent.

Here is a detailed map of triggers and actions:

#### 🔑 Address
- **Triggers**: `address`, `wallet`
- **Action**: Shows the gasless Smart Account, the server's EOA, and the user's connected wallet address (if available).

#### 💰 Balances
- **Triggers**: `balance`, `balances`
- **Default Account**: Smart Account
- **Examples**:
  - `Avax balance` → `avax: 0.0000 ($0.00)`
  - `USDC balance` → `USDC: 5.0000 ($5.00)`
  - `balance 0x...` → Fetches balance for a specific token contract.
- **Targeting Other Accounts**:
  - `ETH balance connected eoa` → Shows balance for your connected wallet.
  - `USDC balance server eoa` → Shows balance for the server's key.

#### 📊 Prices & Market
- **Triggers**: `price`, `prices`, `market`, `top`, `tokens`
- **Examples**:
  - `price avax`,
  - `market`, `top 10 coins`

#### ⛽ Gas
- **Triggers**: `gas`, `gas price`, `fees`
- **Action**: Shows the current gas and base fee on the Base network.

#### 📂 Portfolio
- **Triggers**: `portfolio`, `overview`, `total value`, `net worth`
- **Default Account**: Smart Account
- **Targeting**: Works just like balances (`portfolio connected eoa`, `portfolio server eoa`).

#### 🔄 Transactions
- **Triggers**: `transactions`, `history`, `recent`, `tx`
- **Action**: Shows a summary of recent transactions from the Smart Account.

#### 💸 Transfer (from Smart Account)
- **Basic**: `transfer 0.01 ETH to 0x...`
- **Priority**: `fast transfer 1 USDC to 0x...` (options: `fast`, `cheap`, `urgent`, `economy`)
- **Smart (Auto-Swap)**: `smart transfer 5 USDC to 0x...` (swaps other assets if balance is too low)
- **Batch**: `batch transfer 1 USDC to 0xA and 0.5 ETH to 0xB`

## 📦 Supported tokens

This project maintains a small registry of supported tokens per chain in `lib/tokens.ts`. The UI and backend expect these symbols when requesting balances or swaps.

Base mainnet (8453)

| Symbol | Address |
|--------|---------|
| avax    | native  |
| Wavax   | 0x4200000000000000000000000000000000000006 |
| usdc   | 0x833589fCD6EDb6E08f4c7C10d6D3e96cF6a47b8f |

Avalanche mainnet (43114)

| Symbol | Address |
|--------|---------|
| AVAX   | native  |
| WAVAX  | 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7 |
| USDC   | 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E |

Fuji testnet (43113)

| Symbol | Address |
|--------|---------|
| AVAX   | native  |
| WAVAX  | 0xd00ae08403B9bbb9124bb305C09058E32C39A48c |
| USDC   | 0x5425890298aed601595a70AB815c96711a31Bc65 |

If you need additional tokens supported, add them to `lib/tokens.ts` and the UI will pick them up automatically.
- **Scheduled**: `schedule transfer 2 USDC to 0x... for tomorrow at 2pm`

#### 🔁 Swap (gasless, from Smart Account)
- **Format**: `swap <amount> <FROM> to <TO>`
- **Example**: `swap 5 USDC to ETH`

#### 🎯 Address Targeting Keywords
Use these keywords in your balance or portfolio queries to specify the address.
- **Connected EOA**: `connected`, `my wallet`, `metamask`, `my eoa`
- **Server EOA**: `server eoa`, `agent key`, `server wallet`
- **Smart Account**: `smart account`, `smart`, `gasless`
- **Plain "eoa"**: Defaults to your connected wallet if available, otherwise falls back to the server EOA.

### Other API Routes

-   `/api/db/`: Handles database interactions (not fully implemented).
-   `/api/price/`: Could be used for direct price queries (currently handled within the agent).
-   `/api/poller/`, `/api/rules/`, `/api/logs/`: Support for background tasks and internal tooling.

## � MCP Analytics Server

The project includes an **MCP (Market Context Protocol) Analytics Server** that provides advanced crypto market analysis, predictions, trading strategies, and chart generation.

### Features

- 📈 **Technical Analysis**: RSI, MACD, Moving Averages, Volatility indicators
- 🔮 **Price Predictions**: 7-day forecasts with probability scores
- 💡 **Trading Strategies**: DCA, momentum, mean reversion, trend following
- 📉 **Chart Generation**: SVG charts with historical data and forecasts

### Setup

1. **Install MCP Server Dependencies**
   ```bash
   cd mcp_server
   npm install
   ```

2. **Configure MCP Environment**
   ```bash
   cd mcp_server
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start MCP Server**
   ```bash
   # Development (with auto-reload)
   npm run dev
   
   # Production
   npm start
   ```

   The MCP server will run on `http://localhost:8080` by default.

4. **Configure Next.js to Connect**
   
   Add to your `.env.local`:
   ```env
   MCP_ANALYTICS_URL=http://localhost:8080
   MCP_ANALYTICS_API_KEY=your-secret-key-here
   ```

### Using MCP in Chat

Once running, you can ask the AI agent to analyze coins:

**Examples:**
- `"Analyze BTC"`
- `"Give me a 30-day forecast for ETH"`
- `"What's the trading strategy for AVAX?"`
- `"Show me charts for SOL"`
- `"Predict Bitcoin price for next 7 days"`

The agent will automatically detect analysis requests and call the MCP server to provide:
- Market summaries with current trends
- Technical indicator insights (RSI, MACD, Moving Averages)
- Price predictions with confidence levels
- Recommended trading strategies based on market conditions
- Interactive charts with historical data and forecasts

### MCP Documentation

For detailed MCP server documentation, see:
- **[MCP Server README](./mcp_server/README.md)**: Complete API reference, configuration options, and development guide

## �📖 Documentation

### Architecture Documentation

- **[📋 System Architecture](./SYSTEM_ARCHITECTURE.md)**: Comprehensive system overview, multi-chain infrastructure, technology stack, data flow, and security considerations
- **[🔧 Backend Architecture](./BACKEND_ARCHITECTURE.md)**: Detailed technical implementation, agent factory patterns, transaction pipeline, AI integration, and performance optimization
- **[📊 MCP Server](./mcp_server/README.md)**: Analytics server API reference and setup guide

### Quick Links

- [🚀 Getting Started](#️-getting-started) - Set up the project locally
- [🔧 API Keys & Configuration](#-api-keys--configuration) - Complete setup guide with all API sources
- [🤖 AI Agent Features](#-ai-agent-features) - Understanding the AI chat capabilities
- [📡 API Endpoints](#-api-endpoints) - Backend API reference
- [📊 MCP Analytics](#-mcp-analytics-server) - Market analysis and predictions

### Support

For questions or issues:
1. Check the [System Architecture](./SYSTEM_ARCHITECTURE.md) for high-level understanding
2. Review the [Backend Architecture](./BACKEND_ARCHITECTURE.md) for implementation details
3. See the [MCP Server README](./mcp_server/README.md) for analytics integration
4. Ensure all API keys are correctly configured using the [configuration guide](#-api-keys--configuration)
