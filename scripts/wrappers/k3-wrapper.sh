#!/bin/bash

# k3 (Qwen 3 Max) wrapper script for debate consensus system
# Uses adaptive routing: native Qwen CLI when available, falls back to proxy

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Delegate to adaptive wrapper
exec "$SCRIPT_DIR/k-adaptive-wrapper.sh" "k3" "$@"
