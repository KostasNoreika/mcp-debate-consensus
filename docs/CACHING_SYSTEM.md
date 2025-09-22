# Caching System for Cost Optimization

## Overview

The Caching System implements intelligent caching of debate results to achieve up to 90% cost reduction on repeated questions. It provides instant responses for cached results while maintaining smart invalidation to prevent stale answers.

## Features

### Core Functionality
- **Intelligent Cache Keys**: Generated from question + context for precise matching
- **24-Hour Default TTL**: Configurable time-based expiration
- **Smart Invalidation**: Context-aware cache invalidation based on project changes
- **Memory Optimization**: LRU eviction with configurable entry limits
- **Persistence Support**: Optional disk persistence for cache durability

### Cost Optimization
- **Token Tracking**: Monitors tokens saved through cache hits
- **Cost Estimation**: Calculates approximate cost savings
- **Performance Metrics**: Tracks response time improvements
- **Hit Rate Statistics**: Comprehensive cache performance analytics

### Project Integration
- **MCP Integration**: Seamlessly integrated with existing debate system
- **Environment Configuration**: Extensive environment variable support
- **API Compatibility**: Maintains existing debate API with caching enhancements

## Architecture

### Components

#### DebateCache (`src/cache/debate-cache.js`)
- Main caching logic and storage
- Cache key generation and validation
- Statistics tracking and reporting
- Persistence management

#### CacheInvalidator (`src/cache/invalidator.js`)
- Smart invalidation rules and logic
- Project state tracking
- Time-based and context-based invalidation
- Periodic cleanup management

#### Integration (`src/claude-cli-debate.js`)
- Seamless integration with debate orchestrator
- Cache-aware debate execution
- Result storage and retrieval

### Cache Key Generation

```javascript
// Cache key includes:
{
  question: "normalized question text",
  category: "question category",
  complexity: "complexity level",
  projectPath: "project context",
  models: "selected model configuration",
  useIntelligentSelection: "selection method",
  fileHash: "project file context hash"
}
```

### Invalidation Rules

1. **Time-based**: Entries older than TTL (default 24 hours)
2. **Context-based**: Project files modified since cache entry
3. **Confidence-based**: Low confidence results (< 70%)
4. **User-requested**: Explicit cache bypass or fresh request
5. **Dependency-based**: Package.json or configuration changes

## Configuration

### Environment Variables

```bash
# Cache Configuration
DISABLE_CACHE=false                    # Enable/disable caching
CACHE_MAX_AGE=86400000                # TTL in milliseconds (24 hours)
CACHE_MAX_ENTRIES=1000                # Maximum cache entries
CACHE_PERSISTENCE=true                # Enable disk persistence
CACHE_MIN_CONFIDENCE=0.7              # Minimum confidence threshold

# Invalidation Configuration
CACHE_CHECK_INTERVAL=300000           # Cleanup interval (5 minutes)
CACHE_PROJECT_TRACKING=true           # Enable project state tracking
```

### Programmatic Configuration

```javascript
// Get cache statistics
const stats = debate.getCacheStats();

// Configure cache settings
debate.configureCache({
  maxAge: 30 * 60 * 1000,  // 30 minutes
  maxEntries: 500,          // 500 entries max
  minConfidence: 0.8        // Higher confidence threshold
});

// Clear cache
debate.clearCache();

// Invalidate by project
await debate.invalidateCacheByProject('/path/to/project');

// Warm cache with common questions
await debate.warmCache([
  'How to optimize Node.js performance?',
  'Best practices for error handling?'
], { projectPath: '/path/to/project' });
```

## Usage Examples

### Basic Usage (Automatic)

```javascript
import { ClaudeCliDebate } from './src/claude-cli-debate.js';

const debate = new ClaudeCliDebate();

// First call - Cache MISS, runs full debate
const result1 = await debate.runDebate(
  'How to implement authentication?',
  '/path/to/project'
);
// Response time: ~35 seconds
// Result cached automatically

// Second call - Cache HIT, instant response
const result2 = await debate.runDebate(
  'How to implement authentication?',
  '/path/to/project'
);
// Response time: ~100ms
// Tokens saved: ~50,000
// Cost saved: ~$1.00
```

### Cache Management

```javascript
// Get detailed statistics
const stats = debate.getCacheStats();
console.log(`Hit rate: ${stats.hitRate * 100}%`);
console.log(`Tokens saved: ${stats.tokensSaved}`);
console.log(`Cost saved: $${stats.costSaved.toFixed(2)}`);

// Force fresh result (bypass cache)
const freshResult = await debate.runDebate(
  'How to implement authentication?',
  '/path/to/project',
  null,
  { bypassCache: true }
);

// Invalidate stale entries
await debate.invalidateCacheByProject('/path/to/project');
```

### Cache Warming

```javascript
// Pre-populate cache with common questions
const questions = [
  'How to optimize database queries?',
  'Best practices for API design?',
  'How to implement caching?',
  'Security considerations for web apps?'
];

const warmingResult = await debate.warmCache(questions, {
  projectPath: '/path/to/project',
  modelConfig: 'k1,k2,k3' // Use specific models
});

console.log(`Warmed ${warmingResult.successful}/${warmingResult.total} questions`);
```

## Performance Impact

### Expected Results

| Metric | Cached Response | Fresh Debate | Improvement |
|--------|----------------|--------------|-------------|
| Response Time | ~100ms | ~35s | 350x faster |
| Token Usage | 0 | ~50,000 | 100% saving |
| Cost | $0 | ~$1.00 | 100% saving |
| Hit Rate | - | - | 90%+ target |

### Cache Statistics Example

```json
{
  "enabled": true,
  "entries": 234,
  "maxEntries": 1000,
  "hits": 156,
  "misses": 78,
  "hitRate": 0.67,
  "tokensSaved": 1250000,
  "costSaved": 45.30,
  "avgResponseTime": {
    "cached": "95ms",
    "fresh": "34500ms"
  },
  "memoryUsage": {
    "bytes": 2048576,
    "mb": 1.95
  },
  "invalidationStats": {
    "total": 23,
    "reasons": {
      "timeExpired": 12,
      "contextChanged": 8,
      "lowConfidence": 2,
      "userRequested": 1
    }
  }
}
```

## File Structure

```
src/cache/
├── debate-cache.js          # Main caching logic
└── invalidator.js           # Invalidation rules

cache/                       # Cache persistence directory
└── debate-cache.json        # Persistent cache storage

docs/
└── CACHING_SYSTEM.md       # This documentation

test-cache-system.js        # Test script
```

## Testing

### Run Cache Tests

```bash
# Test the caching system
node test-cache-system.js

# Test with actual debates (requires k-proxy running)
npm run test:cache
```

### Test Scenarios

1. **Cache Miss/Hit**: First call vs subsequent identical calls
2. **Invalidation**: File changes triggering cache invalidation
3. **Configuration**: Dynamic cache setting updates
4. **Statistics**: Comprehensive metrics tracking
5. **Warming**: Pre-population with common questions

## Monitoring

### Cache Health Metrics

- **Hit Rate**: Target 90%+ for repeated questions
- **Memory Usage**: Monitor for memory leaks
- **Invalidation Rate**: Balance between freshness and performance
- **Response Time**: Cached responses should be <200ms

### Alerts and Monitoring

```javascript
// Monitor cache performance
setInterval(() => {
  const stats = debate.getCacheStats();

  if (stats.hitRate < 0.5) {
    console.warn('⚠️ Low cache hit rate:', stats.hitRate);
  }

  if (stats.memoryUsage.mb > 100) {
    console.warn('⚠️ High memory usage:', stats.memoryUsage.mb, 'MB');
  }
}, 60000); // Check every minute
```

## Best Practices

### Cache Optimization

1. **Question Normalization**: Use consistent question formatting
2. **Context Awareness**: Include relevant project context in cache keys
3. **Confidence Thresholds**: Set appropriate minimum confidence levels
4. **TTL Configuration**: Balance freshness with performance needs
5. **Memory Management**: Monitor and configure entry limits

### Invalidation Strategy

1. **File Watching**: Monitor critical project files for changes
2. **Dependency Tracking**: Invalidate on package.json changes
3. **Manual Invalidation**: Provide explicit invalidation controls
4. **Periodic Cleanup**: Automated cleanup of expired entries

### Production Deployment

1. **Persistence**: Enable disk persistence for production
2. **Monitoring**: Implement comprehensive cache monitoring
3. **Backup**: Regular cache backup and restore procedures
4. **Scaling**: Consider Redis for distributed caching

## Troubleshooting

### Common Issues

1. **Cache Not Working**: Check DISABLE_CACHE environment variable
2. **High Memory Usage**: Reduce CACHE_MAX_ENTRIES or enable eviction
3. **Stale Results**: Lower TTL or improve invalidation rules
4. **Low Hit Rate**: Improve question normalization and context matching

### Debug Mode

```bash
# Enable verbose cache logging
DEBUG_CACHE=true node index.js
```

### Performance Tuning

```javascript
// Optimize for development (faster invalidation)
debate.configureCache({
  maxAge: 5 * 60 * 1000,    // 5 minutes
  minConfidence: 0.5         // Lower threshold
});

// Optimize for production (longer caching)
debate.configureCache({
  maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  minConfidence: 0.8             // Higher threshold
});
```

## Future Enhancements

### Planned Features

1. **Redis Integration**: Distributed caching support
2. **Compression**: Result compression for memory efficiency
3. **Partial Caching**: Cache individual model responses
4. **Smart Warming**: ML-based cache warming predictions
5. **Analytics Dashboard**: Web UI for cache monitoring

### API Extensions

1. **Bulk Operations**: Bulk cache invalidation and warming
2. **Export/Import**: Cache data migration tools
3. **Webhooks**: Cache event notifications
4. **GraphQL API**: Advanced cache querying capabilities