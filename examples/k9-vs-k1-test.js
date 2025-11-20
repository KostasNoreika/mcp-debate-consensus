#!/usr/bin/env node

/**
 * K9 (Polaris Alpha) vs K1 (Claude Sonnet 4.5 Thinking)
 * The ultimate test: new cloaked model vs proven champion
 */

import axios from 'axios';

const QUESTION = `Design a high-performance distributed rate limiting system capable of handling 100,000 requests per second across multiple global data centers. Your solution must address:

1. Architecture: Compare centralized vs decentralized approaches, and justify your recommendation
2. Algorithms: Evaluate token bucket, leaky bucket, and sliding window algorithms
3. Consistency vs Latency: How do you balance global accuracy with low-latency local decisions?
4. Data structures: What data structures optimize for both speed and memory?
5. Failure handling: Network partitions, node failures, control plane outages
6. Implementation: Provide concrete technology choices and deployment patterns

Deliver a production-ready, comprehensive technical design with specific implementation details.`;

async function testModel(name, port, model) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing ${name}`);
  console.log(`Model: ${model}`);
  console.log(`Port: ${port}`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  try {
    const response = await axios.post(`http://localhost:${port}/v1/messages`, {
      messages: [{ role: 'user', content: QUESTION }],
      max_tokens: 4000,
      temperature: 0.7
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 180000  // 3 minute timeout for thinking models
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const answer = response.data.content[0].text;
    const tokens = response.data.usage.output_tokens;

    console.log(`\n✅ ${name} completed in ${duration}s`);
    console.log(`Output tokens: ${tokens}`);
    console.log(`Characters: ${answer.length}`);
    console.log(`\nFirst 500 chars of response:`);
    console.log('-'.repeat(80));
    console.log(answer.substring(0, 500));
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
  console.log('🥊 THE ULTIMATE SHOWDOWN');
  console.log('='.repeat(80));
  console.log('K9 (Polaris Alpha) vs K1 (Claude Sonnet 4.5 Thinking)');
  console.log('='.repeat(80));
  console.log('\nQuestion:', QUESTION.substring(0, 150) + '...\n');

  // Test both models
  const k9Result = await testModel('K9 - Polaris Alpha', 3465, 'openrouter/polaris-alpha');
  const k1Result = await testModel('K1 - Claude Sonnet 4.5 Thinking', 3457, 'anthropic/claude-sonnet-4.5');

  // Print comparison
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80));

  if (k9Result.success && k1Result.success) {
    console.log('\n⚡ Speed:');
    console.log(`  K9 (Polaris):      ${k9Result.duration}s`);
    console.log(`  K1 (Sonnet 4.5):   ${k1Result.duration}s`);
    const speedRatio = (k1Result.duration / k9Result.duration).toFixed(2);
    if (k9Result.duration < k1Result.duration) {
      console.log(`  → K9 is ${speedRatio}x FASTER than K1 🚀`);
    } else {
      console.log(`  → K1 is ${(k9Result.duration / k1Result.duration).toFixed(2)}x FASTER than K9`);
    }

    console.log('\n📝 Output Quality:');
    console.log(`  K9 tokens:         ${k9Result.tokens}`);
    console.log(`  K1 tokens:         ${k1Result.tokens}`);
    console.log(`  K9 characters:     ${k9Result.answerLength}`);
    console.log(`  K1 characters:     ${k1Result.answerLength}`);

    const tokenDiff = ((k9Result.tokens - k1Result.tokens) / k1Result.tokens * 100).toFixed(1);
    if (k9Result.tokens > k1Result.tokens) {
      console.log(`  → K9 produced ${tokenDiff}% MORE content than K1`);
    } else {
      console.log(`  → K1 produced ${Math.abs(tokenDiff)}% MORE content than K9`);
    }

    console.log('\n💰 Efficiency (tokens per second):');
    const k9Efficiency = (k9Result.tokens / k9Result.duration).toFixed(2);
    const k1Efficiency = (k1Result.tokens / k1Result.duration).toFixed(2);
    console.log(`  K9:                ${k9Efficiency} tok/s`);
    console.log(`  K1:                ${k1Efficiency} tok/s`);

    console.log('\n🏆 Overall Winner:');
    // Scoring:
    // - Speed: 40% (faster is better)
    // - Content: 30% (more comprehensive is better)
    // - Efficiency: 30% (tokens/sec)

    const k9SpeedScore = (1 / k9Result.duration) * 1000; // normalize
    const k1SpeedScore = (1 / k1Result.duration) * 1000;

    const k9Score = (k9SpeedScore / (k9SpeedScore + k1SpeedScore)) * 40 +
                    (k9Result.tokens / (k9Result.tokens + k1Result.tokens)) * 30 +
                    (parseFloat(k9Efficiency) / (parseFloat(k9Efficiency) + parseFloat(k1Efficiency))) * 30;

    const k1Score = (k1SpeedScore / (k9SpeedScore + k1SpeedScore)) * 40 +
                    (k1Result.tokens / (k9Result.tokens + k1Result.tokens)) * 30 +
                    (parseFloat(k1Efficiency) / (parseFloat(k9Efficiency) + parseFloat(k1Efficiency))) * 30;

    console.log(`  K9 Score: ${k9Score.toFixed(2)}/100`);
    console.log(`  K1 Score: ${k1Score.toFixed(2)}/100`);

    if (k9Score > k1Score) {
      const margin = k9Score - k1Score;
      console.log(`\n  🥇 WINNER: K9 (Polaris Alpha)`);
      console.log(`     Victory margin: ${margin.toFixed(2)} points`);
      if (margin > 10) {
        console.log('     Verdict: CLEAR SUPERIOR PERFORMANCE! 🔥');
      } else if (margin > 5) {
        console.log('     Verdict: Strong performance edge');
      } else {
        console.log('     Verdict: Narrow victory, both excellent');
      }
    } else {
      const margin = k1Score - k9Score;
      console.log(`\n  🥇 WINNER: K1 (Claude Sonnet 4.5 Thinking)`);
      console.log(`     Victory margin: ${margin.toFixed(2)} points`);
      if (margin > 10) {
        console.log('     Verdict: Claude maintains dominance! 👑');
      } else if (margin > 5) {
        console.log('     Verdict: Proven champion prevails');
      } else {
        console.log('     Verdict: Very close match, both excellent');
      }
    }

    // Save full responses for manual review
    console.log('\n📄 Full responses saved to:');
    const fs = await import('fs/promises');
    await fs.writeFile('/opt/mcp/servers/debate-consensus/k9-response.txt', k9Result.answer);
    await fs.writeFile('/opt/mcp/servers/debate-consensus/k1-response.txt', k1Result.answer);
    console.log('  - k9-response.txt (Polaris Alpha)');
    console.log('  - k1-response.txt (Claude Sonnet 4.5)');

  } else if (k9Result.success) {
    console.log('\n🏆 Winner: K9 (Polaris Alpha) - K1 failed');
  } else if (k1Result.success) {
    console.log('\n🏆 Winner: K1 (Claude Sonnet 4.5) - K9 failed');
  } else {
    console.log('\n❌ Both models failed');
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 Test completed!');
  console.log('='.repeat(80) + '\n');
}

runComparison().catch(console.error);
