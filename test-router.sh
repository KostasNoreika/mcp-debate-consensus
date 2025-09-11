#!/bin/bash

# Test script for k1-k4 models with proxy router

echo "🧪 Testing k1-k4 models with Claude Router Proxy"
echo "==============================================="
echo

# Check if proxy is running
if ! curl -s http://localhost:3456/health > /dev/null 2>&1; then
    echo "❌ Proxy not running. Please start it first:"
    echo "   ./start-router.sh"
    exit 1
fi

echo "✅ Proxy is running"
echo

# Source aliases
source ~/.claude-k-models

# Test each model
echo "Testing models..."
echo "=================="
echo

test_model() {
    local alias=$1
    local name=$2
    
    echo "📝 Testing $alias ($name):"
    echo -n "  Model identity: "
    
    # Test model identity
    response=$(bash -c "source ~/.claude-k-models && echo 'What AI model are you? Reply in one sentence.' | $alias 2>/dev/null" | head -1)
    
    if [ -z "$response" ]; then
        echo "❌ No response"
    else
        echo "✅ $response"
    fi
    
    # Test file access
    echo -n "  File access: "
    response=$(bash -c "source ~/.claude-k-models && echo 'List files in /opt/mcp/servers/debate-consensus/src/' | $alias 2>/dev/null" | grep -c "\.js")
    
    if [ "$response" -gt 0 ]; then
        echo "✅ Can see files"
    else
        echo "❌ Cannot access files"
    fi
    
    echo
}

# Test each model
test_model "k1" "Claude Opus 4.1"
test_model "k2" "GPT-5"
test_model "k3" "Qwen 3 Max"
test_model "k4" "Gemini 2.5 Pro"

echo "✅ Testing complete!"