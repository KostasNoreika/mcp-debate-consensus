#!/bin/bash

# Register debate-consensus MCP server in Claude configuration

echo "🔧 Registering debate-consensus MCP server..."
echo

CLAUDE_CONFIG="$HOME/.claude.json"
BACKUP_CONFIG="$HOME/.claude.json.backup-$(date +%Y%m%d-%H%M%S)"

# Check if config exists
if [ ! -f "$CLAUDE_CONFIG" ]; then
    echo "❌ Claude config not found at $CLAUDE_CONFIG"
    exit 1
fi

# Create backup
cp "$CLAUDE_CONFIG" "$BACKUP_CONFIG"
echo "✅ Backup created: $BACKUP_CONFIG"

# Check if already registered
if grep -q "debate-consensus" "$CLAUDE_CONFIG"; then
    echo "ℹ️  debate-consensus already registered"
    exit 0
fi

# Add MCP server configuration using Python for proper JSON handling
python3 << 'EOF'
import json
import sys

config_file = "/Users/kostasnoreika/.claude.json"

# Read existing config
with open(config_file, 'r') as f:
    config = json.load(f)

# Ensure mcpServers exists
if 'mcpServers' not in config:
    config['mcpServers'] = {}

# Add debate-consensus server
config['mcpServers']['debate-consensus'] = {
    "command": "node",
    "args": ["/opt/mcp/servers/debate-consensus/index.js"],
    "env": {
        "NODE_ENV": "production"
    }
}

# Write back
with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print("✅ MCP server registered successfully")
EOF

echo
echo "✅ Registration complete!"
echo
echo "The debate-consensus MCP server is now available in Claude."
echo "Restart Claude Code to load the new MCP server."
echo
echo "Usage in Claude:"
echo "  'Use debate tool to analyze: <question>'"