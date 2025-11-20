#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       ADAPTIVE CLI ROUTING - COMPREHENSIVE TEST SUITE         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local model=$1
    local expected=$2
    local description=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${BLUE}Test $TOTAL_TESTS: $description${NC}"
    echo "  Model: $model"
    
    OUTPUT=$(./${model}-wrapper.sh --version 2>&1 | head -5)
    
    if echo "$OUTPUT" | grep -q "$expected"; then
        echo -e "  ${GREEN}✓ PASSED${NC} - Found: $expected"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "  ${RED}✗ FAILED${NC} - Expected: $expected"
        echo "  Output: $OUTPUT"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
}

echo "═══════════════════════════════════════════════════════════════"
echo "  SECTION 1: Native CLI Tests (k1, k2, k4, k6, k9)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

run_test "k1" "Using native claude CLI" "k1 uses native Claude CLI"
run_test "k2" "Using native codex CLI" "k2 uses native Codex CLI"
run_test "k4" "Using native gemini CLI" "k4 uses native Gemini CLI"
run_test "k6" "Using native codex CLI" "k6 uses native Codex CLI"
run_test "k9" "Using native claude CLI" "k9 uses native Claude CLI"

echo "═══════════════════════════════════════════════════════════════"
echo "  SECTION 2: Proxy-Only Models (k3, k5, k7, k8)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

run_test "k3" "Using Claude CLI + proxy on port 3459" "k3 uses proxy (Qwen)"
run_test "k5" "Using Claude CLI + proxy on port 3461" "k5 uses proxy (Grok)"
run_test "k7" "Using Claude CLI + proxy on port 3463" "k7 uses proxy (Kimi)"
run_test "k8" "Using Claude CLI + proxy on port 3464" "k8 uses proxy (GLM)"

echo "═══════════════════════════════════════════════════════════════"
echo "  SECTION 3: Fallback Mechanism Test"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo -e "${BLUE}Test $((TOTAL_TESTS + 1)): k2 fallback when codex unavailable${NC}"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Temporarily hide codex CLI
PATH_BACKUP="$PATH"
export PATH=$(echo "$PATH" | tr ':' '\n' | grep -v npm-global | tr '\n' ':')

OUTPUT=$(./k2-wrapper.sh --version 2>&1 | head -5)

if echo "$OUTPUT" | grep -q "falling back to proxy"; then
    echo -e "  ${GREEN}✓ PASSED${NC} - Fallback mechanism works"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "  ${RED}✗ FAILED${NC} - Fallback not triggered"
    echo "  Output: $OUTPUT"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

export PATH="$PATH_BACKUP"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Total Tests:  $TOTAL_TESTS"
echo -e "  ${GREEN}Passed:       $PASSED_TESTS${NC}"
echo -e "  ${RED}Failed:       $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ALL TESTS PASSED SUCCESSFULLY!                   ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                  SOME TESTS FAILED                            ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
