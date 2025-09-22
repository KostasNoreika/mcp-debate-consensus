#!/usr/bin/env node

/**
 * Test with subjective question about best country to live
 */

const { IterativeDebateOrchestrator } = require('../../src/iterative-debate-orchestrator');

async function testSubjectiveQuestion() {
  console.log('🌍 TEST: SUBJECTIVE QUESTION - Best Country to Live\n');
  console.log('Question: "Which country is the best to be born and live in?"\n');
  console.log('Expected: Low initial consensus, multiple iterations needed\n');
  console.log('=' .repeat(70) + '\n');
  
  const orchestrator = new IterativeDebateOrchestrator();
  orchestrator.maxIterations = 5;
  orchestrator.consensusThreshold = 85;
  
  try {
    const startTime = Date.now();
    const result = await orchestrator.runIterativeDebate(
      "Which country is the best to be born and live in? Consider quality of life, healthcare, education, economy, freedom, safety, and opportunities.",
      process.cwd()
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '=' .repeat(70));
    console.log('📊 DEBATE RESULTS:');
    console.log('=' .repeat(70));
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log(`🔄 Iterations needed: ${result.iterations}`);
    console.log(`📈 Final consensus: ${result.finalConsensus}%`);
    console.log(`📊 Consensus evolution: ${result.debateHistory.consensusTrend.join('% → ')}%`);
    
    // Show how the debate evolved
    if (result.iterations > 1) {
      console.log('\n🔄 DEBATE EVOLUTION:');
      console.log('-'.repeat(40));
      result.debateHistory.history.forEach((iteration, idx) => {
        console.log(`\n📍 Round ${idx + 1}:`);
        console.log(`   Consensus: ${iteration.consensusScore}%`);
        
        if (iteration.disagreements && iteration.disagreements.length > 0) {
          console.log(`   Key disagreements:`);
          iteration.disagreements.slice(0, 3).forEach(d => {
            // Truncate long disagreements
            const disagreement = d.length > 150 ? d.substring(0, 150) + '...' : d;
            console.log(`   • ${disagreement}`);
          });
        }
        
        if (iteration.convergence !== undefined && idx > 0) {
          const trend = iteration.convergence > 0 ? '↑ improving' : 
                       iteration.convergence < 0 ? '↓ diverging' : '→ stable';
          console.log(`   Trend: ${trend}`);
        }
      });
    }
    
    // Analysis
    console.log('\n' + '=' .repeat(70));
    console.log('🎯 ANALYSIS:');
    console.log('=' .repeat(70));
    
    if (result.iterations === 1) {
      console.log('✅ Models reached immediate consensus!');
      console.log('   This suggests they agree on objective criteria for "best country"');
      console.log('   (likely Nordic countries based on HDI, happiness index, etc.)');
    } else if (result.iterations < 3) {
      console.log('⚡ Quick convergence after initial disagreement');
      console.log('   Models found common ground relatively fast');
    } else if (result.iterations >= 4) {
      console.log('🔥 Extended debate with persistent disagreements');
      console.log('   This reflects the subjective nature of "best" country');
      console.log('   Different models prioritized different criteria');
    }
    
    if (result.finalConsensus < 85) {
      console.log('\n⚠️  Low final consensus indicates fundamental disagreements');
      console.log('   Models couldn\'t fully agree on what makes a country "best"');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

testSubjectiveQuestion().catch(console.error);