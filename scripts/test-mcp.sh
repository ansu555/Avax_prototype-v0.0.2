#!/bin/bash

# Quick test script for MCP Analytics Server

echo "🧪 Testing MCP Analytics Server"
echo "================================"
echo ""

MCP_URL="${MCP_BASE_URL:-http://localhost:8080}"
API_KEY="${MCP_ANALYTICS_API_KEY:-}"

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
if [ -n "$API_KEY" ]; then
  curl -s "$MCP_URL/health" -H "Authorization: Bearer $API_KEY" | jq '.'
else
  curl -s "$MCP_URL/health" | jq '.'
fi
echo ""
echo ""

# Test 2: Analyze Bitcoin
echo "Test 2: Analyze Bitcoin (BTC)"
echo "-----------------------------"
if [ -n "$API_KEY" ]; then
  curl -s -X POST "$MCP_URL/analyze" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d '{"coin":"btc","horizonDays":7,"tasks":["analysis","prediction"]}' \
    | jq '.summary, .insights[0:2], .predictions[0:2]'
else
  curl -s -X POST "$MCP_URL/analyze" \
    -H "Content-Type: application/json" \
    -d '{"coin":"btc","horizonDays":7,"tasks":["analysis","prediction"]}' \
    | jq '.summary, .insights[0:2], .predictions[0:2]'
fi
echo ""
echo ""

# Test 3: Analyze Ethereum with strategies
echo "Test 3: Analyze Ethereum (ETH) with Strategies"
echo "----------------------------------------------"
if [ -n "$API_KEY" ]; then
  curl -s -X POST "$MCP_URL/analyze" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d '{"coin":"eth","tasks":["strategy"]}' \
    | jq '.strategies'
else
  curl -s -X POST "$MCP_URL/analyze" \
    -H "Content-Type: application/json" \
    -d '{"coin":"eth","tasks":["strategy"]}' \
    | jq '.strategies'
fi
echo ""
echo ""

# Test 4: Full analysis with charts
echo "Test 4: Full Analysis with Charts (AVAX)"
echo "----------------------------------------"
if [ -n "$API_KEY" ]; then
  curl -s -X POST "$MCP_URL/analyze" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d '{"coin":"avax","horizonDays":30}' \
    | jq '{summary, insights: .insights[0:3], predictions: .predictions[0:3], strategies: .strategies[0:2], charts}'
else
  curl -s -X POST "$MCP_URL/analyze" \
    -H "Content-Type: application/json" \
    -d '{"coin":"avax","horizonDays":30}' \
    | jq '{summary, insights: .insights[0:3], predictions: .predictions[0:3], strategies: .strategies[0:2], charts}'
fi
echo ""
echo ""

echo "✅ Tests complete!"
echo ""
echo "If all tests passed, your MCP server is working correctly."
echo "Next: Test integration with the chat agent by asking 'Analyze BTC'"
