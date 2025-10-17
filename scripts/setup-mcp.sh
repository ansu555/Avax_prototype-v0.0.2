#!/bin/bash

# MCP Analytics Server Setup Script
# This script helps you set up and run the MCP analytics server

set -e

echo "🚀 MCP Analytics Server Setup"
echo "=============================="
echo ""

# Check if we're in the right directory
if [ ! -f "mcp_server/package.json" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

# Navigate to MCP server directory
cd mcp_server

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "📝 Creating .env file from .env.example..."
  cp .env.example .env
  echo "✅ Created .env file"
  echo ""
  echo "⚠️  Please edit mcp_server/.env with your configuration:"
  echo "   - MCP_PORT (default: 8080)"
  echo "   - MCP_BASE_URL (default: http://localhost:8080)"
  echo "   - MCP_ANALYTICS_API_KEY (optional, for security)"
  echo ""
else
  echo "✅ .env file already exists"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo "✅ Dependencies installed"
else
  echo "✅ Dependencies already installed"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start the MCP server:"
echo "  Development: cd mcp_server && npm run dev"
echo "  Production:  cd mcp_server && npm start"
echo ""
echo "The server will run on http://localhost:8080 by default"
echo ""
echo "Next steps:"
echo "1. Add MCP configuration to your main .env.local:"
echo "   MCP_ANALYTICS_URL=http://localhost:8080"
echo "   MCP_ANALYTICS_API_KEY=your-secret-key"
echo "2. Start the Next.js app: bun run dev"
echo "3. Test by asking: 'Analyze BTC' in the chat"
echo ""
