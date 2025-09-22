#!/bin/bash

# Wrapper script for k5 (Grok 4 Fast) model
# This script sets up the environment for using Grok 4 Fast through the proxy

export MODEL_OVERRIDE=k5
export ANTHROPIC_API_KEY="proxy-key-k5"
export ANTHROPIC_BASE_URL="http://localhost:3456"

# Execute the Claude CLI with all arguments passed through
exec claude "$@"