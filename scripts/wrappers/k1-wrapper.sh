#!/bin/bash

# k1 (Claude Sonnet 4.5 Thinking) wrapper script for debate consensus system
# Uses adaptive routing: native Claude CLI when available, falls back to proxy

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Delegate to adaptive wrapper
exec "$SCRIPT_DIR/k-adaptive-wrapper.sh" "k1" "$@"
