# IMPORTANT - Model Configuration

## DO NOT CHANGE c1/c2/c3
These are existing Claude Code CLI instances with Opus that user already has configured.
- c1, c2, c3 = User's existing Claude Code CLI with Opus
- These are NOT part of debate system
- User has local Qwen3 model separately

## Debate Models (k1-k4)
As per ORIGINAL IMPLEMENTATION PLAN:

1. **Claude Opus 4.1** - Architecture and system design
2. **GPT-5 Pro** - Testing strategies and debugging  
3. **Qwen 3 Max** - Algorithm optimization
4. **Gemini Pro 2.5** - Integration and completeness

## OpenRouter Model IDs (CONFIRMED AVAILABLE)

- **GPT-5 Pro**: `openai/gpt-5` ✅
- **Qwen 3 Max**: `qwen/qwen3-max` ✅
- **Gemini Pro 2.5**: `google/gemini-2.5-pro` ✅
- **Claude Opus 4.1**: `anthropic/claude-3-opus` (using latest available)

## Alias Structure

```bash
k1 = claude-opus-debate   # Claude Opus 4.1
k2 = claude-gpt5          # GPT-5 Pro
k3 = claude-qwen3         # Qwen 3 Max
k4 = claude-gemini-pro    # Gemini Pro 2.5
```

## Note on c1 Usage

c1 (user's existing Claude Opus) is used for final synthesis if available.
This gives best results as it uses the user's actual Opus instance for arbitration.