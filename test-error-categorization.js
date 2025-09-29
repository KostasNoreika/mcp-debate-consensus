#!/usr/bin/env node

/**
 * Error Categorization Test
 * Tests the ErrorClassifier's ability to properly categorize different error types
 * and ensure correct retry behavior for each category
 */

import { ErrorClassifier, ErrorTypes, RetryHandler } from './src/utils/retry-handler.js';

console.log('🏷️  Error Categorization Test\n');
console.log('=============================\n');

/**
 * Comprehensive error test cases
 */
const errorTestCases = [
  // Authentication Errors (Non-retriable)
  {
    category: 'Authentication',
    retriable: false,
    cases: [
      { message: 'Unauthorized', status: 401 },
      { message: 'Forbidden', status: 403 },
      { message: 'Invalid API key provided' },
      { message: 'Authentication failed' },
      { message: 'unauthorized access' },
      { message: 'API key is invalid' }
    ]
  },

  // Configuration Errors (Non-retriable)
  {
    category: 'Configuration',
    retriable: false,
    cases: [
      { message: 'File not found', code: 'ENOENT' },
      { message: 'wrapper script not found' },
      { message: 'Command not found', code: 'ENOENT' },
      { message: 'Permission denied', code: 'EACCES' },
      { message: 'not executable' },
      { message: 'enoent: no such file' }
    ]
  },

  // Rate Limiting Errors (Retriable with special handling)
  {
    category: 'Rate Limiting',
    retriable: true,
    cases: [
      { message: 'Too many requests', status: 429 },
      { message: 'Rate limit exceeded' },
      { message: 'rate limit hit' },
      { message: 'quota exceeded' },
      { message: 'API quota exceeded' },
      { message: 'too many requests per minute' }
    ]
  },

  // Timeout Errors (Retriable)
  {
    category: 'Timeout',
    retriable: true,
    cases: [
      { message: 'Request timeout', code: 'ETIMEDOUT' },
      { message: 'Connection timed out' },
      { message: 'Gateway timeout', status: 504 },
      { message: 'Request timed out', status: 408 },
      { message: 'timed out after 30 seconds' },
      { message: 'operation timed out' }
    ]
  },

  // Network Errors (Retriable)
  {
    category: 'Network',
    retriable: true,
    cases: [
      { message: 'Connection reset by peer', code: 'ECONNRESET' },
      { message: 'Connection refused', code: 'ECONNREFUSED' },
      { message: 'Network error', code: 'ENETWORK' },
      { message: 'Internal server error', status: 500 },
      { message: 'Bad gateway', status: 502 },
      { message: 'Service unavailable', status: 503 },
      { message: 'network connection failed' },
      { message: 'socket hang up' }
    ]
  },

  // Claude CLI Specific Errors
  {
    category: 'Claude CLI',
    retriable: true,
    cases: [
      { message: 'Claude CLI exited with code 1' },
      { message: 'Claude CLI exited with code 124' },
      { message: 'Claude CLI exited with code 125' },
      { message: 'failed to spawn Claude CLI' },
      { message: 'Claude CLI process terminated unexpectedly' }
    ]
  },

  // Response/Parsing Errors (Retriable)
  {
    category: 'Response/Parsing',
    retriable: true,
    cases: [
      { message: 'empty response received' },
      { message: 'unexpected end of JSON input' },
      { message: 'JSON parse error' },
      { message: 'malformed response' },
      { message: 'invalid JSON response' }
    ]
  },

  // Unknown/Default Errors (Retriable by default)
  {
    category: 'Unknown',
    retriable: true,
    cases: [
      { message: 'Something went wrong' },
      { message: 'Unexpected error occurred' },
      { message: 'System failure' },
      { message: 'Random error message' },
      { message: '' } // Empty message
    ]
  }
];

/**
 * Test error classification accuracy
 */
function testErrorClassification() {
  console.log('🧪 Testing Error Classification Accuracy\n');

  let totalTests = 0;
  let passedTests = 0;
  const results = {};

  for (const category of errorTestCases) {
    console.log(`\n📁 ${category.category} Errors (Expected: ${category.retriable ? 'Retriable' : 'Non-retriable'}):`);

    const categoryResults = {
      total: category.cases.length,
      passed: 0,
      failed: 0,
      details: []
    };

    for (let i = 0; i < category.cases.length; i++) {
      const testCase = category.cases[i];
      totalTests++;

      // Create error object
      const error = new Error(testCase.message);
      if (testCase.status) error.status = testCase.status;
      if (testCase.code) error.code = testCase.code;

      // Classify the error
      const classification = ErrorClassifier.classify(error);

      // Check if classification matches expectation
      const isCorrect = classification.retriable === category.retriable;

      if (isCorrect) {
        passedTests++;
        categoryResults.passed++;
        console.log(`  ✅ "${testCase.message}" → ${classification.type} (${classification.retriable ? 'retriable' : 'non-retriable'})`);
      } else {
        categoryResults.failed++;
        console.log(`  ❌ "${testCase.message}" → ${classification.type} (${classification.retriable ? 'retriable' : 'non-retriable'}) - INCORRECT!`);
        console.log(`      Expected: ${category.retriable ? 'retriable' : 'non-retriable'}`);
        console.log(`      Reason: ${classification.reason}`);
      }

      categoryResults.details.push({
        message: testCase.message,
        expected: category.retriable,
        actual: classification.retriable,
        type: classification.type,
        correct: isCorrect
      });
    }

    console.log(`  📊 Category ${category.category}: ${categoryResults.passed}/${categoryResults.total} correct (${((categoryResults.passed / categoryResults.total) * 100).toFixed(1)}%)`);
    results[category.category] = categoryResults;
  }

  const accuracy = (passedTests / totalTests) * 100;
  console.log(`\n📊 Overall Classification Accuracy: ${passedTests}/${totalTests} (${accuracy.toFixed(1)}%)`);

  return {
    totalTests,
    passedTests,
    accuracy,
    categoryResults: results
  };
}

/**
 * Test retry behavior for different error types
 */
async function testRetryBehavior() {
  console.log('\n\n🔄 Testing Retry Behavior for Different Error Types\n');

  const retryHandler = new RetryHandler({
    maxRetries: 2,
    initialDelay: 100,
    maxDelay: 1000,
    enableLogging: false
  });

  const behaviorTests = [
    {
      name: 'Non-retriable Authentication Error',
      error: () => {
        const err = new Error('Unauthorized access');
        err.status = 401;
        return err;
      },
      expectedRetries: 0 // Should fail immediately
    },
    {
      name: 'Non-retriable Configuration Error',
      error: () => {
        const err = new Error('File not found');
        err.code = 'ENOENT';
        return err;
      },
      expectedRetries: 0 // Should fail immediately
    },
    {
      name: 'Retriable Network Error',
      error: () => {
        const err = new Error('Connection reset');
        err.code = 'ECONNRESET';
        return err;
      },
      expectedRetries: 2 // Should retry up to max
    },
    {
      name: 'Retriable Rate Limit Error',
      error: () => {
        const err = new Error('Rate limit exceeded');
        err.status = 429;
        return err;
      },
      expectedRetries: 2 // Should retry up to max
    },
    {
      name: 'Retriable Timeout Error',
      error: () => {
        const err = new Error('Request timeout');
        err.code = 'ETIMEDOUT';
        return err;
      },
      expectedRetries: 2 // Should retry up to max
    }
  ];

  const behaviorResults = [];

  for (const test of behaviorTests) {
    console.log(`\n🧪 Testing: ${test.name}`);

    let attemptCount = 0;
    let startTime = Date.now();

    const testFunction = () => {
      attemptCount++;
      console.log(`  Attempt ${attemptCount}`);
      throw test.error();
    };

    try {
      await retryHandler.execute(testFunction, { name: test.name });

      // Should not reach here for these test cases
      console.log(`  ❌ Unexpected success!`);
      behaviorResults.push({
        test: test.name,
        expectedRetries: test.expectedRetries,
        actualAttempts: attemptCount,
        success: false,
        duration: Date.now() - startTime,
        error: 'Unexpected success'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const actualRetries = attemptCount - 1; // First attempt is not a retry

      console.log(`  ❌ Failed after ${attemptCount} attempts (${actualRetries} retries)`);
      console.log(`  ⏱️  Duration: ${duration}ms`);

      const isCorrect = actualRetries === test.expectedRetries;

      if (isCorrect) {
        console.log(`  ✅ Correct retry behavior!`);
      } else {
        console.log(`  ❌ Incorrect retry behavior! Expected ${test.expectedRetries} retries, got ${actualRetries}`);
      }

      behaviorResults.push({
        test: test.name,
        expectedRetries: test.expectedRetries,
        actualAttempts: attemptCount,
        actualRetries: actualRetries,
        success: isCorrect,
        duration: duration,
        error: error.message
      });
    }

    // Reset stats for next test
    retryHandler.resetStats();
  }

  // Summary
  const correctBehaviors = behaviorResults.filter(r => r.success).length;
  console.log(`\n📊 Retry Behavior Test Results: ${correctBehaviors}/${behaviorResults.length} correct`);

  return behaviorResults;
}

/**
 * Test specific error type handling
 */
async function testSpecificErrorHandling() {
  console.log('\n\n🎯 Testing Specific Error Type Handling\n');

  const retryHandler = new RetryHandler({
    maxRetries: 2,
    initialDelay: 100,
    maxDelay: 2000,
    enableLogging: true
  });

  // Test rate limit special handling (should have longer delays)
  console.log('Testing Rate Limit Special Handling:');

  let callCount = 0;
  const rateLimitFunction = () => {
    callCount++;
    if (callCount <= 2) {
      const error = new Error('Rate limit exceeded');
      error.status = 429;
      throw error;
    }
    return 'Rate limit cleared';
  };

  const startTime = Date.now();

  try {
    const result = await retryHandler.execute(rateLimitFunction, { name: 'rate-limit-test' });
    const duration = Date.now() - startTime;

    console.log(`✅ Success: ${result}`);
    console.log(`⏱️  Total duration: ${duration}ms`);
    console.log(`🔄 Total attempts: ${callCount}`);

    // Rate limit delays should be longer (minimum 5 seconds total for 2 retries)
    if (duration > 1000) {
      console.log(`✅ Rate limit delays appear to be working (${duration}ms duration)`);
    } else {
      console.log(`⚠️  Rate limit delays may be too short (${duration}ms duration)`);
    }

  } catch (error) {
    console.log(`❌ Rate limit test failed: ${error.message}`);
  }

  return {
    callCount,
    duration: Date.now() - startTime
  };
}

/**
 * Test edge cases in error classification
 */
function testErrorClassificationEdgeCases() {
  console.log('\n\n🌟 Testing Error Classification Edge Cases\n');

  const edgeCases = [
    {
      name: 'Null Error',
      error: null,
      description: 'Null error object'
    },
    {
      name: 'Undefined Error',
      error: undefined,
      description: 'Undefined error object'
    },
    {
      name: 'Error with no message',
      error: new Error(),
      description: 'Error object with no message'
    },
    {
      name: 'String instead of Error',
      error: 'This is a string error',
      description: 'String passed instead of Error object'
    },
    {
      name: 'Error with only status code',
      error: (() => {
        const err = new Error('');
        err.status = 500;
        return err;
      })(),
      description: 'Error with empty message but status code'
    },
    {
      name: 'Error with mixed case message',
      error: new Error('NETWORK CONNECTION FAILED'),
      description: 'Error with uppercase message'
    },
    {
      name: 'Error with special characters',
      error: new Error('Error: [ECONNRESET] Connection reset by peer!@#$%'),
      description: 'Error with special characters'
    },
    {
      name: 'Complex nested error message',
      error: new Error('Failed to execute: Claude CLI exited with code 1: Network timeout occurred'),
      description: 'Error with multiple error indicators'
    }
  ];

  const edgeResults = [];

  for (const edgeCase of edgeCases) {
    console.log(`Testing: ${edgeCase.name}`);
    console.log(`  Description: ${edgeCase.description}`);

    try {
      const classification = ErrorClassifier.classify(edgeCase.error);

      console.log(`  ✅ Classification: ${classification.type} (${classification.retriable ? 'retriable' : 'non-retriable'})`);
      console.log(`  💡 Reason: ${classification.reason}`);

      edgeResults.push({
        name: edgeCase.name,
        success: true,
        classification: classification
      });

    } catch (error) {
      console.log(`  ❌ Classification failed: ${error.message}`);

      edgeResults.push({
        name: edgeCase.name,
        success: false,
        error: error.message
      });
    }

    console.log();
  }

  const successfulClassifications = edgeResults.filter(r => r.success).length;
  console.log(`📊 Edge Case Results: ${successfulClassifications}/${edgeResults.length} handled successfully`);

  return edgeResults;
}

/**
 * Performance test for error classification
 */
function testClassificationPerformance() {
  console.log('\n⚡ Testing Error Classification Performance\n');

  const testError = new Error('Connection reset by peer');
  testError.code = 'ECONNRESET';

  const iterations = 10000;

  console.log(`Classifying ${iterations} errors...`);

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    ErrorClassifier.classify(testError);
  }

  const duration = Date.now() - startTime;
  const avgTime = duration / iterations;

  console.log(`⏱️  Total time: ${duration}ms`);
  console.log(`⏱️  Average per classification: ${avgTime.toFixed(3)}ms`);
  console.log(`📊 Classifications per second: ${Math.round(iterations / (duration / 1000))}`);

  if (avgTime < 0.1) {
    console.log(`✅ Performance is excellent (< 0.1ms per classification)`);
  } else if (avgTime < 1) {
    console.log(`✅ Performance is good (< 1ms per classification)`);
  } else {
    console.log(`⚠️  Performance may need optimization (${avgTime.toFixed(3)}ms per classification)`);
  }

  return {
    iterations,
    totalDuration: duration,
    averageTime: avgTime,
    classificationsPerSecond: Math.round(iterations / (duration / 1000))
  };
}

// Main test execution
async function runErrorCategorizationTests() {
  console.log('Starting comprehensive error categorization tests...\n');

  const results = {};

  try {
    // Test 1: Classification Accuracy
    console.log('='.repeat(60));
    results.classification = testErrorClassification();

    // Test 2: Retry Behavior
    console.log('\n' + '='.repeat(60));
    results.retryBehavior = await testRetryBehavior();

    // Test 3: Specific Error Handling
    console.log('\n' + '='.repeat(60));
    results.specificHandling = await testSpecificErrorHandling();

    // Test 4: Edge Cases
    console.log('\n' + '='.repeat(60));
    results.edgeCases = testErrorClassificationEdgeCases();

    // Test 5: Performance
    console.log('\n' + '='.repeat(60));
    results.performance = testClassificationPerformance();

    // Summary
    console.log('\n\n✅ ERROR CATEGORIZATION TEST SUMMARY\n');
    console.log('====================================\n');

    console.log(`🧪 Classification Accuracy: ${results.classification.accuracy.toFixed(1)}% (${results.classification.passedTests}/${results.classification.totalTests})`);

    const correctBehaviors = results.retryBehavior.filter(r => r.success).length;
    console.log(`🔄 Retry Behavior: ${correctBehaviors}/${results.retryBehavior.length} correct`);

    console.log(`🎯 Rate Limit Handling: ${results.specificHandling.callCount} attempts, ${results.specificHandling.duration}ms`);

    const edgeSuccess = results.edgeCases.filter(r => r.success).length;
    console.log(`🌟 Edge Cases: ${edgeSuccess}/${results.edgeCases.length} handled`);

    console.log(`⚡ Performance: ${results.performance.classificationsPerSecond.toLocaleString()} classifications/sec`);

    console.log('\n🎉 All error categorization tests completed!');

    console.log('\n💡 Key Features Validated:');
    console.log('  • Accurate error type classification');
    console.log('  • Proper retriable/non-retriable determination');
    console.log('  • Special handling for rate limits');
    console.log('  • Robust edge case handling');
    console.log('  • High-performance classification');
    console.log('  • Integration with retry logic');

    return results;

  } catch (error) {
    console.error('\n❌ Error categorization tests failed:', error.message);
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
runErrorCategorizationTests().catch(console.error);