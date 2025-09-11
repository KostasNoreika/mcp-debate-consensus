#!/bin/bash

# Debate Consensus MCP Server Uninstallation Script
set -e

echo "🗑️  Uninstalling Debate Consensus MCP Server..."

# Get the absolute path of the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Project directory: $PROJECT_DIR"

# Function to backup claude.json
backup_claude_config() {
    if [ -f "$HOME/.claude.json" ]; then
        local backup_file="$HOME/.claude.json.backup.$(date +%Y%m%d_%H%M%S)"
        echo "📋 Backing up existing ~/.claude.json to $backup_file"
        cp "$HOME/.claude.json" "$backup_file"
        return 0
    fi
    return 1
}

# Function to remove from claude.json
remove_from_claude_config() {
    local claude_config="$HOME/.claude.json"
    local server_name="debate-consensus"

    if [ ! -f "$claude_config" ]; then
        echo "ℹ️  ~/.claude.json not found, nothing to remove"
        return 0
    fi

    echo "🔗 Removing from Claude CLI configuration..."
    
    # Backup existing config
    backup_claude_config
    
    # Use Node.js to safely remove the server from JSON
    node -e "
    const fs = require('fs');
    const path = '$claude_config';
    
    try {
        const content = fs.readFileSync(path, 'utf8');
        let config = JSON.parse(content);
        
        if (config.mcpServers && config.mcpServers['$server_name']) {
            delete config.mcpServers['$server_name'];
            console.log('✅ Removed $server_name from mcpServers');
            
            // If mcpServers is now empty, we can optionally remove it
            if (Object.keys(config.mcpServers).length === 0) {
                console.log('ℹ️  mcpServers section is now empty but keeping it for future use');
            }
            
            fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
            console.log('✅ Updated ~/.claude.json');
        } else {
            console.log('ℹ️  $server_name was not found in ~/.claude.json');
        }
    } catch (e) {
        console.log('⚠️  Error updating ~/.claude.json:', e.message);
        process.exit(1);
    }
    " || {
        echo "❌ Failed to update ~/.claude.json"
        exit 1
    }
}

# Prompt user for confirmation
echo ""
echo "⚠️  This will:"
echo "   • Remove debate-consensus from ~/.claude.json"
echo "   • Clean npm cache and temporary files"
echo "   • Preserve your project files and logs"
echo ""
read -p "❓ Continue with uninstallation? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🚫 Uninstallation cancelled"
    exit 0
fi

# Remove from Claude configuration
remove_from_claude_config

# Clean npm cache and temporary files
echo "🧹 Cleaning temporary files..."
cd "$PROJECT_DIR"

# Clean npm cache for this project
npm cache clean --force 2>/dev/null || true

# Remove node_modules if user wants
echo ""
read -p "❓ Remove node_modules directory? This will require 'npm install' to use again (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing node_modules..."
    rm -rf node_modules
    echo "✅ node_modules removed"
fi

# Remove coverage directory if it exists
if [ -d "coverage" ]; then
    echo "🗑️  Removing test coverage files..."
    rm -rf coverage
fi

# Clean logs if user wants
if [ -d "logs" ] && [ "$(ls -A logs 2>/dev/null)" ]; then
    echo ""
    read -p "❓ Remove log files? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing log files..."
        rm -rf logs/*
        echo "✅ Log files removed"
    fi
fi

# Note about project files
echo ""
echo "ℹ️  Project files are preserved at: $PROJECT_DIR"
echo "   To completely remove the project, manually delete the directory"

echo ""
echo "✅ Uninstallation completed!"
echo ""
echo "📋 What was done:"
echo "   • Removed debate-consensus from ~/.claude.json"
echo "   • Cleaned temporary files and caches"
echo "   • Created backup of original ~/.claude.json"
echo ""
echo "📝 To reinstall:"
echo "   Run: $PROJECT_DIR/install.sh"
echo ""
echo "🔄 To completely remove the project:"
echo "   Run: rm -rf $PROJECT_DIR"