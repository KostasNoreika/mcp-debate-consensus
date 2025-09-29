#!/usr/bin/env node

/**
 * Comprehensive Retry Handler Integration Test
 * Tests retry functionality integrated with the full debate orchestrator system
 */

import { ClaudeCliDebate } from './src/claude-cli-debate.js';
import { RetryHandler, ErrorTypes } from './src/utils/retry-handler.js';
import fs from 'fs';
import path from 'path';

console.log('🔄 Comprehensive Retry Handler Integration Test\n');
console.log('===============================================\n');

/**
 * Mock model wrapper for testing different failure scenarios
 */
async function createMockWrapper(scenario) {
  const tempDir = path.join(process.cwd(), 'temp-test-wrappers');

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const wrapperPath = path.join(tempDir, `mock-wrapper-${scenario}.sh`);

  let wrapperContent = '#!/bin/bash\n\n';

  switch (scenario) {
    case 'immediate-success':
      wrapperContent += 'echo "{\\"response\\": \\"Immediate success\\", \\"confidence\\": 95}"\n';
      break;

    case 'fail-then-success':
      wrapperContent += `
# Create a failure counter file
COUNTER_FILE="/tmp/mock-wrapper-${scenario}-counter"

if [ ! -f "$COUNTER_FILE" ]; then
  echo "1" > "$COUNTER_FILE"
  echo "Network connection failed" >&2
  exit 1
else
  COUNTER=$(cat "$COUNTER_FILE")
  if [ "$COUNTER" -lt "2" ]; then
    echo $((COUNTER + 1)) > "$COUNTER_FILE"
    echo "Temporary failure $COUNTER" >&2
    exit 1
  else
    rm -f "$COUNTER_FILE"
    echo "{\\"response\\": \\"Success after retries\\", \\"confidence\\": 90}"
  fi
fi
`;
      break;

    case 'rate-limit-then-success':
      wrapperContent += `
# Simulate rate limiting
COUNTER_FILE="/tmp/mock-wrapper-${scenario}-counter"

if [ ! -f "$COUNTER_FILE" ]; then
  echo "1" > "$COUNTER_FILE"
  echo "Rate limit exceeded" >&2
  exit 1
else
  rm -f "$COUNTER_FILE"
  echo "{\\"response\\": \\"Rate limit cleared\\", \\"confidence\\": 88}"
fi
`;
      break;

    case 'auth-error':
      wrapperContent += `
echo "Unauthorized: Invalid API key" >&2
exit 1
`;
      break;

    case 'persistent-failure':
      wrapperContent += `
echo "Service permanently unavailable" >&2
exit 1
`;
      break;

    case 'timeout-simulation':
      wrapperContent += `
# Simulate long running process that times out
sleep 30
echo "{\\"response\\": \\"Should not reach here\\", \\"confidence\\": 0}"
`;
      break;

    default:
      wrapperContent += 'echo "{\\"response\\": \\"Unknown scenario\\", \\"confidence\\": 50}"\n';
  }

  fs.writeFileSync(wrapperPath, wrapperContent);
  fs.chmodSync(wrapperPath, 0o755);

  return wrapperPath;
}

/**
 * Clean up test files
 */
function cleanup() {
  const tempDir = path.join(process.cwd(), 'temp-test-wrappers');

  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tempDir, file));
    }
    fs.rmdirSync(tempDir);
  }

  // Clean up counter files
  const counterFiles = [
    '/tmp/mock-wrapper-fail-then-success-counter',
    '/tmp/mock-wrapper-rate-limit-then-success-counter'
  ];

  for (const counterFile of counterFiles) {
    if (fs.existsSync(counterFile)) {
      fs.unlinkSync(counterFile);
    }
  }
}

/**
 * Test immediate success (no retries needed)
 */
async function testImmediateSuccess() {
  console.log('🎯 Test 1: Immediate Success (No Retries)\n');

  const debate = new ClaudeCliDebate();

  // Configure for fast testing
  debate.configureRetry({
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 1000,
    enableLogging: true
  });

  const wrapperPath = await createMockWrapper('immediate-success');

  const mockModel = {
    name: 'Immediate Success Model',
    alias: 'success',
    expertise: 'Testing immediate success',
    wrapper: wrapperPath
  };

  const startTime = Date.now();

  try {
    const result = await debate.callModel(
      mockModel,
      'Test prompt for immediate success',
      process.cwd(),
      null,
      {}
    );

    const duration = Date.now() - startTime;

    console.log(`✅ Success: ${JSON.stringify(result)}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    const stats = debate.getRetryStats();
    console.log(`📊 Retry stats: ${stats.handler.totalAttempts} attempts, ${(stats.handler.successRate * 100).toFixed(1)}% success rate`);

    if (duration < 1000 && result && result.response === 'Immediate success') {
      console.log('✅ Test passed: Immediate success without retries');
      return { success: true, duration, attempts: 1 };
    } else {
      console.log('❌ Test failed: Unexpected behavior');
      return { success: false, reason: 'Unexpected result or timing' };
    }

  } catch (error) {
    console.log(`❌ Unexpected failure: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test success after retries
 */
async function testSuccessAfterRetries() {
  console.log('\n🔄 Test 2: Success After Retries\n');

  const debate = new ClaudeCliDebate();

  // Configure for observable retries
  debate.configureRetry({
    maxRetries: 3,
    initialDelay: 200,
    maxDelay: 2000,
    enableLogging: true
  });

  debate.resetRetryStats();

  const wrapperPath = await createMockWrapper('fail-then-success');

  const mockModel = {
    name: 'Eventually Succeeding Model',
    alias: 'eventual',
    expertise: 'Testing retry success',
    wrapper: wrapperPath
  };

  const startTime = Date.now();

  try {
    const result = await debate.callModel(
      mockModel,
      'Test prompt for eventual success',
      process.cwd(),
      null,
      {}
    );

    const duration = Date.now() - startTime;

    console.log(`✅ Success: ${JSON.stringify(result)}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    const stats = debate.getRetryStats();
    console.log(`📊 Retry stats: ${stats.handler.totalAttempts} attempts, avg ${stats.handler.avgRetryCount.toFixed(1)} retries`);

    if (result && result.response === 'Success after retries' && duration > 200) {
      console.log('✅ Test passed: Success achieved after retries');
      return { success: true, duration, stats: stats.handler };
    } else {
      console.log('❌ Test failed: Expected retry behavior not observed');
      return { success: false, reason: 'Retries not properly executed' };
    }

  } catch (error) {
    console.log(`❌ Unexpected failure: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test rate limit handling
 */
async function testRateLimitHandling() {
  console.log('\n🚦 Test 3: Rate Limit Handling\n');

  const debate = new ClaudeCliDebate();

  // Configure for rate limit testing
  debate.configureRetry({
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 3000,
    enableLogging: true
  });

  debate.resetRetryStats();

  const wrapperPath = await createMockWrapper('rate-limit-then-success');

  const mockModel = {
    name: 'Rate Limited Model',
    alias: 'ratelimit',
    expertise: 'Testing rate limit handling',
    wrapper: wrapperPath
  };

  const startTime = Date.now();

  try {
    const result = await debate.callModel(
      mockModel,
      'Test prompt for rate limit recovery',
      process.cwd(),
      null,
      {}
    );

    const duration = Date.now() - startTime;

    console.log(`✅ Success: ${JSON.stringify(result)}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    const stats = debate.getRetryStats();
    console.log(`📊 Retry stats: ${stats.handler.totalAttempts} attempts`);

    // Rate limit retries should have longer delays
    if (result && result.response === 'Rate limit cleared' && duration > 1000) {
      console.log('✅ Test passed: Rate limit properly handled with longer delays');
      return { success: true, duration, stats: stats.handler };
    } else {
      console.log('❌ Test failed: Rate limit handling not working as expected');
      return { success: false, reason: 'Rate limit delays too short' };
    }

  } catch (error) {
    console.log(`❌ Unexpected failure: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test non-retriable errors
 */
async function testNonRetriableErrors() {
  console.log('\n🚫 Test 4: Non-Retriable Errors\n');

  const debate = new ClaudeCliDebate();

  debate.configureRetry({
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 1000,
    enableLogging: true
  });

  debate.resetRetryStats();

  const wrapperPath = await createMockWrapper('auth-error');

  const mockModel = {
    name: 'Auth Error Model',
    alias: 'autherror',
    expertise: 'Testing non-retriable errors',
    wrapper: wrapperPath
  };

  const startTime = Date.now();

  try {
    const result = await debate.callModel(
      mockModel,
      'Test prompt that should fail with auth error',
      process.cwd(),
      null,
      {}
    );

    console.log(`❌ Unexpected success: ${JSON.stringify(result)}`);
    return { success: false, reason: 'Should have failed with auth error' };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.log(`✅ Expected failure: ${error.message}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    const stats = debate.getRetryStats();
    console.log(`📊 Retry stats: ${stats.handler.totalAttempts} attempts`);

    // Should fail quickly without retries
    if (duration < 500) {
      console.log('✅ Test passed: Non-retriable error failed fast without retries');
      return { success: true, duration, fastFailure: true };
    } else {
      console.log('❌ Test failed: Non-retriable error should fail immediately');
      return { success: false, reason: 'Failed too slowly, may have retried' };
    }
  }
}

/**
 * Test maximum retries exceeded
 */
async function testMaxRetriesExceeded() {
  console.log('\n⏳ Test 5: Maximum Retries Exceeded\n');

  const debate = new ClaudeCliDebate();

  debate.configureRetry({
    maxRetries: 2,
    initialDelay: 200,
    maxDelay: 1000,
    enableLogging: true
  });

  debate.resetRetryStats();

  const wrapperPath = await createMockWrapper('persistent-failure');

  const mockModel = {
    name: 'Persistent Failure Model',
    alias: 'persistfail',
    expertise: 'Testing max retries',
    wrapper: wrapperPath
  };

  const startTime = Date.now();

  try {
    const result = await debate.callModel(
      mockModel,
      'Test prompt that should exhaust retries',
      process.cwd(),
      null,
      {}
    );

    console.log(`❌ Unexpected success: ${JSON.stringify(result)}`);
    return { success: false, reason: 'Should have failed after max retries' };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.log(`✅ Expected failure after retries: ${error.message}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    const stats = debate.getRetryStats();
    console.log(`📊 Retry stats: ${stats.handler.totalAttempts} attempts`);

    // Should have tried multiple times (1 initial + 2 retries = 3 total)
    if (duration > 400 && stats.handler.totalAttempts > 0) {
      console.log('✅ Test passed: Max retries exhausted with proper timing');
      return { success: true, duration, retriesExhausted: true };
    } else {
      console.log('❌ Test failed: Retry behavior not as expected');
      return { success: false, reason: 'Incorrect retry count or timing' };
    }
  }
}

/**
 * Test timeout handling
 */
async function testTimeoutHandling() {
  console.log('\n⏰ Test 6: Timeout Handling\n');

  const debate = new ClaudeCliDebate();

  // Set short timeout for testing
  debate.configureRetry({
    maxRetries: 1,
    initialDelay: 100,
    timeoutMs: 2000, // 2 second timeout
    enableLogging: true
  });

  debate.resetRetryStats();

  const wrapperPath = await createMockWrapper('timeout-simulation');

  const mockModel = {
    name: 'Timeout Model',
    alias: 'timeout',
    expertise: 'Testing timeout behavior',
    wrapper: wrapperPath
  };

  const startTime = Date.now();

  try {
    const result = await debate.callModel(
      mockModel,
      'Test prompt that should timeout',
      process.cwd(),
      null,
      {}
    );

    console.log(`❌ Unexpected success: ${JSON.stringify(result)}`);
    return { success: false, reason: 'Should have timed out' };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.log(`✅ Expected timeout: ${error.message}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    const stats = debate.getRetryStats();
    console.log(`📊 Retry stats: ${stats.handler.totalAttempts} attempts`);

    // Should timeout reasonably quickly (within timeout * max attempts)
    if (duration < 10000 && error.message.toLowerCase().includes('timeout')) {
      console.log('✅ Test passed: Timeout handled properly');
      return { success: true, duration, timedOut: true };
    } else {
      console.log('❌ Test failed: Timeout not handled correctly');
      return { success: false, reason: 'Timeout behavior incorrect' };
    }
  }
}

/**
 * Test retry statistics tracking
 */
async function testRetryStatistics() {
  console.log('\n📊 Test 7: Retry Statistics Tracking\n');

  const debate = new ClaudeCliDebate();

  debate.configureRetry({
    maxRetries: 2,
    initialDelay: 100,
    enableLogging: false // Less noise for stats test
  });

  // Reset and run multiple operations
  debate.resetRetryStats();

  console.log('Running multiple operations to test statistics...');

  const operations = [
    { scenario: 'immediate-success', description: 'Immediate success' },
    { scenario: 'fail-then-success', description: 'Success after retry' },
    { scenario: 'auth-error', description: 'Non-retriable failure' }
  ];

  const results = [];

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    console.log(`  Operation ${i + 1}: ${operation.description}`);

    const wrapperPath = await createMockWrapper(operation.scenario);

    const mockModel = {
      name: `Stats Test Model ${i + 1}`,
      alias: `stats${i + 1}`,
      expertise: 'Testing statistics',
      wrapper: wrapperPath
    };

    try {
      const result = await debate.callModel(
        mockModel,
        `Stats test prompt ${i + 1}`,
        process.cwd(),
        null,
        {}
      );

      console.log(`    ✅ Success`);
      results.push({ success: true, operation: operation.description });

    } catch (error) {
      console.log(`    ❌ Failed: ${error.message.split('\n')[0]}`);
      results.push({ success: false, operation: operation.description, error: error.message });
    }
  }

  const finalStats = debate.getRetryStats();
  console.log('\n📈 Final Statistics:');
  console.log(JSON.stringify(finalStats.handler, null, 2));

  // Validate statistics
  const expectedAttempts = operations.length;
  const successCount = results.filter(r => r.success).length;
  const expectedSuccessRate = successCount / expectedAttempts;

  console.log('\n✅ Statistics Validation:');
  console.log(`  Expected attempts: ${expectedAttempts}, Actual: ${finalStats.handler.totalAttempts}`);
  console.log(`  Expected success rate: ${(expectedSuccessRate * 100).toFixed(1)}%, Actual: ${(finalStats.handler.successRate * 100).toFixed(1)}%`);

  const statsCorrect = finalStats.handler.totalAttempts === expectedAttempts &&
                      Math.abs(finalStats.handler.successRate - expectedSuccessRate) < 0.01;

  if (statsCorrect) {
    console.log('✅ Test passed: Statistics tracking is accurate');
    return { success: true, stats: finalStats.handler, results };
  } else {
    console.log('❌ Test failed: Statistics tracking is inaccurate');
    return { success: false, reason: 'Statistics mismatch' };
  }
}

/**
 * Test concurrent retry operations
 */
async function testConcurrentRetries() {
  console.log('\n🔀 Test 8: Concurrent Retry Operations\n');

  const debate = new ClaudeCliDebate();

  debate.configureRetry({
    maxRetries: 2,
    initialDelay: 200,
    jitterRange: 0.2, // Add jitter for concurrent testing
    enableLogging: false
  });

  debate.resetRetryStats();

  console.log('Running 5 concurrent operations with retries...');

  const concurrentOperations = [];

  for (let i = 0; i < 5; i++) {
    const scenario = i < 2 ? 'fail-then-success' : 'immediate-success';
    const wrapperPath = await createMockWrapper(`${scenario}-concurrent-${i}`);

    const mockModel = {
      name: `Concurrent Model ${i + 1}`,
      alias: `concurrent${i + 1}`,
      expertise: 'Testing concurrent retries',
      wrapper: wrapperPath
    };

    const operation = debate.callModel(
      mockModel,
      `Concurrent test prompt ${i + 1}`,
      process.cwd(),
      null,
      {}
    ).then(result => ({
      id: i + 1,
      success: true,
      result: result
    })).catch(error => ({
      id: i + 1,
      success: false,
      error: error.message
    }));

    concurrentOperations.push(operation);
  }

  const startTime = Date.now();
  const results = await Promise.all(concurrentOperations);
  const duration = Date.now() - startTime;

  console.log(`\n⏱️  All operations completed in ${duration}ms`);

  const successCount = results.filter(r => r.success).length;
  console.log(`📊 Results: ${successCount}/${results.length} successful`);

  for (const result of results) {
    if (result.success) {
      console.log(`  ✅ Operation ${result.id}: Success`);
    } else {
      console.log(`  ❌ Operation ${result.id}: ${result.error.split('\n')[0]}`);
    }
  }

  const finalStats = debate.getRetryStats();
  console.log(`\n📈 Final stats: ${finalStats.handler.totalAttempts} attempts, ${(finalStats.handler.successRate * 100).toFixed(1)}% success rate`);

  if (successCount >= 3 && duration < 10000) {
    console.log('✅ Test passed: Concurrent retries handled successfully');
    return { success: true, results, duration, stats: finalStats.handler };
  } else {
    console.log('❌ Test failed: Concurrent retry issues detected');
    return { success: false, reason: 'Concurrent operations failed' };
  }
}

// Main test execution
async function runIntegrationTests() {
  console.log('Starting comprehensive retry handler integration tests...\n');

  // Setup
  console.log('🚀 Test Setup\n');
  cleanup(); // Clean up any previous test artifacts

  const testResults = {};

  try {
    // Run all tests
    const tests = [
      { name: 'immediateSuccess', fn: testImmediateSuccess },
      { name: 'successAfterRetries', fn: testSuccessAfterRetries },
      { name: 'rateLimitHandling', fn: testRateLimitHandling },
      { name: 'nonRetriableErrors', fn: testNonRetriableErrors },
      { name: 'maxRetriesExceeded', fn: testMaxRetriesExceeded },
      { name: 'timeoutHandling', fn: testTimeoutHandling },
      { name: 'retryStatistics', fn: testRetryStatistics },
      { name: 'concurrentRetries', fn: testConcurrentRetries }
    ];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];

      console.log('='.repeat(80));

      const result = await test.fn();
      testResults[test.name] = result;

      if (i < tests.length - 1) {
        console.log('\n⏸️  Waiting 1 second between tests...\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log('\n\n✅ INTEGRATION TEST SUMMARY\n');
    console.log('============================\n');

    const passedTests = Object.values(testResults).filter(result => result.success).length;
    const totalTests = Object.keys(testResults).length;

    console.log(`Overall Result: ${passedTests}/${totalTests} tests passed\n`);

    for (const [testName, result] of Object.entries(testResults)) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const detail = result.success ?
        (result.duration ? `(${result.duration}ms)` : '') :
        `(${result.reason || result.error || 'Unknown error'})`;

      console.log(`  ${testName.padEnd(20)}: ${status} ${detail}`);
    }

    console.log('\n💡 Integration Test Coverage:');
    console.log('  • Immediate success (no retries needed)');
    console.log('  • Success after exponential backoff retries');
    console.log('  • Rate limit handling with extended delays');
    console.log('  • Non-retriable error fast failure');
    console.log('  • Maximum retry exhaustion');
    console.log('  • Timeout handling and cancellation');
    console.log('  • Statistics tracking accuracy');
    console.log('  • Concurrent retry operations');

    if (passedTests === totalTests) {
      console.log('\n🎉 All integration tests passed successfully!');
      console.log('\n🔧 Retry handler is production-ready and fully integrated!');
    } else {
      console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed. Please review the implementation.`);
    }

    return testResults;

  } catch (error) {
    console.error('\n❌ Integration tests failed:', error.message);
    console.error(error.stack);
    return { error: error.message };
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test artifacts...');
    cleanup();
    console.log('✅ Cleanup completed');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Test terminated');
  cleanup();
  process.exit(0);
});

// Run the tests
runIntegrationTests().catch(error => {
  console.error('Fatal error:', error);
  cleanup();
  process.exit(1);
});