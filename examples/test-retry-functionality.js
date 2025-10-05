#!/usr/bin/env node

/**
 * Test script to demonstrate retry functionality
 * Shows various failure scenarios and retry behavior
 */

import { RetryHandler, ErrorClassifier, ErrorTypes } from './src/utils/retry-handler.js';

console.log('🔄 Retry Handler Functionality Test\n');
console.log('=====================================\n');

// Test configuration
const retryConfig = {
  maxRetries: 3,
  initialDelay: 500, // 0.5 seconds for faster testing
  maxDelay: 5000,
  backoffMultiplier: 2,
  enableLogging: true
};

const retryHandler = new RetryHandler(retryConfig);

// Test scenarios
const testScenarios = [
  {
    name: 'Immediate Success',
    description: 'Function succeeds on first attempt',
    fn: async () => {
      console.log('  ✅ Executing successfully...');
      return 'Success!';
    }
  },
  {
    name: 'Temporary Network Failure',
    description: 'Fails twice with network error, then succeeds',
    fn: (() => {
      let attempt = 0;
      return async () => {
        attempt++;
        console.log(`  🔄 Attempt ${attempt}`);

        if (attempt <= 2) {
          const error = new Error('Network connection failed');
          error.code = 'ECONNRESET';
          throw error;
        }

        return 'Network recovered!';
      };
    })()
  },
  {
    name: 'Rate Limit Recovery',
    description: 'Rate limited, then succeeds with longer delay',
    fn: (() => {
      let attempt = 0;
      return async () => {
        attempt++;
        console.log(`  🔄 Rate limit attempt ${attempt}`);

        if (attempt === 1) {
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        }

        return 'Rate limit cleared!';
      };
    })()
  },
  {
    name: 'Authentication Failure',
    description: 'Non-retriable authentication error',
    fn: async () => {
      console.log('  ❌ Authentication failing...');
      const error = new Error('Invalid API key');
      error.status = 401;
      throw error;
    }
  },
  {
    name: 'Configuration Error',
    description: 'Non-retriable configuration error',
    fn: async () => {
      console.log('  ❌ Configuration error...');
      const error = new Error('Wrapper script not found');
      error.code = 'ENOENT';
      throw error;
    }
  },
  {
    name: 'Persistent Failure',
    description: 'Fails all retry attempts',
    fn: async () => {
      console.log('  ❌ Persistent failure...');
      throw new Error('Service permanently unavailable');
    }
  },
  {
    name: 'Claude CLI Exit Code 1',
    description: 'Claude CLI process exits with retriable code',
    fn: (() => {
      let attempt = 0;
      return async () => {
        attempt++;
        console.log(`  🔄 Claude CLI attempt ${attempt}`);

        if (attempt <= 1) {
          throw new Error('Claude CLI exited with code 1');
        }

        return 'Claude CLI recovered!';
      };
    })()
  }
];

// Run test scenarios
async function runTestScenarios() {
  console.log(`Running ${testScenarios.length} test scenarios...\n`);

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];

    console.log(`\n${i + 1}. ${scenario.name}`);
    console.log(`   ${scenario.description}\n`);

    const startTime = Date.now();

    try {
      const result = await retryHandler.execute(scenario.fn, {
        name: scenario.name,
        context: { scenarioIndex: i }
      });

      const duration = Date.now() - startTime;
      console.log(`   ✅ Result: ${result}`);
      console.log(`   ⏱️  Duration: ${duration}ms`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ Failed: ${error.message}`);
      console.log(`   ⏱️  Duration: ${duration}ms`);

      if (error.name === 'RetryError') {
        const details = error.getDetails();
        console.log(`   📊 Error Type: ${details.errorType}`);
        console.log(`   🔄 Attempts: ${details.attemptCount}`);
        console.log(`   💡 Reason: ${details.reason}`);
      }
    }

    console.log('   ' + '─'.repeat(50));
  }
}

// Error classification demonstration
function demonstrateErrorClassification() {
  console.log('\n\n🏷️  Error Classification Examples\n');
  console.log('=====================================\n');

  const errorExamples = [
    new Error('Network timeout'),
    (() => { const e = new Error('Unauthorized'); e.status = 401; return e; })(),
    (() => { const e = new Error('Too many requests'); e.status = 429; return e; })(),
    (() => { const e = new Error('Connection reset'); e.code = 'ECONNRESET'; return e; })(),
    (() => { const e = new Error('File not found'); e.code = 'ENOENT'; return e; })(),
    new Error('Claude CLI exited with code 1'),
    new Error('Internal server error'),
    new Error('Some unknown error')
  ];

  errorExamples.forEach((error, index) => {
    const classification = ErrorClassifier.classify(error);

    console.log(`${index + 1}. "${error.message}"`);
    console.log(`   Type: ${classification.type}`);
    console.log(`   Retriable: ${classification.retriable ? '✅ Yes' : '❌ No'}`);
    console.log(`   Reason: ${classification.reason}`);
    console.log('');
  });
}

// Retry statistics demonstration
function showRetryStatistics() {
  console.log('\n📊 Final Retry Statistics\n');
  console.log('==========================\n');

  const stats = retryHandler.getStats();

  console.log(`Total Attempts: ${stats.totalAttempts}`);
  console.log(`Success Rate: ${Math.round(stats.successRate * 100)}%`);
  console.log(`Average Retry Count: ${stats.avgRetryCount.toFixed(2)}`);
  console.log(`Maximum Retry Count: ${stats.maxRetryCount}`);
  console.log(`Average Retry Time: ${Math.round(stats.avgRetryTime)}ms`);

  if (Object.keys(stats.errorBreakdown).length > 0) {
    console.log('\nError Breakdown:');
    Object.entries(stats.errorBreakdown).forEach(([errorType, count]) => {
      console.log(`  ${errorType}: ${count} occurrences`);
    });
  }
}

// Configuration demonstration
function demonstrateConfiguration() {
  console.log('\n\n⚙️  Configuration Management\n');
  console.log('=============================\n');

  console.log('Current Configuration:');
  console.log(JSON.stringify(retryHandler.config, null, 2));

  console.log('\nUpdating configuration...');
  retryHandler.updateConfig({
    maxRetries: 5,
    initialDelay: 1000
  });

  console.log('\nUpdated Configuration:');
  console.log(`Max Retries: ${retryHandler.config.maxRetries}`);
  console.log(`Initial Delay: ${retryHandler.config.initialDelay}ms`);
}

// Main execution
async function main() {
  try {
    await runTestScenarios();
    demonstrateErrorClassification();
    showRetryStatistics();
    demonstrateConfiguration();

    console.log('\n✅ Retry functionality test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Test terminated');
  process.exit(0);
});

// Run the tests
main().catch(console.error);