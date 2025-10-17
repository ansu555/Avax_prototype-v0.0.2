# Auto-Pilot Rule Model - Complete Documentation

## Overview
This document describes the complete rule model used in the Avax Prototype v0.0.2 platform for automated crypto trading strategies.

## Table of Contents
1. [Rule Structure](#rule-structure)
2. [Strategies](#strategies)
3. [Triggers](#triggers)
4. [Risk Controls](#risk-controls)
5. [Coin Selection](#coin-selection)
6. [Workflow Examples](#workflow-examples)
7. [Frontend Integration](#frontend-integration)
8. [MCP Server Integration](#mcp-server-integration)

---

## Rule Structure

### TypeScript Type Definition
```typescript
type RuleTrigger =
  | { type: 'price_drop_pct'; value: number }
  | { type: 'trend_pct'; value: number; window: '24h' | '7d' | '30d' }
  | { type: 'momentum'; value: number; lookbackDays: number }

type Rule = {
  id: string                    // Auto-generated (e.g., "rule_abc123")
  ownerAddress: string          // Wallet address (lowercase)
  type: 'dca' | 'rebalance' | 'rotate'
  targets: string[]             // Coin IDs (e.g., ["bitcoin", "ethereum"])
  rotateTopN?: number           // Required for 'rotate' strategy
  maxSpendUSD: number           // Maximum USD per execution
  maxSlippage: number           // 0-100 percentage
  trigger: RuleTrigger          // Condition to execute rule
  cooldownMinutes: number       // Minimum time between executions
  status: 'active' | 'paused'
  createdAt: string             // ISO timestamp
}
```

### Required Fields
- `type`: Strategy type (dca, rebalance, rotate)
- `trigger`: Trigger mechanism (price_drop_pct, trend_pct, momentum)
- `maxSpendUSD`: Maximum USD amount to spend per execution (must be > 0)
- `maxSlippage`: Maximum allowed slippage percentage (0-100)
- `cooldownMinutes`: Minimum minutes between executions

### Conditional Fields
- `targets`: Array of coin IDs (required for DCA and REBALANCE)
- `rotateTopN`: Number of top coins (required for ROTATE)

### Auto-generated Fields
- `id`: Unique identifier with "rule_" prefix
- `ownerAddress`: Defaults to "0x0000000000000000000000000000000000000000"
- `status`: Defaults to "active"
- `createdAt`: ISO timestamp of creation

---

## Strategies

### 1. DCA (Dollar Cost Averaging)
**Purpose**: Invest fixed amounts on a schedule to reduce timing risk

**Best For**: 
- Long-term investors who want to smooth out price volatility
- Accumulation during market dips
- Mean reversion opportunities

**Risk Level**: Low to Medium

**Requirements**:
- `targets`: Array of 1+ coin IDs
- `trigger`: Any trigger type (price_drop_pct recommended)
- `maxSpendUSD`: Fixed amount per execution

**Example Use Cases**:
- "Buy $100 of BTC every time it drops 5%"
- "Accumulate ETH on 3% dips"
- "Mean reversion: DCA into oversold coins (RSI < 30)"

### 2. REBALANCE (Portfolio Rebalancing)
**Purpose**: Maintain target allocations across selected coins

**Best For**:
- Diversified portfolio management
- Capturing trend momentum while staying balanced
- Risk-controlled exposure to multiple assets

**Risk Level**: Medium

**Requirements**:
- `targets`: Array of 2+ coin IDs
- `trigger`: Any trigger type (trend_pct recommended)
- `maxSpendUSD`: Total budget for rebalancing

**Example Use Cases**:
- "Rebalance 60% BTC / 40% ETH when 7d trend > 3%"
- "Maintain equal allocation across BTC, ETH, SOL when momentum builds"
- "Rebalance portfolio on strong trends"

### 3. ROTATE (Rotate Top N)
**Purpose**: Dynamically shift into the top N trending coins

**Best For**:
- Active traders seeking momentum plays
- Following market leaders
- Capturing strong directional moves

**Risk Level**: High

**Requirements**:
- `rotateTopN`: Number of top coins to rotate into (1-10 typical)
- `trigger`: Any trigger type (momentum recommended)
- `maxSpendUSD`: Budget for rotation

**Example Use Cases**:
- "Rotate into top 3 coins with 7-day momentum > 5%"
- "Follow market leaders: top 5 coins by trend strength"
- "Momentum rotation: switch to top performers every week"

---

## Triggers

### 1. Price Drop Percentage (`price_drop_pct`)
**Purpose**: Execute when price drops by specified percentage

**Structure**:
```typescript
{
  type: 'price_drop_pct',
  value: number  // Percentage (e.g., 5 = 5% drop)
}
```

**Best For**:
- DCA strategies
- Buy-the-dip approaches
- Mean reversion plays

**Typical Values**:
- Conservative: 3-5%
- Moderate: 5-10%
- Aggressive: 10-15%

**Example**:
```json
{
  "type": "price_drop_pct",
  "value": 5
}
```
_Triggers when price drops 5% from recent high_

### 2. Trend Percentage (`trend_pct`)
**Purpose**: Execute based on trend strength over a time window

**Structure**:
```typescript
{
  type: 'trend_pct',
  value: number,              // Trend threshold percentage
  window: '24h' | '7d' | '30d' // Time window
}
```

**Best For**:
- REBALANCE strategies
- Trend-following approaches
- Capturing sustained moves

**Typical Values**:
- 24h window: 2-5% threshold
- 7d window: 3-7% threshold
- 30d window: 5-15% threshold

**Example**:
```json
{
  "type": "trend_pct",
  "value": 3,
  "window": "7d"
}
```
_Triggers when 7-day trend exceeds 3%_

### 3. Momentum (`momentum`)
**Purpose**: Execute based on momentum indicator over lookback period

**Structure**:
```typescript
{
  type: 'momentum',
  value: number,          // Momentum threshold percentage
  lookbackDays: number    // Days to calculate momentum
}
```

**Best For**:
- ROTATE strategies
- Momentum plays
- Riding strong waves

**Typical Values**:
- Lookback: 3-14 days
- Threshold: 3-10%

**Example**:
```json
{
  "type": "momentum",
  "value": 5,
  "lookbackDays": 7
}
```
_Triggers when 7-day momentum exceeds 5%_

---

## Risk Controls

### Max Spend USD (`maxSpendUSD`)
**Purpose**: Limit capital deployed per rule execution

**Recommendation**:
- Small accounts (<$5k): $50-100
- Medium accounts ($5k-50k): $100-500
- Large accounts (>$50k): $500-2000
- General rule: 1-5% of portfolio per execution

**Example**: `maxSpendUSD: 100` → Maximum $100 spent per trade

### Max Slippage (`maxSlippage`)
**Purpose**: Protect against poor execution prices

**Recommendation**:
- Major pairs (BTC, ETH): 0.3-1%
- Mid-caps: 1-2%
- Small-caps: 2-5%
- Volatile markets: Add 0.5-1% buffer

**Example**: `maxSlippage: 0.5` → Maximum 0.5% slippage allowed

### Cooldown Minutes (`cooldownMinutes`)
**Purpose**: Prevent over-trading and allow market to settle

**Recommendation**:
- Scalping/Active: 15-60 minutes
- Day trading: 60-240 minutes (1-4 hours)
- Swing trading: 360-1440 minutes (6-24 hours)
- Position trading: 1440+ minutes (1+ days)

**Example**: `cooldownMinutes: 60` → Minimum 1 hour between executions

---

## Coin Selection

### For DCA Strategy
- **Minimum**: 1 coin
- **Maximum**: Unlimited
- **Format**: Array of coin IDs
- **Example**: `["bitcoin"]` or `["ethereum", "solana", "avalanche-2"]`

### For REBALANCE Strategy
- **Minimum**: 2 coins
- **Maximum**: Unlimited
- **Format**: Array of coin IDs
- **Example**: `["bitcoin", "ethereum"]` or `["bitcoin", "ethereum", "solana", "cardano"]`
- **Note**: System maintains balanced allocation across all selected coins

### For ROTATE Strategy
- **Format**: `rotateTopN: number` (no targets array needed)
- **Typical Range**: 3-10 coins
- **Example**: `rotateTopN: 3` → Rotate into top 3 trending coins
- **Note**: System automatically selects top N by momentum/trend

---

## Workflow Examples

### Example 1: DCA Buy the Dip
**Goal**: Accumulate Bitcoin on 5% price drops

```json
{
  "type": "dca",
  "targets": ["bitcoin"],
  "trigger": {
    "type": "price_drop_pct",
    "value": 5
  },
  "maxSpendUSD": 100,
  "maxSlippage": 0.5,
  "cooldownMinutes": 60
}
```

**Behavior**: 
- Monitors Bitcoin price
- When BTC drops 5%, buy $100 worth
- Allow max 0.5% slippage
- Wait at least 60 minutes before next execution

---

### Example 2: Rebalance on Trend
**Goal**: Rebalance portfolio when 7-day trend shows strength

```json
{
  "type": "rebalance",
  "targets": ["bitcoin", "ethereum", "solana"],
  "trigger": {
    "type": "trend_pct",
    "value": 3,
    "window": "7d"
  },
  "maxSpendUSD": 500,
  "maxSlippage": 1,
  "cooldownMinutes": 1440
}
```

**Behavior**:
- Monitors 7-day trend for BTC, ETH, SOL
- When trend exceeds 3%, rebalance portfolio
- Use up to $500 for rebalancing
- Allow max 1% slippage
- Wait 24 hours between rebalances

---

### Example 3: Momentum Rotation
**Goal**: Rotate into top 3 coins with strong 7-day momentum

```json
{
  "type": "rotate",
  "rotateTopN": 3,
  "trigger": {
    "type": "momentum",
    "value": 5,
    "lookbackDays": 7
  },
  "maxSpendUSD": 300,
  "maxSlippage": 2,
  "cooldownMinutes": 360
}
```

**Behavior**:
- Monitors momentum across all available coins
- Identifies top 3 coins with >5% 7-day momentum
- Rotate position into these top performers
- Use up to $300 per rotation
- Allow max 2% slippage
- Wait 6 hours between rotations

---

## Frontend Integration

### Rule Builder Component
**Location**: `components/rule-builder-modal.tsx`

**Frontend Field Names** → **Backend Field Names**:
- `strategy` (DCA/REBALANCE/ROTATE) → `type` (dca/rebalance/rotate)
- `triggerType` (priceDrop/trend/momentum) → `trigger.type` (price_drop_pct/trend_pct/momentum)
- `maxSpendUsd` → `maxSpendUSD`
- `maxSlippagePercent` → `maxSlippage`

**Frontend Form Fields**:
```typescript
{
  strategy: 'DCA' | 'REBALANCE' | 'ROTATE'
  coins: string[]                    // Coin IDs
  triggerType: 'priceDrop' | 'trend' | 'momentum'
  dropPercent?: number               // For priceDrop trigger
  trendWindow?: '24h' | '7d' | '30d' // For trend trigger
  trendThreshold?: number            // For trend trigger
  momentumLookback?: number          // For momentum trigger
  momentumThreshold?: number         // For momentum trigger
  rotateTopN?: number                // For ROTATE strategy
  maxSpendUsd: number
  maxSlippagePercent: number
  cooldownMinutes: number
}
```

### API Endpoints
- **Create Rule**: `POST /api/rules`
- **Get Rules**: `GET /api/rules?owner={address}`
- **Update Rule**: `PATCH /api/rules`
- **Delete Rule**: `DELETE /api/rules`
- **Execute Rule**: `POST /api/agent/execute`

---

## MCP Server Integration

### GET /rule-model
Returns complete rule model documentation in JSON format.

**Usage**:
```bash
curl http://localhost:8080/rule-model
```

**Response**: Complete rule model structure (strategies, triggers, risk controls, examples)

### POST /suggest-rule
AI analyzes market conditions and suggests optimal rule configurations.

**Request**:
```json
{
  "coin": "bitcoin"
}
```

**Response**:
```json
{
  "ok": true,
  "coin": "bitcoin",
  "suggestions": [
    {
      "strategy": "DCA",
      "description": "DCA bitcoin on price dips - RSI at 42.3",
      "reasoning": "Market is neutral. DCA reduces timing risk.",
      "trigger": {
        "type": "price_drop_pct",
        "value": 5
      },
      "riskLevel": "low",
      "suggestedParams": {
        "maxSpendUSD": 100,
        "maxSlippage": 0.5,
        "cooldownMinutes": 60
      }
    }
  ]
}
```

### POST /analyze
Comprehensive market analysis to inform rule creation decisions.

**Request**:
```json
{
  "coin": "ethereum",
  "horizonDays": 90,
  "chartType": "line"
}
```

**Response**: Includes summary, insights, predictions, strategies (DCA/REBALANCE/ROTATE), and overall analysis.

---

## Best Practices

### Strategy Selection
✅ **Use DCA when**:
- Market is oversold (RSI < 30)
- You want to accumulate over time
- Volatility is high
- Mean reversion opportunity exists

✅ **Use REBALANCE when**:
- Managing diversified portfolio
- Capturing trend while maintaining balance
- Market shows clear directional bias

✅ **Use ROTATE when**:
- Seeking momentum plays
- Active trading approach
- Following market leaders

### Risk Management
1. **Start Small**: Test with low maxSpendUSD first
2. **Set Appropriate Cooldowns**: Prevent over-trading (6-24h recommended)
3. **Monitor Slippage**: Adjust based on market conditions
4. **Diversify Triggers**: Use different triggers for different rules
5. **Review Regularly**: Adjust rules based on market regime changes

### Trigger Selection
- **Price Drop**: Best for DCA and accumulation
- **Trend**: Best for REBALANCE and directional plays
- **Momentum**: Best for ROTATE and active strategies

---

## Common Questions

### Q: Can I have multiple rules for the same coin?
**A**: Yes! You can create multiple rules with different strategies and triggers for the same coin.

### Q: What happens if cooldown hasn't elapsed?
**A**: The rule will not execute until the cooldown period has passed.

### Q: How does ROTATE strategy select coins?
**A**: It automatically identifies the top N coins by momentum/trend strength and rotates into them.

### Q: Can I pause a rule temporarily?
**A**: Yes, set `status: 'paused'` to temporarily disable without deleting.

### Q: What's the difference between price_drop_pct and momentum triggers?
**A**: 
- `price_drop_pct`: Reacts to downward price movement (good for buying dips)
- `momentum`: Reacts to upward momentum (good for trend following)

---

## Summary

The Auto-Pilot rule system provides a flexible, risk-controlled framework for automated crypto trading:

- **3 Strategies**: DCA, REBALANCE, ROTATE
- **3 Triggers**: Price Drop, Trend, Momentum  
- **3 Risk Controls**: Max Spend, Max Slippage, Cooldown
- **Unlimited Combinations**: Mix and match to fit your trading style

**Key Principle**: Always prioritize risk management and start with conservative parameters before scaling up.
