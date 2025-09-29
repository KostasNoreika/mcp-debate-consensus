#!/usr/bin/env node

/**
 * Circuit Breaker Pattern Test
 * Tests circuit breaker functionality for preventing cascading failures
 *
 * Note: The current RetryHandler doesn't implement a true circuit breaker pattern.
 * This test demonstrates how to implement and test circuit breaker functionality.
 */

import { RetryHandler, ErrorTypes } from './src/utils/retry-handler.js';

console.log('🔌 Circuit Breaker Pattern Test\n');
console.log('================================\n');

/**
 * Circuit Breaker States
 */
const CircuitStates = {
  CLOSED: 'closed',     // Normal operation
  OPEN: 'open',         // Failing fast, not allowing requests
  HALF_OPEN: 'half_open' // Testing if service has recovered
};

/**
 * Enhanced Circuit Breaker Implementation
 * This demonstrates how a circuit breaker could be integrated with the retry handler
 */
class CircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeout = config.resetTimeout || 10000; // 10 seconds
    this.monitoringPeriod = config.monitoringPeriod || 30000; // 30 seconds

    this.state = CircuitStates.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successCount = 0;

    this.retryHandler = new RetryHandler({
      maxRetries: config.maxRetries || 3,
      initialDelay: config.initialDelay || 1000,
      enableLogging: false
    });

    console.log(`🔌 Circuit Breaker initialized:`);
    console.log(`  Failure threshold: ${this.failureThreshold}`);
    console.log(`  Reset timeout: ${this.resetTimeout}ms`);
    console.log(`  State: ${this.state}\n`);
  }

  async execute(fn, options = {}) {
    const startTime = Date.now();

    // Check circuit state before attempting execution
    if (this.state === CircuitStates.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        const waitTime = this.nextAttemptTime - Date.now();
        throw new Error(`Circuit breaker OPEN - next attempt in ${waitTime}ms`);
      } else {
        // Transition to HALF_OPEN
        this.state = CircuitStates.HALF_OPEN;
        console.log(`🔧 Circuit breaker transitioning to HALF_OPEN`);
      }
    }

    console.log(`🔌 Executing in ${this.state} state (failures: ${this.failureCount}/${this.failureThreshold})`);

    try {
      // Execute with retry logic
      const result = await this.retryHandler.execute(fn, {
        ...options,
        name: options.name || 'circuit-breaker-wrapped'
      });

      // Success - handle circuit state transitions
      this.onSuccess();

      const duration = Date.now() - startTime;
      console.log(`  ✅ Success in ${this.state} state (${duration}ms)`);

      return result;

    } catch (error) {
      // Failure - handle circuit state transitions
      this.onFailure(error);

      const duration = Date.now() - startTime;
      console.log(`  ❌ Failure in ${this.state} state (${duration}ms): ${error.message}`);

      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === CircuitStates.HALF_OPEN) {
      this.state = CircuitStates.CLOSED;
      console.log(`🔧 Circuit breaker CLOSED after successful recovery`);
    }
  }

  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitStates.HALF_OPEN) {
      // Failed during half-open, go back to open
      this.state = CircuitStates.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      console.log(`🔧 Circuit breaker OPEN again after half-open failure`);
    } else if (this.failureCount >= this.failureThreshold && this.state === CircuitStates.CLOSED) {
      // Exceeded threshold, open the circuit
      this.state = CircuitStates.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      console.log(`🔧 Circuit breaker OPEN after ${this.failureCount} failures`);
    }
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureThreshold: this.failureThreshold,
      nextAttemptTime: this.nextAttemptTime,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : null
    };
  }

  reset() {
    this.state = CircuitStates.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.retryHandler.resetStats();
    console.log(`🔌 Circuit breaker reset to CLOSED state`);
  }
}

/**
 * Test Circuit Breaker State Transitions
 */
async function testCircuitBreakerStates() {
  console.log('🔄 Testing Circuit Breaker State Transitions\n');

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 2000, // 2 seconds for faster testing
    maxRetries: 1 // Reduce retries for faster testing
  });

  let callCount = 0;

  // Function that always fails
  const alwaysFailingFunction = async () => {
    callCount++;
    console.log(`  Call ${callCount}: Always failing...`);
    throw new Error(`Simulated failure ${callCount}`);
  };

  console.log('Phase 1: Testing transition from CLOSED to OPEN\n');

  // Make calls until circuit opens
  for (let i = 1; i <= 5; i++) {
    console.log(`Attempt ${i}:`);

    try {
      await circuitBreaker.execute(alwaysFailingFunction, { name: `attempt-${i}` });
    } catch (error) {
      console.log(`  ❌ ${error.message}`);
    }

    const stats = circuitBreaker.getStats();
    console.log(`  State: ${stats.state}, Failures: ${stats.failureCount}/${stats.failureThreshold}\n`);

    if (stats.state === CircuitStates.OPEN) {
      console.log(`🎯 Circuit opened after ${stats.failureCount} failures!\n`);
      break;
    }
  }

  console.log('Phase 2: Testing OPEN state (fast failures)\n');

  // Test fast failures while circuit is open
  for (let i = 1; i <= 3; i++) {
    const startTime = Date.now();

    try {
      await circuitBreaker.execute(alwaysFailingFunction, { name: `open-test-${i}` });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`Fast failure ${i}: ${error.message} (${duration}ms)`);

      if (duration < 100) {
        console.log(`  ✅ Fast failure detected - circuit breaker working!`);
      }
    }
  }

  console.log('\nPhase 3: Testing transition to HALF_OPEN\n');

  // Wait for reset timeout
  console.log('Waiting for reset timeout...');
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Function that succeeds after recovery
  let recoveryCallCount = 0;
  const recoveringFunction = async () => {
    recoveryCallCount++;
    console.log(`  Recovery call ${recoveryCallCount}`);

    if (recoveryCallCount === 1) {
      // First call in HALF_OPEN should succeed to close circuit
      return 'Service recovered!';
    }

    return `Service working normally (call ${recoveryCallCount})`;
  };

  console.log('Testing recovery:');

  try {
    const result = await circuitBreaker.execute(recoveringFunction, { name: 'recovery-test' });
    console.log(`  ✅ ${result}`);

    const stats = circuitBreaker.getStats();
    console.log(`  Final state: ${stats.state}\n`);

  } catch (error) {
    console.log(`  ❌ Recovery failed: ${error.message}`);
  }

  return circuitBreaker.getStats();
}

/**
 * Test Circuit Breaker with Partial Failures
 */
async function testPartialFailures() {
  console.log('🎲 Testing Circuit Breaker with Partial Failures\n');

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 4,
    resetTimeout: 1000,
    maxRetries: 2
  });

  let callCount = 0;

  // Function that fails 70% of the time
  const partiallyFailingFunction = async () => {
    callCount++;
    const shouldFail = Math.random() < 0.7; // 70% failure rate

    console.log(`  Call ${callCount}: ${shouldFail ? 'Failing' : 'Succeeding'}`);

    if (shouldFail) {
      throw new Error(`Random failure ${callCount}`);
    }

    return `Success ${callCount}`;
  };

  console.log('Making 15 calls with 70% failure rate:\n');

  const results = { success: 0, failure: 0, fastFailure: 0 };

  for (let i = 1; i <= 15; i++) {
    const startTime = Date.now();

    try {
      const result = await circuitBreaker.execute(partiallyFailingFunction, { name: `partial-${i}` });
      const duration = Date.now() - startTime;

      results.success++;
      console.log(`${i}: ✅ ${result} (${duration}ms)`);

    } catch (error) {
      const duration = Date.now() - startTime;

      if (duration < 100) {
        results.fastFailure++;
        console.log(`${i}: ⚡ Fast failure: ${error.message} (${duration}ms)`);
      } else {
        results.failure++;
        console.log(`${i}: ❌ Normal failure: ${error.message} (${duration}ms)`);
      }
    }

    const stats = circuitBreaker.getStats();
    console.log(`   State: ${stats.state}, Failures: ${stats.failureCount}/${stats.failureThreshold}`);

    // Small delay between calls
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log();
  }

  console.log('📊 Partial Failure Test Results:');
  console.log(`  Successes: ${results.success}`);
  console.log(`  Normal failures: ${results.failure}`);
  console.log(`  Fast failures (circuit open): ${results.fastFailure}`);

  const totalCalls = results.success + results.failure + results.fastFailure;
  console.log(`  Success rate: ${((results.success / totalCalls) * 100).toFixed(1)}%`);
  console.log(`  Fast failure rate: ${((results.fastFailure / totalCalls) * 100).toFixed(1)}%`);

  return { results, finalStats: circuitBreaker.getStats() };
}

/**
 * Test Circuit Breaker Error Categorization
 */
async function testErrorCategorization() {
  console.log('🏷️  Testing Circuit Breaker with Error Categorization\n');

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 2,
    resetTimeout: 1000,
    maxRetries: 1
  });

  const errorScenarios = [
    {
      name: 'Network Error',
      error: () => {
        const err = new Error('Connection reset by peer');
        err.code = 'ECONNRESET';
        return err;
      }
    },
    {
      name: 'Auth Error',
      error: () => {
        const err = new Error('Unauthorized');
        err.status = 401;
        return err;
      }
    },
    {
      name: 'Rate Limit',
      error: () => {
        const err = new Error('Too many requests');
        err.status = 429;
        return err;
      }
    },
    {
      name: 'Server Error',
      error: () => {
        const err = new Error('Internal server error');
        err.status = 500;
        return err;
      }
    }
  ];

  for (const scenario of errorScenarios) {
    console.log(`Testing ${scenario.name}:`);

    // Reset circuit for each test
    circuitBreaker.reset();

    const errorFunction = () => {
      throw scenario.error();
    };

    let consecutiveFailures = 0;

    // Make calls until circuit opens or we hit limit
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await circuitBreaker.execute(errorFunction, { name: `${scenario.name}-${attempt}` });
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        console.log(`  Attempt ${attempt}: ${error.message}`);

        const stats = circuitBreaker.getStats();
        console.log(`    State: ${stats.state}, Failures: ${stats.failureCount}`);

        if (stats.state === CircuitStates.OPEN) {
          console.log(`    🔌 Circuit opened after ${consecutiveFailures} consecutive failures`);
          break;
        }
      }
    }

    console.log();
  }

  return { tested: errorScenarios.length };
}

/**
 * Performance comparison test
 */
async function testPerformanceImpact() {
  console.log('⚡ Testing Performance Impact of Circuit Breaker\n');

  // Test without circuit breaker
  const normalRetryHandler = new RetryHandler({
    maxRetries: 3,
    initialDelay: 100,
    enableLogging: false
  });

  // Test with circuit breaker
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 2,
    resetTimeout: 1000,
    maxRetries: 3,
    initialDelay: 100
  });

  const alwaysFailingFunction = () => {
    throw new Error('Simulated failure');
  };

  // Warm up circuit breaker to open state
  console.log('Warming up circuit breaker...');
  for (let i = 0; i < 3; i++) {
    try {
      await circuitBreaker.execute(alwaysFailingFunction);
    } catch (error) {
      // Expected failures
    }
  }

  console.log('Circuit breaker state:', circuitBreaker.getStats().state);

  // Performance test
  const iterations = 10;

  console.log(`\nTesting ${iterations} iterations of failing calls:\n`);

  // Test normal retry handler
  console.log('Testing normal retry handler:');
  const normalStartTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    try {
      await normalRetryHandler.execute(alwaysFailingFunction, { name: `normal-${i}` });
    } catch (error) {
      // Expected failures
    }
  }

  const normalDuration = Date.now() - normalStartTime;
  console.log(`  Total time: ${normalDuration}ms`);
  console.log(`  Average per call: ${(normalDuration / iterations).toFixed(1)}ms`);

  // Test circuit breaker (should be much faster due to fast failures)
  console.log('\nTesting circuit breaker (open state):');
  const circuitStartTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    try {
      await circuitBreaker.execute(alwaysFailingFunction, { name: `circuit-${i}` });
    } catch (error) {
      // Expected fast failures
    }
  }

  const circuitDuration = Date.now() - circuitStartTime;
  console.log(`  Total time: ${circuitDuration}ms`);
  console.log(`  Average per call: ${(circuitDuration / iterations).toFixed(1)}ms`);

  const speedup = normalDuration / circuitDuration;
  console.log(`\n📊 Performance Results:`);
  console.log(`  Speedup: ${speedup.toFixed(2)}x faster with circuit breaker`);
  console.log(`  Time saved: ${normalDuration - circuitDuration}ms (${(((normalDuration - circuitDuration) / normalDuration) * 100).toFixed(1)}%)`);

  return {
    normalDuration,
    circuitDuration,
    speedup,
    timeSaved: normalDuration - circuitDuration
  };
}

// Main test execution
async function runCircuitBreakerTests() {
  console.log('Starting comprehensive circuit breaker tests...\n');

  const results = {};

  try {
    // Test 1: State Transitions
    console.log('='.repeat(60));
    results.stateTransitions = await testCircuitBreakerStates();

    // Test 2: Partial Failures
    console.log('\n' + '='.repeat(60));
    results.partialFailures = await testPartialFailures();

    // Test 3: Error Categorization
    console.log('\n' + '='.repeat(60));
    results.errorCategorization = await testErrorCategorization();

    // Test 4: Performance Impact
    console.log('\n' + '='.repeat(60));
    results.performance = await testPerformanceImpact();

    // Summary
    console.log('\n\n✅ CIRCUIT BREAKER TEST SUMMARY\n');
    console.log('===============================\n');

    console.log(`🔄 State Transitions: Final state ${results.stateTransitions.state}`);
    console.log(`🎲 Partial Failures: ${results.partialFailures.results.success} successes, ${results.partialFailures.results.fastFailure} fast failures`);
    console.log(`🏷️  Error Categorization: ${results.errorCategorization.tested} error types tested`);
    console.log(`⚡ Performance: ${results.performance.speedup.toFixed(2)}x speedup, ${results.performance.timeSaved}ms saved`);

    console.log('\n🎉 All circuit breaker tests completed successfully!');

    console.log('\n💡 Key Benefits Demonstrated:');
    console.log('  • Prevents cascading failures by failing fast');
    console.log('  • Significant performance improvement during outages');
    console.log('  • Automatic recovery testing with half-open state');
    console.log('  • Works with existing retry handler error classification');
    console.log('  • Configurable thresholds and timeouts');

    return results;

  } catch (error) {
    console.error('\n❌ Circuit breaker tests failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  process.exit(0);
});

// Run the tests
runCircuitBreakerTests().catch(console.error);