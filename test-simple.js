#!/usr/bin/env node

/**
 * Simple test for new features
 */

import { ClaudeCliDebate } from './src/claude-cli-debate.js';

async function test() {
  const debate = new ClaudeCliDebate();

  console.log('🧪 Testing budget mode with k7 and k8\n');

  try {
    const result = await debate.runDebate(
      'What is 2 + 2?',
      process.cwd(),
      null,
      { mode: 'budget', bypassCache: true }
    );

    console.log('\n✅ Test completed!');
    console.log('Result:', result.substring(0, 200));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test().catch(console.error);