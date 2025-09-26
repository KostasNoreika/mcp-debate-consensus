#!/usr/bin/env node

/**
 * Test ultrathink mode
 */

import { ClaudeCliDebate } from './src/claude-cli-debate.js';

async function test() {
  const debate = new ClaudeCliDebate();

  console.log('🧠 Testing ultrathink mode\n');

  try {
    const result = await debate.runDebate(
      'Design a distributed cache system with high availability',
      process.cwd(),
      null,
      { ultrathink: true, bypassCache: true }
    );

    console.log('\n✅ Test completed!');
    console.log('Result preview:', result.substring(0, 300) + '...');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test().catch(console.error);