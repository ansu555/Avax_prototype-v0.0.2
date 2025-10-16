/**
 * Test Script to Check CoinGecko Historical Data Availability
 * 
 * This script tests:
 * 1. What historical data is available for each token
 * 2. The earliest date available
 * 3. Data quality for different time ranges
 */

const API_KEY = 'CG-yBGPehgHHsHoKf6haCAaEAWf';
const BASE_URL = 'https://api.coingecko.com/api/v3';

async function fetchCoinData(coinId) {
    const url = `${BASE_URL}/coins/${coinId}?localization=false&tickers=false&market_data=true`;
    const response = await fetch(url, {
        headers: {
            'x-cg-demo-api-key': API_KEY
        }
    });
    return response.json();
}

async function fetchMaxHistory(coinId) {
    const url = `${BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=max`;
    const response = await fetch(url, {
        headers: {
            'x-cg-demo-api-key': API_KEY
        }
    });
    return response.json();
}

async function testTokenHistory(coinId) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${coinId.toUpperCase()}`);
    console.log('='.repeat(60));
    
    try {
        // Get coin details
        const coinData = await fetchCoinData(coinId);
        console.log(`\n📊 Token: ${coinData.name} (${coinData.symbol.toUpperCase()})`);
        console.log(`🔢 Rank: #${coinData.market_cap_rank || 'N/A'}`);
        console.log(`📅 Genesis Date: ${coinData.genesis_date || 'Unknown'}`);
        
        // Get maximum available history
        console.log(`\n📈 Fetching maximum historical data...`);
        const historyData = await fetchMaxHistory(coinId);
        
        if (historyData.prices && historyData.prices.length > 0) {
            const firstPrice = historyData.prices[0];
            const lastPrice = historyData.prices[historyData.prices.length - 1];
            
            const firstDate = new Date(firstPrice[0]);
            const lastDate = new Date(lastPrice[0]);
            
            console.log(`\n✅ Historical Data Available:`);
            console.log(`   From: ${firstDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}`);
            console.log(`   To:   ${lastDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}`);
            console.log(`   Total Days: ${Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24))} days`);
            console.log(`   Data Points: ${historyData.prices.length}`);
            
            console.log(`\n💰 Price Range:`);
            console.log(`   First Price: $${firstPrice[1].toFixed(6)}`);
            console.log(`   Latest Price: $${lastPrice[1].toFixed(6)}`);
            
            const allPrices = historyData.prices.map(p => p[1]);
            const minPrice = Math.min(...allPrices);
            const maxPrice = Math.max(...allPrices);
            console.log(`   All-Time Low: $${minPrice.toFixed(6)}`);
            console.log(`   All-Time High: $${maxPrice.toFixed(6)}`);
            
        } else {
            console.log(`\n❌ No historical data available`);
        }
        
    } catch (error) {
        console.error(`\n❌ Error testing ${coinId}:`, error.message);
    }
    
    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, 1200));
}

async function main() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   CoinGecko Historical Data Availability Checker           ║
║   Testing Avalanche Ecosystem Tokens                       ║
╚════════════════════════════════════════════════════════════╝
    `);
    
    // Test popular Avalanche tokens
    const tokensToTest = [
        'avalanche-2',        // AVAX
        'wrapped-avax',       // WAVAX
        'joe',                // JOE (Trader Joe)
        'pangolin',           // PNG
        'benqi',              // QI
        'gmx',                // GMX
        'usd-coin',           // USDC
        'tether',             // USDT
    ];
    
    for (const coinId of tokensToTest) {
        await testTokenHistory(coinId);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Testing Complete!`);
    console.log('='.repeat(60));
    console.log(`\n📝 Summary:`);
    console.log(`   - CoinGecko provides historical data from token inception`);
    console.log(`   - Use days=max to get all available data`);
    console.log(`   - Each token has different start dates`);
    console.log(`   - Avalanche tokens typically have data from 2020-2021 onwards`);
    console.log(`\n💡 Tip: For custom date ranges, use the /market_chart/range endpoint\n`);
}

// Run the test
main().catch(console.error);
