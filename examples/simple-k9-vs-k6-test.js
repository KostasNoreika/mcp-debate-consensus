#!/usr/bin/env node

/**
 * Simple comparison test: k9 (Polaris Alpha) vs k6 (GPT-5)
 */

import axios from 'axios';

const QUESTION = `Design a scalable distributed rate limiting system for handling 100,000 requests/second across multiple data centers. Consider: 1) Architecture (centralized vs decentralized), 2) Algorithms (token bucket, leaky bucket, sliding window), 3) Consistency vs latency trade-offs, 4) Failure handling. Provide a comprehensive technical solution.`;

async function testModel(name, port, model) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing ${name} (${model})`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  try {
    const response = await axios.post(`http://localhost:${port}/v1/messages`, {
      messages: [{ role: 'user', content: QUESTION }],
      max_tokens: 4000,
      temperature: 0.7
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000  // 2 minute timeout
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const answer = response.data.content[0].text;
    const tokens = response.data.usage.output_tokens;

    console.log(`\n✅ ${name} completed in ${duration}s`);
    console.log(`Output tokens: ${tokens}`);
    console.log(`\nResponse:`);
    console.log('-'.repeat(80));
    console.log(answer);
    console.log('-'.repeat(80));

    return {
      name,
      model,
      success: true,
      duration: parseFloat(duration),
      tokens,
      answerLength: answer.length,
      answer
    };

  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.error(`\n❌ ${name} failed after ${duration}s:`, error.response?.data?.error?.message || error.message);

    return {
      name,
      model,
      success: false,
      duration: parseFloat(duration),
      error: error.response?.data?.error?.message || error.message
    };
  }
}

async function runComparison() {
  console.log('🔬 K9 (Polaris Alpha) vs K6 (GPT-5) Comparison Test');
  console.log('Question:', QUESTION.substring(0, 100) + '...\n');

  // Test both models
  const k9Result = await testModel('k9 (Polaris Alpha)', 3465, 'openrouter/polaris-alpha');
  const k6Result = await testModel('k6 (GPT-5)', 3462, 'openai/gpt-5');

  // Print comparison
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80));

  if (k9Result.success && k6Result.success) {
    console.log('\n🏁 Speed:');
    console.log(`  k9 (Polaris):  ${k9Result.duration}s`);
    console.log(`  k6 (GPT-5):    ${k6Result.duration}s`);
    const speedup = (k6Result.duration / k9Result.duration).toFixed(2);
    console.log(`  → k9 is ${speedup}x ${speedup > 1 ? 'faster' : 'slower'} than k6`);

    console.log('\n📝 Output:');
    console.log(`  k9 tokens:     ${k9Result.tokens}`);
    console.log(`  k6 tokens:     ${k6Result.tokens}`);
    console.log(`  k9 chars:      ${k9Result.answerLength}`);
    console.log(`  k6 chars:      ${k6Result.answerLength}`);

    console.log('\n🏆 Winner:');
    // Speed is important, but also completeness
    const k9Score = (1 / k9Result.duration) * 50 + k9Result.tokens * 0.5;
    const k6Score = (1 / k6Result.duration) * 50 + k6Result.tokens * 0.5;

    if (k9Score > k6Score) {
      console.log('  🥇 k9 (Polaris Alpha)');
      console.log(`     Score: ${k9Score.toFixed(2)} vs ${k6Score.toFixed(2)}`);
    } else {
      console.log('  🥇 k6 (GPT-5)');
      console.log(`     Score: ${k6Score.toFixed(2)} vs ${k9Score.toFixed(2)}`);
    }
  } else if (k9Result.success) {
    console.log('\n🏆 Winner: k9 (Polaris Alpha) - k6 failed');
  } else if (k6Result.success) {
    console.log('\n🏆 Winner: k6 (GPT-5) - k9 failed');
  } else {
    console.log('\n❌ Both models failed');
  }

  console.log('\n' + '='.repeat(80));
  console.log('Test completed!');
  console.log('='.repeat(80) + '\n');
}

runComparison().catch(console.error);
