#!/bin/bash

# Debate Consensus MCP Server Installation Script
set -e

echo "🔧 Installing Debate Consensus MCP Server..."

# Get the absolute path of the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Project directory: $PROJECT_DIR"

# Check if running on macOS (required for this project structure)
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  Warning: This script is optimized for macOS. Some paths may need adjustment for other systems."
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo "🔍 Checking dependencies..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$MAJOR_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+ and try again."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ npm is available"

# Install npm dependencies
echo "📦 Installing npm dependencies..."
cd "$PROJECT_DIR"
npm install

# Check if .env file exists, if not copy from example
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "📝 Creating .env file from example..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo "⚠️  Please edit .env file and add your API keys:"
    echo "   - OPENROUTER_API_KEY (required for Kimi, Qwen, and Gemini models)"
    echo "   - ANTHROPIC_API_KEY (optional if using system default)"
fi

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

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

# Function to update claude.json
update_claude_config() {
    local claude_config="$HOME/.claude.json"
    local server_name="debate-consensus"
    local server_command="node"
    local server_args="[\"$PROJECT_DIR/index.js\"]"

    # Check if ~/.claude.json exists
    if [ ! -f "$claude_config" ]; then
        echo "📝 Creating new ~/.claude.json..."
        cat > "$claude_config" << EOF
{
  "mcpServers": {
    "$server_name": {
      "command": "$server_command",
      "args": $server_args
    }
  }
}
EOF
    else
        echo "📝 Updating existing ~/.claude.json..."
        
        # Backup existing config
        backup_claude_config
        
        # Use Node.js to safely update the JSON
        node -e "
        const fs = require('fs');
        const path = '$claude_config';
        let config = {};
        
        try {
            const content = fs.readFileSync(path, 'utf8');
            config = JSON.parse(content);
        } catch (e) {
            console.log('Creating new config due to parse error:', e.message);
        }
        
        if (!config.mcpServers) {
            config.mcpServers = {};
        }
        
        config.mcpServers['$server_name'] = {
            command: '$server_command',
            args: $server_args
        };
        
        fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
        console.log('✅ Updated ~/.claude.json');
        "
    fi
}

# Update Claude configuration
echo "🔗 Configuring Claude CLI integration..."
update_claude_config

# Run configuration validation
echo "🔧 Validating configuration..."
if npm run validate; then
    echo "✅ Configuration is valid"
else
    echo "⚠️  Configuration validation failed. Please check your .env file."
fi

# Test MCP server functionality
echo "🧪 Testing MCP server..."
if node -e "
const mcpServer = require('$PROJECT_DIR/index.js');
console.log('✅ MCP server can be loaded');
" 2>/dev/null; then
    echo "✅ MCP server test passed"
else
    echo "⚠️  MCP server test failed. Please check the logs."
fi

# Make scripts executable
echo "🔑 Making scripts executable..."
chmod +x "$PROJECT_DIR/install.sh"
chmod +x "$PROJECT_DIR/uninstall.sh" 2>/dev/null || true
chmod +x "$PROJECT_DIR/test-mcp.js" 2>/dev/null || true

echo ""
echo "🎉 Installation completed!"
echo ""
echo "📋 Next steps:"
echo "1. Edit $PROJECT_DIR/.env and add your API keys"
echo "2. Test the installation: node $PROJECT_DIR/test-mcp.js"
echo "3. Use in Claude CLI: claude \"Use debate tool to solve: How to implement caching?\""
echo ""
echo "📚 Available commands:"
echo "   • debate: Run multi-LLM consensus debate"
echo "   • debate_history: View recent debate history"
echo ""
echo "🔧 Management commands:"
echo "   • npm run validate    - Validate configuration"
echo "   • npm run config:show - Show current configuration"
echo "   • npm test           - Run test suite"
echo ""
echo "For more information, see README.md"