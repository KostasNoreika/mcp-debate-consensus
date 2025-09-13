#!/usr/bin/env node

const { IterativeDebateOrchestrator } = require('./src/iterative-debate-orchestrator');

async function quickTest() {
  console.log('🌍 Quick Test: Best Country (Simplified)\n');
  
  const orchestrator = new IterativeDebateOrchestrator();
  orchestrator.maxIterations = 2; // Limit iterations
  orchestrator.consensusThreshold = 80; // Lower threshold
  orchestrator.timeout = 2 * 60 * 1000; // 2 minutes timeout
  
  try {
    const result = await orchestrator.runIterativeDebate(
      "Name the single best country to live in based on HDI and happiness index. Give one name.",
      process.cwd()
    );
    
    console.log('\n📊 FINAL RESULT:');
    console.log('Iterations:', result.iterations);
    console.log('Final consensus:', result.finalConsensus + '%');
    
    // Extract the answer from synthesis
    const lines = result.solution.split('\n');
    const answerSection = lines.findIndex(line => line.includes('Core Solution'));
    if (answerSection !== -1) {
      console.log('\n🎯 ANSWER:');
      console.log(lines.slice(answerSection + 2, answerSection + 20).join('\n'));
    }
    
    // Show what each model said initially
    if (result.debateHistory && result.debateHistory.history[0]) {
      console.log('\n📝 INITIAL POSITIONS:');
      const firstRound = result.debateHistory.history[0].responses;
      Object.entries(firstRound).forEach(([model, response]) => {
        // Extract first meaningful line
        const firstLine = response.split('\n').find(line => 
          line.length > 10 && !line.startsWith('#')
        );
        console.log(`${model}: ${firstLine ? firstLine.substring(0, 100) : 'No clear answer'}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

quickTest();