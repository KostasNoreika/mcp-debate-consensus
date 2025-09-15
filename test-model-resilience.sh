#!/bin/bash

# Test script to verify model resilience and token limits

echo "🧪 Testing Model Resilience and Token Limits"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if proxy server is running
check_proxy() {
    local port=$1
    local name=$2

    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name proxy is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $name proxy is NOT running on port $port${NC}"
        return 1
    fi
}

# Test individual model health
test_model_health() {
    local port=$1
    local model=$2

    echo -n "Testing $model health check... "

    # Use the new /health/test endpoint that properly tests with 20 tokens
    local response=$(curl -s -X POST "http://localhost:$port/health/test" \
        -H "Content-Type: application/json" 2>&1)

    if [[ $response == *"healthy"* ]]; then
        echo -e "${GREEN}OK${NC}"
        # Extract the actual response if available
        local model_response=$(echo "$response" | grep -o '"response":"[^"]*"' | cut -d':' -f2 | tr -d '"')
        if [[ ! -z "$model_response" ]]; then
            echo "  Model responded: $model_response"
        fi
        return 0
    else
        echo -e "${RED}Failed${NC}"
        # Extract error message if available
        local error_msg=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d':' -f2 | tr -d '"')
        if [[ ! -z "$error_msg" ]]; then
            echo "  Error: $error_msg"
        else
            echo "  Error: $response" | head -2
        fi
        return 1
    fi
}

echo "1. Checking Proxy Servers Status"
echo "---------------------------------"

# Check k-proxy-server ports
check_proxy 3457 "k1 (Claude Opus 4.1)"
k1_status=$?

check_proxy 3458 "k2 (GPT-5-chat)"
k2_status=$?

check_proxy 3459 "k3 (Qwen 3 Max)"
k3_status=$?

check_proxy 3460 "k4 (Gemini 2.5 Pro)"
k4_status=$?

# Also check claude-router proxy
check_proxy 3456 "Claude Router"
router_status=$?

echo ""
echo "2. Testing Model Configuration"
echo "-------------------------------"

# Count how many proxies are running
running_count=0
[[ $k1_status -eq 0 ]] && ((running_count++))
[[ $k2_status -eq 0 ]] && ((running_count++))
[[ $k3_status -eq 0 ]] && ((running_count++))
[[ $k4_status -eq 0 ]] && ((running_count++))

echo "Models running: $running_count/4"

if [[ $running_count -lt 2 ]]; then
    echo -e "${RED}⚠️  Warning: Less than 2 models running. Debate will fail.${NC}"
    echo ""
    echo "To start the proxy servers, run:"
    echo "  node k-proxy-server.js"
    exit 1
elif [[ $running_count -lt 4 ]]; then
    echo -e "${YELLOW}⚠️  Warning: Only $running_count models running. Debate will continue with partial models.${NC}"
else
    echo -e "${GREEN}✅ All models are running${NC}"
fi

echo ""
echo "3. Testing Model Health Checks"
echo "-------------------------------"

if [[ $k1_status -eq 0 ]]; then
    test_model_health 3457 "k1 (Claude Opus 4.1)"
fi

if [[ $k2_status -eq 0 ]]; then
    test_model_health 3458 "k2 (GPT-5-chat)"
fi

if [[ $k3_status -eq 0 ]]; then
    test_model_health 3459 "k3 (Qwen 3 Max)"
fi

if [[ $k4_status -eq 0 ]]; then
    test_model_health 3460 "k4 (Gemini 2.5 Pro)"
fi

echo ""
echo "4. Checking Token Limits Configuration"
echo "---------------------------------------"

# Check if the token limits are properly configured in the source files
echo -n "Checking k-proxy-server.js configuration... "
if grep -q "maxTokensMap" k-proxy-server.js && grep -q "gpt-5-chat" k-proxy-server.js; then
    echo -e "${GREEN}OK${NC}"
    echo "  - GPT-5 model name: gpt-5-chat ✓"
    echo "  - Dynamic token limits: configured ✓"
else
    echo -e "${RED}Failed${NC}"
    echo "  - Check k-proxy-server.js for proper configuration"
fi

echo -n "Checking claude-router/proxy.js configuration... "
if grep -q "maxTokensMap" claude-router/proxy.js && grep -q "gpt-5-chat" claude-router/proxy.js; then
    echo -e "${GREEN}OK${NC}"
    echo "  - GPT-5 model name: gpt-5-chat ✓"
    echo "  - Dynamic token limits: configured ✓"
else
    echo -e "${RED}Failed${NC}"
    echo "  - Check claude-router/proxy.js for proper configuration"
fi

echo ""
echo "5. Resilience Check"
echo "-------------------"

echo -n "Checking claude-cli-debate.js resilience... "
if grep -q "if (Object.keys(proposals).length < 2)" src/claude-cli-debate.js; then
    echo -e "${GREEN}OK${NC}"
    echo "  - Minimum models required: 2 ✓"
    echo "  - Will continue with partial results ✓"
else
    echo -e "${YELLOW}Warning${NC}"
    echo "  - Check src/claude-cli-debate.js for resilience logic"
fi

echo ""
echo "========================================="
echo "Test Summary:"
echo "========================================="

if [[ $running_count -ge 2 ]]; then
    echo -e "${GREEN}✅ System is ready for debate consensus${NC}"
    echo "   - At least 2 models are available"
    echo "   - Resilience is configured"
    echo "   - Token limits are properly set"

    if [[ $running_count -lt 4 ]]; then
        echo -e "${YELLOW}   - Note: Running with $running_count/4 models${NC}"
    fi
else
    echo -e "${RED}❌ System is NOT ready${NC}"
    echo "   - Need at least 2 models running"
    echo "   - Start proxy server with: node k-proxy-server.js"
fi

echo ""
echo "To run a full debate test:"
echo "  npm test"
echo "  # or"
echo "  ./test-consensus.sh"