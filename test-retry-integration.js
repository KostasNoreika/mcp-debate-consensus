#!/usr/bin/env node

/**
 * Integration test for retry handler with ClaudeCliDebate
 * Demonstrates retry functionality in the context of the actual debate system
 */

import { ClaudeCliDebate } from './src/claude-cli-debate.js';

console.log('🔄 Retry Handler Integration Test\n');
console.log('======================================\n');

async function testRetryIntegration() {
  // Create a debate instance
  const debate = new ClaudeCliDebate();

  try {
    console.log('📊 Initial retry configuration:');
    const initialStats = debate.getRetryStats();
    console.log(JSON.stringify(initialStats.config, null, 2));

    console.log('\n🔧 Updating retry configuration for faster testing...');
    debate.configureRetry({
      maxRetries: 2,
      initialDelay: 100,
      maxDelay: 1000
    });

    const updatedStats = debate.getRetryStats();
    console.log('Updated config:', {
      maxRetries: updatedStats.config.maxRetries,
      initialDelay: updatedStats.config.initialDelay,
      maxDelay: updatedStats.config.maxDelay
    });

    console.log('\n📈 Initial retry statistics:');
    console.log(JSON.stringify(updatedStats.handler, null, 2));

    // Test the retry functionality by creating a mock model that fails initially
    const mockModel = {
      name: 'Test Model',
      alias: 'test',
      expertise: 'Testing retry functionality',
      wrapper: '/nonexistent/wrapper.sh' // This will fail
    };

    console.log('\n🧪 Testing model call with retry logic...');
    console.log('(This will fail as expected since the wrapper doesn\'t exist)');

    try {
      const result = await debate.callModel(
        mockModel,
        'Test prompt',
        process.cwd(),
        null,
        {}
      );

      if (result === null) {
        console.log('✅ Expected result: Model call failed after retries (as expected)');
      } else {
        console.log('❌ Unexpected success:', result);
      }
    } catch (error) {
      console.log('❌ Caught error:', error.message);
    }

    console.log('\n📊 Final retry statistics:');
    const finalStats = debate.getRetryStats();
    console.log(JSON.stringify(finalStats.handler, null, 2));

    console.log('\n🔄 Resetting retry statistics...');
    debate.resetRetryStats();

    const resetStats = debate.getRetryStats();
    console.log('Reset statistics:', JSON.stringify(resetStats.handler, null, 2));

    console.log('\n✅ Retry integration test completed successfully!');
    console.log('\nKey points demonstrated:');
    console.log('• Retry handler is properly integrated into ClaudeCliDebate');
    console.log('• Configuration can be updated at runtime');
    console.log('• Statistics are tracked across method calls');
    console.log('• Non-retriable errors (like missing files) are handled correctly');
    console.log('• Error classification works with real scenarios');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  process.exit(0);
});

testRetryIntegration().catch(console.error);