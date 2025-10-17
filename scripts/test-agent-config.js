#!/usr/bin/env node

/**
 * 0xGasless Agent Diagnostics
 * Run: node scripts/test-agent-config.js
 */

require('dotenv').config({ path: '.env.local' })

console.log('=== 0xGasless Agent Configuration Check ===\n')

const checks = {
  'PRIVATE_KEY': !!process.env.PRIVATE_KEY,
  'CHAIN_ID': process.env.CHAIN_ID || '43113 (default)',
  'RPC_URL_FUJI': !!process.env.RPC_URL_FUJI,
  'RPC_URL_AVALANCHE': !!process.env.RPC_URL_AVALANCHE,
  'GASLESS_API_KEY_FUJI': !!process.env.GASLESS_API_KEY_FUJI,
  'GASLESS_API_KEY_AVALANCHE': !!process.env.GASLESS_API_KEY_AVALANCHE,
  'GASLESS_PAYMASTER_URL_FUJI': !!process.env.GASLESS_PAYMASTER_URL_FUJI,
  'GASLESS_PAYMASTER_URL_AVALANCHE': !!process.env.GASLESS_PAYMASTER_URL_AVALANCHE,
  'OPENAI_API_KEY': !!process.env.OPENAI_API_KEY,
}

console.log('Configuration Status:')
Object.entries(checks).forEach(([key, value]) => {
  const status = typeof value === 'boolean' 
    ? (value ? '✅' : '❌') 
    : '⚠️'
  const display = typeof value === 'boolean' 
    ? (value ? 'Present' : 'Missing') 
    : value
  console.log(`${status} ${key}: ${display}`)
})

console.log('\n=== Network RPC Test ===\n')

// Test RPC connectivity
async function testRPC(url, chainId, name) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId'
      })
    })
    
    if (!response.ok) {
      console.log(`❌ ${name}`)
      console.log(`   HTTP ${response.status}: ${response.statusText}`)
      return false
    }
    
    const data = await response.json()
    if (data.error) {
      console.log(`❌ ${name}`)
      console.log(`   RPC Error: ${data.error.message || JSON.stringify(data.error)}`)
      return false
    }
    
    const rpcChainId = parseInt(data.result, 16)
    const match = rpcChainId === chainId
    console.log(`${match ? '✅' : '❌'} ${name}`)
    console.log(`   URL: ${url}`)
    console.log(`   Chain ID: ${rpcChainId} ${match ? '(match)' : `(expected ${chainId})`}`)
    return match
  } catch (error) {
    console.log(`❌ ${name}`)
    console.log(`   Error: ${error.message}`)
    return false
  }
}

(async () => {
  let allGood = true
  
  if (process.env.RPC_URL_FUJI) {
    const result = await testRPC(process.env.RPC_URL_FUJI, 43113, 'Avalanche Fuji Testnet')
    allGood = allGood && result
  } else {
    console.log('⚠️ RPC_URL_FUJI not configured')
    allGood = false
  }
  
  console.log('')
  
  if (process.env.RPC_URL_AVALANCHE) {
    const result = await testRPC(process.env.RPC_URL_AVALANCHE, 43114, 'Avalanche Mainnet')
    allGood = allGood && result
  } else {
    console.log('⚠️ RPC_URL_AVALANCHE not configured')
  }
  
  console.log('\n=== Recommendations ===\n')
  
  const issues = []
  
  if (!process.env.PRIVATE_KEY) {
    issues.push('❌ PRIVATE_KEY is missing - Agent cannot initialize')
    issues.push('   Add to .env.local: PRIVATE_KEY=your_private_key_here')
  }
  
  if (!process.env.CHAIN_ID) {
    issues.push('⚠️ CHAIN_ID not set - defaults to 43113 (Fuji testnet)')
    issues.push('   Add to .env.local: CHAIN_ID=43113')
  }
  
  if (!process.env.GASLESS_API_KEY_FUJI && !process.env.GASLESS_API_KEY_AVALANCHE) {
    issues.push('❌ No GASLESS_API_KEY configured - Gasless operations will fail')
    issues.push('   Get API key from: https://0xgasless.com/dashboard')
    issues.push('   Add to .env.local: GASLESS_API_KEY_FUJI=your_key_here')
  }
  
  if (!process.env.OPENAI_API_KEY) {
    issues.push('❌ OPENAI_API_KEY missing - LangChain agent cannot work')
    issues.push('   Get API key from: https://platform.openai.com/api-keys')
    issues.push('   Add to .env.local: OPENAI_API_KEY=sk-...')
  }
  
  if (!process.env.RPC_URL_FUJI && !process.env.RPC_URL_AVALANCHE) {
    issues.push('❌ No RPC_URL configured - Cannot connect to blockchain')
    issues.push('   Add to .env.local:')
    issues.push('   RPC_URL_FUJI=https://api.avax-test.network/ext/bc/C/rpc')
    issues.push('   RPC_URL_AVALANCHE=https://api.avax.network/ext/bc/C/rpc')
  }
  
  if (issues.length > 0) {
    console.log('Issues Found:')
    issues.forEach(issue => console.log(issue))
    console.log('')
  }
  
  console.log('=== Test Checklist ===\n')
  console.log('Once configuration is complete, test in chat:')
  console.log('1. Type: "what\'s my address?"')
  console.log('   ✅ Should return 0x... address')
  console.log('')
  console.log('2. Type: "get my balance"')
  console.log('   ✅ Should return AVAX balance (may be 0)')
  console.log('')
  console.log('3. Type: "price of bitcoin"')
  console.log('   ✅ Should return current BTC price')
  console.log('')
  console.log('4. Fund wallet from faucet: https://faucet.avax.network/')
  console.log('   (Use address from step 1)')
  console.log('')
  console.log('5. Type: "transfer 0.001 AVAX to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"')
  console.log('   ✅ Should execute transfer and return tx hash')
  console.log('')
  
  if (allGood && issues.length === 0) {
    console.log('✅ Configuration looks good! Your agent should work.')
  } else {
    console.log('⚠️ Please fix the issues above before testing.')
  }
  
  console.log('\n=== Diagnostics Complete ===')
})()
