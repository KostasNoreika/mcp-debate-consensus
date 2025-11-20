#!/usr/bin/env node

/**
 * K9 (Polaris Alpha) vs K4 (Gemini 2.5 Pro)
 * Quick comparison test on architecture challenge
 */

import axios from 'axios';

const QUESTION = `Design a high-performance distributed rate limiting system for handling 100,000 requests per second across multiple global data centers.

Requirements:
1. Architecture approach (centralized vs decentralized)
2. Algorithm selection (token bucket, leaky bucket, sliding window)
3. Consistency vs latency trade-offs
4. Failure handling strategies
5. Technology recommendations

Provide a concise but comprehensive technical solution with specific implementation details.`;

async function testModel(name, port, model) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing ${name}`);
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
    console.log(`Characters: ${answer.length}`);

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
  console.log('🔬 K9 (Polaris Alpha) vs K4 (Gemini 2.5 Pro)');
  console.log('='.repeat(80));

  const k9Result = await testModel('K9 - Polaris Alpha', 3465, 'openrouter/polaris-alpha');
  const k4Result = await testModel('K4 - Gemini 2.5 Pro', 3460, 'google/gemini-2.5-pro');

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RESULTS');
  console.log('='.repeat(80));

  if (k9Result.success && k4Result.success) {
    console.log('\n⚡ Speed:');
    console.log(`  K9: ${k9Result.duration}s`);
    console.log(`  K4: ${k4Result.duration}s`);
    const faster = k9Result.duration < k4Result.duration ? 'K9' : 'K4';
    console.log(`  Winner: ${faster}`);

    console.log('\n📝 Output:');
    console.log(`  K9: ${k9Result.tokens} tokens, ${k9Result.answerLength} chars`);
    console.log(`  K4: ${k4Result.tokens} tokens, ${k4Result.answerLength} chars`);

    console.log('\n💰 Efficiency:');
    console.log(`  K9: ${(k9Result.tokens / k9Result.duration).toFixed(2)} tok/s`);
    console.log(`  K4: ${(k4Result.tokens / k4Result.duration).toFixed(2)} tok/s`);

    const k9Score = (1 / k9Result.duration) * 50 + k9Result.tokens * 0.5;
    const k4Score = (1 / k4Result.duration) * 50 + k4Result.tokens * 0.5;

    console.log('\n🏆 Overall Winner:');
    if (k9Score > k4Score) {
      console.log(`  K9 (Polaris Alpha) - Score: ${k9Score.toFixed(2)} vs ${k4Score.toFixed(2)}`);
    } else {
      console.log(`  K4 (Gemini 2.5 Pro) - Score: ${k4Score.toFixed(2)} vs ${k9Score.toFixed(2)}`);
    }
  } else if (k9Result.success) {
    console.log('\n🏆 Winner: K9 (Polaris Alpha) - K4 failed');
  } else if (k4Result.success) {
    console.log('\n🏆 Winner: K4 (Gemini 2.5 Pro) - K9 failed');
  } else {
    console.log('\n❌ Both failed');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

runComparison().catch(console.error);
