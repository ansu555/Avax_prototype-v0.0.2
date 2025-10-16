#!/usr/bin/env node

/**
 * Test Script for Historical Data Integration
 * 
 * This script tests:
 * 1. Direct API calls to /api/history
 * 2. Different time ranges
 * 3. Various coin formats
 * 4. Error handling
 * 
 * Usage: node scripts/test-historical-data.js
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function testHistoricalAPI(coin, days, label) {
  log(`\n${colors.bold}Testing: ${label}${colors.reset}`)
  log(`Coin: ${coin}, Days: ${days}`, 'blue')
  
  try {
    const url = `${BASE_URL}/api/history?coin=${coin}&days=${days}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.ok) {
      log(`✅ SUCCESS`, 'green')
      log(`   Data Points: ${data.dataPoints}`)
      log(`   Current Price: $${data.statistics?.currentPrice?.toFixed(6) || 'N/A'}`)
      log(`   Price Change: ${data.statistics?.priceChangePercent?.toFixed(2) || 'N/A'}%`)
      log(`   Volatility: ${data.statistics?.volatility?.toFixed(2) || 'N/A'}%`)
      
      if (data.ohlcv && data.ohlcv.length > 0) {
        const firstCandle = data.ohlcv[0]
        log(`   First Candle: ${firstCandle.date} - O:${firstCandle.open.toFixed(2)} H:${firstCandle.high.toFixed(2)} L:${firstCandle.low.toFixed(2)} C:${firstCandle.close.toFixed(2)}`)
      }
      
      return true
    } else {
      log(`❌ FAILED: ${data.error}`, 'red')
      return false
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red')
    return false
  }
}

async function testChatIntegration(query) {
  log(`\n${colors.bold}Testing Chat: "${query}"${colors.reset}`, 'blue')
  
  try {
    const url = `${BASE_URL}/api/agent/chat`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: query }]
      })
    })
    
    const data = await response.json()
    
    if (data.ok) {
      log(`✅ SUCCESS`, 'green')
      log(`Response Preview:`, 'blue')
      const preview = data.content.slice(0, 200) + (data.content.length > 200 ? '...' : '')
      log(`   ${preview.replace(/\n/g, '\n   ')}`)
      return true
    } else {
      log(`❌ FAILED: ${data.error}`, 'red')
      return false
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red')
    return false
  }
}

async function testDateRange(coin, from, to) {
  log(`\n${colors.bold}Testing Date Range${colors.reset}`)
  log(`Coin: ${coin}, From: ${from}, To: ${to}`, 'blue')
  
  try {
    const url = `${BASE_URL}/api/history?coin=${coin}&from=${from}&to=${to}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.ok) {
      log(`✅ SUCCESS`, 'green')
      log(`   Data Points: ${data.dataPoints}`)
      log(`   Days: ${data.days}`)
      return true
    } else {
      log(`❌ FAILED: ${data.error}`, 'red')
      return false
    }
  } catch (error) {
    log(`❌ ERROR: ${error.message}`, 'red')
    return false
  }
}

async function main() {
  log(`
╔════════════════════════════════════════════════════════════╗
║   Historical Data Integration Test Suite                  ║
║   Testing CoinGecko API Integration                       ║
╚════════════════════════════════════════════════════════════╝
  `, 'bold')
  
  const results = []
  
  // Test 1: Bitcoin - 1 Year
  results.push(await testHistoricalAPI('bitcoin', 365, 'Bitcoin - 1 Year'))
  await delay(1000)
  
  // Test 2: Ethereum - 30 Days
  results.push(await testHistoricalAPI('ethereum', 30, 'Ethereum - 30 Days'))
  await delay(1000)
  
  // Test 3: AVAX - 90 Days
  results.push(await testHistoricalAPI('avax', 90, 'Avalanche (symbol) - 90 Days'))
  await delay(1000)
  
  // Test 4: avalanche-2 - 7 Days
  results.push(await testHistoricalAPI('avalanche-2', 7, 'Avalanche (ID) - 7 Days'))
  await delay(1000)
  
  // Test 5: Max history
  results.push(await testHistoricalAPI('bitcoin', 'max', 'Bitcoin - Maximum History'))
  await delay(1000)
  
  // Test 6: Date Range
  results.push(await testDateRange('ethereum', '2024-01-01', '2024-06-30'))
  await delay(1000)
  
  // Test 7: Invalid coin (should fail gracefully)
  log(`\n${colors.bold}Testing Error Handling${colors.reset}`)
  results.push(!await testHistoricalAPI('invalid-coin-xyz', 30, 'Invalid Coin (Expected to Fail)'))
  await delay(1000)
  
  // Test 8: Chat integration
  log(`\n${colors.bold}═══════════════════════════════════════${colors.reset}`)
  log(`${colors.bold}Chat Integration Tests${colors.reset}`)
  log(`${colors.bold}═══════════════════════════════════════${colors.reset}`)
  
  results.push(await testChatIntegration('Show me Bitcoin price history'))
  await delay(1500)
  
  results.push(await testChatIntegration('1 year data for Ethereum'))
  await delay(1500)
  
  results.push(await testChatIntegration('AVAX historical prices'))
  
  // Summary
  log(`\n${'═'.repeat(60)}`)
  log(`${colors.bold}TEST SUMMARY${colors.reset}`)
  log(`${'═'.repeat(60)}`)
  
  const passed = results.filter(r => r).length
  const failed = results.filter(r => !r).length
  
  log(`Total Tests: ${results.length}`)
  log(`Passed: ${passed}`, passed === results.length ? 'green' : 'yellow')
  log(`Failed: ${failed}`, failed === 0 ? 'green' : 'red')
  
  if (passed === results.length) {
    log(`\n✅ ${colors.green}${colors.bold}ALL TESTS PASSED!${colors.reset}`)
    log(`\n🚀 Historical data integration is working perfectly!`, 'green')
  } else {
    log(`\n⚠️  ${colors.yellow}${colors.bold}SOME TESTS FAILED${colors.reset}`)
    log(`\nPlease check the errors above and ensure:`, 'yellow')
    log(`  1. Your Next.js dev server is running (npm run dev)`)
    log(`  2. CoinGecko API key is configured in .env.local`)
    log(`  3. All dependencies are installed`)
  }
  
  log(`\n${'═'.repeat(60)}\n`)
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run tests
main().catch(error => {
  log(`\n❌ Fatal Error: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})
