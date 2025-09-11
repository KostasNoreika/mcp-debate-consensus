# Using k1-k4 Models with Full Claude CLI Capabilities

## 🚀 Quick Start

### 1. Start the proxy server (in separate terminal):
```bash
cd /opt/mcp/servers/debate-consensus
./start-router.sh

# Or run in background:
nohup ./start-router.sh > router.log 2>&1 &
```

### 2. Use k1-k4 aliases with full Claude CLI features:
```bash
# Source aliases
source ~/.claude-k-models

# Now each model has full Claude CLI capabilities:
k1 /init                    # Claude Opus 4.1 analyzes project
k2 "Find bugs in this code" # GPT-5 with file access
k3 "Optimize algorithm"     # Qwen 3 Max with MCP tools
k4 "Review completeness"    # Gemini 2.5 Pro full access
```

## ✨ What's New

### Before (Simple API wrapper):
- ❌ No file access
- ❌ No MCP tools
- ❌ No bash commands
- ❌ Just text in/out

### Now (Full Claude CLI via proxy):
- ✅ Full file system access
- ✅ All MCP servers work
- ✅ Can run bash commands
- ✅ Can edit files
- ✅ Can use all Claude CLI features

## 🤖 Model Assignments

| Alias | Model | Expertise | Use For |
|-------|-------|-----------|---------|
| **k1** | Claude Opus 4.1 | Architecture | System design, code structure |
| **k2** | GPT-5 | Testing | Test strategies, debugging |
| **k3** | Qwen 3 Max | Algorithms | Optimization, performance |
| **k4** | Gemini 2.5 Pro | Integration | Completeness, review |

## 🧪 Testing

Test that everything works:
```bash
./test-router.sh
```

## 🎯 Using in Debate MCP

The debate MCP automatically uses the proxy when available:

```bash
# In Claude CLI
claude "Use debate tool to analyze: What's the best database for my project?"
```

The system will:
1. Check if proxy is running
2. Use k1-k4 with full capabilities
3. Each model can read files, check tests, run commands
4. Synthesize best solution

## 🛠️ Troubleshooting

### Proxy not starting?
```bash
# Check if port 3456 is in use
lsof -i:3456

# Kill existing proxy
pkill -f 'node proxy.js'

# Restart
./start-router.sh
```

### Models not responding?
```bash
# Check proxy health
curl http://localhost:3456/health

# Check OpenRouter API key
grep OPENROUTER_API_KEY /opt/mcp/servers/debate-consensus/claude-router/.env
```

### Want to use without proxy?
The old wrapper still works as fallback when proxy is not running.

## 📝 Architecture

```
Claude CLI (k1-k4 aliases)
    ↓
ANTHROPIC_BASE_URL=http://localhost:3456
    ↓
Proxy Server (routes by MODEL_OVERRIDE)
    ↓
OpenRouter API (different models)
    ↓
Response transformed back to Claude format
    ↓
Claude CLI processes response with MCP/files access
```

## 🔑 Key Points

1. **MCP and file access** work because we use real Claude CLI
2. **Model switching** happens via MODEL_OVERRIDE environment variable
3. **Proxy translates** between Claude API and OpenRouter API
4. **Each k* alias** sets MODEL_OVERRIDE to select the right model
5. **Full compatibility** with all Claude CLI features