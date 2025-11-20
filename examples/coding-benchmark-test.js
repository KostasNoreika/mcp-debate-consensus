#!/usr/bin/env node

/**
 * Coding Benchmark Test: Polaris Alpha vs Top Models
 * Tests multiple models on a real-world programming challenge
 */

import axios from 'axios';
import { promises as fs } from 'fs';

const CODING_CHALLENGE = `You are a senior software engineer. Implement a high-performance LRU (Least Recently Used) cache in TypeScript with the following requirements:

Requirements:
1. O(1) time complexity for get() and put() operations
2. Thread-safe with proper TypeScript types
3. Support for TTL (Time To Live) per entry
4. Automatic cleanup of expired entries
5. Memory-efficient implementation
6. Generic type support for keys and values
7. Optional eviction callback when items are removed
8. Comprehensive error handling

Additional features:
- Get cache statistics (hits, misses, evictions)
- Clear cache
- Get current size and capacity
- Check if key exists

Provide:
1. Complete TypeScript implementation
2. Full type definitions
3. Unit tests using Jest
4. Performance analysis comments
5. Usage examples

Write production-ready code with proper documentation.`;

const models = [
  { name: 'K9 - Polaris Alpha', alias: 'k9', port: 3465, model: 'openrouter/polaris-alpha' },
  { name: 'K1 - Claude Sonnet 4.5 Thinking', alias: 'k1', port: 3457, model: 'anthropic/claude-sonnet-4.5' },
  { name: 'K2 - GPT-5', alias: 'k2', port: 3458, model: 'openai/gpt-5' },
  { name: 'K5 - Grok 4 Fast', alias: 'k5', port: 3461, model: 'x-ai/grok-4-fast' }
];

async function testModel(modelInfo) {
  const { name, alias, port, model } = modelInfo;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing ${name}`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  try {
    const response = await axios.post(`http://localhost:${port}/v1/messages`, {
      messages: [{ role: 'user', content: CODING_CHALLENGE }],
      max_tokens: 4000,
      temperature: 0.3  // Lower temperature for code generation
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 180000  // 3 minute timeout
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const answer = response.data.content[0].text;
    const tokens = response.data.usage.output_tokens;

    // Analyze code quality
    const hasTypeScript = answer.includes('interface') || answer.includes('type ');
    const hasTests = answer.includes('describe(') || answer.includes('test(') || answer.includes('it(');
    const hasGenerics = answer.includes('<K,') || answer.includes('<K ');
    const hasComments = (answer.match(/\/\//g) || []).length > 5;
    const hasClassImplementation = answer.includes('class LRU') || answer.includes('class Cache');
    const codeBlocks = (answer.match(/```/g) || []).length / 2;

    console.log(`\n✅ ${name} completed in ${duration}s`);
    console.log(`Output tokens: ${tokens}`);
    console.log(`\nCode Quality Metrics:`);
    console.log(`  TypeScript types: ${hasTypeScript ? '✅' : '❌'}`);
    console.log(`  Unit tests: ${hasTests ? '✅' : '❌'}`);
    console.log(`  Generic types: ${hasGenerics ? '✅' : '❌'}`);
    console.log(`  Documentation: ${hasComments ? '✅' : '❌'}`);
    console.log(`  Class implementation: ${hasClassImplementation ? '✅' : '❌'}`);
    console.log(`  Code blocks: ${codeBlocks}`);

    const qualityScore = (hasTypeScript ? 20 : 0) +
                        (hasTests ? 25 : 0) +
                        (hasGenerics ? 15 : 0) +
                        (hasComments ? 15 : 0) +
                        (hasClassImplementation ? 15 : 0) +
                        (codeBlocks >= 3 ? 10 : 0);

    console.log(`  Quality Score: ${qualityScore}/100`);

    // Save response
    await fs.writeFile(`/opt/mcp/servers/debate-consensus/${alias}-coding-response.txt`, answer);

    return {
      name,
      alias,
      model,
      success: true,
      duration: parseFloat(duration),
      tokens,
      answerLength: answer.length,
      metrics: {
        hasTypeScript,
        hasTests,
        hasGenerics,
        hasComments,
        hasClassImplementation,
        codeBlocks
      },
      qualityScore,
      answer
    };

  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.error(`\n❌ ${name} failed after ${duration}s:`, error.response?.data?.error?.message || error.message);

    return {
      name,
      alias,
      model,
      success: false,
      duration: parseFloat(duration),
      error: error.response?.data?.error?.message || error.message
    };
  }
}

async function runBenchmark() {
  console.log('🚀 CODING BENCHMARK TEST');
  console.log('='.repeat(80));
  console.log('Testing: Polaris Alpha vs Top Models');
  console.log('Challenge: LRU Cache Implementation in TypeScript');
  console.log('='.repeat(80));
  console.log('\nTask:', CODING_CHALLENGE.substring(0, 200) + '...\n');

  const results = [];

  // Test all models
  for (const modelInfo of models) {
    const result = await testModel(modelInfo);
    results.push(result);
  }

  // Generate comparison report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 BENCHMARK RESULTS');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);

  if (successful.length > 0) {
    // Sort by quality score
    successful.sort((a, b) => b.qualityScore - a.qualityScore);

    console.log('\n🏆 Rankings (by code quality):');
    successful.forEach((r, idx) => {
      console.log(`\n${idx + 1}. ${r.name}`);
      console.log(`   Quality Score: ${r.qualityScore}/100`);
      console.log(`   Speed: ${r.duration}s`);
      console.log(`   Tokens: ${r.tokens}`);
      console.log(`   Efficiency: ${(r.tokens / r.duration).toFixed(2)} tok/s`);
    });

    console.log('\n\n⚡ Speed Rankings:');
    const bySpeed = [...successful].sort((a, b) => a.duration - b.duration);
    bySpeed.forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.name}: ${r.duration}s`);
    });

    console.log('\n\n📝 Code Quality Details:');
    successful.forEach(r => {
      console.log(`\n${r.name}:`);
      console.log(`  TypeScript: ${r.metrics.hasTypeScript ? '✅' : '❌'}`);
      console.log(`  Tests: ${r.metrics.hasTests ? '✅' : '❌'}`);
      console.log(`  Generics: ${r.metrics.hasGenerics ? '✅' : '❌'}`);
      console.log(`  Docs: ${r.metrics.hasComments ? '✅' : '❌'}`);
      console.log(`  Implementation: ${r.metrics.hasClassImplementation ? '✅' : '❌'}`);
    });

    // Generate summary table
    console.log('\n\n📋 Summary Table:');
    console.log('| Model | Quality | Speed | Tokens | TS | Tests | Generics |');
    console.log('|-------|---------|-------|--------|----|----|----------|');
    successful.forEach(r => {
      console.log(`| ${r.alias.toUpperCase()} | ${r.qualityScore}/100 | ${r.duration}s | ${r.tokens} | ${r.metrics.hasTypeScript ? '✅' : '❌'} | ${r.metrics.hasTests ? '✅' : '❌'} | ${r.metrics.hasGenerics ? '✅' : '❌'} |`);
    });

    // Generate markdown report
    const markdown = `# Coding Benchmark: LRU Cache Implementation

## Test Details
- **Challenge**: Implement production-ready LRU Cache in TypeScript
- **Requirements**: O(1) operations, TTL support, thread-safety, generics, tests
- **Models Tested**: ${models.length}
- **Temperature**: 0.3 (optimized for code generation)

## Results

### Overall Rankings

${successful.map((r, idx) => `${idx + 1}. **${r.name}** - Quality: ${r.qualityScore}/100, Speed: ${r.duration}s`).join('\n')}

### Detailed Comparison

| Model | Quality Score | Speed | Tokens | TypeScript | Tests | Generics | Documentation |
|-------|--------------|-------|--------|------------|-------|----------|---------------|
${successful.map(r => `| ${r.alias.toUpperCase()} | ${r.qualityScore}/100 | ${r.duration}s | ${r.tokens} | ${r.metrics.hasTypeScript ? '✅' : '❌'} | ${r.metrics.hasTests ? '✅' : '❌'} | ${r.metrics.hasGenerics ? '✅' : '❌'} | ${r.metrics.hasComments ? '✅' : '❌'} |`).join('\n')}

### Winner: ${successful[0].name}

**Victory Margin**: ${successful[0].qualityScore - (successful[1]?.qualityScore || 0)} points

**Key Strengths**:
${successful[0].metrics.hasTypeScript ? '- ✅ Full TypeScript implementation\n' : ''}${successful[0].metrics.hasTests ? '- ✅ Comprehensive unit tests\n' : ''}${successful[0].metrics.hasGenerics ? '- ✅ Generic type support\n' : ''}${successful[0].metrics.hasComments ? '- ✅ Well-documented code\n' : ''}${successful[0].metrics.hasClassImplementation ? '- ✅ Clean class-based implementation\n' : ''}
### Speed Comparison

${bySpeed.map((r, idx) => `${idx + 1}. ${r.name}: ${r.duration}s (${(r.tokens / r.duration).toFixed(2)} tok/s)`).join('\n')}

## Test Methodology

1. **Same prompt** sent to all models
2. **Temperature**: 0.3 for consistent code generation
3. **Max tokens**: 4000
4. **Quality metrics**: TypeScript types, tests, generics, documentation, implementation quality
5. **Automatic scoring**: 0-100 based on code completeness

## Full Responses

${successful.map(r => `- [${r.alias}-coding-response.txt](${r.alias}-coding-response.txt)`).join('\n')}
`;

    await fs.writeFile('/opt/mcp/servers/debate-consensus/CODING-BENCHMARK-RESULTS.md', markdown);
    console.log('\n\n📄 Full report saved to: CODING-BENCHMARK-RESULTS.md');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Benchmark completed!');
  console.log('='.repeat(80) + '\n');
}

runBenchmark().catch(console.error);
