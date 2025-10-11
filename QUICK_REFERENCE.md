# 🔴 Avalanche + CoinGecko - Quick Reference

## API Details
```
Provider: CoinGecko
API Key: CG-yBGPehgHHsHoKf6haCAaEAWf
Base URL: https://api.coingecko.com/api/v3
Filter: category=avalanche-ecosystem
```

## Endpoints Used

### 1. Get Avalanche Tokens
```javascript
GET /coins/markets?vs_currency=usd&category=avalanche-ecosystem&per_page=100&sparkline=true
```

### 2. Get Token Details
```javascript
GET /coins/{coin_id}
```

### 3. Get Price History
```javascript
GET /coins/{coin_id}/market_chart?vs_currency=usd&days=7
```

### 4. Get Global Stats
```javascript
GET /global
```

## Component Data Flow

```
CoinGecko API
    ↓
cryptoApi.js (transforms data)
    ↓
Redux Store
    ↓
Components (use hooks)
    ↓
Display to user
```

## Hook Usage

```javascript
// Get Avalanche tokens
const { data, isFetching, error } = useGetCryptosQuery(100)

// Get coin details
const { data } = useGetCryptoDetailsQuery(coinId)

// Get price history
const { data } = useGetCryptoHistoryQuery({ coinId, timePeriod: '7d' })

// Get global stats
const { data } = useGetStatsQuery()
```

## Data Structure

### Input (CoinGecko):
```json
{
  "id": "avalanche-2",
  "symbol": "avax",
  "name": "Avalanche",
  "current_price": 35.50,
  "market_cap": 14500000000,
  "total_volume": 850000000,
  "price_change_percentage_24h": 2.5,
  "sparkline_in_7d": { "price": [...] }
}
```

### Output (Your App):
```javascript
{
  uuid: "avalanche-2",
  id: "avalanche-2",
  rank: 11,
  name: "Avalanche",
  symbol: "AVAX",
  price: "35.50",
  change: "2.5",
  marketCap: "14500000000",
  "24hVolume": "850000000",
  sparkline: [...]
}
```

## Common Issues & Fixes

### Issue: No data showing
**Fix:** Check API key in .env.local, restart server

### Issue: Rate limit (429)
**Fix:** Wait 60s or upgrade API plan

### Issue: Wrong data format
**Fix:** Use `data` not `data.coins`

### Issue: Tokens missing
**Fix:** CoinGecko auto-filters, token might not be in Avalanche category

## Environment Variables

```bash
# Required
NEXT_PUBLIC_COINGECKO_API_KEY=CG-yBGPehgHHsHoKf6haCAaEAWf
NEXT_PUBLIC_CRYPTO_API_URL=https://api.coingecko.com/api/v3
NEXT_PUBLIC_EXCHANGE_API_URL=https://api.coingecko.com/api/v3

# Not needed anymore (removed)
# NEXT_PUBLIC_RAPID_API_KEY=...
# NEXT_PUBLIC_CRYPTO_API_HOST=...
```

## Testing Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Check types
npx tsc --noEmit

# Open in browser
open http://localhost:3000
```

## Visual Indicators

### Homepage
```
🔴 Avalanche Ecosystem Only | Powered by CoinGecko
```

### Cryptocurrencies Page
```
┌──────────────────────────────────────────────┐
│ 🔴 Avalanche Ecosystem Tokens                │
│ Powered by CoinGecko API                     │
│                              [47 tokens] 🔴  │
└──────────────────────────────────────────────┘
```

## Rate Limits

| Plan | Calls/Min | Calls/Month | Cost |
|------|-----------|-------------|------|
| Demo | 10-50 | Limited | Free |
| Analyst | 500 | 10,000 | $129 |
| Lite | 500 | 50,000 | $499 |

## Support Links

- Docs: https://docs.coingecko.com/
- Status: https://status.coingecko.com/
- Pricing: https://www.coingecko.com/api/pricing
- Support: https://www.coingecko.com/contact

## Quick Checks

### ✅ Working Correctly:
- Avalanche banner visible
- 100+ tokens showing
- Prices updating
- Sparklines rendering
- Search/filter working

### ❌ Something Wrong:
- No banner → Check component files
- No data → Check API key
- Wrong tokens → Check API response
- Errors → Check browser console

---

**Status:** 🟢 Active
**Last Updated:** October 12, 2025
