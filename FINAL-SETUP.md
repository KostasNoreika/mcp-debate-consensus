# FINAL SETUP - Debate Consensus System

## ✅ CONFIRMED CONFIGURATION

### Models (all via OpenRouter):
- **k1** = Claude Opus 4 (`anthropic/claude-opus-4`)
- **k2** = GPT-5 Pro (`openai/gpt-5`)
- **k3** = Qwen 3 Max (`qwen/qwen3-max`)
- **k4** = Gemini Pro 2.5 (`google/gemini-2.5-pro`)

### IMPORTANT: c1/c2/c3 NOT CHANGED
- c1, c2, c3 = Your existing Claude Code CLI with Opus
- These are NOT part of debate system
- k-aliases are for debate models only

## Setup Instructions

```bash
cd /opt/mcp/servers/debate-consensus

# 1. Install dependencies
npm install

# 2. Setup aliases
./setup-aliases.sh
source ~/.claude-models

# 3. Test
echo "test" | k1
./test-quick.js
```

## Usage

### Via Claude MCP:
```bash
claude "Use debate tool: What's the best database?"
```

### Direct model testing:
```bash
k1 /init        # Claude Opus 4
k2 "Find bugs"  # GPT-5 Pro
k3 "Optimize"   # Qwen 3 Max
k4 "Review"     # Gemini Pro 2.5
```

## Troubleshooting

If models don't respond:
1. Check OPENROUTER_API_KEY in .env
2. Re-run: source ~/.claude-models
3. Test individual model: echo "test" | k1

## No c2/c3 Conflicts

The system uses k1-k4 aliases only. Your existing c1/c2/c3 Claude instances remain unchanged.