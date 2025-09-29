/**
 * Unit tests for the RetryHandler utility
 * Tests exponential backoff, error classification, and retry logic
 */

import { jest } from '@jest/globals';
import {
  RetryHandler,
  ErrorClassifier,
  DelayCalculator,
  ErrorTypes,
  RetryError,
  createRetryHandler
} from '../../src/utils/retry-handler.js';

describe('RetryHandler', () => {
  let retryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      enableLogging: false
    });
  });

  afterEach(() => {
    retryHandler.resetStats();
  });

  describe('successful execution', () => {
    test('should execute function successfully on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retryHandler.execute(mockFn, { name: 'test' });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);

      const stats = retryHandler.getStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successRate).toBe(1);
    });

    test('should succeed after retries', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValueOnce('success');

      const result = await retryHandler.execute(mockFn, { name: 'test' });

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);

      const stats = retryHandler.getStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.avgRetryCount).toBe(2); // 2 retries before success
    });
  });

  describe('failure scenarios', () => {
    test('should fail after max retries exceeded', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(retryHandler.execute(mockFn, { name: 'test' }))
        .rejects.toThrow(RetryError);

      expect(mockFn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    test('should fail immediately for non-retriable errors', async () => {
      const authError = new Error('Unauthorized');
      authError.status = 401;
      const mockFn = jest.fn().mockRejectedValue(authError);

      await expect(retryHandler.execute(mockFn, { name: 'test' }))
        .rejects.toThrow(RetryError);

      expect(mockFn).toHaveBeenCalledTimes(1); // No retries for auth errors
    });

    test('should provide detailed error information', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await retryHandler.execute(mockFn, { name: 'test' });
      } catch (error) {
        expect(error).toBeInstanceOf(RetryError);
        const details = error.getDetails();
        expect(details.attemptCount).toBe(4);
        expect(details.errorType).toBe(ErrorTypes.RETRIABLE);
        expect(details.stats).toBeDefined();
      }
    });
  });

  describe('timeout handling', () => {
    test('should timeout long-running functions', async () => {
      const longRunningFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );

      const timeoutHandler = new RetryHandler({
        maxRetries: 1,
        timeoutMs: 100,
        enableLogging: false
      });

      await expect(timeoutHandler.execute(longRunningFn, { name: 'timeout-test' }))
        .rejects.toThrow('timed out');

      expect(longRunningFn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    });
  });

  describe('configuration management', () => {
    test('should update configuration correctly', () => {
      const newConfig = {
        maxRetries: 5,
        initialDelay: 200
      };

      retryHandler.updateConfig(newConfig);

      expect(retryHandler.config.maxRetries).toBe(5);
      expect(retryHandler.config.initialDelay).toBe(200);
      expect(retryHandler.config.backoffMultiplier).toBe(2); // Should retain original
    });

    test('should reset statistics', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      await retryHandler.execute(mockFn);
      expect(retryHandler.getStats().totalAttempts).toBe(1);

      retryHandler.resetStats();
      expect(retryHandler.getStats().totalAttempts).toBe(0);
    });
  });
});

describe('ErrorClassifier', () => {
  describe('authentication errors', () => {
    test('should classify 401 errors as non-retriable', () => {
      const error = new Error('Unauthorized');
      error.status = 401;

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.AUTHENTICATION);
      expect(classification.retriable).toBe(false);
    });

    test('should classify invalid API key errors', () => {
      const error = new Error('Invalid API key provided');

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.AUTHENTICATION);
      expect(classification.retriable).toBe(false);
    });
  });

  describe('configuration errors', () => {
    test('should classify ENOENT errors as non-retriable', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.CONFIGURATION);
      expect(classification.retriable).toBe(false);
    });

    test('should classify wrapper script errors', () => {
      const error = new Error('wrapper script not found');

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.CONFIGURATION);
      expect(classification.retriable).toBe(false);
    });
  });

  describe('rate limiting errors', () => {
    test('should classify 429 errors as retriable', () => {
      const error = new Error('Too many requests');
      error.status = 429;

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.RATE_LIMIT);
      expect(classification.retriable).toBe(true);
    });

    test('should classify rate limit messages', () => {
      const error = new Error('Rate limit exceeded');

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.RATE_LIMIT);
      expect(classification.retriable).toBe(true);
    });
  });

  describe('timeout errors', () => {
    test('should classify timeout errors as retriable', () => {
      const error = new Error('Request timed out');
      error.code = 'ETIMEDOUT';

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.TIMEOUT);
      expect(classification.retriable).toBe(true);
    });

    test('should classify 504 gateway timeout', () => {
      const error = new Error('Gateway timeout');
      error.status = 504;

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.TIMEOUT);
      expect(classification.retriable).toBe(true);
    });
  });

  describe('network errors', () => {
    test('should classify connection reset as retriable', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.NETWORK);
      expect(classification.retriable).toBe(true);
    });

    test('should classify 500 server errors as retriable', () => {
      const error = new Error('Internal server error');
      error.status = 500;

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.NETWORK);
      expect(classification.retriable).toBe(true);
    });
  });

  describe('Claude CLI specific errors', () => {
    test('should classify retriable exit codes', () => {
      const error = new Error('Claude CLI exited with code 1');

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.RETRIABLE);
      expect(classification.retriable).toBe(true);
    });

    test('should classify spawn failures as retriable', () => {
      const error = new Error('Failed to spawn Claude CLI');

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.RETRIABLE);
      expect(classification.retriable).toBe(true);
    });
  });

  describe('unknown errors', () => {
    test('should default to retriable for unknown errors', () => {
      const error = new Error('Some unknown error');

      const classification = ErrorClassifier.classify(error);

      expect(classification.type).toBe(ErrorTypes.RETRIABLE);
      expect(classification.retriable).toBe(true);
    });
  });
});

describe('DelayCalculator', () => {
  const config = {
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterRange: 0.1
  };

  test('should calculate exponential backoff delays', () => {
    const delay1 = DelayCalculator.calculate(1, config);
    const delay2 = DelayCalculator.calculate(2, config);
    const delay3 = DelayCalculator.calculate(3, config);

    // Base delays should follow exponential pattern
    expect(delay2).toBeGreaterThan(delay1 * 1.8); // Account for jitter
    expect(delay3).toBeGreaterThan(delay2 * 1.8);
  });

  test('should cap delays at maximum', () => {
    const delay = DelayCalculator.calculate(10, config);

    expect(delay).toBeLessThanOrEqual(config.maxDelay * 1.1); // Account for jitter
  });

  test('should apply longer delays for rate limits', () => {
    const normalDelay = DelayCalculator.calculate(1, config);
    const rateLimitDelay = DelayCalculator.calculate(1, config, ErrorTypes.RATE_LIMIT);

    expect(rateLimitDelay).toBeGreaterThan(normalDelay);
    expect(rateLimitDelay).toBeGreaterThanOrEqual(5000); // Minimum 5 seconds
  });

  test('should include jitter in calculations', () => {
    // Calculate multiple delays for the same attempt
    const delays = Array.from({ length: 10 }, () =>
      DelayCalculator.calculate(1, config)
    );

    // All delays should be different due to jitter
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });
});

describe('createRetryHandler utility', () => {
  test('should create handler with default config', () => {
    const handler = createRetryHandler();

    expect(handler).toBeInstanceOf(RetryHandler);
    expect(handler.config.maxRetries).toBeDefined();
  });

  test('should create handler with custom config', () => {
    const handler = createRetryHandler({
      maxRetries: 5,
      initialDelay: 500
    });

    expect(handler.config.maxRetries).toBe(5);
    expect(handler.config.initialDelay).toBe(500);
  });
});

describe('RetryError', () => {
  test('should contain all required error information', () => {
    const originalError = new Error('Original error');
    const classification = { type: ErrorTypes.NETWORK, retriable: true };
    const stats = { totalAttempts: 3, successRate: 0.5 };

    const retryError = new RetryError(
      'Retry failed',
      originalError,
      classification,
      3,
      stats
    );

    expect(retryError.name).toBe('RetryError');
    expect(retryError.originalError).toBe(originalError);
    expect(retryError.classification).toBe(classification);
    expect(retryError.attemptCount).toBe(3);
    expect(retryError.stats).toBe(stats);
  });

  test('should provide detailed error information', () => {
    const originalError = new Error('Original error');
    const classification = {
      type: ErrorTypes.TIMEOUT,
      retriable: true,
      reason: 'Request timeout'
    };
    const stats = { totalAttempts: 2 };

    const retryError = new RetryError(
      'Retry failed',
      originalError,
      classification,
      4,
      stats
    );

    const details = retryError.getDetails();

    expect(details.message).toBe('Retry failed');
    expect(details.originalError).toBe('Original error');
    expect(details.errorType).toBe(ErrorTypes.TIMEOUT);
    expect(details.retriable).toBe(true);
    expect(details.reason).toBe('Request timeout');
    expect(details.attemptCount).toBe(4);
    expect(details.stats).toBe(stats);
  });
});

describe('integration scenarios', () => {
  test('should handle model spawning failure simulation', async () => {
    const retryHandler = new RetryHandler({
      maxRetries: 1,
      initialDelay: 10,
      maxDelay: 50,
      enableLogging: false
    });

    // Test simple spawn failure and recovery
    const mockSpawn = jest.fn()
      .mockRejectedValueOnce(new Error('Failed to spawn Claude CLI'))
      .mockResolvedValueOnce('success');

    const result = await retryHandler.execute(mockSpawn, {
      name: 'model-spawn-test'
    });

    expect(result).toBe('success');
    expect(mockSpawn).toHaveBeenCalledTimes(2);
  });

  test('should handle rate limit with longer delays', async () => {
    const retryHandler = new RetryHandler({
      maxRetries: 1,
      initialDelay: 100,
      maxDelay: 1000,
      enableLogging: false
    });

    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.status = 429;

    const mockFn = jest.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('rate limit cleared');

    const startTime = Date.now();
    const result = await retryHandler.execute(mockFn, {
      name: 'rate-limit-test'
    });
    const duration = Date.now() - startTime;

    expect(result).toBe('rate limit cleared');
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(duration).toBeGreaterThan(200); // Should have a longer delay for rate limits
  });

  test('should handle mixed success/failure patterns', async () => {
    const retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 10,
      enableLogging: false
    });

    // Test multiple executions with different patterns
    const executions = [
      // Immediate success
      () => Promise.resolve('success1'),
      // Fail then succeed
      jest.fn()
        .mockRejectedValueOnce(new Error('temp failure'))
        .mockResolvedValueOnce('success2'),
      // Multiple failures then success
      jest.fn()
        .mockRejectedValueOnce(new Error('failure1'))
        .mockRejectedValueOnce(new Error('failure2'))
        .mockResolvedValueOnce('success3')
    ];

    for (let i = 0; i < executions.length; i++) {
      const result = await retryHandler.execute(executions[i], {
        name: `execution-${i}`
      });

      expect(result).toBe(`success${i + 1}`);
    }

    const stats = retryHandler.getStats();
    expect(stats.totalAttempts).toBe(3);
    expect(stats.successRate).toBe(1);
    expect(stats.avgRetryCount).toBeGreaterThan(0);
  });
});