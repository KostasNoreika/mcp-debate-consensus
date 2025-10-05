# Examples

This directory contains demonstration and testing scripts for the AI Expert Consensus MCP server.

## Quick Start Demo

**test-debate.js** - Main demonstration script
```bash
node examples/test-debate.js "Your question here"
```

Example questions:
- `node examples/test-debate.js "What's the best architecture for a real-time chat app?"`
- `node examples/test-debate.js "How to optimize React performance?"`

## Feature Testing Scripts

These scripts test and demonstrate specific features:

### Security & Performance
- **test-security.js** - Security features (HMAC signing, rate limiting, validation)
- **test-cache-direct.js** - Smart caching system with 90% cost reduction
- **test-performance-tracking.js** - Performance metrics and SQLite tracking

### AI Features
- **test-confidence-scorer.js** - Confidence scoring (0-100% with breakdowns)
- **test-mcp-confidence.js** - MCP integration with confidence analysis
- **test-learning-system.js** - ML learning system and pattern recognition
- **test-retry-functionality.js** - Exponential backoff retry handler

### Utilities
- **client-signing-example.js** - HMAC request signing example for API clients

## Running Examples

All scripts can be run directly from the project root:

```bash
# Main demo
npm run test:debate

# Feature tests (via npm scripts)
npm run test:security
npm run test:cache
npm run test:performance
npm run test:confidence
npm run test:client

# Or directly
node examples/test-debate.js "question"
node examples/test-security.js
```

## For Development

For comprehensive testing, use the Jest test suite in `/tests/`:

```bash
npm test                  # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:coverage     # With coverage report
```
