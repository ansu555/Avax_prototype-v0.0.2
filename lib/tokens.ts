import type { Address } from 'viem'

// Token registry trimmed to Avalanche Fuji (43113) only.
// NOTE: If mainnet or Base support is reintroduced, restore previous maps and conditional logic.

export type TokenInfo = {
  symbol: string
  address: Address | 'AVAX' // Native sentinel (ETH removed since only AVAX chain now)
  decimals: number
  coingeckoId?: string
}

// NOTE: Addresses below are commonly used Fuji testnet tokens (verify before use in production):
//  - WAVAX (Wrapped AVAX): 0xd00ae08403B9bbb9124bB305C09058E32C39A48c
//  - USDC.e (Bridged USDC): 0x5425890298aed601595a70AB815c96711a31Bc65
//  - WETH.e (Bridged WETH): 0x12162c3E810393dEC01362aBf156D7ecf6159528
//  - USDT.e (Bridged USDT): 0xA27f39E9C21b3376e1DA169e90e2DbA0C2e88d7b
// These may change; always confirm via Avalanche docs / explorer. Do NOT assume liquidity exists.
// Static Fuji tokens (only keeping AVAX, removing WAVAX/USDC since we override with test tokens)
const staticTokens: Record<string, TokenInfo> = {
  AVAX:  { symbol: 'AVAX',  address: 'AVAX', decimals: 18, coingeckoId: 'avalanche-2' },
  // Removed static WAVAX/USDC - will be replaced by our custom test tokens
  WETH:  { symbol: 'WETH.e', address: '0x12162c3E810393dEC01362aBf156D7ecf6159528', decimals: 18, coingeckoId: 'weth' },
  'WETH.E':  { symbol: 'WETH.e', address: '0x12162c3E810393dEC01362aBf156D7ecf6159528', decimals: 18, coingeckoId: 'weth' },
  USDT:  { symbol: 'USDT.e', address: '0xA27f39E9C21b3376e1DA169e90e2DbA0C2e88d7b', decimals: 6, coingeckoId: 'tether' },
  'USDT.E':  { symbol: 'USDT.e', address: '0xA27f39E9C21b3376e1DA169e90e2DbA0C2e88d7b', decimals: 6, coingeckoId: 'tether' },
}

// Dynamic custom tokens from env - using familiar symbols for test tokens
function getCustomEnvTokens(): Record<string, TokenInfo> {
  const out: Record<string, TokenInfo> = {}
  if (process.env.NEXT_PUBLIC_TOKEN_A) {
    // TOKEN_A is our test "WAVAX" 
    out.WAVAX = { symbol: 'WAVAX', address: process.env.NEXT_PUBLIC_TOKEN_A as Address, decimals: 18 }
  }
  if (process.env.NEXT_PUBLIC_TOKEN_B) {
    // TOKEN_B is our test "USDC"
    out.USDC = { symbol: 'USDC', address: process.env.NEXT_PUBLIC_TOKEN_B as Address, decimals: 18 }
  }
  if (process.env.NEXT_PUBLIC_TOKEN_C) {
    // TOKEN_C is our test "TokenC"
    out.TOKENC = { symbol: 'TOKENC', address: process.env.NEXT_PUBLIC_TOKEN_C as Address, decimals: 18 }
  }
  return out
}

export const FUJI_SYMBOL_TO_TOKEN: Record<string, TokenInfo> = {
  ...staticTokens,
  ...getCustomEnvTokens()
}

export function resolveTokenBySymbol(symbol?: string, chainId?: number): TokenInfo | null {
  if (!symbol) return null
  const key = symbol.toUpperCase()
  // Normalize variants (USDC.e => USDC.E etc.)
  return FUJI_SYMBOL_TO_TOKEN[key] ?? null
}

export function resolveTokenByCoinrankingId(): TokenInfo | null {
  return null
}
