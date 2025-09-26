#!/bin/bash

# k3 (Qwen 3 Max) wrapper script for debate consensus system
# Routes through OpenRouter proxy with full MCP tool access

export CLAUDE_CONFIG_DIR="$HOME/.claude-k3"
export ANTHROPIC_BASE_URL="http://localhost:3459"
export ANTHROPIC_API_KEY="k3-debate-key"

# Ensure proxy server is running
if ! curl -s http://localhost:3459/health > /dev/null 2>&1; then
    echo "Error: k3 proxy server not running. Start it with: node $(dirname "$0")/k-proxy-server.js" >&2
    exit 1
fi

# Ensure MCP config exists
if [ ! -f "$CLAUDE_CONFIG_DIR/.claude.json" ]; then
    echo "Error: k3 configuration not found at $CLAUDE_CONFIG_DIR/.claude.json" >&2
    exit 1
fi

# Auto-detect Claude CLI path
CLAUDE_CLI_PATH="${CLAUDE_CLI_PATH:-}"

# Try to find Claude CLI if not set
if [ -z "$CLAUDE_CLI_PATH" ]; then
    # Try common paths in order of preference
    if command -v claude >/dev/null 2>&1; then
        CLAUDE_CLI_PATH="claude"
    elif [ -f "$HOME/.claude/local/claude" ]; then
        CLAUDE_CLI_PATH="$HOME/.claude/local/claude"
    elif [ -f "/usr/local/bin/claude" ]; then
        CLAUDE_CLI_PATH="/usr/local/bin/claude"
    else
        echo "Error: Claude CLI not found. Set CLAUDE_CLI_PATH environment variable or install Claude CLI" >&2
        exit 1
    fi
fi

# Run Claude CLI with all arguments passed through
exec /Users/kostasnoreika/.npm-global/bin/claude --dangerously-skip-permissions "$@"