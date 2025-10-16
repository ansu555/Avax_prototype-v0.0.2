# MCP Server Rule Model Integration - Summary

## What Was Done

Your MCP analytics server now has complete knowledge of your Auto-Pilot rule system!

## New Features Added

### 1. **GET /rule-model Endpoint**
A comprehensive API endpoint that returns the complete rule model documentation in JSON format.

**Access**: `http://localhost:8080/rule-model`

**Returns**:
- Overview and platform features
- All 3 strategies (DCA, REBALANCE, ROTATE) with descriptions
- All 3 triggers (price_drop_pct, trend_pct, momentum) with examples
- Complete rule structure and field requirements
- Risk controls explanation (maxSpendUSD, maxSlippage, cooldownMinutes)
- Coin selection logic for each strategy
- Workflow examples with actual rule configurations
- Frontend mapping and conversion rules
- Best practices and recommendations
- MCP integration details

### 2. **Enhanced /suggest-rule Endpoint**
The existing suggestion endpoint now uses full rule model knowledge to generate accurate recommendations.

### 3. **Complete Documentation**
Created `RULE_MODEL_DOCUMENTATION.md` with human-readable documentation covering:
- Rule structure and TypeScript types
- Strategy details (when to use each)
- Trigger mechanisms (how each works)
- Risk controls (recommended values)
- Coin selection (requirements per strategy)
- Real-world workflow examples
- Frontend integration details
- Best practices and FAQs

## Rule Model Summary

### Strategies (3 Types)
1. **DCA** - Dollar Cost Averaging
   - Accumulate assets over time
   - Low-medium risk
   - Best for: Buy-the-dip, mean reversion

2. **REBALANCE** - Portfolio Rebalancing
   - Maintain target allocations
   - Medium risk
   - Best for: Diversified portfolios, trend following

3. **ROTATE** - Rotate Top N
   - Shift into top performers
   - High risk
   - Best for: Momentum plays, active trading

### Triggers (3 Types)
1. **price_drop_pct** - Price drops by X%
   - Fields: `type`, `value`
   - Best for: DCA, buy-the-dip

2. **trend_pct** - Trend exceeds X% over time window
   - Fields: `type`, `value`, `window` (24h/7d/30d)
   - Best for: REBALANCE, trend following

3. **momentum** - Momentum exceeds X% over lookback period
   - Fields: `type`, `value`, `lookbackDays`
   - Best for: ROTATE, momentum trading

### Risk Controls (3 Parameters)
1. **maxSpendUSD** - Max capital per execution
   - Recommended: 1-5% of portfolio
   - Example: 100 (spend max $100)

2. **maxSlippage** - Max slippage percentage
   - Major pairs: 0.3-1%
   - Small caps: 2-5%
   - Example: 0.5 (allow 0.5% slippage)

3. **cooldownMinutes** - Time between executions
   - Day trading: 60-240 min
   - Swing trading: 360-1440 min
   - Example: 60 (wait 1 hour)

## How MCP Uses This Knowledge

### When User Asks for Rule Suggestions
```
User: "suggest a rule for bitcoin"
MCP: 
1. Analyzes BTC market conditions (RSI, MACD, trend)
2. Selects appropriate strategy (DCA/REBALANCE/ROTATE)
3. Recommends optimal trigger (price_drop_pct/trend_pct/momentum)
4. Suggests risk parameters based on volatility
5. Returns complete rule configuration ready to use
```

### When User Asks About Rules
```
User: "what triggers are available?"
MCP: Returns trigger documentation from /rule-model

User: "how does ROTATE strategy work?"
MCP: Returns ROTATE strategy details from /rule-model

User: "what's a good cooldown for swing trading?"
MCP: Returns risk control recommendations
```

## Testing the Integration

### Test 1: Get Rule Model
```bash
curl http://localhost:8080/rule-model
```
**Returns**: Complete JSON with all rule model information

### Test 2: Get Rule Suggestions
```bash
curl -X POST http://localhost:8080/suggest-rule \
  -H "Content-Type: application/json" \
  -d '{"coin":"bitcoin"}'
```
**Returns**: AI-generated rule suggestions based on market analysis

### Test 3: Analyze Market
```bash
curl -X POST http://localhost:8080/analyze \
  -H "Content-Type: application/json" \
  -d '{"coin":"ethereum","horizonDays":90}'
```
**Returns**: Comprehensive analysis including strategy recommendations

## Frontend Integration

The MCP server now understands the exact field names and conversions used by your Rule Builder component:

**Frontend** → **MCP Understands**:
- `DCA`/`REBALANCE`/`ROTATE` → `dca`/`rebalance`/`rotate`
- `priceDrop` → `price_drop_pct`
- `trend` → `trend_pct`
- `momentum` → `momentum`
- `maxSpendUsd` → `maxSpendUSD`
- `maxSlippagePercent` → `maxSlippage`

## What to Do Next

1. **Restart MCP Server**:
   ```bash
   cd mcp_server && npx tsx main.ts
   ```

2. **Test the new endpoint**:
   ```bash
   curl http://localhost:8080/rule-model | jq
   ```

3. **Try asking your AI agent**:
   - "What rule strategies are available?"
   - "Suggest a rule for AVAX"
   - "What's the difference between DCA and REBALANCE?"
   - "How does the price_drop_pct trigger work?"

## Benefits

✅ **Intelligent Suggestions**: MCP can now suggest rules that match your exact platform capabilities

✅ **Accurate Field Names**: No more confusion between frontend and backend field naming

✅ **Context-Aware**: MCP knows which strategy works best with which trigger

✅ **Risk-Aware**: MCP suggests appropriate risk parameters based on market conditions

✅ **Documented**: Complete reference for developers and AI agents

✅ **Self-Describing API**: GET /rule-model provides all information programmatically

---

Your MCP analytics server is now a complete expert on your Auto-Pilot rule system! 🚀
