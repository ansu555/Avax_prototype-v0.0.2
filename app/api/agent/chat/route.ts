import { NextResponse } from "next/server"
import { AgentkitToolkit } from "@0xgasless/agentkit"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage } from "@langchain/core/messages"
import { MemorySaver } from "@langchain/langgraph"
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { getAgent } from "@/lib/agent"
import { analyzeCoin, mcpHealth } from "@/lib/mcp/analytics-client"
import { resolveTokenBySymbol } from "@/lib/tokens"
import { parseEther, type Address } from "viem"
import { fetchHistoricalData, formatHistoricalDataForAI } from "@/lib/coingecko-history"
import { formatTrigger } from "@/lib/shared/rules"

export const runtime = "nodejs"

type ClientMessage = { role: "user" | "assistant" | "system" | "tool"; content: string; toolName?: string }

function toLangChainMessages(msgs: ClientMessage[]): BaseMessage[] {
  return msgs.map((m) => {
    switch (m.role) {
      case "system":
        return new SystemMessage(m.content)
      case "assistant":
        return new AIMessage(m.content)
      case "tool":
        return new ToolMessage({ content: m.content, tool_call_id: m.toolName || "tool" })
      case "user":
      default:
        return new HumanMessage(m.content)
    }
  })
}

function getLLM() {
  const model = process.env.AI_MODEL || "gpt-4o-mini"
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase()
  const openrouter = process.env.OPENROUTER_API_KEY
  const openai = process.env.OPENAI_API_KEY
  if (provider === "openrouter" && openrouter) {
    return new ChatOpenAI({ model, apiKey: openrouter, configuration: { baseURL: "https://openrouter.ai/api/v1" } })
  }
  if (openai) {
    return new ChatOpenAI({ model, apiKey: openai })
  }
  // Fallback: if OPENROUTER is set but provider differs
  if (openrouter) {
    return new ChatOpenAI({ model, apiKey: openrouter, configuration: { baseURL: "https://openrouter.ai/api/v1" } })
  }
  throw new Error("Missing OPENROUTER_API_KEY or OPENAI_API_KEY")
}

export async function POST(req: Request) {
  try {
  const body = await req.json().catch(() => ({})) as { prompt?: string; messages?: ClientMessage[]; threadId?: string; walletAddress?: string; chainId?: number }
    const prompt = (body.prompt && typeof body.prompt === "string") ? body.prompt : undefined
    const incoming = Array.isArray(body.messages) ? body.messages : (prompt ? [{ role: "user", content: prompt }] as ClientMessage[] : [])
    if (!incoming.length) return NextResponse.json({ ok: false, error: "No prompt or messages provided" }, { status: 400 })

  const chainOverride = typeof body.chainId === 'number' ? body.chainId : undefined
  const { agentkit, getAddress, getBalance, smartTransfer, smartSwap, customSwap, publicClient, eoaClient, getEOAAddress, getSmartAddressOrNull } = await getAgent(chainOverride)
    const toolkit = new AgentkitToolkit(agentkit as any)
    const tools = toolkit.getTools()

    // Attempt to get LLM, but allow fallback parse if not available
    let llm: ChatOpenAI | undefined
    try {
      llm = getLLM()
    } catch {
      llm = undefined
    }
    const memory = new MemorySaver()
    const agent = llm
      ? createReactAgent({
          llm,
          tools,
          checkpointSaver: memory,
          messageModifier: `You are a helpful crypto agent using 0xGasless smart accounts. You can:
          - get the user's smart account address
          - check native and ERC20 balances (user can provide token contract)
          - perform gasless transfers and swaps on supported chains
          - fetch market data, token prices, gas estimates, and portfolio information
          Always explain actions in simple words. If a request is unsafe or unsupported, say so clearly.`,
        })
      : undefined

    const messages = toLangChainMessages(incoming)
    const config = { configurable: { thread_id: body.threadId || `web_${Date.now()}` } }

    // === EARLY INTENT DETECTION (bypasses LLM for reliable data) ===
    const lastUserMsg = [...incoming].reverse().find(m => m.role === 'user')?.content || ''
    const text = lastUserMsg.toLowerCase().trim()
    
    // Auto-pilot rule suggestion intent
    const ruleIntent = /(suggest|create|setup|build|make|generate|recommend).*?(rule|auto.*pilot|strategy|dca|rebalance)/i.test(lastUserMsg)
    
    // Address query intent (bypass agent for instant response)
    const addressIntent = /\b(what.{0,20}(is|s).{0,20}(my|the).{0,20}(address|wallet)|my.{0,10}address|my.{0,10}wallet|show.{0,10}address|get.{0,10}address)\b/i.test(lastUserMsg)
    
    if (addressIntent) {
      try {
        const { getAddress, getEOAAddress } = await getAgent(chainOverride)
        const smart = await getAddress()
        const eoa = await getEOAAddress()
        const clientEOA = (body.walletAddress && /^0x[a-fA-F0-9]{40}$/.test(body.walletAddress)) ? body.walletAddress : undefined
        
        let response = '🔑 **Your Wallet Addresses:**\n\n'
        
        // Smart Account (primary for gasless operations)
        response += `**Smart Account** (Gasless):\n\`${smart}\`\n\n`
        
        // Server EOA (agent's private key)
        response += `**Server EOA** (Agent Key):\n\`${eoa}\`\n\n`
        
        // Connected EOA (if provided from frontend)
        if (clientEOA) {
          response += `**Connected Wallet** (Your Browser):\n\`${clientEOA}\`\n\n`
        }
        
        response += '💡 *Use the Smart Account address for gasless transactions and receiving funds.*'
        
        if (smart.toLowerCase() === eoa.toLowerCase()) {
          response += '\n\n⚠️ *Note: Smart account shows EOA as fallback. Fund the EOA to deploy your smart account.*'
        }
        
        return NextResponse.json({ 
          ok: true, 
          content: response,
          threadId: config.configurable.thread_id 
        })
      } catch (e: any) {
        return NextResponse.json({ 
          ok: true, 
          content: `❌ Failed to retrieve addresses: ${e?.message || String(e)}`,
          threadId: config.configurable.thread_id 
        })
      }
    }
    
    // Balance query intent (bypass agent for instant response)
    const balanceIntent = /\b(what.{0,20}(is|s).{0,20}(my|the).{0,20}balance|my.{0,10}balance|show.{0,10}balance|get.{0,10}balance|check.{0,10}balance|balances?)\b/i.test(lastUserMsg)
    
    if (balanceIntent) {
      try {
        const { getAddress, getBalance } = await getAgent(chainOverride)
        const addr = await getAddress()
        const chainId = body.chainId || chainOverride || 43113
        
        // Check if specific token mentioned
        const tokenMatch = lastUserMsg.match(/\b(USDC|USDT|DAI|WETH|WBTC|WAVAX|ETH|BTC|AVAX)\b/i)
        const tokenSymbol = tokenMatch?.[1]?.toUpperCase()
        
        if (tokenSymbol && tokenSymbol !== 'AVAX') {
          // Get specific token balance
          const token = resolveTokenBySymbol(tokenSymbol, chainId)
          if (!token) {
            return NextResponse.json({ 
              ok: true, 
              content: `❌ Token ${tokenSymbol} not found on this chain.`,
              threadId: config.configurable.thread_id 
            })
          }
          
          const balance = await getBalance(token.address as Address, addr)
          const balNum = parseFloat(balance)
          const formattedBal = balNum >= 1 ? balNum.toFixed(4) : balNum.toExponential(4)
          
          return NextResponse.json({ 
            ok: true, 
            content: `💰 **${tokenSymbol} Balance:**\n\`${formattedBal} ${tokenSymbol}\`\n\n📍 Account: \`${addr}\``,
            threadId: config.configurable.thread_id 
          })
        } else {
          // Get native AVAX balance
          const nativeBalance = await getBalance(undefined, addr)
          const balNum = parseFloat(nativeBalance)
          const formattedBal = balNum.toFixed(4)
          
          let response = `💰 **Your Balances:**\n\n`
          response += `**Native Token (AVAX):**\n\`${formattedBal} AVAX\`\n\n`
          response += `📍 Account: \`${addr}\``
          
          if (balNum === 0) {
            response += '\n\n💡 *Fund your account to start making transactions.*'
            if (chainId === 43113) {
              response += '\n🚰 Get testnet AVAX: https://faucet.avax.network/'
            }
          }
          
          return NextResponse.json({ 
            ok: true, 
            content: response,
            threadId: config.configurable.thread_id 
          })
        }
      } catch (e: any) {
        return NextResponse.json({ 
          ok: true, 
          content: `❌ Failed to retrieve balance: ${e?.message || String(e)}`,
          threadId: config.configurable.thread_id 
        })
      }
    }
    
    // MCP analytics intents: analyze, predict, strategy, chart requests
    const mcpIntent = /(analy[sz]e|analysis|prediction|predict|forecast|strategy|strategies|portfolio\s+strategy|chart|charts|graph|graphs)/i.test(lastUserMsg)
    // If user explicitly asks for analysis of a specific coin
    // Improved pattern: matches "analyze bitcoin", "bitcoin analysis", "forecast for eth", etc.
    const mcpCoinMatch = 
      lastUserMsg.match(/(?:analy[sz]e|predict|forecast|strategy|chart)\s+([a-z0-9\-]{2,40})/i) ||  // "analyze bitcoin"
      lastUserMsg.match(/(?:of|for|on|about)\s+([a-z0-9\-]{2,40})/i) ||                               // "analysis of bitcoin"
      lastUserMsg.match(/\b([A-Za-z]{2,10})\b\s+(?:analysis|forecast|prediction|strategy)/i)          // "bitcoin analysis"
    
    // Filter out common words that aren't coins
    const blacklistedWords = ['previous', 'next', 'last', 'first', 'current', 'latest', 'recent', 'today', 'yesterday', 'tomorrow', 'this', 'that', 'these', 'those', 'same', 'other', 'another', 'some', 'any', 'all', 'each', 'every', 'both', 'few', 'many', 'more', 'most', 'several', 'such']
    const coinName = mcpCoinMatch?.[1]?.toLowerCase()
    const isValidCoin = coinName && !blacklistedWords.includes(coinName)
    
    if (mcpIntent && mcpCoinMatch && isValidCoin) {
      try {
        // Basic health check first (non-fatal if it fails, we continue and surface error)
        const health = await mcpHealth()
        const coinRaw = (mcpCoinMatch[1] || '').trim()
        const coin = coinRaw.toLowerCase()
        const horizonMatch = lastUserMsg.match(/(?:next|over|for)\s+(\d{1,3})\s*(?:days?|d)/i)
        const horizonDays = horizonMatch ? Math.min(365, Math.max(1, parseInt(horizonMatch[1], 10))) : 30
        const granularity: '1h' | '4h' | '1d' = /\b1h\b/i.test(lastUserMsg) ? '1h' : /\b4h\b/i.test(lastUserMsg) ? '4h' : '1d'

        // Detect chart type from user message
        let chartType: 'line' | 'bar' | 'candlestick' | 'area' = 'line'
        if (/\b(bar|bars|bar\s+chart)\b/i.test(lastUserMsg)) chartType = 'bar'
        else if (/\b(candlestick|candle|ohlc)\b/i.test(lastUserMsg)) chartType = 'candlestick'
        else if (/\b(area|area\s+chart)\b/i.test(lastUserMsg)) chartType = 'area'
        else if (/\b(line|linear|line\s+chart|linear\s+graph)\b/i.test(lastUserMsg)) chartType = 'line'

        // Fetch historical data for context (1 year by default)
        const historicalContext = await fetchHistoricalData(coin, 365, false).catch(() => null)

        const resp = await analyzeCoin({ coin, horizonDays, granularity, chartType, tasks: ['analysis', 'prediction', 'strategy', 'charts'] })
        if (!resp.ok) {
          return NextResponse.json({ ok: true, content: `❌ MCP error: ${resp.error || 'Unknown error'}${health.ok ? '' : `\nHealth: ${health.message || 'unreachable'}`}` , threadId: config.configurable.thread_id })
        }

        // Format a concise response for chat
        const parts: string[] = []
        
        // Add methodology explanation first (transparency)
        if (resp.methodology) {
          const m = resp.methodology
          parts.push(`🔍 **Prediction Methodology**\n📊 Analyzed: ${m.dataPoints} data points over ${m.timeframe}\n🧮 Method: ${m.method}\n📈 Indicators: ${m.indicators.join(', ')}\n🎯 Confidence: ${m.confidenceFactors}`)
        }
        
        // Add historical context if available
        if (historicalContext?.ok && historicalContext.statistics) {
          const stats = historicalContext.statistics
          parts.push(`📊 **${coin.toUpperCase()} - 1 Year Overview**\n💰 Current: $${stats.currentPrice.toFixed(6)} | 📈 High: $${stats.highestPrice.toFixed(6)} | 📉 Low: $${stats.lowestPrice.toFixed(6)}\n📊 Change: ${stats.priceChangePercent >= 0 ? '+' : ''}${stats.priceChangePercent.toFixed(2)}% | Volatility: ${stats.volatility.toFixed(2)}%`)
        }
        
        if (resp.summary) parts.push(`📊 ${resp.summary}`)
        if (resp.insights?.length) parts.push(`Insights:\n- ${resp.insights.slice(0, 5).join('\n- ')}`)
        if (resp.predictions?.length) {
          const next3 = resp.predictions.slice(0, 3).map(p => `• ${p.date}: $${Number(p.price).toFixed(4)}${p.probability ? ` (${Math.round((p.probability || 0) * 100)}%)` : ''}`).join('\n')
          parts.push(`Forecast (next):\n${next3}`)
        }
        if (resp.strategies?.length) {
          const s = resp.strategies.slice(0, 2).map(x => `• ${x.name} (${x.risk}) — ${x.description}`).join('\n')
          parts.push(`Strategies:\n${s}`)
        }
        
        // Show overall analysis (comprehensive summary)
        if (resp.overallAnalysis) {
          parts.push(`\n**📋 Overall Analysis:**\n${resp.overallAnalysis}`)
        }
        
        // Show chart links (Format 1 - clean and simple)
        if (resp.charts?.length) {
          const c = resp.charts.map(x => `• ${x.title}: ${x.url}`).join('\n')
          parts.push(`Charts:\n${c}`)
        }
        
        if (!parts.length) parts.push('No analysis available from MCP.')

        return NextResponse.json({ ok: true, content: parts.join('\n\n'), threadId: config.configurable.thread_id })
      } catch (e: any) {
        return NextResponse.json({ ok: true, content: `❌ MCP request failed: ${e?.message || String(e)}`, threadId: config.configurable.thread_id })
      }
    }
    
    // === AUTO-PILOT RULE SUGGESTION ===
    if (ruleIntent && mcpCoinMatch && isValidCoin) {
      try {
        const coinRaw = (mcpCoinMatch[1] || '').trim()
        const coin = coinRaw.toLowerCase()
        
        const baseUrl = process.env.MCP_ANALYTICS_URL || 'http://localhost:8080'
        const apiKey = process.env.MCP_ANALYTICS_API_KEY
        
        const response = await fetch(`${baseUrl}/suggest-rule`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
          },
          body: JSON.stringify({ coin, horizonDays: 30 })
        })
        
        if (!response.ok) {
          return NextResponse.json({ 
            ok: true, 
            content: `❌ Failed to generate rule suggestions for ${coin.toUpperCase()}`, 
            threadId: config.configurable.thread_id 
          })
        }
        
        const data = await response.json()
        
        if (data.ok && data.suggestions?.length) {
          const parts: string[] = []
          parts.push(`🤖 **Auto-Pilot Rule Suggestions for ${coin.toUpperCase()}**\n`)
          
          data.suggestions.forEach((sug: any, idx: number) => {
            parts.push(`\n**${idx + 1}. ${sug.strategy} Strategy** (${sug.riskLevel} risk)`)
            parts.push(`📋 ${sug.description}`)
            parts.push(`💡 ${sug.reasoning}`)
            parts.push(`\n**Trigger:** ${formatTrigger(sug.trigger)}`)
            parts.push(`**Suggested Settings:**`)
            parts.push(`• Max Spend: $${sug.suggestedParams.maxSpendUSD}`)
            parts.push(`• Max Slippage: ${sug.suggestedParams.maxSlippage}%`)
            parts.push(`• Cooldown: ${sug.suggestedParams.cooldownMinutes} minutes`)
            if (sug.suggestedParams.rotateTopN) {
              parts.push(`• Rotate Top: ${sug.suggestedParams.rotateTopN} coins`)
            }
          })
          
          parts.push(`\n\n💡 **To create a rule:** Click "Auto-Pilot Portfolio" in the header or "Add to Auto-Pilot" on the coin page.`)
          
          return NextResponse.json({ ok: true, content: parts.join('\n'), threadId: config.configurable.thread_id })
        }
        
        return NextResponse.json({ 
          ok: true, 
          content: `No rule suggestions available for ${coin.toUpperCase()} at this time.`, 
          threadId: config.configurable.thread_id 
        })
      } catch (e: any) {
        return NextResponse.json({ 
          ok: true, 
          content: `❌ Rule suggestion failed: ${e?.message || String(e)}`, 
          threadId: config.configurable.thread_id 
        })
      }
    }

    // === HISTORICAL DATA DETECTION ===
    // Detect requests for historical price data: "bitcoin history", "1 year data for eth", "price history of avax"
    const historyIntent = /(history|historical|past\s+(?:price|data)|(?:price|data)\s+history|year\s+(?:old|data)|month\s+(?:old|data)|since)/i.test(lastUserMsg)
    const historyMatch = 
      lastUserMsg.match(/(?:history|historical|past|data)\s+(?:of|for|on)?\s*([a-z0-9\-]{2,40})/i) ||  // "history of bitcoin"
      lastUserMsg.match(/([a-z0-9\-]{2,40})\s+(?:history|historical|past\s+data|price\s+history)/i) ||  // "bitcoin history"
      lastUserMsg.match(/(\d+)\s+(?:year|month|day)s?\s+(?:of|for)?\s*([a-z0-9\-]{2,40})/i)            // "1 year bitcoin"
    
    if (historyIntent && historyMatch) {
      try {
        // Extract coin name and time period
        let coin = historyMatch[2] || historyMatch[1] || ''
        coin = coin.toLowerCase().trim()
        
        // Skip if blacklisted word
        if (!blacklistedWords.includes(coin)) {
          // Extract days parameter
          let days: number | 'max' = 365 // default 1 year
          
          // Check for specific time periods
          const yearMatch = lastUserMsg.match(/(\d+)\s*years?/i)
          const monthMatch = lastUserMsg.match(/(\d+)\s*months?/i)
          const dayMatch = lastUserMsg.match(/(\d+)\s*days?/i)
          const maxMatch = /\b(all|max|maximum|complete|full|entire)\b/i.test(lastUserMsg)
          
          if (maxMatch) {
            days = 'max'
          } else if (yearMatch) {
            days = Math.min(365, parseInt(yearMatch[1]) * 365)
          } else if (monthMatch) {
            days = Math.min(365, parseInt(monthMatch[1]) * 30)
          } else if (dayMatch) {
            days = Math.min(365, parseInt(dayMatch[1]))
          }
          
          // Fetch historical data
          const histData = await fetchHistoricalData(coin, days, true)
          
          if (histData.ok && histData.statistics) {
            // Format comprehensive response
            const response = formatHistoricalDataForAI(histData)
            
            // Add trend analysis
            const trend = histData.statistics.priceChangePercent > 0 ? '📈 Upward trend' : '📉 Downward trend'
            const volatilityLevel = histData.statistics.volatility > 10 ? 'High' : histData.statistics.volatility > 5 ? 'Medium' : 'Low'
            
            const enhancedResponse = `${response}\n\n**Analysis:**\n${trend}\nVolatility Level: ${volatilityLevel}\nData Period: ${days === 'max' ? 'Maximum available' : `${days} days`}\n\n💡 *This data can be used for technical analysis, trend prediction, and investment decisions.*`
            
            return NextResponse.json({
              ok: true,
              content: enhancedResponse,
              threadId: config.configurable.thread_id,
              metadata: {
                type: 'historical_data',
                coin,
                days,
                dataPoints: histData.dataPoints
              }
            })
          } else {
            return NextResponse.json({
              ok: true,
              content: `❌ Could not fetch historical data for ${coin}. ${histData.error || 'Please check the coin name and try again.'}`,
              threadId: config.configurable.thread_id
            })
          }
        }
      } catch (e: any) {
        // Continue to other handlers if historical data fails
        console.error('Historical data error:', e)
      }
    }
    
    // Top coins with dynamic count - "top 5 coins", "show me 15 cryptocurrencies", etc.
    let topCoinsMatch = text.match(/top\s+(\d+)\s+(?:coin|crypto|cryptocurrency|token)/i)
    if (!topCoinsMatch) topCoinsMatch = text.match(/show\s+(?:me\s+)?(\d+)\s+(?:coin|crypto|cryptocurrency|token)/i)
    if (!topCoinsMatch) topCoinsMatch = text.match(/(\d+)\s+(?:top|best)\s+(?:coin|crypto|cryptocurrency)/i)
    
    if (topCoinsMatch || /\b(top|ranking|market|cryptocurrencies)\b/i.test(text)) {
      const count = topCoinsMatch?.[1] ? parseInt(topCoinsMatch[1]) : 5
      const n = Math.min(50, Math.max(1, count))
      
      try {
        const coinrankingApiUrl = `https://api.coinranking.com/v2/coins?limit=${n}&orderBy=marketCap&orderDirection=desc`
        const response = await fetch(coinrankingApiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          const coins = data.data?.coins || []
          
          if (coins.length > 0) {
            const formatPrice = (price: string) => {
              const num = parseFloat(price)
              if (num >= 1) return `$${num.toFixed(2)}`
              if (num >= 0.01) return `$${num.toFixed(4)}`
              return `$${parseFloat(price).toExponential(2)}`
            }
            
            const formatMarketCap = (marketCap: string) => {
              const num = parseFloat(marketCap)
              if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`
              if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
              if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
              return `$${num.toFixed(0)}`
            }
            
            const coinsText = coins.map((coin: any, index: number) => {
              const change = coin.change ? parseFloat(coin.change) : 0
              const changeText = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`
              const changeEmoji = change >= 0 ? '🟢' : '🔴'
              
              return `${index + 1}. **${coin.name} (${coin.symbol})**\n   💰 ${formatPrice(coin.price)} | 📊 ${formatMarketCap(coin.marketCap)} | ${changeEmoji} ${changeText}`
            }).join('\n\n')
            
            return NextResponse.json({
              ok: true,
              content: `📈 **Top ${n} Cryptocurrencies by Market Cap**\n\n${coinsText}\n\n*Data from CoinRanking API*`,
              threadId: config.configurable.thread_id
            })
          }
        }
      } catch (e) {
        // Continue to agent if API fails
      }
    }
    
    // Gas price - "gas price", "avax gas", "current gas fees" (must come before individual coin price)
    if (/\b(?:gas\s+(?:price|fee|cost)|avax\s+gas|current\s+gas|network\s+fee|gas\s+estimate)\b/i.test(text)) {
      try {
        const { createPublicClient, http } = require('viem')
        const { avalanche, avalancheFuji } = require('viem/chains')
        const chainId = Number(process.env.CHAIN_ID || 43113)
        const chain = chainId === 43114 ? avalanche : avalancheFuji
        const rpcUrl = chainId === 43114 
          ? (process.env.RPC_URL_AVALANCHE || 'https://api.avax.network/ext/bc/C/rpc')
          : (process.env.RPC_URL_FUJI || process.env.NEXT_PUBLIC_RPC_URL_FUJI || 'https://api.avax-test.network/ext/bc/C/rpc')
        const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
        
        const gasPrice = await publicClient.getGasPrice()
        const gasPriceGwei = Number(gasPrice) / 1e9
        const networkName = chainId === 43114 ? 'Avalanche Mainnet' : 'Avalanche Fuji Testnet'
        
        return NextResponse.json({
          ok: true,
          content: `⛽ **${networkName} Gas Price**\n\nCurrent: ${gasPriceGwei.toFixed(2)} Gwei\nNetwork: ${networkName} (Chain ID: ${chainId})\n\n*Real-time data from RPC*`,
          threadId: config.configurable.thread_id
        })
      } catch (e) {
        // Continue to agent if RPC fails
      }
    }
    
    // Balance check - "my balance", "balance", "show balance" (early detection)
    if (/\b(balance|balances)\b/.test(text)) {
      try {
        const eoaAddress = await getEOAAddress()
        const chainId = Number(process.env.CHAIN_ID || 43113)
        
        // Get AVAX balance directly via RPC
        const avaxBalance = await publicClient.getBalance({ address: eoaAddress })
        const avaxFormatted = Number(avaxBalance) / 1e18
        
        let tokenBalances = ''
        
        // Try to get WAVAX and USDC balances
        try {
          const wavaxToken = resolveTokenBySymbol('WAVAX')
          const usdcToken = resolveTokenBySymbol('USDC')
          
          if (wavaxToken && wavaxToken.address !== 'AVAX') {
            const wavaxBalance = await publicClient.readContract({
              address: wavaxToken.address as `0x${string}`,
              abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
              functionName: 'balanceOf',
              args: [eoaAddress]
            })
            const wavaxFormatted = Number(wavaxBalance) / 1e18
            tokenBalances += `\nWAVAX: ${wavaxFormatted.toFixed(4)}`
          }
          
          if (usdcToken && usdcToken.address !== 'AVAX') {
            const usdcBalance = await publicClient.readContract({
              address: usdcToken.address as `0x${string}`,
              abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
              functionName: 'balanceOf',
              args: [eoaAddress]
            })
            const usdcFormatted = Number(usdcBalance) / 1e18
            tokenBalances += `\nUSDC: ${usdcFormatted.toFixed(4)}`
          }
        } catch (tokenError) {
          // Token balance queries failed, but that's okay
        }
        
        return NextResponse.json({
          ok: true,
          content: `💰 **Your Balance** (Avalanche ${chainId === 43114 ? 'Mainnet' : 'Fuji'})\n\nAddress: ${eoaAddress}\n\nAVAX: ${avaxFormatted.toFixed(4)}${tokenBalances}`,
          threadId: config.configurable.thread_id
        })
      } catch (error) {
        // Continue to agent if balance fails
      }
    }
    
    // Smart account balance check - "smart balance", "smart account balance"
    if (/\b(smart\s+(?:account\s+)?balance|smart\s+account)\b/i.test(text)) {
      try {
        const smartAddress = await getSmartAddressOrNull()
        const eoaAddress = await getEOAAddress()
        const chainId = Number(process.env.CHAIN_ID || 43113)
        
        if (!smartAddress) {
          // Smart account not deployed - check EOA balance instead
          const avaxBalance = await publicClient.getBalance({ address: eoaAddress })
          const avaxFormatted = Number(avaxBalance) / 1e18
          
          return NextResponse.json({
            ok: true,
            content: `🏦 **Smart Account Status: Not Deployed**\n\n⚠️ Your smart account will be deployed on your first gasless transaction.\n\n**EOA Balance (Current):**\n💰 \`${avaxFormatted.toFixed(4)} AVAX\`\n\n📍 Address: \`${eoaAddress}\`\n\n💡 **Note:** Your EOA balance will be used until the smart account is deployed. After deployment, the smart account will have its own separate balance.\n\n🚰 Need more testnet AVAX? Visit: https://faucet.avax.network/`,
            threadId: config.configurable.thread_id
          })
        }
        
        // Get AVAX balance for smart account
        const avaxBalance = await publicClient.getBalance({ address: smartAddress })
        const avaxFormatted = Number(avaxBalance) / 1e18
        
        let tokenBalances = ''
        
        // Try to get WAVAX and USDC balances for smart account
        try {
          const wavaxToken = resolveTokenBySymbol('WAVAX')
          const usdcToken = resolveTokenBySymbol('USDC')
          
          if (wavaxToken && wavaxToken.address !== 'AVAX') {
            const wavaxBalance = await publicClient.readContract({
              address: wavaxToken.address as `0x${string}`,
              abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
              functionName: 'balanceOf',
              args: [smartAddress]
            })
            const wavaxFormatted = Number(wavaxBalance) / 1e18
            tokenBalances += `\nWAVAX: ${wavaxFormatted.toFixed(4)}`
          }
          
          if (usdcToken && usdcToken.address !== 'AVAX') {
            const usdcBalance = await publicClient.readContract({
              address: usdcToken.address as `0x${string}`,
              abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
              functionName: 'balanceOf',
              args: [smartAddress]
            })
            const usdcFormatted = Number(usdcBalance) / 1e18
            tokenBalances += `\nUSDC: ${usdcFormatted.toFixed(4)}`
          }
        } catch (tokenError) {
          // Token balance queries failed, but that's okay
        }
        
        return NextResponse.json({
          ok: true,
          content: `🏦 **Smart Account Balance** (Avalanche ${chainId === 43114 ? 'Mainnet' : 'Fuji'})\n\n✅ Smart Account Deployed\n\n💰 **AVAX:** \`${avaxFormatted.toFixed(4)}\`${tokenBalances}\n\n📍 Smart Account: \`${smartAddress}\``,
          threadId: config.configurable.thread_id
        })
      } catch (error) {
        return NextResponse.json({
          ok: true,
          content: `❌ Failed to check smart account balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
          threadId: config.configurable.thread_id
        })
      }
    }
    
    // Smart account address query - "smart address", "smart account address"
    if (/\b(smart\s+(?:account\s+)?address|smart\s+account)\b/i.test(text) && !/balance/i.test(text)) {
      try {
        const smartAddress = await getSmartAddressOrNull()
        const eoaAddress = await getEOAAddress()
        const chainId = Number(process.env.CHAIN_ID || 43113)
        const networkName = chainId === 43114 ? 'Avalanche Mainnet' : 'Avalanche Fuji testnet'
        
        if (!smartAddress) {
          // Smart account not deployed - provide clear guidance
          return NextResponse.json({
            ok: true,
            content: `🏦 **Smart Account Status**\n\n⚠️ **Not Deployed Yet**\n\nYour smart account is not deployed on ${networkName}. It will be automatically deployed on your first gasless transaction.\n\n**Your EOA Address:**\n\`${eoaAddress}\`\n\n**Current Balance:** Check with "get my balance"\n\n💡 **How to Deploy:**\n• Make any gasless transaction (transfer/swap)\n• The smart account will deploy automatically\n• You can use your EOA for now - it has the same address as your future smart account\n\n� **Need testnet AVAX?** Visit: https://faucet.avax.network/`,
            threadId: config.configurable.thread_id
          })
        }
        
        return NextResponse.json({
          ok: true,
          content: `🏦 **Smart Account Address**\n\n\`${smartAddress}\`\n\n📱 **Your EOA**: \`${eoaAddress}\`\n\n✅ Smart account is deployed on ${networkName}`,
          threadId: config.configurable.thread_id
        })
      } catch (error) {
        return NextResponse.json({
          ok: true,
          content: `❌ Failed to get smart account address: ${error instanceof Error ? error.message : 'Unknown error'}`,
          threadId: config.configurable.thread_id
        })
      }
    }
    
    // Transfer detection - "transfer 0.01 AVAX to 0x..." (early detection)
    const transferRe = /transfer\s+(\d+(?:\.\d+)?)\s*(?:([A-Za-z]{2,6}))?\s*(?:tokens?)?\s*(?:to|=>)\s*(0x[a-fA-F0-9]{40})/
    const tr = text.match(transferRe)
    if (tr) {
      const amount = tr[1]
      const symbol = tr[2] || 'AVAX' // Default to AVAX if no symbol specified
      const to = tr[3] as `0x${string}`
      
      try {
        if (symbol.toUpperCase() === 'AVAX') {
          // For AVAX transfers, use our direct implementation since AgentKit has issues with Fuji testnet
          
          // First check if we have enough balance
          const eoaAddress = await getEOAAddress()
          const currentBalance = await publicClient.getBalance({ address: eoaAddress })
          const transferAmount = parseEther(amount)
          
          // Get current gas price
          const gasPrice = await publicClient.getGasPrice()
          const gasLimit = BigInt(21000)
          const gasCost = gasPrice * gasLimit
          const totalCost = transferAmount + gasCost
          
          if (currentBalance < totalCost) {
            const currentBalanceEth = Number(currentBalance) / 1e18
            const totalCostEth = Number(totalCost) / 1e18
            const gasCostEth = Number(gasCost) / 1e18
            
            return NextResponse.json({
              ok: true,
              content: `❌ **Insufficient Balance**\n\nCurrent Balance: ${currentBalanceEth.toFixed(6)} AVAX\nTransfer Amount: ${amount} AVAX\nEstimated Gas Cost: ${gasCostEth.toFixed(6)} AVAX\nTotal Needed: ${totalCostEth.toFixed(6)} AVAX\n\nYou need ${(totalCostEth - currentBalanceEth).toFixed(6)} more AVAX to complete this transfer.`,
              threadId: config.configurable.thread_id
            })
          }
          
          const txHash = await eoaClient.sendTransaction({
            to,
            value: transferAmount,
            gas: gasLimit,
            gasPrice: gasPrice
          })
          await publicClient.waitForTransactionReceipt({ hash: txHash })
          
          return NextResponse.json({
            ok: true,
            content: `✅ Successfully transferred ${amount} AVAX to ${to.slice(0, 8)}...${to.slice(-6)}\n\nTransaction: ${txHash}\nGas Used: ${Number(gasCost) / 1e18} AVAX`,
            threadId: config.configurable.thread_id
          })
        } else {
          // For token transfers, continue to agent handling below
        }
      } catch (error) {
        return NextResponse.json({
          ok: true,
          content: `❌ Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your balance and try again.`,
          threadId: config.configurable.thread_id
        })
      }
    }
    
    // Individual coin price - "price of bitcoin", "BTC price", "what's ETH worth"
    const priceMatch = text.match(/\b(?:price\s+of\s+|what'?s\s+|current\s+price\s+of\s+)?([a-z]{2,10})\s+(?:price|worth|value|cost)\b/i) ||
                       text.match(/\b(?:price|worth|value|cost)\s+(?:of\s+)?([a-z]{2,10})\b/i) ||
                       text.match(/\bhow\s+much\s+(?:is\s+)?([a-z]{2,10})\b/i)
    if (priceMatch && priceMatch[1]) {
      const sym = priceMatch[1].toUpperCase()
      try {
        const coinrankingApiUrl = `https://api.coinranking.com/v2/coins?search=${sym.toLowerCase()}&limit=5`
        const response = await fetch(coinrankingApiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          const coin = data.data?.coins?.find((c: any) => 
            c.symbol.toUpperCase() === sym || c.name.toLowerCase() === sym.toLowerCase()
          )
          
          if (coin) {
            const price = parseFloat(coin.price)
            const change = coin.change ? parseFloat(coin.change) : 0
            const changeText = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`
            const changeEmoji = change >= 0 ? '🟢' : '🔴'
            
            const formatPrice = (price: number) => {
              if (price >= 1) return `$${price.toFixed(2)}`
              if (price >= 0.01) return `$${price.toFixed(4)}`
              return `$${price.toExponential(2)}`
            }
            
            const formatMarketCap = (marketCap: string) => {
              const num = parseFloat(marketCap)
              if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`
              if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
              if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
              return `$${num.toFixed(0)}`
            }
            
            return NextResponse.json({
              ok: true,
              content: `💰 **${coin.name} (${coin.symbol})**\n\nPrice: ${formatPrice(price)}\nMarket Cap: ${formatMarketCap(coin.marketCap)}\n${changeEmoji} 24h Change: ${changeText}\n\n*Data from CoinRanking API*`,
              threadId: config.configurable.thread_id
            })
          }
        }
      } catch (e) {
        // Continue to agent if API fails
      }
    }

    // Execute agent and collect the final response
    // Helper: simple intent fallback for common actions
  const fallback = async (): Promise<string | null> => {
      const lastUser = [...incoming].reverse().find((m) => m.role === "user")
      const text = (lastUser?.content || "").toLowerCase()
      if (!text) return null

      // Helper: decide which address to use based on phrasing
      const resolveAddressContext = async () => {
        const { getAddresses } = await getAgent(chainOverride)
        const { smart, eoa } = await getAddresses()
        const clientEOA = (body.walletAddress && /^0x[a-fA-F0-9]{40}$/.test(body.walletAddress)) ? body.walletAddress : undefined

        const mentionsConnected = /(connected|my wallet|metamask|my eoa|connected eoa|wallet address)/i.test(lastUser!.content)
        const mentionsServer = /(server eoa|agent eoa|agent key|server wallet)/i.test(lastUser!.content)
        const mentionsSmart = /(smart account|smart|gasless)/i.test(lastUser!.content)
        const mentionsEOAOnly = /\beoa\b/i.test(lastUser!.content)

        if (mentionsConnected) {
          return { target: clientEOA, label: 'Connected EOA', missing: !clientEOA }
        }
        if (mentionsServer) {
          return { target: eoa, label: 'Server EOA', missing: false }
        }
        if (mentionsSmart) {
          return { target: smart, label: 'Smart Account', missing: false }
        }
        if (mentionsEOAOnly) {
          // Prefer client EOA when unspecified, else server EOA
          return { target: clientEOA || eoa, label: clientEOA ? 'Connected EOA' : 'Server EOA', missing: !clientEOA && false }
        }
        // Default: prefer Connected EOA if provided (read-only friendly), else smart account
        if (clientEOA) {
          return { target: clientEOA, label: 'Connected EOA', missing: false }
        }
        return { target: smart, label: 'Smart Account', missing: false }
      }

      // Address
      if (/\b(address|wallet)\b/.test(text)) {
  const { getAddresses } = await getAgent(chainOverride)
        const { smart, eoa } = await getAddresses()
        const clientEOA = (body.walletAddress && /^0x[a-fA-F0-9]{40}$/.test(body.walletAddress)) ? body.walletAddress : undefined
        return [
          `Agent smart account (shared): ${smart}`,
          `Server EOA (agent key): ${eoa}`,
          clientEOA ? `Connected EOA (your wallet): ${clientEOA}` : undefined,
        ].filter(Boolean).join('\n')
      }

      // Market data and prices
    if (/\b(price|prices?|market|market data|top|tokens?)\b/.test(text)) {
  const { getTokenPrice, getMarketData } = await getAgent(chainOverride)
        
        // Check for specific token (case-insensitive, e.g., "price of eth")
        const symMatch = (lastUser!.content || '').match(/(?:price(?:\s+of)?\s+)?([a-z0-9]{2,10})/i)
        if (symMatch && symMatch[1]) {
          const sym = symMatch[1].toUpperCase()
          try {
            const priceData = await getTokenPrice(sym)
            return `${sym} price: $${priceData.price}`
          } catch (e) {
            // Fallback to CoinRanking API for individual coin prices
            try {
              const coinrankingApiUrl = `https://api.coinranking.com/v2/coins?search=${sym.toLowerCase()}&limit=1`
              const response = await fetch(coinrankingApiUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
              })
              
              if (response.ok) {
                const data = await response.json()
                const coin = data.data?.coins?.[0]
                if (coin && coin.symbol.toUpperCase() === sym) {
                  const price = parseFloat(coin.price)
                  const change = coin.change ? parseFloat(coin.change) : 0
                  const changeText = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`
                  const changeEmoji = change >= 0 ? '🟢' : '🔴'
                  
                  return `💰 **${coin.name} (${coin.symbol})**\nPrice: $${price >= 1 ? price.toFixed(2) : price.toFixed(6)}\n${changeEmoji} 24h Change: ${changeText}`
                }
              }
            } catch (coinRankingError) {
              // Silent fallback failure
            }
            return `Couldn't fetch price for ${sym}. Please check the symbol and try again.`
          }
        }
        
        // General market overview (only if user asked about market, not gas)
        if (/\b(market|top|coins?|cryptocurrencies|tokens?)\b/.test(text)) {
          try {
            // Determine requested count, default 5, cap at 50
            const nMatch = text.match(/top\s+(\d{1,2})/) || text.match(/show\s*(?:me)?\s*(\d{1,2})/)
            const n = Math.min(50, Math.max(1, nMatch ? parseInt(nMatch[1], 10) : 5))
            
            // Try AgentKit first
            try {
              const marketData = await getMarketData()
              const topCoins = (Array.isArray(marketData) ? marketData : [])
                .slice(0, n)
                .map((coin: any) => `${coin.symbol}: $${Number(coin.price || 0).toFixed(4)}`)
                .join(', ')
              if (topCoins) {
                return `Top ${n} cryptocurrencies: ${topCoins}`
              }
            } catch (agentError) {
              // Fallback to CoinRanking API
              const coinrankingApiUrl = `https://api.coinranking.com/v2/coins?limit=${n}&orderBy=marketCap&orderDirection=desc`
              const response = await fetch(coinrankingApiUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
              })
              
              if (response.ok) {
                const data = await response.json()
                const coins = data.data?.coins || []
                
                if (coins.length > 0) {
                  const formatPrice = (price: string) => {
                    const num = parseFloat(price)
                    if (num >= 1) return `$${num.toFixed(2)}`
                    if (num >= 0.01) return `$${num.toFixed(4)}`
                    return `$${parseFloat(price).toExponential(2)}`
                  }
                  
                  const formatMarketCap = (marketCap: string) => {
                    const num = parseFloat(marketCap)
                    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`
                    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
                    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
                    return `$${num.toFixed(0)}`
                  }
                  
                  const coinsText = coins.map((coin: any, index: number) => {
                    const change = coin.change ? parseFloat(coin.change) : 0
                    const changeText = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`
                    const changeEmoji = change >= 0 ? '🟢' : '🔴'
                    
                    return `${index + 1}. **${coin.name} (${coin.symbol})**\n   💰 ${formatPrice(coin.price)} | 📊 ${formatMarketCap(coin.marketCap)} | ${changeEmoji} ${changeText}`
                  }).join('\n\n')
                  
                  return `📈 **Top ${n} Cryptocurrencies by Market Cap**\n\n${coinsText}\n\n*Data from CoinRanking API*`
                }
              }
            }
            
            return `Couldn't fetch market data. Please try again later.`
          } catch (e) {
            return `Couldn't fetch market data: ${e instanceof Error ? e.message : 'Unknown error'}`
          }
        }
      }

      // Gas estimates
      if (/\b(gas|gas price|gas estimate|fees?)\b/.test(text)) {
        try {
          const { getGasEstimate } = await getAgent(chainOverride)
          const gasData = await getGasEstimate()
          return `Current gas price: ${gasData.gasPrice} Gwei\nBase fee: ${gasData.baseFee} Gwei\nChain: ${gasData.chain} (${gasData.chainId})`
        } catch (e) {
          // Fallback to direct RPC call for Avalanche Fuji
          try {
            const { createPublicClient, http } = require('viem')
            const { avalancheFuji } = require('viem/chains')
            const rpcUrl = process.env.RPC_URL_FUJI || process.env.NEXT_PUBLIC_RPC_URL_FUJI || 'https://api.avax-test.network/ext/bc/C/rpc'
            const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpcUrl) })
            
            const gasPrice = await publicClient.getGasPrice()
            const gasPriceGwei = Number(gasPrice) / 1e9
            
            return `⛽ **Avalanche Fuji Testnet Gas Price**\nCurrent: ${gasPriceGwei.toFixed(2)} Gwei\nNetwork: Avalanche Fuji (Chain ID: 43113)`
          } catch (fallbackError) {
            return `Couldn't fetch gas estimate: ${e instanceof Error ? e.message : 'Unknown error'}`
          }
        }
      }

      // Portfolio overview
      if (/\b(portfolio|portfolio overview|total value|net worth)\b/.test(text)) {
        try {
          const { getPortfolioOverview } = await getAgent(chainOverride)
          const addrCtx = await resolveAddressContext()
          if (addrCtx.missing) {
            return 'No connected wallet detected. Connect your wallet to query the Connected EOA portfolio.'
          }
          const portfolio = await getPortfolioOverview(addrCtx.target as any)
          const fmtUSD = (n: number) => {
            if (!Number.isFinite(n) || n === 0) return '0.00'
            const abs = Math.abs(n)
            if (abs > 0 && abs < 0.01) return (n < 0 ? '-' : '') + '0.01'
            return n.toFixed(2)
          }
          const assets = portfolio.assets.map((asset: any) => {
            const formattedBalance = parseFloat(asset.balance).toFixed(4)
            return `${asset.symbol}: ${formattedBalance} ($${fmtUSD(asset.valueUSD)})`
          }).join('\n')
          return `Portfolio Overview (${addrCtx.label}):\nTotal Value: $${fmtUSD(portfolio.totalValueUSD)}\n\nAssets:\n${assets}`
        } catch (e) {
          return `Couldn't fetch portfolio: ${e instanceof Error ? e.message : 'Unknown error'}`
        }
      }

      // Transaction history
      if (/\b(transactions?|history|recent|tx)\b/.test(text)) {
        try {
          const { getTransactionHistory } = await getAgent(chainOverride)
          const txs = await getTransactionHistory()
          if (txs.length === 0) {
            return "No recent transactions found."
          }
            const { getChainInfo } = await getAgent(chainOverride)
            const info = await getChainInfo()
            const nativeSym = info.nativeSymbol
            const recent = txs.slice(0, 3).map((tx: any) => 
            `${tx.status === 'success' ? '✅' : '❌'} ${tx.hash.slice(0, 8)}...${tx.hash.slice(-6)}: ${tx.value} ${nativeSym}`
          ).join('\n')
          return `Recent transactions:\n${recent}${txs.length > 3 ? `\n...and ${txs.length - 3} more` : ''}`
        } catch (e) {
          return `Couldn't fetch transaction history: ${e instanceof Error ? e.message : 'Unknown error'}`
        }
      }

      // Transfer: "transfer 0.01 USDC to 0x..." or "transfer 0.01 to 0x..."
      const transferRe = /transfer\s+(\d+(?:\.\d+)?)\s*(?:([A-Za-z]{2,6}))?\s*(?:tokens?)?\s*(?:to|=>)\s*(0x[a-fA-F0-9]{40})/
      const tr = lastUser!.content.match(transferRe)
      if (tr) {
        const amount = tr[1]
        const symbol = tr[2] || 'AVAX' // Default to AVAX if no symbol specified
        const to = tr[3] as `0x${string}`
        
        try {
          const { getChainInfo } = await getAgent(chainOverride)
          const info = await getChainInfo()
          
          if (symbol.toUpperCase() === 'AVAX') {
            // For AVAX transfers, use our direct implementation since AgentKit has issues with Fuji testnet
            const txHash = await eoaClient.sendTransaction({
              to,
              value: parseEther(amount),
              gas: BigInt(21000)
            })
            await publicClient.waitForTransactionReceipt({ hash: txHash })
            return `✅ Successfully transferred ${amount} AVAX to ${to.slice(0, 8)}...${to.slice(-6)}\n\nTransaction: ${txHash}`
          } else {
            // For token transfers, try AgentKit first, then fallback
            const token = resolveTokenBySymbol(symbol, info.chainId)
            if (!token) return `Unknown token symbol: ${symbol}`
            
            try {
              const { hash } = await smartTransfer({ tokenAddress: token.address === 'AVAX' ? undefined : (token.address as any), amount, destination: to, wait: true })
              return `✅ Successfully transferred ${amount} ${symbol} to ${to.slice(0, 8)}...${to.slice(-6)}\n\nTransaction: ${hash}`
            } catch (agentError) {
              return `❌ Transfer failed: ${agentError instanceof Error ? agentError.message : 'Unknown error'}\n\nPlease check your balance and try again.`
            }
          }
        } catch (error) {
          return `❌ Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your balance and try again.`
        }
      }

      // Enhanced Smart Transfer Patterns
      // Batch transfer: "batch transfer 0.01 ETH to 0x... and 0.02 USDC to 0x..."
      const batchTransferRe = /batch\s+transfer\s+(.+?)(?:\s+and\s+(.+))?/
      const batchMatch = lastUser!.content.match(batchTransferRe)
      if (batchMatch) {
        try {
          const { smartTransferAdvanced } = await getAgent()
          const transfers = []
          
          // Parse multiple transfers
          const transferTexts = [batchMatch[1], batchMatch[2]].filter(Boolean)
          for (const text of transferTexts) {
            const match = text.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]{2,6})?\s*(?:to|=>)\s*(0x[a-fA-F0-9]{40})/)
            if (match) {
              const [, amount, symbol, destination] = match
              const { getChainInfo } = await getAgent()
              const info = await getChainInfo()
              const token = symbol ? resolveTokenBySymbol(symbol, info.chainId) : null
              transfers.push({
                destination: destination as `0x${string}`,
                amount,
                tokenAddress: token && token.address === 'AVAX' ? undefined : (token?.address as any)
              })
            }
          }
          
          if (transfers.length > 0) {
            const result = await smartTransferAdvanced({ 
            amount: transfers[0].amount,
            destination: transfers[0].destination as `0x${string}`,
            batch: transfers, 
            wait: true 
          })
            return `Batch transfer submitted! ${transfers.length} transfers executed. Hash: ${result.hash}`
          }
        } catch (e: any) {
          return `Batch transfer failed: ${e.message}`
        }
      }

      // Scheduled transfer: "schedule transfer 0.01 ETH to 0x... for tomorrow at 2pm"
      const scheduledTransferRe = /schedule\s+transfer\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{2,6})?\s*(?:to|=>)\s*(0x[a-fA-F0-9]{40})\s+(?:for|at)\s+(.+)/i
      const scheduledMatch = lastUser!.content.match(scheduledTransferRe)
      if (scheduledMatch) {
        try {
          const [, amount, symbol, destination, timeText] = scheduledMatch
          const { getChainInfo } = await getAgent()
          const info = await getChainInfo()
          const token = symbol ? resolveTokenBySymbol(symbol, info.chainId) : null
          
          // Simple time parsing (you can enhance this)
          let scheduleDate = new Date()
          if (timeText.toLowerCase().includes('tomorrow')) {
            scheduleDate.setDate(scheduleDate.getDate() + 1)
          }
          if (timeText.includes('2pm') || timeText.includes('14:00')) {
            scheduleDate.setHours(14, 0, 0, 0)
          }
          
          const { smartTransferAdvanced } = await getAgent()
          const result = await smartTransferAdvanced({
            tokenAddress: token && token.address === 'AVAX' ? undefined : (token?.address as any),
            amount,
            destination: destination as `0x${string}`,
            schedule: scheduleDate,
            priority: 'normal'
          })
          
          return `Scheduled transfer set for ${scheduleDate.toLocaleString()}. Amount: ${amount} ${symbol || 'AVAX'} to ${destination.slice(0, 8)}...`
        } catch (e: any) {
          return `Scheduled transfer failed: ${e.message}`
        }
      }

      // Priority transfer: "urgent transfer 0.01 ETH to 0x..." or "cheap transfer 0.01 ETH to 0x..."
      const priorityTransferRe = /(urgent|fast|cheap|economy)\s+transfer\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{2,6})?\s*(?:to|=>)\s*(0x[a-fA-F0-9]{40})/
      const priorityMatch = lastUser!.content.match(priorityTransferRe)
      if (priorityMatch) {
        const [, priority, amount, symbol, destination] = priorityMatch
        try {
          const { getChainInfo } = await getAgent()
          const info = await getChainInfo()
          const token = symbol ? resolveTokenBySymbol(symbol, info.chainId) : null
          
          let routing: 'fastest' | 'cheapest' | 'mostReliable' = 'fastest'
          if (priority === 'cheap' || priority === 'economy') routing = 'cheapest'
          else if (priority === 'urgent' || priority === 'fast') routing = 'fastest'
          
          const { smartTransferWithRouting } = await getAgent()
          const result = await smartTransferWithRouting({
            tokenAddress: token && token.address === 'AVAX' ? undefined : (token?.address as any),
            amount,
            destination: destination as `0x${string}`,
            routing,
            wait: true
          })
          
          return `${priority.charAt(0).toUpperCase() + priority.slice(1)} transfer submitted! Hash: ${result.hash}\nRouting: ${routing}`
        } catch (e: any) {
          return `${priority.charAt(0).toUpperCase() + priority.slice(1)} transfer failed: ${e.message}`
        }
      }

      // Auto-swap transfer: "smart transfer 0.01 ETH to 0x..." (handles insufficient balance)
      const smartTransferRe = /smart\s+transfer\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{2,6})?\s*(?:to|=>)\s*(0x[a-fA-F0-9]{40})/
      const smartMatch = lastUser!.content.match(smartTransferRe)
      if (smartMatch) {
        try {
          const [, amount, symbol, destination] = smartMatch
          const { getChainInfo } = await getAgent()
          const info = await getChainInfo()
          const token = symbol ? resolveTokenBySymbol(symbol, info.chainId) : null
          
          const { smartTransferAdvanced } = await getAgent()
          const result = await smartTransferAdvanced({
            tokenAddress: token?.address === 'AVAX' ? undefined : (token?.address as any),
            amount,
            destination: destination as `0x${string}`,
            autoSwap: true, // Enable auto-swap for insufficient balance
            wait: true
          })
          
          return `Smart transfer executed! Hash: ${result.hash}\nAuto-swap enabled: ${result.details.autoSwap || false}`
        } catch (e: any) {
          return `Smart transfer failed: ${e.message}`
        }
      }

      // Swap: "swap 5 USDC to ETH"
      const swapRe = /swap\s+(\d+(?:\.\d+)?)\s*([A-Za-z]{2,6})\s*(?:to|for|->)\s*([A-Za-z]{2,6})/
      const sw = lastUser!.content.match(swapRe)
      if (sw) {
        const amount = sw[1]
        const fromSym = sw[2]
        const toSym = sw[3]
        // Try custom swap first (Fuji). Fallback to legacy smartSwap if custom fails for non-Fuji chains or config issues.
        try {
          const custom = await customSwap({ tokenInSymbol: fromSym, tokenOutSymbol: toSym, amount, slippageBps: 100, wait: true })
          return `Custom swap submitted. Tx hash: ${custom.hash}`
        } catch (e: any) {
          // Attempt legacy aggregator swap if available
          try {
            const legacy = await smartSwap({ tokenInSymbol: fromSym.toUpperCase(), tokenOutSymbol: toSym.toUpperCase(), amount, slippage: 0.5, wait: true })
            return `Legacy swap submitted. Tx hash: ${legacy.hash}`
          } catch (e2: any) {
            return `Swap failed. Custom error: ${e?.message || e}. Legacy error: ${e2?.message || e2}`
          }
        }
      }

      return null
    }

    if (!agent) {
      const fb = await fallback()
      if (fb) return NextResponse.json({ ok: true, content: fb, threadId: (config as any).configurable.thread_id })
  return NextResponse.json({ ok: false, error: "LLM not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY, or use simple commands: 'address', 'balance', 'transfer 0.01 to 0x..', 'swap 5 USDC to WETH'." }, { status: 429 })
    }

    try {
      const result = await agent.invoke({ messages }, config as any)
      const outMsgs = (result as any)?.messages as BaseMessage[] | undefined
      const last = Array.isArray(outMsgs) && outMsgs.length ? outMsgs[outMsgs.length - 1] : undefined
      const content = (last && typeof (last as any).content === "string") ? (last as any).content : (last?.content as any)?.toString?.() || ""
      return NextResponse.json({ ok: true, content, threadId: (config as any).configurable.thread_id })
    } catch (err: any) {
      const raw = String(err?.message || err)
      const quota = /quota|rate limit|429/i.test(raw)
      if (quota) {
        const fb = await fallback()
        if (fb) return NextResponse.json({ ok: true, content: fb, threadId: (config as any).configurable.thread_id })
      }
      const guidance = quota
        ? "LLM quota or rate limit hit. Set OPENROUTER_API_KEY (recommended) or ensure your OPENAI_API_KEY has credits."
        : raw
      return NextResponse.json({ ok: false, error: guidance }, { status: quota ? 429 : 500 })
    }
  } catch (e: any) {
    const msg = e?.message || "Agent error"
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
