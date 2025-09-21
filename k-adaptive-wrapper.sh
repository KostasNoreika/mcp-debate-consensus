#!/bin/bash

# Adaptive K-wrapper: Automatically chooses native CLI or proxy based on availability
# Usage: ./k-adaptive-wrapper.sh <k-alias> [arguments]

set -e

# Get the k-alias (k1, k2, k3, k4)
K_ALIAS="$1"
shift # Remove first argument, pass rest to CLI

# Base directory
BASE_DIR="$(dirname "$0")"
CONFIG_FILE="$BASE_DIR/cli-config.json"

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found at $CONFIG_FILE" >&2
    exit 1
fi

# Parse configuration using jq (or python if jq not available)
if command -v jq >/dev/null 2>&1; then
    PREFER_NATIVE=$(jq -r ".cli_preferences.$K_ALIAS.prefer_native" "$CONFIG_FILE")
    NATIVE_CLI=$(jq -r ".cli_preferences.$K_ALIAS.native_cli" "$CONFIG_FILE")
    NATIVE_AVAILABLE=$(jq -r ".cli_preferences.$K_ALIAS.native_available" "$CONFIG_FILE")
    FALLBACK_TO_PROXY=$(jq -r ".cli_preferences.$K_ALIAS.fallback_to_proxy" "$CONFIG_FILE")
    PROXY_PORT=$(jq -r ".global_settings.proxy_ports.$K_ALIAS" "$CONFIG_FILE")
    MODEL_NAME=$(jq -r ".cli_preferences.$K_ALIAS.name" "$CONFIG_FILE")
else
    # Fallback to Python for JSON parsing
    PREFER_NATIVE=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['cli_preferences']['$K_ALIAS']['prefer_native'])")
    NATIVE_CLI=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['cli_preferences']['$K_ALIAS']['native_cli'])")
    NATIVE_AVAILABLE=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['cli_preferences']['$K_ALIAS'].get('native_available', 'false'))")
    FALLBACK_TO_PROXY=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['cli_preferences']['$K_ALIAS']['fallback_to_proxy'])")
    PROXY_PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['global_settings']['proxy_ports']['$K_ALIAS'])")
    MODEL_NAME=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['cli_preferences']['$K_ALIAS']['name'])")
fi

echo "🤖 $K_ALIAS ($MODEL_NAME) - Checking available options..." >&2

# Function to check if native CLI is available and configured
check_native_cli() {
    local cli_name="$1"

    # Check if CLI exists
    if ! command -v "$cli_name" >/dev/null 2>&1; then
        return 1
    fi

    # Check specific configuration requirements
    case "$cli_name" in
        claude)
            # Claude is always ready if installed
            # Check if Claude CLI exists
            if [ -f "$HOME/.claude/local/claude" ]; then
                return 0
            elif command -v claude >/dev/null 2>&1; then
                return 0
            else
                return 1
            fi
            ;;
        codex)
            # Check if Codex is authenticated
            if codex exec "test" 2>&1 | grep -q "401 Unauthorized"; then
                echo "  ⚠️  Codex CLI found but not authenticated. Run: codex login" >&2
                return 1
            fi
            return 0
            ;;
        gemini)
            # Check for Gemini API key
            if [ -z "$GEMINI_API_KEY" ] && [ ! -f "$HOME/.gemini/settings.json" ]; then
                echo "  ⚠️  Gemini CLI found but no API key. Set GEMINI_API_KEY env var" >&2
                return 1
            fi
            return 0
            ;;
        qwen)
            # Check for Qwen configuration
            if [ -z "$OPENAI_API_KEY" ] && [ ! -f "$HOME/.qwen/settings.json" ]; then
                echo "  ⚠️  Qwen CLI found but not configured. Set OPENAI_API_KEY or configure ~/.qwen/settings.json" >&2
                return 1
            fi
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to run via proxy
run_via_proxy() {
    echo "  📡 Using Claude CLI + proxy on port $PROXY_PORT" >&2

    # Check if proxy is running
    if ! curl -s "http://localhost:$PROXY_PORT/health" > /dev/null 2>&1; then
        echo "Error: Proxy server not running on port $PROXY_PORT. Start with: node $BASE_DIR/k-proxy-server.js" >&2
        exit 1
    fi

    # Set environment for proxy
    export CLAUDE_CONFIG_DIR="$HOME/.claude-$K_ALIAS"
    export ANTHROPIC_BASE_URL="http://localhost:$PROXY_PORT"
    export ANTHROPIC_API_KEY="$K_ALIAS-debate-key"

    # Use Claude CLI with proxy
    CLAUDE_CLI_PATH="$HOME/.claude/local/claude"
    if [ -f "$CLAUDE_CLI_PATH" ]; then
        exec "$CLAUDE_CLI_PATH" --dangerously-skip-permissions "$@"
    elif command -v claude >/dev/null 2>&1; then
        exec claude --dangerously-skip-permissions "$@"
    else
        echo "Error: Claude CLI not found. Install it first." >&2
        exit 1
    fi
}

# Function to run native CLI
run_native_cli() {
    local cli_name="$1"
    shift

    echo "  ✅ Using native $cli_name CLI" >&2

    case "$cli_name" in
        claude)
            # Use the full path to Claude CLI
            CLAUDE_CLI_PATH="$HOME/.claude/local/claude"
            if [ -f "$CLAUDE_CLI_PATH" ]; then
                exec "$CLAUDE_CLI_PATH" "$@"
            else
                exec claude "$@"
            fi
            ;;
        codex)
            exec codex exec "$@"
            ;;
        gemini)
            # Ensure API key is set
            if [ -n "$GEMINI_API_KEY" ]; then
                export GEMINI_API_KEY
            fi
            exec gemini -p "$@"
            ;;
        qwen)
            # Ensure API key is set
            if [ -n "$OPENAI_API_KEY" ]; then
                export OPENAI_API_KEY
            fi
            exec qwen -p "$@"
            ;;
        *)
            echo "Error: Unknown CLI: $cli_name" >&2
            exit 1
            ;;
    esac
}

# Main logic
if [ "$PREFER_NATIVE" = "true" ] && [ "$NATIVE_AVAILABLE" = "true" ]; then
    # Try native CLI first
    if check_native_cli "$NATIVE_CLI"; then
        run_native_cli "$NATIVE_CLI" "$@"
    elif [ "$FALLBACK_TO_PROXY" = "true" ]; then
        echo "  ⚠️  Native CLI not ready, falling back to proxy..." >&2
        run_via_proxy "$@"
    else
        echo "Error: Native CLI not available and fallback disabled" >&2
        exit 1
    fi
elif [ "$FALLBACK_TO_PROXY" = "true" ]; then
    # Use proxy directly
    run_via_proxy "$@"
else
    echo "Error: No available method to run $K_ALIAS" >&2
    exit 1
fi