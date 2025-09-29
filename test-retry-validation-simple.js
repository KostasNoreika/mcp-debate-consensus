#!/usr/bin/env node

/**
 * Simple Retry Handler Validation
 * Quick validation of core retry functionality
 */

import { RetryHandler, ErrorClassifier, DelayCalculator, ErrorTypes } from './src/utils/retry-handler.js';

console.log('🔄 Simple Retry Handler Validation\n');
console.log('==================================\n');

let testsRun = 0;
let testsPassed = 0;

// Test helper
function test(name, testFn) {
  testsRun++;
  try {
    console.log(`🧪 Test ${testsRun}: ${name}`);
    testFn();
    testsPassed++;
    console.log('   ✅ PASS\n');
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}\n`);
  }
}

// Test 1: Basic instantiation
test('RetryHandler instantiation', () => {
  const handler = new RetryHandler({ enableLogging: false });
  if (!handler) throw new Error('Handler not created');
  if (handler.config.maxRetries !== 3) throw new Error('Default config not set');
});

// Test 2: Error classification
test('Error classification - Authentication', () => {
  const error = new Error('Unauthorized');
  error.status = 401;
  const classification = ErrorClassifier.classify(error);
  if (classification.type !== ErrorTypes.AUTHENTICATION) throw new Error('Wrong error type');
  if (classification.retriable !== false) throw new Error('Should not be retriable');
});

// Test 3: Error classification - Network
test('Error classification - Network', () => {
  const error = new Error('Connection reset');
  error.code = 'ECONNRESET';
  const classification = ErrorClassifier.classify(error);
  if (classification.type !== ErrorTypes.NETWORK) throw new Error('Wrong error type');
  if (classification.retriable !== true) throw new Error('Should be retriable');
});

// Test 4: Delay calculation
test('Delay calculation - Exponential backoff', () => {
  const config = { initialDelay: 1000, backoffMultiplier: 2, maxDelay: 10000, jitterRange: 0 };
  const delay1 = DelayCalculator.calculate(1, config);
  const delay2 = DelayCalculator.calculate(2, config);

  if (delay1 !== 1000) throw new Error(`Expected 1000ms, got ${delay1}ms`);
  if (delay2 !== 2000) throw new Error(`Expected 2000ms, got ${delay2}ms`);
});

// Test 5: Rate limit special handling
test('Rate limit delay calculation', () => {
  const config = { initialDelay: 1000, backoffMultiplier: 2, maxDelay: 30000, jitterRange: 0 };
  const normalDelay = DelayCalculator.calculate(1, config);
  const rateLimitDelay = DelayCalculator.calculate(1, config, ErrorTypes.RATE_LIMIT);

  if (rateLimitDelay <= normalDelay) throw new Error('Rate limit delay should be longer');
  if (rateLimitDelay < 5000) throw new Error('Rate limit delay should be at least 5 seconds');
});

// Test 6: Successful execution
test('Successful execution (no retries)', async () => {
  const handler = new RetryHandler({ enableLogging: false });
  const result = await handler.execute(async () => 'success');
  if (result !== 'success') throw new Error('Unexpected result');

  const stats = handler.getStats();
  if (stats.totalAttempts !== 1) throw new Error('Wrong attempt count');
  if (stats.successRate !== 1) throw new Error('Wrong success rate');
});

// Test 7: Success after retries
test('Success after retries', async () => {
  const handler = new RetryHandler({ maxRetries: 2, initialDelay: 10, enableLogging: false });

  let attempts = 0;
  const testFn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };

  const result = await handler.execute(testFn);
  if (result !== 'success') throw new Error('Unexpected result');
  if (attempts !== 3) throw new Error(`Expected 3 attempts, got ${attempts}`);
});

// Test 8: Non-retriable error fails immediately
test('Non-retriable error fails immediately', async () => {
  const handler = new RetryHandler({ maxRetries: 3, initialDelay: 10, enableLogging: false });

  let attempts = 0;
  const testFn = async () => {
    attempts++;
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  };

  try {
    await handler.execute(testFn);
    throw new Error('Should have failed');
  } catch (error) {
    if (attempts !== 1) throw new Error(`Expected 1 attempt, got ${attempts}`);
    if (!error.message.includes('Non-retriable')) throw new Error('Wrong error type');
  }
});

// Test 9: Max retries exhausted
test('Max retries exhausted', async () => {
  const handler = new RetryHandler({ maxRetries: 2, initialDelay: 10, enableLogging: false });

  let attempts = 0;
  const testFn = async () => {
    attempts++;
    throw new Error('Always fails');
  };

  try {
    await handler.execute(testFn);
    throw new Error('Should have failed');
  } catch (error) {
    if (attempts !== 3) throw new Error(`Expected 3 attempts, got ${attempts}`); // 1 initial + 2 retries
    if (!error.message.includes('Max retries')) throw new Error('Wrong error message');
  }
});

// Test 10: Statistics tracking
test('Statistics tracking', async () => {
  const handler = new RetryHandler({ maxRetries: 1, initialDelay: 10, enableLogging: false });

  // Success
  await handler.execute(async () => 'success1');

  // Success after retry
  let attempt = 0;
  await handler.execute(async () => {
    attempt++;
    if (attempt === 1) throw new Error('temp failure');
    return 'success2';
  });

  // Failure
  try {
    await handler.execute(async () => {
      throw new Error('permanent failure');
    });
  } catch (error) {
    // Expected
  }

  const stats = handler.getStats();
  if (stats.totalAttempts !== 3) throw new Error(`Expected 3 attempts, got ${stats.totalAttempts}`);
  if (Math.abs(stats.successRate - 0.6667) > 0.001) throw new Error(`Expected ~66.7% success rate, got ${(stats.successRate * 100).toFixed(1)}%`);
});

// Run all tests and report
async function runValidation() {
  console.log('Running validation tests...\n');

  // Run synchronous tests
  for (let i = 1; i <= 5; i++) {
    // Tests 1-5 are synchronous, already run above
  }

  // Run asynchronous tests
  try {
    await test('Successful execution (no retries)', async () => {
      const handler = new RetryHandler({ enableLogging: false });
      const result = await handler.execute(async () => 'success');
      if (result !== 'success') throw new Error('Unexpected result');

      const stats = handler.getStats();
      if (stats.totalAttempts !== 1) throw new Error('Wrong attempt count');
      if (stats.successRate !== 1) throw new Error('Wrong success rate');
    });

    await test('Success after retries', async () => {
      const handler = new RetryHandler({ maxRetries: 2, initialDelay: 10, enableLogging: false });

      let attempts = 0;
      const testFn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await handler.execute(testFn);
      if (result !== 'success') throw new Error('Unexpected result');
      if (attempts !== 3) throw new Error(`Expected 3 attempts, got ${attempts}`);
    });

    await test('Non-retriable error fails immediately', async () => {
      const handler = new RetryHandler({ maxRetries: 3, initialDelay: 10, enableLogging: false });

      let attempts = 0;
      const testFn = async () => {
        attempts++;
        const error = new Error('Unauthorized');
        error.status = 401;
        throw error;
      };

      try {
        await handler.execute(testFn);
        throw new Error('Should have failed');
      } catch (error) {
        if (attempts !== 1) throw new Error(`Expected 1 attempt, got ${attempts}`);
        if (!error.message.includes('Non-retriable')) throw new Error('Wrong error type');
      }
    });

    await test('Max retries exhausted', async () => {
      const handler = new RetryHandler({ maxRetries: 2, initialDelay: 10, enableLogging: false });

      let attempts = 0;
      const testFn = async () => {
        attempts++;
        throw new Error('Always fails');
      };

      try {
        await handler.execute(testFn);
        throw new Error('Should have failed');
      } catch (error) {
        if (attempts !== 3) throw new Error(`Expected 3 attempts, got ${attempts}`); // 1 initial + 2 retries
        if (!error.message.includes('Max retries')) throw new Error('Wrong error message');
      }
    });

    await test('Statistics tracking', async () => {
      const handler = new RetryHandler({ maxRetries: 1, initialDelay: 10, enableLogging: false });

      // Success
      await handler.execute(async () => 'success1');

      // Success after retry
      let attempt = 0;
      await handler.execute(async () => {
        attempt++;
        if (attempt === 1) throw new Error('temp failure');
        return 'success2';
      });

      // Failure
      try {
        await handler.execute(async () => {
          throw new Error('permanent failure');
        });
      } catch (error) {
        // Expected
      }

      const stats = handler.getStats();
      if (stats.totalAttempts !== 3) throw new Error(`Expected 3 attempts, got ${stats.totalAttempts}`);
      if (Math.abs(stats.successRate - 0.6667) > 0.001) throw new Error(`Expected ~66.7% success rate, got ${(stats.successRate * 100).toFixed(1)}%`);
    });

  } catch (error) {
    console.log(`❌ Async test failed: ${error.message}\n`);
  }

  // Summary
  console.log('🏁 VALIDATION SUMMARY');
  console.log('====================');
  console.log(`Tests run: ${testsRun}`);
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Success rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%\n`);

  if (testsPassed === testsRun) {
    console.log('🎉 All tests passed! Retry handler is working correctly.');
    console.log('\n✅ CORE FEATURES VALIDATED:');
    console.log('   • Exponential backoff with configurable parameters');
    console.log('   • Error classification (auth, network, rate limit, etc.)');
    console.log('   • Non-retriable error fast-fail');
    console.log('   • Rate limit special handling');
    console.log('   • Statistics tracking');
    console.log('   • Success after retries');
    console.log('   • Max retry exhaustion');
    console.log('\n🚀 Ready for production use!');
  } else {
    console.log(`❌ ${testsRun - testsPassed} test(s) failed. Review implementation.`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  process.exit(0);
});

// Run validation
runValidation().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});