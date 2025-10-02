/**
 * Robust Retry Handler with Exponential Backoff
 *
 * Provides intelligent retry logic with exponential backoff for the debate-consensus MCP server.
 * Handles transient failures, network timeouts, API rate limits with proper error classification.
 */

import { setTimeout as delay } from 'timers/promises';
import logger from './logger.js';

/**
 * Error types for classification
 */
export const ErrorTypes = {
  RETRIABLE: 'retriable',
  NON_RETRIABLE: 'non_retriable',
  RATE_LIMIT: 'rate_limit',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  AUTHENTICATION: 'authentication',
  CONFIGURATION: 'configuration'
};

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG = {
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  initialDelay: parseInt(process.env.INITIAL_RETRY_DELAY) || 1000, // 1 second
  maxDelay: parseInt(process.env.MAX_RETRY_DELAY) || 30000, // 30 seconds
  backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER) || 2,
  jitterRange: 0.1, // 10% jitter to prevent thundering herd
  timeoutMs: parseInt(process.env.DEBATE_TIMEOUT_MINUTES) * 60 * 1000 || 3600000, // 60 minutes default
  enableLogging: true
};

/**
 * Retry statistics tracking
 */
class RetryStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalAttempts = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.errorBreakdown = {};
    this.avgRetryCount = 0;
    this.maxRetryCount = 0;
    this.totalRetryTime = 0;
  }

  recordAttempt(attemptCount, success, errorType = null, retryTime = 0) {
    this.totalAttempts++;

    if (success) {
      this.totalSuccesses++;
      this.avgRetryCount = ((this.avgRetryCount * (this.totalSuccesses - 1)) + (attemptCount - 1)) / this.totalSuccesses;
      this.maxRetryCount = Math.max(this.maxRetryCount, attemptCount - 1);
      this.totalRetryTime += retryTime;
    } else {
      this.totalFailures++;
      if (errorType) {
        this.errorBreakdown[errorType] = (this.errorBreakdown[errorType] || 0) + 1;
      }
    }
  }

  getStats() {
    return {
      totalAttempts: this.totalAttempts,
      successRate: this.totalAttempts > 0 ? (this.totalSuccesses / this.totalAttempts) : 0,
      avgRetryCount: this.avgRetryCount,
      maxRetryCount: this.maxRetryCount,
      avgRetryTime: this.totalSuccesses > 0 ? (this.totalRetryTime / this.totalSuccesses) : 0,
      errorBreakdown: { ...this.errorBreakdown }
    };
  }
}

/**
 * Enhanced error classifier for determining retry strategy
 */
export class ErrorClassifier {
  /**
   * Classify error to determine if it's retriable and what type
   * @param {Error} error - The error to classify
   * @returns {Object} Classification result with type and retriable flag
   */
  static classify(error) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toUpperCase() || '';
    const status = error.status || error.statusCode || 0;

    // Authentication errors - not retriable
    if (message.includes('unauthorized') ||
        message.includes('invalid api key') ||
        message.includes('authentication') ||
        status === 401 || status === 403) {
      return {
        type: ErrorTypes.AUTHENTICATION,
        retriable: false,
        reason: 'Authentication failure - check API keys'
      };
    }

    // Configuration errors - not retriable
    if (message.includes('wrapper script not found') ||
        message.includes('not executable') ||
        message.includes('enoent') ||
        code === 'ENOENT') {
      return {
        type: ErrorTypes.CONFIGURATION,
        retriable: false,
        reason: 'Configuration error - check file paths and permissions'
      };
    }

    // Rate limiting - retriable with longer delay
    if (message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('quota exceeded') ||
        status === 429) {
      return {
        type: ErrorTypes.RATE_LIMIT,
        retriable: true,
        reason: 'Rate limit exceeded - will retry with backoff'
      };
    }

    // Timeout errors - retriable
    if (message.includes('timeout') ||
        message.includes('timed out') ||
        code === 'ETIMEDOUT' ||
        status === 408 || status === 504) {
      return {
        type: ErrorTypes.TIMEOUT,
        retriable: true,
        reason: 'Request timeout - will retry'
      };
    }

    // Network errors - retriable
    if (message.includes('network') ||
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('econnrefused') ||
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ENETWORK' ||
        status >= 500) {
      return {
        type: ErrorTypes.NETWORK,
        retriable: true,
        reason: 'Network error - will retry'
      };
    }

    // Claude CLI specific errors
    if (message.includes('claude cli exited with code')) {
      const exitCodeMatch = message.match(/exited with code (\d+)/);
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : null;

      // Exit codes that suggest retriable errors
      if (exitCode && [1, 124, 125, 126, 127].includes(exitCode)) {
        return {
          type: ErrorTypes.RETRIABLE,
          retriable: true,
          reason: `Claude CLI exit code ${exitCode} - temporary failure`
        };
      }

      return {
        type: ErrorTypes.NON_RETRIABLE,
        retriable: false,
        reason: `Claude CLI non-retriable error (exit code: ${exitCode})`
      };
    }

    // Claude CLI spawn failures are usually retriable
    if (message.includes('failed to spawn claude cli')) {
      return {
        type: ErrorTypes.RETRIABLE,
        retriable: true,
        reason: 'Claude CLI spawn failure - will retry'
      };
    }

    // Empty response or parsing errors - retriable
    if (message.includes('empty response') ||
        message.includes('unexpected end') ||
        message.includes('json parse')) {
      return {
        type: ErrorTypes.RETRIABLE,
        retriable: true,
        reason: 'Response parsing error - will retry'
      };
    }

    // Default: assume retriable for unknown errors
    return {
      type: ErrorTypes.RETRIABLE,
      retriable: true,
      reason: 'Unknown error type - attempting retry'
    };
  }
}

/**
 * Delay calculator with exponential backoff and jitter
 */
export class DelayCalculator {
  /**
   * Calculate delay with exponential backoff and jitter
   * @param {number} attempt - Current attempt number (1-based)
   * @param {Object} config - Retry configuration
   * @param {string} errorType - Type of error for custom delays
   * @returns {number} Delay in milliseconds
   */
  static calculate(attempt, config = DEFAULT_CONFIG, errorType = null) {
    let baseDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);

    // Cap at max delay
    baseDelay = Math.min(baseDelay, config.maxDelay);

    // Special handling for rate limits - longer delays
    if (errorType === ErrorTypes.RATE_LIMIT) {
      baseDelay = Math.max(baseDelay, 5000); // Minimum 5 seconds for rate limits
      baseDelay *= 2; // Double the delay for rate limits
    }

    // Add jitter to prevent thundering herd
    const jitter = config.jitterRange * baseDelay * (Math.random() - 0.5);
    const finalDelay = Math.max(0, baseDelay + jitter);

    return Math.round(finalDelay);
  }
}

/**
 * Main retry handler class
 */
export class RetryHandler {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = new RetryStats();

    if (this.config.enableLogging) {
      logger.debug('RetryHandler initialized', {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.initialDelay,
        maxDelay: this.config.maxDelay,
        backoffMultiplier: this.config.backoffMultiplier,
        timeoutMs: this.config.timeoutMs
      });
    }
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Execution options
   * @returns {Promise} Result of the function execution
   */
  async execute(fn, options = {}) {
    const startTime = Date.now();
    const functionName = options.name || fn.name || 'anonymous';
    const context = options.context || {};

    let lastError = null;
    let totalRetryTime = 0;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        if (this.config.enableLogging && attempt > 1) {
          logger.debug('Retry attempt', {
            function: functionName,
            attempt,
            maxAttempts: this.config.maxRetries + 1
          });
        }

        // Execute the function with timeout
        const result = await this.executeWithTimeout(fn, context);

        // Record successful execution
        this.stats.recordAttempt(attempt, true, null, totalRetryTime);

        if (this.config.enableLogging && attempt > 1) {
          logger.info('Function succeeded after retry', {
            function: functionName,
            attempt,
            totalRetryTime
          });
        }

        return result;

      } catch (error) {
        lastError = error;

        // Classify the error
        const classification = ErrorClassifier.classify(error);

        if (this.config.enableLogging) {
          logger.warn('Function attempt failed', {
            function: functionName,
            attempt,
            error: error.message,
            classification: classification.type,
            retriable: classification.retriable,
            reason: classification.reason
          });
        }

        // If it's not retriable or we've exhausted retries, fail immediately
        if (!classification.retriable || attempt > this.config.maxRetries) {
          this.stats.recordAttempt(attempt, false, classification.type);

          if (!classification.retriable) {
            throw new RetryError(
              `Non-retriable error in ${functionName}: ${error.message}`,
              error,
              classification,
              attempt,
              this.stats.getStats()
            );
          } else {
            throw new RetryError(
              `Max retries (${this.config.maxRetries}) exceeded for ${functionName}: ${error.message}`,
              error,
              classification,
              attempt,
              this.stats.getStats()
            );
          }
        }

        // Calculate delay for next attempt
        const delayMs = DelayCalculator.calculate(attempt, this.config, classification.type);
        totalRetryTime += delayMs;

        if (this.config.enableLogging) {
          logger.debug('Waiting before retry', {
            delayMs,
            nextAttempt: attempt + 1
          });
        }

        // Wait before next attempt
        await delay(delayMs);
      }
    }

    // This shouldn't be reached, but just in case
    throw new RetryError(
      `Unexpected end of retry loop for ${functionName}`,
      lastError,
      { type: ErrorTypes.RETRIABLE, retriable: false },
      this.config.maxRetries + 1,
      this.stats.getStats()
    );
  }

  /**
   * Execute function with timeout wrapper
   * @param {Function} fn - Function to execute
   * @param {Object} context - Execution context
   * @returns {Promise} Function result
   */
  async executeWithTimeout(fn, context) {
    const timeoutPromise = new Promise((_, reject) => {
      global.setTimeout(() => {
        reject(new Error(`Function execution timed out after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);
    });

    return Promise.race([
      fn(context),
      timeoutPromise
    ]);
  }

  /**
   * Get retry statistics
   * @returns {Object} Current statistics
   */
  getStats() {
    return this.stats.getStats();
  }

  /**
   * Reset retry statistics
   */
  resetStats() {
    this.stats.reset();
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    if (this.config.enableLogging) {
      logger.info('RetryHandler configuration updated', newConfig);
    }
  }
}

/**
 * Custom error class for retry failures
 */
export class RetryError extends Error {
  constructor(message, originalError, classification, attemptCount, stats) {
    super(message);
    this.name = 'RetryError';
    this.originalError = originalError;
    this.classification = classification;
    this.attemptCount = attemptCount;
    this.stats = stats;

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RetryError);
    }
  }

  /**
   * Get detailed error information
   */
  getDetails() {
    return {
      message: this.message,
      originalError: this.originalError?.message,
      errorType: this.classification?.type,
      retriable: this.classification?.retriable,
      reason: this.classification?.reason,
      attemptCount: this.attemptCount,
      stats: this.stats
    };
  }
}

/**
 * Utility function to create a retry handler with common settings
 * @param {Object} config - Configuration options
 * @returns {RetryHandler} Configured retry handler
 */
export function createRetryHandler(config = {}) {
  return new RetryHandler(config);
}

/**
 * Decorator function for adding retry logic to methods
 * @param {Object} retryConfig - Retry configuration
 * @returns {Function} Decorator function
 */
export function withRetry(retryConfig = {}) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const retryHandler = new RetryHandler(retryConfig);

    descriptor.value = async function(...args) {
      return retryHandler.execute(
        async () => originalMethod.apply(this, args),
        {
          name: `${target.constructor.name}.${propertyKey}`,
          context: { args, instance: this }
        }
      );
    };

    return descriptor;
  };
}

export default RetryHandler;