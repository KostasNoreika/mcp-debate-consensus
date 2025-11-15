# Model Testing Guide

This guide explains how to test all 9 models (k1-k9) in the debate consensus system.

## Overview

The debate consensus system uses 9 different AI models, each with specific expertise:

| Model | Name | Role | Token Limit |
|-------|------|------|-------------|
| k1 | Claude Sonnet 4.5 Thinking | Architecture | 64K |
| k2 | GPT-5 | Testing | 128K |
| k3 | Qwen 3 Max | Algorithms | 32K |
| k4 | Gemini 2.5 Pro | Integration | 65K |
| k5 | Grok 4 Fast | Fast Reasoning | 30K |
| k6 | GPT-5 Max Thinking | Maximum Reasoning | 128K |
| k7 | Kimi K2 Thinking | Autonomous Tools | 256K |
| k8 | GLM-4.6 Exacto | Massive Context | 200K |
| k9 | Claude Opus 4.1 | Ultra Reasoning | 200K |

## Testing All 9 Models

### Quick Test (Recommended)

Test all 9 models with a simple question using npm:

```bash
npm run test:all-models
```

Or using the bash script directly:

```bash
./test-all-9-models.sh
```

### What the Test Does

1. **Checks Proxy Servers** - Verifies all 9 proxy servers (ports 3457-3465) are running
2. **Runs Debate** - Executes a debate with all available models using a simple question
3. **Reports Results** - Shows which models responded and their answers
4. **Displays Summary** - Provides statistics and confidence scores

### Expected Output

```
🧪 Testing All 9 Models (k1-k9)
============================================

1. Checking Proxy Servers (ports 3457-3465)
────────────────────────────────────────────

✅ k1 (Claude Sonnet 4.5 Thinking)
✅ k2 (GPT-5)
✅ k3 (Qwen 3 Max)
✅ k4 (Gemini 2.5 Pro)
✅ k5 (Grok 4 Fast)
✅ k6 (GPT-5 Max Thinking)
✅ k7 (Kimi K2 Thinking)
✅ k8 (GLM-4.6 Exacto)
✅ k9 (Claude Opus 4.1)

Proxy Status: 9/9 running

============================================
  Running Debate with Available Models
============================================

Question: What is 2+2? Reply with just the number.

Using models: k1,k2,k3,k4,k5,k6,k7,k8,k9
Timeout: 180 seconds

ℹ️  Starting debate (this may take 2-3 minutes)...

⏳ k1: Starting...
✅ k1: Completed
⏳ k2: Starting...
✅ k2: Completed
...

============================================
  Test Results
============================================

✅ Debate completed in 45.3s
Models participated: 9/9

Final Consensus:
  4

Confidence: 95.2%

============================================
  Summary
============================================

✅ Perfect! All 9 models responded! 🎉
```

## Individual Model Testing

### Test Specific Models

You can test specific models by using the debate system directly:

```bash
# Test just k1 and k2
npm run test:debate -- --models k1,k2

# Test thinking models only
npm run test:debate -- --models k1,k6,k7
```

### Health Check

To verify all proxy servers are running and configured correctly:

```bash
node health-check.js
```

This checks:
- Proxy server availability (ports 3457-3465)
- OpenRouter API connectivity
- Model accessibility
- Configuration validity

### Model Resilience Test

Test the system's ability to handle partial model failures:

```bash
./test-model-resilience.sh
```

## Troubleshooting

### No Models Responding

If no models respond:

1. **Check proxy servers are running:**
   ```bash
   node k-proxy-server.js &
   ```

2. **Verify health status:**
   ```bash
   node health-check.js
   ```

3. **Check OPENROUTER_API_KEY:**
   ```bash
   grep OPENROUTER_API_KEY .env
   ```

### Some Models Not Responding

If only some models respond:

1. **Check specific proxy ports:**
   ```bash
   curl http://localhost:3457/health  # k1
   curl http://localhost:3458/health  # k2
   # ... etc for 3459-3465
   ```

2. **Check logs:**
   ```bash
   tail -f logs/debate-*.json
   ```

3. **Verify model availability on OpenRouter:**
   - Visit https://openrouter.ai/docs/models
   - Check if all models are available with your API key

### Timeout Issues

If debates timeout:

1. **Increase timeout:**
   - Edit `.env` and set `DEBATE_TIMEOUT_MINUTES=10`
   - Or modify the test script timeout parameter

2. **Test with fewer models:**
   ```bash
   npm run test:debate -- --models k1,k2,k3
   ```

3. **Check system resources:**
   ```bash
   top  # Check CPU/memory usage
   ```

## Advanced Testing

### Custom Questions

You can modify the test to use custom questions:

```javascript
// Edit examples/test-all-9-models.js
const question = 'Your custom question here';
```

### Performance Benchmarking

Compare model response times:

```bash
npm run test:performance
```

### Stress Testing

Test system under load:

```bash
for i in {1..10}; do
  npm run test:all-models &
done
wait
```

## Test Files

- `test-all-9-models.sh` - Bash script for quick testing
- `examples/test-all-9-models.js` - Node.js test with detailed output
- `test-model-resilience.sh` - Tests system resilience
- `health-check.js` - Comprehensive health verification

## CI/CD Integration

To integrate into CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Test All Models
  run: |
    node k-proxy-server.js &
    sleep 10
    npm run test:all-models
```

## See Also

- [CLAUDE.md](../CLAUDE.md) - Complete development guide
- [API.md](../API.md) - API documentation
- [ARCHITECTURE-V2.md](./ARCHITECTURE-V2.md) - System architecture
