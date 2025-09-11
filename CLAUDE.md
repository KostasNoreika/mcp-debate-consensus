# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛑 CRITICAL RULES - NEVER VIOLATE 🛑

1. **NEVER CHANGE MODEL CONFIGURATIONS**: The k1-k4 model aliases are FIXED and must NEVER be changed to different models unless the user explicitly requests a specific model change.
   
   **NOTE**: The k1-k4 aliases are NOT OS-level aliases. They are handled internally by the proxy server (`claude-router/proxy.js`). No alias setup is required - just start the proxy server.
   - k1 MUST remain: `anthropic/claude-opus-4.1`
   - k2 MUST remain: `openai/gpt-5-chat`
   - k3 MUST remain: `qwen/qwen3-max`
   - k4 MUST remain: `google/gemini-2.5-pro`

2. **DO NOT suggest model alternatives or "improvements"** - these models were specifically chosen by the user.

3. **If models return 404 errors**, fix the naming/format but NEVER switch to a different model.

## Commands

### Development
```bash
npm start           # Start the MCP server
npm run dev        # Start in development mode
npm run prod       # Start in production mode
```

### Testing
```bash
npm test           # Run all Jest tests
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:mcp   # Test MCP client directly (test-mcp-client.js)
npm run test:models # Test consensus mechanism (./test-consensus.sh)

# Test scripts
./test-router.sh           # Test k1-k4 models with proxy
```

### Configuration
```bash
npm run validate   # Validate configuration
npm run config:show # Display current configuration  
npm run config:check # Check config and available models
```

### Utilities
```bash
npm run clean      # Clean logs, coverage, and cache

# Setup scripts
./setup-claude-router.sh   # Setup proxy server (one time)
./proxy-daemon.sh start    # Start proxy server
./proxy-daemon.sh status   # Check proxy status
source ~/.claude-k-models  # Load model aliases
```

### Model Testing
```bash
# Test individual models (proxy must be running)
k1 /init                  # Claude Opus 4.1 with full MCP
k2 "Find bugs"           # GPT-5 with file access
k3 "Optimize code"       # Qwen 3 Max with tools
k4 "Review project"      # Gemini 2.5 Pro with everything
```

## Architecture

This is an MCP (Model Context Protocol) server that orchestrates multi-model debates using Claude CLI instances with different backend models via OpenRouter.

### Core Components

**Entry Point (`index.js`)**
- Initializes MCP server with debate consensus capabilities
- Loads ES modules for MCP SDK dynamically
- Exposes `debate` and `debate-history` tools via MCP protocol

**Debate Orchestrator (`src/simple-debate.js`)**
- Manages multi-model consensus through two-round debate process
- Uses k1-k4 aliases to invoke different models via Claude CLI
- Models have full MCP tool access (file reading, bash commands, etc.)
- Implements scoring and synthesis logic for consensus building

**Model Configuration (FIXED - DO NOT CHANGE)**
- **k1**: Claude Opus 4.1 (`anthropic/claude-opus-4.1`) - Architecture and system design
- **k2**: GPT-5 (`openai/gpt-5-chat`) - Testing strategies and debugging  
- **k3**: Qwen 3 Max (`qwen/qwen3-max`) - Algorithm optimization
- **k4**: Gemini 2.5 Pro (`google/gemini-2.5-pro`) - Integration and completeness
- **c1**: Existing Claude CLI with Opus - Final synthesis arbitrator

### Process Flow

1. **Round 1: Independent Analysis**
   - Each model (k1-k4) analyzes the question independently
   - Models can use MCP tools to read files, check tests, examine configs
   - Each provides a complete solution proposal

2. **Selection Phase**
   - Solutions scored on completeness, testability, and practicality
   - Best initial proposal selected based on scoring

3. **Round 2: Collaborative Improvement**
   - All models review the best solution
   - Each suggests improvements from their expertise area
   - No complete rewrites, only enhancements

4. **Synthesis**
   - If c1 available: Used as final arbitrator
   - Otherwise: Automated merging of improvements
   - Final consensus solution produced

### Key Implementation Details

- Models run as separate Claude CLI processes with environment variable overrides
- Communication via stdin/stdout with JSON formatting
- Temporary files in `/tmp/simple-debate` for inter-model communication
- Logs stored in `/opt/mcp/servers/debate-consensus/logs/`
- Fallback logic ensures operation even if some models fail
- OpenRouter API provides access to multiple model providers through single key

## Configuration Requirements

1. **OpenRouter API Key**: Must be set in `.env` file as `OPENROUTER_API_KEY`
2. **Model Aliases**: Must run `./setup-aliases.sh` and `source ~/.claude-models`
3. **MCP Registration**: Server must be registered in `~/.claude.json`

## Error Handling

- Minimum 2 model responses required for debate
- Automatic retry with exponential backoff for failed model calls
- Graceful degradation if arbitrator (c1) unavailable
- Comprehensive logging to `logs/` directory for debugging