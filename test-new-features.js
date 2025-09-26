#!/usr/bin/env node

/**
 * Test script for new debate-consensus features:
 * - k7 and k8 models
 * - ultrathink mode
 * - budget mode
 */

import { ClaudeCliDebate } from './src/claude-cli-debate.js';

async function runTests() {
  const debate = new ClaudeCliDebate();

  console.log('🧪 Testing new debate-consensus features\n');
  console.log('='.repeat(70));

  try {
    // Test 1: Basic test with k7 and k8 in budget mode
    console.log('\n📝 Test 1: Budget mode with k7 and k8 models');
    console.log('-'.repeat(50));

    const budgetResult = await debate.runDebate(
      'Write a simple function to check if a number is prime',
      process.cwd(),
      null,
      { mode: 'budget' }
    );

    console.log('\n✅ Budget mode test completed');
    console.log('Result length:', budgetResult.length);

    // Test 2: Ultrathink mode with k1
    console.log('\n📝 Test 2: Ultrathink mode for deep reasoning');
    console.log('-'.repeat(50));

    const ultrathinkResult = await debate.runDebate(
      'Design a scalable microservices architecture for an e-commerce platform',
      process.cwd(),
      null,
      { ultrathink: true }
    );

    console.log('\n✅ Ultrathink test completed');
    console.log('Result length:', ultrathinkResult.length);

    // Test 3: Combined - budget mode with ultrathink
    console.log('\n📝 Test 3: Budget mode + ultrathink (k1 with deep reasoning)');
    console.log('-'.repeat(50));

    const combinedResult = await debate.runDebate(
      'Optimize this sorting algorithm for performance',
      process.cwd(),
      null,
      { mode: 'budget', ultrathink: true }
    );

    console.log('\n✅ Combined test completed');
    console.log('Result length:', combinedResult.length);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);