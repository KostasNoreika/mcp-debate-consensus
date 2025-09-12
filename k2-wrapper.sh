#!/bin/bash

# k2 (GPT-5) wrapper script for debate consensus system
# Routes through OpenRouter proxy with full MCP tool access

export CLAUDE_CONFIG_DIR="$HOME/.claude-k2"
export ANTHROPIC_BASE_URL="http://localhost:3458"
export ANTHROPIC_API_KEY="k2-debate-key"

# Ensure proxy server is running
if ! curl -s http://localhost:3458/health > /dev/null 2>&1; then
    echo "Error: k2 proxy server not running. Start it with: node $(dirname "$0")/k-proxy-server.js" >&2
    exit 1
fi

# Ensure MCP config exists
if [ ! -f "$CLAUDE_CONFIG_DIR/.claude.json" ]; then
    echo "Error: k2 configuration not found at $CLAUDE_CONFIG_DIR/.claude.json" >&2
    exit 1
fi

# Run Claude CLI with all arguments passed through
exec /Users/kostasnoreika/.claude/local/claude --dangerously-skip-permissions "$@"