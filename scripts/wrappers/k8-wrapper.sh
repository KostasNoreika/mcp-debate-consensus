#!/bin/bash

# k8 (GLM-4.6 Exacto) wrapper script for debate consensus system
# Uses proxy only (no native CLI available for GLM)

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Delegate to adaptive wrapper
exec "$SCRIPT_DIR/k-adaptive-wrapper.sh" "k8" "$@"
