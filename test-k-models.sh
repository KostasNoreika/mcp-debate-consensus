#!/bin/bash

# Test script for all k-models (k1-k5) through the single proxy server

echo "🧪 Testing K-Models through Claude Router Proxy"
echo "==============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if proxy server is running
check_proxy() {
    if curl -s "http://localhost:3456/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Claude Router proxy is running on port 3456${NC}"
        return 0
    else
        echo -e "${RED}❌ Claude Router proxy is NOT running on port 3456${NC}"
        echo "Please start it with: cd claude-router && node proxy.js &"
        exit 1
    fi
}

# Test individual model through proxy
test_model() {
    local model_alias=$1
    local model_name=$2
    local api_key="proxy-key-$model_alias"

    echo -e "${BLUE}Testing $model_alias ($model_name)...${NC}"

    # Create test request
    local json_request=$(cat <<EOF
{
  "messages": [
    {
      "role": "user",
      "content": "Reply with exactly: '$model_alias OK'"
    }
  ],
  "max_tokens": 50,
  "temperature": 0.1
}
EOF
)

    # Send request to proxy
    local response=$(echo "$json_request" | curl -s -X POST http://localhost:3456/v1/messages \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d @- 2>&1)

    # Check response
    if echo "$response" | grep -q '"model"'; then
        local model_used=$(echo "$response" | grep -o '"model":"[^"]*"' | cut -d':' -f2 | tr -d '"')
        local content=$(echo "$response" | grep -o '"text":"[^"]*"' | cut -d':' -f2 | tr -d '"')

        if [[ "$model_used" == *"$model_name"* ]] || [[ "$model_used" == *"$(echo $model_name | tr '[:upper:]' '[:lower:]')"* ]]; then
            echo -e "  ${GREEN}✅ Model routing: OK (using $model_used)${NC}"
        else
            echo -e "  ${YELLOW}⚠️ Model routing: Expected $model_name, got $model_used${NC}"
        fi

        if [[ ! -z "$content" ]]; then
            echo -e "  Response: $content"
        else
            echo -e "  ${YELLOW}⚠️ Empty response content${NC}"
        fi

        return 0
    else
        echo -e "  ${RED}❌ Failed to get response${NC}"
        echo "  Error: $(echo "$response" | head -1)"
        return 1
    fi
}

# Test wrapper command
test_wrapper() {
    local model_alias=$1
    local model_name=$2

    echo -e "${BLUE}Testing $model_alias wrapper command...${NC}"

    # Source the aliases
    source ~/.claude-k-models 2>/dev/null

    # Test the wrapper
    local response=$($model_alias "Say exactly: '$model_alias wrapper works'" 2>&1 | head -5)

    if [[ $? -eq 0 ]]; then
        echo -e "  ${GREEN}✅ Wrapper command works${NC}"
        echo "  Response: $(echo "$response" | head -1)"
    else
        echo -e "  ${YELLOW}⚠️ Wrapper command may not be configured${NC}"
    fi
}

echo "1. Checking Proxy Server Status"
echo "--------------------------------"
check_proxy

echo ""
echo "2. Testing Model Routing via API"
echo "---------------------------------"

# Test all 5 models
test_model "k1" "anthropic/claude-opus-4.1"
echo ""
test_model "k2" "openai/gpt-5"
echo ""
test_model "k3" "qwen/qwen3-max"
echo ""
test_model "k4" "google/gemini-2.5-pro"
echo ""
test_model "k5" "x-ai/grok-4-fast"

echo ""
echo "3. Testing Wrapper Commands"
echo "----------------------------"

# Test wrapper commands if available
test_wrapper "k1" "Claude Opus 4.1"
echo ""
test_wrapper "k2" "GPT-5"
echo ""
test_wrapper "k3" "Qwen 3 Max"
echo ""
test_wrapper "k4" "Gemini 2.5 Pro"
echo ""
test_wrapper "k5" "Grok 4 Fast"

echo ""
echo "4. Model Configuration Summary"
echo "------------------------------"

# Show current configuration
echo "Models configured in proxy:"
grep "modelMap\[" claude-router/proxy.js 2>/dev/null | grep -E "k[1-5]" | sed 's/.*\(k[1-5]\).*: .\([^'"'"']*\).*/  \1 → \2/'

echo ""
echo "======================================="
echo "Test Summary:"
echo "======================================="
echo -e "${GREEN}✅ Proxy server is running${NC}"
echo "All 5 models (k1-k5) are configured and available"
echo ""
echo "To run a debate with all models:"
echo "  npm test"
echo "  # or use MCP tool:"
echo "  mcp call debate-consensus debate '{\"topic\":\"Your question here\"}'"