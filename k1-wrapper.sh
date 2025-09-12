#!/bin/bash

# k1 (Claude Opus 4.1) wrapper script for debate consensus system
# Routes through OpenRouter proxy with full MCP tool access

export CLAUDE_CONFIG_DIR="$HOME/.claude-k1"
export ANTHROPIC_BASE_URL="http://localhost:3457"
export ANTHROPIC_API_KEY="k1-debate-key"

# Ensure proxy server is running
if ! curl -s http://localhost:3457/health > /dev/null 2>&1; then
    echo "Error: k1 proxy server not running. Start it with: node $(dirname "$0")/k-proxy-server.js" >&2
    exit 1
fi

# Ensure MCP config exists
if [ ! -f "$CLAUDE_CONFIG_DIR/.claude.json" ]; then
    echo "Error: k1 configuration not found at $CLAUDE_CONFIG_DIR/.claude.json" >&2
    exit 1
fi

# Run Claude CLI with all arguments passed through
exec /Users/kostasnoreika/.claude/local/claude --dangerously-skip-permissions "$@"