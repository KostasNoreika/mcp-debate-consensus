# Native CLI Setup - Complete Guide

## ✅ Installation Status

All native CLI tools are now installed:
- **Claude CLI** - Already installed (works with Anthropic API)
- **Codex CLI** - Installed via npm (@openai/codex)
- **Gemini CLI** - Installed via npm (@google/gemini-cli)
- **Qwen** - Using wrapper with OpenRouter

## 🔧 Configuration Required

### 1. Claude (k1) - Already works with your API
```bash
# Uses your existing Claude setup
k1 "Your prompt"
```

### 2. Codex/GPT (k2) - Needs OpenAI API key
```bash
# Login to Codex (uses ChatGPT Plus/Pro account)
codex /login

# Or set environment variable
export OPENAI_API_KEY="sk-..."
```

### 3. Gemini (k3) - Needs Google API key
```bash
# Set Gemini API key
export GEMINI_API_KEY="your-google-api-key"

# Or configure in settings
mkdir -p ~/.gemini
echo '{"auth": {"apiKey": "your-key"}}' > ~/.gemini/settings.json
```

### 4. Qwen (k4) - Already configured
```bash
# Uses OpenRouter, already working
k4 "Your prompt"
```

## 📝 Usage

### Activate the system:
```bash
source ~/.claude-native-debate
```

### Test all models:
```bash
test-native
```

### Run parallel debate:
```bash
debate-native "What's the best database for my project?"
```

### Test file creation:
```bash
test-native-files
```

## 🎯 How It Works

Each CLI has NATIVE support for:
- **File operations** - Create, edit, read files
- **Code execution** - Run commands, scripts
- **Tool/function calling** - API integrations
- **MCP protocols** - Claude and Gemini support MCP

## 🚀 Quick Start

```bash
# 1. Source the configuration
source ~/.claude-native-debate

# 2. Check status
check-native

# 3. Configure API keys as needed
export OPENAI_API_KEY="your-key"
export GEMINI_API_KEY="your-key"

# 4. Test everything
test-native

# 5. Run a debate
debate-native "How to implement authentication?"
```

## 📊 Architecture

```
Question → [k1, k2, k3, k4] parallel execution → Synthesis
            ↓   ↓   ↓   ↓
         Claude GPT Gemini Qwen
            ↓   ↓   ↓   ↓
         [Native MCP/Tools support]
```

## ✨ Benefits

1. **Native tools** - Each CLI uses its native capabilities
2. **Parallel execution** - All models run simultaneously
3. **Full MCP** - Claude and Gemini have MCP support
4. **Tool calling** - Codex has OpenAI function calling
5. **No proxy needed** - Direct API connections

## 🔍 Troubleshooting

### Codex not working?
- Run: `codex /login`
- Or use ChatGPT Plus/Pro account

### Gemini not working?
- Get API key from: https://makersuite.google.com/app/apikey
- Set: `export GEMINI_API_KEY="your-key"`

### Claude not working?
- Check: `echo $ANTHROPIC_API_KEY`
- Already configured in your system

## 🎉 Ready!

The system is now fully configured with native CLI tools.
Each model can:
- Create and edit files
- Execute code
- Use their native tool systems
- Work in parallel for debates