#!/bin/bash

# Test script to verify all 9 models (k1-k9) can answer a simple question

echo "🧪 Testing All 9 Models with Simple Question"
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Test question
QUESTION="What is 2+2? Reply with just the number."

# Check if proxy server is running
check_proxy() {
    local port=$1
    local name=$2

    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name proxy running on port $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $name proxy NOT running on port $port${NC}"
        return 1
    fi
}

echo "1. Checking Proxy Servers (ports 3457-3464)"
echo "--------------------------------------------"

# Define all 9 proxy servers with their ports
declare -A PROXIES=(
    [3457]="k1 (Claude Sonnet 4.5)"
    [3458]="k2 (GPT-5)"
    [3459]="k3 (Qwen 3 Max)"
    [3460]="k4 (Gemini 2.5 Pro)"
    [3461]="k5 (Grok 4 Fast)"
    [3462]="k6 (GPT-5 Max Thinking)"
    [3463]="k7 (Kimi K2 Thinking)"
    [3464]="k8 (GLM-4.6 Exacto)"
    [3465]="k9 (Claude Opus 4.1)"
)

running_count=0
failed_proxies=()

for port in "${!PROXIES[@]}"; do
    name="${PROXIES[$port]}"
    if check_proxy "$port" "$name"; then
        ((running_count++))
    else
        failed_proxies+=("$name")
    fi
done

echo ""
echo -e "${CYAN}Proxy Status: $running_count/9 running${NC}"

if [[ $running_count -lt 2 ]]; then
    echo -e "${RED}⚠️  Error: Need at least 2 models running. Please start k-proxy-server.js${NC}"
    echo ""
    echo "To start proxy servers:"
    echo "  node k-proxy-server.js &"
    exit 1
elif [[ $running_count -lt 9 ]]; then
    echo -e "${YELLOW}⚠️  Warning: Only $running_count/9 models running${NC}"
    echo "Missing: ${failed_proxies[*]}"
fi

echo ""
echo "2. Testing All 9 Models via Debate System"
echo "------------------------------------------"
echo -e "Question: ${CYAN}$QUESTION${NC}"
echo ""

# Create a test file that will run the debate
TEST_SCRIPT=$(cat <<'EOF'
import { ClaudeCliDebate } from './src/claude-cli-debate.js';

const debate = new ClaudeCliDebate();

// Run debate with all 9 models
const result = await debate.runDebate({
  question: process.env.TEST_QUESTION,
  modelConfig: 'k1,k2,k3,k4,k5,k6,k7,k8,k9',
  timeout: 180000, // 3 minutes
  progressCallback: (progress) => {
    if (progress.type === 'model_response') {
      console.log(`✓ ${progress.model}: ${progress.status}`);
    }
  }
});

// Output results as JSON for parsing
console.log('RESULTS_START');
console.log(JSON.stringify(result, null, 2));
console.log('RESULTS_END');
EOF
)

# Write temporary test script
echo "$TEST_SCRIPT" > /tmp/test-all-models-$$.mjs

# Run the debate
echo "Running debate with all 9 models (this may take 2-3 minutes)..."
echo ""

export TEST_QUESTION="$QUESTION"
TEST_OUTPUT=$(node /tmp/test-all-models-$$.mjs 2>&1)
TEST_EXIT_CODE=$?

# Clean up temp file
rm -f /tmp/test-all-models-$$.mjs

# Parse results
if [[ $TEST_EXIT_CODE -eq 0 ]]; then
    # Extract JSON results
    RESULTS=$(echo "$TEST_OUTPUT" | sed -n '/RESULTS_START/,/RESULTS_END/p' | grep -v 'RESULTS_')

    # Count successful models
    SUCCESSFUL_COUNT=$(echo "$RESULTS" | grep -o '"model"' | wc -l)

    echo ""
    echo "3. Test Results"
    echo "---------------"

    # Show which models responded
    echo "$TEST_OUTPUT" | grep "✓" | while read line; do
        echo -e "${GREEN}$line${NC}"
    done

    echo ""
    echo -e "${GREEN}✅ Debate completed successfully!${NC}"
    echo -e "   Models participated: $SUCCESSFUL_COUNT"

    # Extract and show final answer
    FINAL_ANSWER=$(echo "$RESULTS" | grep -A 1 '"finalAnswer"' | tail -1 | sed 's/.*: "\(.*\)".*/\1/')
    if [[ ! -z "$FINAL_ANSWER" ]]; then
        echo -e "   Final consensus: ${CYAN}$FINAL_ANSWER${NC}"
    fi

    # Show confidence if available
    CONFIDENCE=$(echo "$RESULTS" | grep '"confidence"' | head -1 | grep -o '[0-9.]*')
    if [[ ! -z "$CONFIDENCE" ]]; then
        echo -e "   Confidence: ${CYAN}${CONFIDENCE}%${NC}"
    fi

    echo ""
    echo "========================================="
    echo "Summary:"
    echo "========================================="
    echo -e "${GREEN}✅ All working models tested successfully${NC}"
    echo "   Question: $QUESTION"
    echo "   Models responded: $SUCCESSFUL_COUNT/$running_count available"

    if [[ $SUCCESSFUL_COUNT -eq 9 ]]; then
        echo -e "${GREEN}   🎉 Perfect! All 9 models responded!${NC}"
    elif [[ $SUCCESSFUL_COUNT -ge 2 ]]; then
        echo -e "${YELLOW}   ⚠️  Some models did not respond${NC}"
    fi

else
    echo ""
    echo "3. Test Results"
    echo "---------------"
    echo -e "${RED}❌ Debate failed${NC}"
    echo ""
    echo "Error output:"
    echo "$TEST_OUTPUT" | tail -20
    echo ""
    echo "========================================="
    echo "Troubleshooting:"
    echo "========================================="
    echo "1. Check if proxy servers are running: node health-check.js"
    echo "2. Check logs in: logs/debate-*.json"
    echo "3. Verify OPENROUTER_API_KEY in .env"
    echo "4. Try with fewer models: npm run test:debate"
    exit 1
fi

echo ""
echo "To test individual models:"
echo "  ./test-model-resilience.sh"
echo ""
echo "To run full test suite:"
echo "  npm test"
