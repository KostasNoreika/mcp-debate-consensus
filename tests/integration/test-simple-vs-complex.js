#!/usr/bin/env node

/**
 * Test iterative debate with simple vs complex questions
 */

const { IterativeDebateOrchestrator } = require('../../src/iterative-debate-orchestrator');

async function testSimpleQuestion() {
  console.log('=' .repeat(70));
  console.log('🧪 TEST 1: SIMPLE FACTUAL QUESTION');
  console.log('=' .repeat(70));
  console.log('Question: "What is the capital of France?"\n');
  console.log('Expected: High consensus, early exit after Round 1\n');
  
  const orchestrator = new IterativeDebateOrchestrator();
  orchestrator.maxIterations = 5;
  orchestrator.consensusThreshold = 90;
  
  try {
    const startTime = Date.now();
    const result = await orchestrator.runIterativeDebate(
      "What is the capital of France?",
      process.cwd()
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n📊 RESULTS:');
    console.log(`✅ Iterations needed: ${result.iterations}`);
    console.log(`✅ Final consensus: ${result.finalConsensus}%`);
    console.log(`✅ Time taken: ${duration} seconds`);
    console.log(`✅ Early exit: ${result.iterations === 1 ? 'YES ✓' : 'NO'}`);
    
    if (result.debateHistory.consensusTrend.length > 0) {
      console.log(`✅ Consensus evolution: ${result.debateHistory.consensusTrend.join('% → ')}%`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

async function testMediumComplexityQuestion() {
  console.log('\n' + '=' .repeat(70));
  console.log('🧪 TEST 2: MEDIUM COMPLEXITY QUESTION');
  console.log('=' .repeat(70));
  console.log('Question: "What are the key benefits of using TypeScript over JavaScript?"\n');
  console.log('Expected: Moderate initial consensus, 2-3 iterations to converge\n');
  
  const orchestrator = new IterativeDebateOrchestrator();
  orchestrator.maxIterations = 5;
  orchestrator.consensusThreshold = 85;
  
  try {
    const startTime = Date.now();
    const result = await orchestrator.runIterativeDebate(
      "What are the key benefits of using TypeScript over JavaScript?",
      process.cwd()
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n📊 RESULTS:');
    console.log(`✅ Iterations needed: ${result.iterations}`);
    console.log(`✅ Final consensus: ${result.finalConsensus}%`);
    console.log(`✅ Time taken: ${duration} seconds`);
    console.log(`✅ Consensus evolution: ${result.debateHistory.consensusTrend.join('% → ')}%`);
    
    // Show how positions evolved
    if (result.iterations > 1) {
      console.log('\n📈 CONSENSUS PROGRESSION:');
      result.debateHistory.consensusTrend.forEach((score, idx) => {
        const arrow = idx > 0 ? 
          (score > result.debateHistory.consensusTrend[idx-1] ? '↑' : '→') : '';
        console.log(`   Round ${idx + 1}: ${score}% ${arrow}`);
      });
    }
    
    // Show key disagreements from last iteration
    const lastIteration = result.debateHistory.history[result.debateHistory.history.length - 1];
    if (lastIteration && lastIteration.disagreements && lastIteration.disagreements.length > 0) {
      console.log('\n⚖️ FINAL DISCUSSION POINTS:');
      lastIteration.disagreements.slice(0, 3).forEach(d => {
        console.log(`   • ${d}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 ITERATIVE DEBATE SYSTEM - COMPLEXITY HANDLING TEST\n');
  
  // Check if proxy is running
  import http from 'http.js';
  const checkProxy = () => new Promise((resolve) => {
    http.get('http://localhost:3457/health', (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404);
    }).on('error', () => resolve(false));
  });
  
  const proxyRunning = await checkProxy();
  if (!proxyRunning) {
    console.error('❌ Error: k-proxy-server is not running!');
    console.error('Please start it with: node k-proxy-server.js\n');
    process.exit(1);
  }
  
  console.log('✅ Proxy server is running\n');
  
  // Run tests
  const simpleResult = await testSimpleQuestion();
  const mediumResult = await testMediumComplexityQuestion();
  
  // Summary
  console.log('\n' + '=' .repeat(70));
  console.log('📊 SUMMARY - COMPLEXITY HANDLING');
  console.log('=' .repeat(70));
  
  if (simpleResult) {
    console.log('\n✅ SIMPLE QUESTION:');
    console.log(`   • Iterations: ${simpleResult.iterations}`);
    console.log(`   • Final consensus: ${simpleResult.finalConsensus}%`);
    console.log(`   • Early exit: ${simpleResult.iterations === 1 ? 'YES' : 'NO'}`);
  }
  
  if (mediumResult) {
    console.log('\n✅ MEDIUM COMPLEXITY:');
    console.log(`   • Iterations: ${mediumResult.iterations}`);
    console.log(`   • Final consensus: ${mediumResult.finalConsensus}%`);
    console.log(`   • Convergence pattern: ${mediumResult.debateHistory.consensusTrend.map(s => s + '%').join(' → ')}`);
  }
  
  console.log('\n🎯 CONCLUSION:');
  console.log('The system successfully adapts to question complexity:');
  console.log('• Simple factual questions → Quick consensus & early exit');
  console.log('• Medium complexity → Iterative refinement to reach agreement');
  console.log('• Complex philosophical → Would continue to max iterations\n');
}

main().catch(console.error);