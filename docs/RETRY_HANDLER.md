# Retry Handler Documentation

The retry handler provides robust, production-ready retry logic with exponential backoff for the debate-consensus MCP server. It intelligently handles various failure scenarios while preventing cascading failures and ensuring reliable operation.

## Features

### 🔄 **Exponential Backoff with Jitter**
- Configurable initial delay, maximum delay, and backoff multiplier
- Intelligent jitter to prevent thundering herd problems
- Special handling for rate limits with longer delays

### 🏷️ **Smart Error Classification**
- Automatic classification of errors as retriable vs non-retriable
- Support for various error types: network, timeout, authentication, configuration
- Claude CLI specific error handling

### 📊 **Comprehensive Statistics**
- Success rates, retry counts, timing metrics
- Error breakdown by type
- Performance monitoring integration

### ⚙️ **Flexible Configuration**
- Environment variable support
- Runtime configuration updates
- Per-operation customization

## Configuration

### Environment Variables

```bash
# Maximum number of retry attempts (default: 3)
MAX_RETRIES=3

# Initial delay between retries in milliseconds (default: 1000)
INITIAL_RETRY_DELAY=1000

# Maximum delay between retries in milliseconds (default: 30000)
MAX_RETRY_DELAY=30000

# Exponential backoff multiplier (default: 2.0)
BACKOFF_MULTIPLIER=2

# Disable retry logging for tests
RETRY_LOGGING=false
```

### Programmatic Configuration

```javascript
import { RetryHandler } from './src/utils/retry-handler.js';

const retryHandler = new RetryHandler({
  maxRetries: 5,
  initialDelay: 2000,
  maxDelay: 60000,
  backoffMultiplier: 2.5,
  jitterRange: 0.15,
  timeoutMs: 300000,
  enableLogging: true
});
```

## Usage

### Basic Usage

```javascript
import { RetryHandler } from './src/utils/retry-handler.js';

const retryHandler = new RetryHandler();

try {
  const result = await retryHandler.execute(
    async () => {
      // Your function that might fail
      return await someOperationThatMightFail();
    },
    {
      name: 'operation-name',
      context: { additionalData: 'value' }
    }
  );

  console.log('Operation succeeded:', result);
} catch (error) {
  console.error('Operation failed after all retries:', error.message);
}
```

### Integration with Claude CLI Debate

The retry handler is automatically integrated into the `callModel` method:

```javascript
// In ClaudeCliDebate class
async callModel(model, prompt, projectPath, instanceConfig, options) {
  try {
    const result = await this.retryHandler.execute(
      async () => {
        // Model spawning logic with full error handling
        return await this.spawnClaude(model, fullPrompt, projectPath, instanceConfig);
      },
      {
        name: `callModel(${model.name})`,
        context: { model, prompt, projectPath, instanceConfig, options }
      }
    );

    return result;
  } catch (error) {
    // Enhanced error reporting with retry details
    return null;
  }
}
```

## Error Classification

### Retriable Errors

**Network Errors**
- Connection timeouts (`ETIMEDOUT`)
- Connection resets (`ECONNRESET`, `ECONNREFUSED`)
- HTTP 5xx server errors
- Network connectivity issues

**Temporary Failures**
- Claude CLI exit codes 1, 124, 125, 126, 127
- Spawn failures
- Empty responses
- Parsing errors

**Rate Limits**
- HTTP 429 status codes
- "Rate limit exceeded" messages
- API quota errors

### Non-Retriable Errors

**Authentication Issues**
- HTTP 401/403 status codes
- Invalid API key errors
- Authorization failures

**Configuration Problems**
- File not found (`ENOENT`)
- Wrapper script issues
- Permission errors
- Invalid configurations

## Delay Calculation

The retry handler uses exponential backoff with jitter:

```
Base Delay = Initial Delay × (Backoff Multiplier ^ (Attempt - 1))
Capped Delay = min(Base Delay, Max Delay)
Final Delay = Capped Delay + Jitter

Where Jitter = ±(Jitter Range × Capped Delay × Random Factor)
```

### Special Cases

- **Rate Limits**: Minimum 5-second delay, doubled base delay
- **Jitter**: 10% randomization to prevent synchronized retries
- **Maximum Cap**: Ensures delays don't grow indefinitely

## Statistics and Monitoring

### Accessing Statistics

```javascript
// Get current retry statistics
const stats = retryHandler.getStats();
console.log('Retry Statistics:', {
  totalAttempts: stats.totalAttempts,
  successRate: stats.successRate,
  avgRetryCount: stats.avgRetryCount,
  avgRetryTime: stats.avgRetryTime,
  errorBreakdown: stats.errorBreakdown
});

// Reset statistics
retryHandler.resetStats();

// Update configuration
retryHandler.updateConfig({
  maxRetries: 10,
  initialDelay: 500
});
```

### Integration with Debate Results

Retry statistics are included in debate results:

```javascript
// Access retry stats from ClaudeCliDebate instance
const retryStats = debate.getRetryStats();
console.log('Configuration:', retryStats.config);
console.log('Performance:', retryStats.handler);
```

## Error Handling Best Practices

### 1. Proper Error Propagation

```javascript
try {
  const result = await retryHandler.execute(operation);
  return result;
} catch (error) {
  if (error.name === 'RetryError') {
    const details = error.getDetails();
    console.error('Retry failed:', {
      attempts: details.attemptCount,
      errorType: details.errorType,
      retriable: details.retriable,
      reason: details.reason
    });
  }

  throw error; // Re-throw for upstream handling
}
```

### 2. Context-Aware Retry Logic

```javascript
// Different retry strategies based on operation type
const quickRetry = new RetryHandler({
  maxRetries: 2,
  initialDelay: 500,
  maxDelay: 5000
});

const robustRetry = new RetryHandler({
  maxRetries: 5,
  initialDelay: 2000,
  maxDelay: 60000
});

// Use appropriate handler based on operation criticality
const handler = isQuickOperation ? quickRetry : robustRetry;
```

### 3. Resource Management

```javascript
// Ensure proper cleanup in retry operations
await retryHandler.execute(async () => {
  const resource = await acquireResource();

  try {
    return await performOperation(resource);
  } finally {
    await releaseResource(resource);
  }
});
```

## Testing

### Unit Tests

Run the comprehensive unit test suite:

```bash
npm run test:retry
```

### Functional Testing

Run the interactive test script:

```bash
node test-retry-functionality.js
```

This script demonstrates:
- Various failure scenarios
- Error classification examples
- Retry behavior patterns
- Statistics collection
- Configuration management

### Test Scenarios Covered

1. **Immediate Success** - No retries needed
2. **Temporary Network Failure** - Network recovery after retries
3. **Rate Limit Recovery** - Handling API rate limits
4. **Authentication Failure** - Non-retriable authentication errors
5. **Configuration Error** - Non-retriable configuration issues
6. **Persistent Failure** - Exhausting all retry attempts
7. **Claude CLI Failures** - Process exit code handling

## Performance Considerations

### Memory Usage
- Minimal memory overhead per retry handler instance
- Statistics stored in lightweight objects
- No memory leaks in long-running processes

### CPU Impact
- Efficient error classification using string matching
- Optimized delay calculations
- Minimal overhead during successful operations

### Network Efficiency
- Intelligent backoff prevents network flooding
- Jitter reduces synchronized load spikes
- Rate limit awareness prevents unnecessary requests

## Production Deployment

### Recommended Settings

```bash
# Production environment variables
MAX_RETRIES=3
INITIAL_RETRY_DELAY=1000
MAX_RETRY_DELAY=30000
BACKOFF_MULTIPLIER=2
RETRY_LOGGING=true
```

### Monitoring Integration

The retry handler integrates with the existing performance tracking system:

```javascript
// Retry statistics are automatically included in performance metrics
const performanceData = await performanceTracker.getMetrics();
console.log('Retry performance:', performanceData.retryStats);
```

### Alerting Thresholds

Consider alerting when:
- Success rate drops below 90%
- Average retry count exceeds 2
- Error rates spike for specific error types
- Individual operations require maximum retries

## Troubleshooting

### Common Issues

**High Retry Rates**
- Check network connectivity
- Verify API key validity
- Monitor rate limit usage
- Review timeout settings

**Non-Retriable Errors**
- Validate configuration files
- Check file permissions
- Verify wrapper script paths
- Review authentication setup

**Performance Impact**
- Adjust retry limits for time-sensitive operations
- Consider operation-specific timeout values
- Monitor resource usage during retry storms

### Debug Information

Enable detailed logging for troubleshooting:

```bash
# Enable debug logging
RETRY_LOGGING=true
NODE_ENV=development

# Run with verbose output
npm run dev
```

## API Reference

### RetryHandler Class

#### Constructor
```javascript
new RetryHandler(config)
```

#### Methods
- `execute(fn, options)` - Execute function with retry logic
- `getStats()` - Get current statistics
- `resetStats()` - Reset statistics
- `updateConfig(newConfig)` - Update configuration

### ErrorClassifier

#### Static Methods
- `classify(error)` - Classify error for retry determination

### DelayCalculator

#### Static Methods
- `calculate(attempt, config, errorType)` - Calculate backoff delay

### Utility Functions
- `createRetryHandler(config)` - Factory function
- `withRetry(config)` - Decorator for method retry logic

---

For more information, see the source code in `src/utils/retry-handler.js` and the test suite in `tests/unit/retry-handler.test.js`.