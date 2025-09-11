#!/bin/bash

# Start proxy router for k1-k4 models
# This allows Claude CLI to use different models with full MCP access

echo "🚀 Starting Claude Router Proxy for k1-k4 models"
echo "================================================="
echo

# Setup if needed
if [ ! -d "/opt/mcp/servers/debate-consensus/claude-router" ]; then
    echo "📦 First time setup..."
    /opt/mcp/servers/debate-consensus/setup-claude-router.sh
    echo
fi

# Start proxy
cd /opt/mcp/servers/debate-consensus/claude-router

# Check if proxy is already running
if lsof -i:3456 > /dev/null 2>&1; then
    echo "⚠️  Proxy already running on port 3456"
    echo "   To restart, run: pkill -f 'node proxy.js'"
    exit 1
fi

echo "📡 Starting proxy server..."
echo "   URL: http://localhost:3456"
echo "   Models:"
echo "     k1 -> Claude Opus 4.1"
echo "     k2 -> GPT-5"
echo "     k3 -> Qwen 3 Max"
echo "     k4 -> Gemini 2.5 Pro"
echo
echo "Press Ctrl+C to stop"
echo "===================="
echo

# Start server
npm start