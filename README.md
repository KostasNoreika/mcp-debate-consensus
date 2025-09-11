# MCP Debate Consensus Server

A Model Context Protocol (MCP) server that orchestrates multi-model debates using different Large Language Models to reach consensus on complex questions.

## 🚀 Quick Start

### Option 1: Full Claude CLI Mode (Recommended - with MCP tools!)
```bash
# 1. Clone & install
git clone https://github.com/KostasNoreika/mcp-debate-consensus.git
cd mcp-debate-consensus && npm install

# 2. Setup API key
cp .env.example .env
# Edit .env and add your OpenRouter API key

# 3. Install Claude CLI (if not already installed)
npm install -g @anthropic/claude-cli

# 4. Start the k-proxy server (maps k1-k4 to different models)
node k-proxy-server.js

# 5. Run debate with full MCP tool access!
node test-claude-cli-debate.js "What's the best architecture for a chat app?"
```

### Option 2: Simple HTTP Mode (No tools, faster)
```bash
# Start simple proxy
cd claude-router && node proxy.js

# Run simple debate (no MCP tools)
node test-direct-debate.js "Your question here"
```

## Features

- **Two Modes Available**:
  - **Full Mode**: Each model runs as real Claude CLI with complete MCP tool access (file operations, bash, Git, Docker, etc.)
  - **Simple Mode**: Direct HTTP calls for faster responses without tool access
- **Multi-Model Consensus**: Combines insights from 4 different LLMs (Claude, GPT-4, Qwen, Gemini)
- **Turn-Based Debate**: Models see and build upon each other's responses
- **Semantic Scoring**: Advanced scoring algorithm evaluating relevance, novelty, quality, and coherence
- **MCP Tool Integration**: In full mode, models can read files, run commands, search code, manage Git, etc.
- **Comprehensive Logging**: Detailed debate history and decision tracking

## How It Works

The system uses **k1-k4 aliases** that are handled internally by the proxy server (no OS-level alias setup needed):

- **k1**: Claude Opus 4.1 - Architecture and system design
- **k2**: GPT-5 - Testing strategies and debugging
- **k3**: Qwen 3 Max - Algorithm optimization
- **k4**: Gemini 2.5 Pro - Integration and completeness

These aliases work through the included proxy server (`claude-router/proxy.js`) which routes requests to the appropriate models via OpenRouter API.

## Prerequisites

- Node.js 18+ 
- OpenRouter API key (get from [OpenRouter](https://openrouter.ai/keys))
- Optional: Any MCP-compatible client (Claude Desktop, Claude CLI, etc.) - only if you want to use as MCP server

## Platform Support

✅ **Works on all platforms**: Windows, macOS, Linux
- No OS-specific aliases or scripts needed
- Everything runs through Node.js
- Proxy server handles all model routing internally

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- OpenRouter API key from [https://openrouter.ai/keys](https://openrouter.ai/keys)

### Step-by-step Setup

1. **Clone the repository:**
```bash
git clone https://github.com/KostasNoreika/mcp-debate-consensus.git
cd mcp-debate-consensus
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure your API key:**
```bash
cp .env.example .env
```
Then edit `.env` file and replace `your_openrouter_api_key_here` with your actual OpenRouter API key:
```
OPENROUTER_API_KEY=your_actual_key_here
```

4. **Install and start the proxy server:**
```bash
cd claude-router
npm install
cd ..
```

5. **Start the proxy server (REQUIRED):**
```bash
# In a separate terminal window:
cd mcp-debate-consensus/claude-router
node proxy.js
```
⚠️ **Important:** The proxy server MUST be running for the debate system to work! Keep it running in a separate terminal.

## Usage

### Standalone Mode (No Claude CLI needed!)

Run debates directly from command line:
```bash
# Start proxy server first
cd claude-router && node proxy.js &

# Run a debate
node test-direct-debate.js "What's the best architecture for a chat app?"
```

### As an MCP Server (Optional)

For integration with MCP-compatible clients (Claude Desktop, Claude CLI, etc.):

1. Register the server in your MCP client config (e.g., `~/.claude.json` for Claude):
```json
{
  "mcpServers": {
    "debate-consensus": {
      "command": "node",
      "args": ["/path/to/mcp-debate-consensus/index.js"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

2. Use the debate tool in Claude CLI:
```bash
# Run a debate
claude "use the debate tool to analyze: What is the best architecture for a real-time chat application?"

# View debate history
claude "show me the debate history"
```

### Direct Testing

Run debates directly without MCP:
```bash
node test-direct-debate.js "Your question here"
```

## Architecture

### How It Works

1. **Question Analysis**: Each model independently analyzes the question
2. **Proposal Generation**: Models generate initial solution proposals
3. **Semantic Scoring**: Proposals are scored on multiple dimensions
4. **Collaborative Improvement**: All models review and improve the best proposal
5. **Consensus Building**: Final solution incorporates improvements from all models

### Scoring Algorithm

The semantic scoring system evaluates proposals on:
- **Relevance (40%)**: How well the answer addresses the question
- **Novelty (20%)**: Unique insights and creative approaches
- **Quality (20%)**: Technical accuracy and completeness
- **Coherence (20%)**: Logical structure and clarity

### Project Structure

```
mcp-debate-consensus/
├── index.js                    # MCP server entry point
├── src/
│   ├── simple-debate-fixed.js  # Main debate orchestrator
│   ├── improved-semantic-scoring.js # Scoring algorithm
│   └── history.js              # Debate history management
├── claude-router/
│   └── proxy.js                # Model routing proxy server
├── test-*.js                   # Test scripts
└── logs/                       # Debate logs and history
```

## Testing

Run the test suite:
```bash
npm test
```

Test individual components:
```bash
# Test semantic scoring
node evaluate-scoring.js

# Test full debate flow
node test-full-debate.js

# Test synchronous execution
node test-restoration-verification.js
```

## Configuration

### Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key (required)
- `PROXY_PORT`: Port for the proxy server (default: 3456)
- `DEBATE_TIMEOUT`: Maximum time for debate in ms (default: 1800000)
- `MIN_MODELS_REQUIRED`: Minimum models needed for consensus (default: 2)

### Model Configuration

Models are configured in `claude-router/proxy.js`. The k1-k4 aliases map to specific models via OpenRouter. These should not be changed unless you understand the implications.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built on the [Model Context Protocol (MCP)](https://github.com/anthropics/mcp) by Anthropic
- Powered by [OpenRouter](https://openrouter.ai) for multi-model access
- Inspired by ensemble learning and consensus algorithms

## Support

For issues, questions, or suggestions, please open an issue on GitHub.
