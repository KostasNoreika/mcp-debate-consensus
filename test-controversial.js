#!/usr/bin/env node

/**
 * Test with controversial question to force iterations
 */

const { IterativeDebateOrchestrator } = require('./src/iterative-debate-orchestrator');

async function testControversial() {
  console.log('🔥 TEST: CONTROVERSIAL QUESTION (Should force iterations)\n');
  console.log('Question: "Should startups use microservices or monolith architecture?"\n');
  
  const orchestrator = new IterativeDebateOrchestrator();
  orchestrator.maxIterations = 5;
  orchestrator.consensusThreshold = 85; // Lower threshold
  
  try {
    const result = await orchestrator.runIterativeDebate(
      "Should a 3-person startup use microservices or monolith architecture? Consider development speed, scalability, maintenance, and cost.",
      process.cwd()
    );
    
    console.log('\n📊 DEBATE RESULTS:');
    console.log(`Iterations: ${result.iterations}`);
    console.log(`Final consensus: ${result.finalConsensus}%`);
    console.log(`Consensus evolution: ${result.debateHistory.consensusTrend.join('% → ')}%`);
    
    // Show debate dynamics
    if (result.iterations > 1) {
      console.log('\n🔄 ITERATION DETAILS:');
      result.debateHistory.history.forEach((iteration, idx) => {
        console.log(`\nRound ${idx + 1}:`);
        console.log(`  Consensus: ${iteration.consensusScore}%`);
        if (iteration.disagreements && iteration.disagreements.length > 0) {
          console.log(`  Key disagreements:`);
          iteration.disagreements.slice(0, 2).forEach(d => {
            console.log(`    • ${d.substring(0, 100)}...`);
          });
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error('Test failed:', error.message);
    return null;
  }
}

testControversial().catch(console.error);