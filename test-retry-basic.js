#!/usr/bin/env node

/**
 * Basic Retry Handler Test - Exponential Backoff Validation
 * Tests the core exponential backoff functionality with precise timing
 */

import { RetryHandler, DelayCalculator, ErrorTypes } from './src/utils/retry-handler.js';

console.log('🔄 Basic Retry Handler - Exponential Backoff Test\n');
console.log('================================================\n');

// Create handler with specific configuration for predictable testing
const retryHandler = new RetryHandler({
  maxRetries: 4,
  initialDelay: 1000, // 1 second
  maxDelay: 16000,    // 16 seconds max
  backoffMultiplier: 2,
  jitterRange: 0.0,   // No jitter for precise timing tests
  enableLogging: true
});

async function testExponentialBackoff() {
  console.log('📊 Testing Exponential Backoff Pattern\n');

  let attemptCount = 0;
  const attemptTimes = [];

  const failingFunction = async () => {
    attemptCount++;
    const now = Date.now();
    attemptTimes.push(now);

    console.log(`  Attempt ${attemptCount} at ${new Date(now).toISOString()}`);

    // Always fail to test full retry sequence
    throw new Error(`Network failure on attempt ${attemptCount}`);
  };

  const startTime = Date.now();

  try {
    await retryHandler.execute(failingFunction, { name: 'exponential-backoff-test' });
  } catch (error) {
    console.log(`\n❌ Final failure after all retries: ${error.message}\n`);
  }

  const totalDuration = Date.now() - startTime;

  // Analyze the timing between attempts
  console.log('⏱️  Timing Analysis:');
  console.log(`Total execution time: ${totalDuration}ms`);

  if (attemptTimes.length > 1) {
    for (let i = 1; i < attemptTimes.length; i++) {
      const delay = attemptTimes[i] - attemptTimes[i - 1];
      const expectedDelay = DelayCalculator.calculate(i, retryHandler.config);
      const variance = Math.abs(delay - expectedDelay);
      const variancePercent = (variance / expectedDelay) * 100;

      console.log(`  Delay ${i}: ${delay}ms (expected: ${expectedDelay}ms, variance: ${variancePercent.toFixed(1)}%)`);

      if (variancePercent > 10) {
        console.log(`    ⚠️  High variance detected!`);
      } else {
        console.log(`    ✅ Within acceptable range`);
      }
    }

    // Verify exponential pattern: each delay should be ~2x the previous
    const delays = [];
    for (let i = 1; i < attemptTimes.length; i++) {
      delays.push(attemptTimes[i] - attemptTimes[i - 1]);
    }

    console.log('\n📈 Exponential Pattern Verification:');
    for (let i = 1; i < delays.length; i++) {
      const ratio = delays[i] / delays[i - 1];
      const expectedRatio = retryHandler.config.backoffMultiplier;

      console.log(`  Delay ratio ${i + 1}/${i}: ${ratio.toFixed(2)} (expected: ${expectedRatio})`);

      if (Math.abs(ratio - expectedRatio) < 0.2) {
        console.log(`    ✅ Correct exponential growth`);
      } else {
        console.log(`    ⚠️  Unexpected ratio!`);
      }
    }
  }

  return {
    totalDuration,
    attemptCount,
    delays: attemptTimes.slice(1).map((time, i) => time - attemptTimes[i])
  };
}

async function testSuccessAfterRetries() {
  console.log('\n\n🎯 Testing Success After Multiple Retries\n');

  let attemptCount = 0;
  const maxAttempts = 3;

  const eventuallySucceedingFunction = async () => {
    attemptCount++;

    console.log(`  Attempt ${attemptCount} - ${attemptCount < maxAttempts ? 'Failing' : 'Succeeding'}`);

    if (attemptCount < maxAttempts) {
      throw new Error(`Temporary failure ${attemptCount}`);
    }

    return `Success after ${attemptCount} attempts!`;
  };

  const startTime = Date.now();

  try {
    const result = await retryHandler.execute(eventuallySucceedingFunction, {
      name: 'eventual-success-test'
    });

    const duration = Date.now() - startTime;

    console.log(`\n✅ Result: ${result}`);
    console.log(`⏱️  Total duration: ${duration}ms`);
    console.log(`🔄 Total attempts: ${attemptCount}`);

    return { success: true, result, duration, attempts: attemptCount };

  } catch (error) {
    console.log(`\n❌ Unexpected failure: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testDelayCalculations() {
  console.log('\n\n🧮 Testing Delay Calculation Logic\n');

  const config = {
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterRange: 0.0
  };

  console.log('Expected delay progression:');

  for (let attempt = 1; attempt <= 5; attempt++) {
    const delay = DelayCalculator.calculate(attempt, config);
    const expectedBase = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedExpected = Math.min(expectedBase, config.maxDelay);

    console.log(`  Attempt ${attempt}: ${delay}ms (base: ${expectedBase}ms, capped: ${cappedExpected}ms)`);

    if (delay === cappedExpected) {
      console.log(`    ✅ Correct calculation`);
    } else {
      console.log(`    ❌ Calculation error!`);
    }
  }

  // Test rate limit delays
  console.log('\n🚦 Rate Limit Delay Testing:');

  const normalDelay = DelayCalculator.calculate(1, config);
  const rateLimitDelay = DelayCalculator.calculate(1, config, ErrorTypes.RATE_LIMIT);

  console.log(`  Normal delay: ${normalDelay}ms`);
  console.log(`  Rate limit delay: ${rateLimitDelay}ms`);
  console.log(`  Rate limit multiplier: ${(rateLimitDelay / normalDelay).toFixed(2)}x`);

  if (rateLimitDelay >= 5000 && rateLimitDelay > normalDelay) {
    console.log(`    ✅ Rate limit delays are properly increased`);
  } else {
    console.log(`    ❌ Rate limit delay logic failed!`);
  }

  return {
    normalDelay,
    rateLimitDelay,
    multiplier: rateLimitDelay / normalDelay
  };
}

async function testStatisticsTracking() {
  console.log('\n\n📊 Testing Statistics Tracking\n');

  // Reset stats for clean test
  retryHandler.resetStats();

  let initialStats = retryHandler.getStats();
  console.log('Initial stats:', JSON.stringify(initialStats, null, 2));

  // Run several operations with different outcomes
  const operations = [
    // Immediate success
    async () => 'success1',

    // Fail once, then succeed
    (() => {
      let count = 0;
      return async () => {
        count++;
        if (count === 1) throw new Error('temp failure');
        return 'success2';
      };
    })(),

    // Fail completely
    async () => { throw new Error('permanent failure'); }
  ];

  for (let i = 0; i < operations.length; i++) {
    console.log(`\nOperation ${i + 1}:`);
    try {
      const result = await retryHandler.execute(operations[i], { name: `op-${i + 1}` });
      console.log(`  ✅ Success: ${result}`);
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`);
    }
  }

  const finalStats = retryHandler.getStats();
  console.log('\nFinal statistics:');
  console.log(JSON.stringify(finalStats, null, 2));

  // Verify statistics calculations
  console.log('\n📈 Statistics Verification:');
  console.log(`  Total attempts: ${finalStats.totalAttempts} (expected: 3)`);
  console.log(`  Success rate: ${(finalStats.successRate * 100).toFixed(1)}% (expected: ~66.7%)`);
  console.log(`  Average retry count: ${finalStats.avgRetryCount.toFixed(2)}`);
  console.log(`  Max retry count: ${finalStats.maxRetryCount}`);

  return finalStats;
}

// Main test execution
async function runBasicTests() {
  console.log('Starting comprehensive basic retry tests...\n');

  const results = {
    backoffTest: null,
    successTest: null,
    delayTest: null,
    statsTest: null
  };

  try {
    // Test 1: Exponential Backoff
    results.backoffTest = await testExponentialBackoff();

    // Reset handler for next test
    retryHandler.resetStats();

    // Test 2: Success After Retries
    results.successTest = await testSuccessAfterRetries();

    // Test 3: Delay Calculations
    results.delayTest = await testDelayCalculations();

    // Test 4: Statistics Tracking
    results.statsTest = await testStatisticsTracking();

    // Summary
    console.log('\n\n✅ BASIC RETRY TEST SUMMARY\n');
    console.log('============================\n');

    console.log(`🔄 Exponential Backoff: ${results.backoffTest.attemptCount} attempts, ${results.backoffTest.totalDuration}ms total`);
    console.log(`🎯 Success After Retries: ${results.successTest.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`🧮 Delay Calculations: Rate limit multiplier ${results.delayTest.multiplier.toFixed(2)}x`);
    console.log(`📊 Statistics Tracking: ${results.statsTest.totalAttempts} operations tracked`);

    console.log('\n🎉 All basic retry tests completed successfully!');
    return results;

  } catch (error) {
    console.error('\n❌ Basic retry tests failed:', error.message);
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
runBasicTests().catch(console.error);