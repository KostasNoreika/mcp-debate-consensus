# Task 007: Caching System for Cost Optimization

## Current State (NOW)
- Every identical question runs full debate
- No reuse of previous results
- Wastes tokens on repeated questions
- No memory of past answers

## Future State (AFTER)
- Cache debate results for identical questions
- Smart cache invalidation
- Huge cost savings on repeated questions
- Optional cache bypass for fresh answers

## Implementation

### Cache Storage
```javascript
class DebateCache {
  constructor() {
    this.cache = new Map();
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
  }

  async getCached(question, options) {
    const key = this.generateKey(question, options);
    const cached = this.cache.get(key);

    if (cached && !this.isExpired(cached)) {
      return {
        ...cached.result,
        fromCache: true,
        cachedAt: cached.timestamp
      };
    }

    return null;
  }

  generateKey(question, options) {
    // Create unique key from question + options
    return crypto.hash({
      question,
      category: options.category,
      complexity: options.complexity
    });
  }
}
```

### Smart Invalidation
```javascript
class CacheInvalidator {
  shouldInvalidate(cached, context) {
    // Time-based
    if (Date.now() - cached.timestamp > this.maxAge) {
      return true;
    }

    // Context changed (new files, updates)
    if (context.lastModified > cached.timestamp) {
      return true;
    }

    // Low confidence original answer
    if (cached.confidence < 0.7) {
      return true;
    }

    // User requested fresh
    if (context.fresh) {
      return true;
    }

    return false;
  }
}
```

### Cache-Aware Debate
```javascript
async runDebate(question, options) {
  // Check cache first
  const cached = await this.cache.getCached(question, options);

  if (cached && !options.bypassCache) {
    console.log('Using cached result from', cached.cachedAt);
    return cached;
  }

  // Run fresh debate
  const result = await this.runFreshDebate(question, options);

  // Cache the result
  await this.cache.store(question, result, options);

  return result;
}
```

## Cache Statistics
```javascript
{
  "cacheStats": {
    "hits": 234,
    "misses": 567,
    "hitRate": 0.29,
    "tokensSaved": 1250000,
    "costSaved": "$45.30",
    "avgResponseTime": {
      "cached": "0.1s",
      "fresh": "35s"
    }
  }
}
```

## Benefits
- **90% cost reduction** on repeated questions
- **Instant responses** for cached results
- **Reduces API load** significantly
- **Improves user experience** with speed