#!/bin/bash

# Install and configure all native CLI tools for debate consensus system
# This script will install: claude, codex, gemini, qwen

set -e

echo "🚀 Installing all native CLI tools for debate consensus..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if command exists
check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 1. Install Claude CLI
echo -e "\n${YELLOW}1. Claude CLI${NC}"
if check_command claude; then
    echo -e "  ${GREEN}✓ Already installed${NC}"
else
    echo "  📦 Installing Claude CLI..."
    echo "  Please visit: https://claude.ai/download"
    echo "  Or run: brew install claude (on macOS)"
    echo -e "  ${RED}⚠️  Manual installation required${NC}"
fi

# 2. Install Codex CLI (OpenAI)
echo -e "\n${YELLOW}2. Codex CLI (GPT-5)${NC}"
if check_command codex; then
    CODEX_VERSION=$(codex --version 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓ Already installed (v$CODEX_VERSION)${NC}"

    # Check authentication
    if codex exec "test" 2>&1 | grep -q "401 Unauthorized"; then
        echo -e "  ${YELLOW}⚠️  Not authenticated. Run: codex login${NC}"
    else
        echo -e "  ${GREEN}✓ Authenticated${NC}"
    fi
else
    echo "  📦 Installing @openai/codex..."
    npm install -g @openai/codex
    echo -e "  ${GREEN}✓ Installed${NC}"
    echo -e "  ${YELLOW}⚠️  Run 'codex login' to authenticate${NC}"
fi

# 3. Install Gemini CLI
echo -e "\n${YELLOW}3. Gemini CLI${NC}"
if check_command gemini; then
    GEMINI_VERSION=$(gemini --version 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓ Already installed (v$GEMINI_VERSION)${NC}"

    # Check for API key
    if [ -n "$GEMINI_API_KEY" ]; then
        echo -e "  ${GREEN}✓ API key configured (env)${NC}"
    elif [ -f "$HOME/.gemini/settings.json" ]; then
        echo -e "  ${GREEN}✓ API key configured (file)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Set GEMINI_API_KEY environment variable${NC}"
    fi
else
    echo "  📦 Installing Gemini CLI..."
    npm install -g @google/gemini-cli
    echo -e "  ${GREEN}✓ Installed${NC}"
    echo -e "  ${YELLOW}⚠️  Set GEMINI_API_KEY environment variable${NC}"
fi

# 4. Install Qwen CLI
echo -e "\n${YELLOW}4. Qwen Code CLI${NC}"
if check_command qwen; then
    QWEN_VERSION=$(qwen --version 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓ Already installed (v$QWEN_VERSION)${NC}"

    # Check configuration
    if [ -n "$OPENAI_API_KEY" ]; then
        echo -e "  ${GREEN}✓ API key configured (env)${NC}"
    elif [ -f "$HOME/.qwen/settings.json" ]; then
        echo -e "  ${GREEN}✓ Configured (file)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Set OPENAI_API_KEY for OpenRouter access${NC}"
    fi
else
    echo "  📦 Installing @qwen-code/qwen-code..."
    npm install -g @qwen-code/qwen-code
    echo -e "  ${GREEN}✓ Installed${NC}"
    echo -e "  ${YELLOW}⚠️  Configure with OpenRouter API key${NC}"
fi

# 5. Check jq for JSON parsing
echo -e "\n${YELLOW}5. JSON Parser (jq)${NC}"
if check_command jq; then
    echo -e "  ${GREEN}✓ Already installed${NC}"
else
    echo "  📦 Installing jq..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y jq
    else
        echo -e "  ${YELLOW}⚠️  Please install jq manually${NC}"
    fi
fi

# Summary
echo -e "\n=================================================="
echo -e "${GREEN}Installation Summary:${NC}"
echo ""

# Check status of each CLI
echo "CLI Status:"
for cli in claude codex gemini qwen; do
    if check_command $cli; then
        echo -e "  ${GREEN}✓${NC} $cli"
    else
        echo -e "  ${RED}✗${NC} $cli"
    fi
done

# Configuration reminders
echo -e "\n${YELLOW}Configuration Reminders:${NC}"
echo ""

if ! check_command claude; then
    echo "• Claude: Install from https://claude.ai/download"
fi

if check_command codex; then
    if codex exec "test" 2>&1 | grep -q "401 Unauthorized"; then
        echo "• Codex: Run 'codex login' to authenticate"
    fi
fi

if [ -z "$GEMINI_API_KEY" ] && [ ! -f "$HOME/.gemini/settings.json" ]; then
    echo "• Gemini: Set GEMINI_API_KEY environment variable"
fi

if [ -z "$OPENAI_API_KEY" ] && [ ! -f "$HOME/.qwen/settings.json" ]; then
    echo "• Qwen: Set OPENAI_API_KEY for OpenRouter access"
fi

echo -e "\n${GREEN}Setup complete!${NC}"
echo ""
echo "Test your setup with:"
echo "  ./k1 'Hello'  # Claude (native or proxy)"
echo "  ./k2 'Hello'  # Codex GPT-5 (native)"
echo "  ./k3 'Hello'  # Qwen (proxy fallback)"
echo "  ./k4 'Hello'  # Gemini (native)"