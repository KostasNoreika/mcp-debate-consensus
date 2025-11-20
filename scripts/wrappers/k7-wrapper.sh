#!/bin/bash

# k7 (Kimi K2 Thinking) wrapper script for debate consensus system
# Uses proxy only (no native CLI available for Kimi)

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Delegate to adaptive wrapper
exec "$SCRIPT_DIR/k-adaptive-wrapper.sh" "k7" "$@"
