#!/usr/bin/env node

/**
 * Test the iterative debate system
 */

const { IterativeDebateOrchestrator } = require('./src/iterative-debate-orchestrator');

async function testFactualQuestion() {
  console.log('🧪 Test 1: Factual Question (Should reach consensus quickly)\n');
  
  const orchestrator = new IterativeDebateOrchestrator();
  const question = "What is the capital of Lithuania?";
  
  try {
    const result = await orchestrator.runIterativeDebate(question);
    
    console.log('\n📊 Results:');
    console.log(`- Iterations needed: ${result.iterations}`);
    console.log(`- Final consensus: ${result.finalConsensus}%`);
    console.log(`- Early exit: ${result.iterations === 1 ? 'Yes' : 'No'}`);
    
    return result;
  } catch (error) {
    console.error('Test failed:', error.message);
    return null;
  }
}

async function testComplexQuestion() {
  console.log('\n🧪 Test 2: Complex Question (Should require iterations)\n');
  
  const orchestrator = new IterativeDebateOrchestrator();
  const question = "What is the best approach to implement microservices architecture for a startup?";
  
  try {
    const result = await orchestrator.runIterativeDebate(question);
    
    console.log('\n📊 Results:');
    console.log(`- Iterations needed: ${result.iterations}`);
    console.log(`- Final consensus: ${result.finalConsensus}%`);
    console.log(`- Consensus evolution: ${result.debateHistory.consensusTrend.join('% → ')}%`);
    
    return result;
  } catch (error) {
    console.error('Test failed:', error.message);
    return null;
  }
}

async function testConsensusAnalyzer() {
  console.log('\n🧪 Test 3: Consensus Analyzer\n');
  
  const { ConsensusAnalyzer } = require('./src/iterative-debate-orchestrator');
  const analyzer = new ConsensusAnalyzer();
  
  // Test with high agreement responses
  const highAgreementResponses = {
    "Model A": "The capital of Lithuania is Vilnius. It's the largest city and has been the capital since 1323.",
    "Model B": "Vilnius is Lithuania's capital city. It's located in the southeastern part of the country.",
    "Model C": "Lithuania's capital is Vilnius, a historic city with beautiful baroque architecture.",
    "Model D": "Vilnius serves as the capital of Lithuania and is its cultural and economic center."
  };
  
  // Test with disagreement
  const disagreementResponses = {
    "Model A": "The best database for this project is PostgreSQL due to its ACID compliance.",
    "Model B": "I recommend MongoDB for its flexibility and scalability in handling unstructured data.",
    "Model C": "Consider using both - PostgreSQL for transactional data and MongoDB for analytics.",
    "Model D": "Actually, a graph database like Neo4j might be better for your relationship-heavy data."
  };
  
  try {
    console.log('Testing high agreement scenario...');
    const highConsensus = await analyzer.evaluateConsensus(
      "What is the capital of Lithuania?",
      highAgreementResponses
    );
    console.log(`High agreement consensus: ${highConsensus.consensus_score}%`);
    console.log(`Continue debate: ${highConsensus.continue_debate}`);
    
    console.log('\nTesting disagreement scenario...');
    const lowConsensus = await analyzer.evaluateConsensus(
      "What database should we use?",
      disagreementResponses
    );
    console.log(`Disagreement consensus: ${lowConsensus.consensus_score}%`);
    console.log(`Key disagreements: ${lowConsensus.key_disagreements?.join('; ')}`);
    
  } catch (error) {
    console.error('Consensus analyzer test failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Iterative Debate System Tests\n');
  console.log('=' .repeat(70));
  
  // Check if proxy is running
  const http = require('http');
  const checkProxy = () => new Promise((resolve) => {
    http.get('http://localhost:3457/health', (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
  
  const proxyRunning = await checkProxy();
  if (!proxyRunning) {
    console.error('❌ Error: k-proxy-server is not running!');
    console.error('Please start it with: node k-proxy-server.js\n');
    process.exit(1);
  }
  
  // Run tests
  await testConsensusAnalyzer();
  
  // Note: The following tests require actual model responses
  // Uncomment to run with real models
  
  // await testFactualQuestion();
  // await testComplexQuestion();
  
  console.log('\n✅ All tests completed!');
}

// Run tests
runAllTests().catch(console.error);