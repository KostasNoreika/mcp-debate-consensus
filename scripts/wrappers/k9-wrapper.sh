#!/bin/bash

# k9 (Claude Opus 4.1) wrapper script for debate consensus system
# Uses adaptive routing: native Claude CLI when available, falls back to proxy

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Delegate to adaptive wrapper
exec "$SCRIPT_DIR/k-adaptive-wrapper.sh" "k9" "$@"
