# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the AI Expert Consensus MCP server codebase.

## 🛑 CRITICAL RULES

1. **NEVER CHANGE MODEL CONFIGURATIONS** without explicit user request:
   - k1: `anthropic/claude-sonnet-4.5` - Architecture and system design
   - k2: `openai/gpt-5` - Testing strategies and debugging
   - k3: `qwen/qwen3-max` - Algorithm optimization
   - k4: `google/gemini-2.5-pro` - Integration and completeness
   - k5: `x-ai/grok-4-fast:free` - Fast reasoning and coding
   - k7: `deepseek/deepseek-r1` - Deep analytical reasoning
   - k8: `z-ai/glm-4.5` - Chinese AI perspective

2. **DO NOT suggest model alternatives** - these were specifically chosen
3. **If models return 404 errors**, fix naming/format but NEVER switch models

## Essential Commands

### Setup & Starting Services
```bash
# One-time setup
node install.js                # Automated installer
cp .env.example .env          # Create config (add OPENROUTER_API_KEY)

# Start services (REQUIRED before use)
node k-proxy-server.js &      # Proxy servers (ports 3457-3464)
npm start                     # MCP server

# Health verification
node health-check.js          # Comprehensive system check
```

### Testing (98.5% Success Rate - 279/283 passing)
```bash
# Full test suite
npm test                      # All 283 tests

# Component testing
npm run test:security         # Enterprise security features
npm run test:retry           # Exponential backoff retry
npm run test:performance     # Performance tracking
npm run test:confidence      # Confidence scoring
npm run test:cache          # Smart caching
npm run test:learning       # ML learning system

# Direct testing
node test-debate.js "question"    # Test debate directly
npm run test:all                  # Security + full suite
```

### Development
```bash
npm run dev                  # Development mode (verbose)
npm run validate            # Validate configuration
npm run config:show         # Display current config
npm run clean              # Clean logs/cache/coverage
```

### Security & Learning
```bash
# Security
npm run security:generate-secret  # Generate HMAC secret
npm run test:security            # Test security
npm run security:status         # Check config

# Learning System
npm run learning:status     # Check metrics
npm run learning:report     # Performance report
npm run learning:reset      # Reset data (careful!)
```

## Architecture Overview

### System Flow

```
MCP Request → index.js → Claude CLI Orchestrator → k-proxy-server (3457-3464) → OpenRouter
                              ↓
                    Gemini Coordinator (analyzes question)
                              ↓
                    Selects 3-5 optimal models
                              ↓
              Round 1: Independent Analysis (parallel)
                              ↓
              Semantic Scoring & Selection
                              ↓
              Round 2: Collaborative Improvement
                              ↓
                    Final Consensus + Confidence Score
```

### Key Components

**Entry Points:**
- `index.js` - MCP server, tool registration, request routing
- `k-proxy-server.js` - Proxy layer (ports 3457-3464), OpenRouter translation

**Core Orchestration:**
- `src/claude-cli-debate.js` - Main debate orchestrator, spawns Claude CLI processes
- `src/gemini-coordinator.js` - Intelligent model selection (analyzes questions)
- `src/iterative-debate-orchestrator.js` - Multi-round debate management

**Advanced Systems:**
- `src/security.js` - HMAC-SHA256, rate limiting, validation, audit logging
- `src/utils/retry-handler.js` - Exponential backoff with error classification
- `src/confidence-scorer.js` - 0-100% confidence with multi-factor analysis
- `src/cache/debate-cache.js` - Smart caching (90% cost reduction)
- `src/learning/learning-system.js` - ML pattern detection, model profiling
- `src/performance-tracker.js` - SQLite performance metrics (70+ categories)
- `src/cross-verifier.js` - Adversarial testing for critical scenarios
- `src/telemetry-client.js` - Anonymous usage stats (opt-out available)

**Key Directories:**
- `/src/adapters/` - Model-specific adapters (Claude, Gemini, Codex, fallback)
- `/src/streaming/` - Real-time progress streaming
- `/src/learning/` - ML optimization (pattern-detector, model-profiler, optimizer)
- `/src/verification/` - Adversarial testing and fact-checking
- `/src/utils/` - Utilities including retry handler
- `/data/` - SQLite databases
- `/cache/` - Debate cache storage
- `/logs/` - Execution logs (JSON format)
- `/tests/` - Comprehensive test suite (unit, integration, e2e)

## SDK Version

**Current**: `@modelcontextprotocol/sdk@1.19.1` (upgraded from 0.5.0 on 2025-10-02)

**Import Paths** (backwards compatible):
```javascript
// Server components
import('@modelcontextprotocol/sdk/server/index.js')  // Server class
import('@modelcontextprotocol/sdk/server/stdio.js')  // StdioServerTransport
import('@modelcontextprotocol/sdk/types.js')        // ListToolsRequestSchema, CallToolRequestSchema

// New SDK supports both ESM and CJS via export maps
// Import paths work identically despite internal restructuring
```

**New SDK Features**:
- Dual ESM/CJS builds (dist/esm and dist/cjs)
- Enhanced TypeScript types
- Improved streaming support
- Additional middleware: cors, express-rate-limit

## Configuration

### Required Environment Variables
```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-xxx      # From openrouter.ai

# Security (Production)
HMAC_SECRET=xxx                       # 64+ chars, generate with npm script
ENABLE_REQUEST_SIGNING=true
SIGNATURE_VALIDITY_WINDOW=300        # 5 minutes

# Retry Configuration
MAX_RETRIES=3
INITIAL_RETRY_DELAY=1000             # 1 second
MAX_RETRY_DELAY=30000                # 30 seconds
BACKOFF_MULTIPLIER=2

# Optional
DEBATE_TIMEOUT_MINUTES=60
TELEMETRY_DISABLED=false
RATE_LIMIT_MAX_REQUESTS=10
```

### MCP Registration
Add to `~/.claude.json`:
```json
{
  "mcpServers": {
    "debate-consensus": {
      "command": "node",
      "args": ["/opt/mcp/servers/debate-consensus/index.js"]
    }
  }
}
```

## Development Workflow

### Testing Models
1. Run `node health-check.js` - verify proxy servers
2. Check individual: `curl http://localhost:3457/health`
3. Test with question: `node test-debate.js "What is 2+2?"`
4. Review logs in `/logs/debate-*.json` for debugging

### Common Issues

**Proxy server not starting:**
- Check ports 3457-3464 are free
- Verify OPENROUTER_API_KEY is set
- Look for "proxy running on http://" in output

**Model failures:**
- Minimum 2 models must respond for consensus
- System gracefully degrades with fallback logic
- Check retry handler logs in debate results
- Review `/logs/debate-*.json` for details

**Security issues:**
- Generate secret: `npm run security:generate-secret`
- Test: `npm run test:security`
- Check signature validation in logs

**Cache issues:**
- Auto-invalidates after 24 hours
- Manual clear: `rm -rf cache/debate-cache.json`
- Disable: Set cache size to 0 in config

**Retry failures:**
- Check .env retry configuration
- Review retry statistics in debate results
- Test: `node test-retry-functionality.js`

## Code Architecture

### Wrapper Scripts (k1-k8)
Shell wrappers in root directory proxy Claude CLI calls:
- `k1-wrapper.sh` through `k8-wrapper.sh`
- Each wrapper points to specific port (3457-3464)
- Enables model diversity while using Claude CLI interface

### Debate Process
1. **Question Analysis** - GeminiCoordinator analyzes and categorizes
2. **Model Selection** - Chooses 3-5 optimal models from pool of 7
3. **Round 1** - Independent parallel analysis (each model gets full MCP access)
4. **Semantic Scoring** - LLM evaluates proposals (relevance, novelty, quality, coherence)
5. **Best Selection** - Highest scoring proposal becomes baseline
6. **Round 2** - Collaborative improvement based on best proposal
7. **Synthesis** - Final consensus with confidence score

### Parallel Instances
Syntax: `k1:2,k2,k3:3` means:
- k1:2 = 2 parallel Claude Sonnet instances (different seeds)
- k2 = 1 GPT-5 instance
- k3:3 = 3 parallel Qwen instances
Enhances diversity and consensus quality.

### Quality Presets
- **Rapid** (3-5s) - Single fast model
- **Balanced** (30-60s) - 3 models (default)
- **Maximum** (2-5min) - 5 models with verification

## Testing Strategy

### Test Structure
- `tests/unit/` - Component unit tests
- `tests/integration/` - Integration tests
- `tests/e2e/` - End-to-end workflows
- `test-*.js` (root) - Direct functional tests

### Running Single Tests
```bash
# Run specific test file
NODE_OPTIONS='--no-warnings --experimental-vm-modules' jest tests/unit/retry-handler.test.js

# Run with debugging
npm run test:debug

# Run with verbose output
npm run test:verbose

# Clean and run
npm run test:clean
```

### Jest Configuration
- ESM modules enabled
- Single worker for stability
- 45s timeout for complex operations
- Coverage thresholds: 75%

## Performance Optimization

### Caching Strategy
- Question similarity detection
- 24-hour auto-invalidation
- Configurable cache size
- 90% cost reduction on repeated questions

### Performance Tracking
- SQLite database in `/data/`
- 70+ universal categories (not just programming)
- Tracks: success rate, avg confidence, model performance
- Used by learning system for optimization

### Learning System
- Pattern detection across debates
- Model profiling (strengths/weaknesses)
- Automatic optimization recommendations
- Can be reset with `npm run learning:reset`

## Security Features

**HMAC-SHA256 Request Signing:**
- Cryptographic authentication
- Replay attack prevention (nonce + timestamp)
- Timing-safe comparison

**Rate Limiting:**
- Per-IP and per-API-key limits
- Configurable windows
- Automatic cleanup

**Input Validation:**
- XSS prevention
- Injection protection
- Path traversal prevention

**Security Headers:**
- HSTS, CSP, X-Frame-Options
- Comprehensive security suite

**Audit Logging:**
- All security events logged
- Forensic capabilities

## Documentation

- **README.md** - Quick start and features
- **API.md** - Complete API documentation
- **SECURITY.md** - Security implementation guide
- **TELEMETRY.md** - Privacy policy
- **DEPLOYMENT.md** - Production deployment
- **docs/RETRY_HANDLER.md** - Retry handler details
- **CLAUDE.md** - This file

## Version 2.1 Features

**Enterprise Production Ready:**
- 96% test reliability improvement (279/283 passing)
- Complete security suite with HMAC signing
- Intelligent retry with exponential backoff
- Advanced monitoring and telemetry
- ML-based learning system
- Cross-verification for critical scenarios

## Key Files Reference

| File | Purpose | Line Reference |
|------|---------|---------------|
| `index.js:70` | Debate tool registration |
| `k-proxy-server.js:42` | Model mapping |
| `src/claude-cli-debate.js:56` | Model definitions |
| `src/gemini-coordinator.js` | Intelligent selection |
| `src/security.js` | Security implementation |
| `src/utils/retry-handler.js` | Retry logic |
| `jest.config.js:30` | Test configuration |

## Debugging Tips

1. **Enable verbose logging**: `npm run dev`
2. **Check proxy health**: `curl http://localhost:3457/health` (repeat for 3458-3464)
3. **Review debate logs**: `cat logs/debate-*.json | jq`
4. **Test security**: `npm run test:security`
5. **Validate config**: `npm run validate`
6. **Monitor learning**: `npm run learning:status`

## Common Patterns

**Adding a new model:**
1. Update `modelMap` in `k-proxy-server.js`
2. Add to `portMap` with new port
3. Create `kX-wrapper.sh` in root
4. Update model list in `src/claude-cli-debate.js`
5. Update documentation

**Adding a new feature:**
1. Create in appropriate `/src/` directory
2. Add unit tests in `/tests/unit/`
3. Add integration test if needed
4. Update CLAUDE.md with reference
5. Run full test suite before commit

**Troubleshooting a failed debate:**
1. Check `logs/debate-*.json` for details
2. Verify proxy servers: `node health-check.js`
3. Test individual models: `curl http://localhost:345X/health`
4. Review retry statistics in debate output
5. Check learning system: `npm run learning:status`
