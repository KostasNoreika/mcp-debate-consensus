#!/bin/bash

# cg (Claude with Gemini) wrapper script
# Runs Claude CLI with Gemini 3 Pro Preview model via OpenRouter proxy

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
PROXY_PORT=3460  # Same as k4 (Gemini 3 Pro Preview)
MODEL_NAME="Gemini 3 Pro Preview"

echo "🤖 cg ($MODEL_NAME) - Starting..." >&2

# Check if proxy is running
if ! curl -s "http://localhost:$PROXY_PORT/health" > /dev/null 2>&1; then
    echo "Error: Proxy server not running on port $PROXY_PORT." >&2
    echo "Start with: node $SCRIPT_DIR/k-proxy-server.js &" >&2
    exit 1
fi

# Load .env file for API key
ENV_FILE="$SCRIPT_DIR/../../.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | grep OPENROUTER_API_KEY | xargs)
fi

# Set environment for proxy
export CLAUDE_CONFIG_DIR="$HOME/.claude-cg"
export ANTHROPIC_BASE_URL="http://localhost:$PROXY_PORT"
export ANTHROPIC_AUTH_TOKEN="${OPENROUTER_API_KEY}"
# Unset API_KEY to avoid conflict with AUTH_TOKEN
unset ANTHROPIC_API_KEY

# Use Claude CLI with proxy
CLAUDE_CLI_PATH="$HOME/.claude/local/claude"
if [ -f "$CLAUDE_CLI_PATH" ]; then
    echo "  📡 Using Claude CLI + Gemini proxy on port $PROXY_PORT" >&2
    exec "$CLAUDE_CLI_PATH" --dangerously-skip-permissions "$@"
elif command -v claude >/dev/null 2>&1; then
    echo "  📡 Using Claude CLI + Gemini proxy on port $PROXY_PORT" >&2
    exec claude --dangerously-skip-permissions "$@"
else
    echo "Error: Claude CLI not found. Install it first." >&2
    exit 1
fi
