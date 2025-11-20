#!/bin/bash

# k5 (Grok 4 Fast) wrapper script for debate consensus system
# Uses proxy only (no native CLI available for Grok)

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Delegate to adaptive wrapper
exec "$SCRIPT_DIR/k-adaptive-wrapper.sh" "k5" "$@"
