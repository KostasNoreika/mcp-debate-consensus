#!/bin/bash

# k2 (GPT-5.1-Codex) wrapper script for debate consensus system
# Uses adaptive routing: native Codex CLI when available, falls back to proxy

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Delegate to adaptive wrapper
exec "$SCRIPT_DIR/k-adaptive-wrapper.sh" "k2" "$@"
