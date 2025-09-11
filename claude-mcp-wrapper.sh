#!/bin/bash

# Claude MCP Wrapper - Runs Claude with full MCP tools access
# Usage: ./claude-mcp-wrapper.sh "<prompt>"

PROMPT="$1"
PROJECT_PATH="${2:-/opt/dev/bookit.paysera.com}"

# Create temp file for prompt
TEMP_PROMPT="/tmp/claude_prompt_$$.txt"
echo "$PROMPT" > "$TEMP_PROMPT"

# Run Claude with full MCP access (no --headless)
# Using environment variables to enable bypass mode
export CLAUDE_ALLOW_FILE_ACCESS=1
export CLAUDE_BYPASS_WARNINGS=1
export CLAUDE_PROJECT_PATH="$PROJECT_PATH"

# Run Claude and capture output
/Users/kostasnoreika/.claude/local/claude < "$TEMP_PROMPT" 2>/dev/null

# Clean up
rm -f "$TEMP_PROMPT"