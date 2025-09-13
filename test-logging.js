#!/usr/bin/env node

const { IterativeDebateOrchestrator } = require('./src/iterative-debate-orchestrator');

async function testWithLogging() {
  console.log('🧪 Testing with logging enabled\n');
  
  const orchestrator = new IterativeDebateOrchestrator();
  orchestrator.maxIterations = 1; // Very short test
  orchestrator.consensusThreshold = 99; // Force at least one iteration
  orchestrator.timeout = 60 * 1000; // 1 minute timeout
  
  try {
    const result = await orchestrator.runIterativeDebate(
      "What is 2+2?",
      process.cwd()
    );
    
    console.log('\n✅ Test completed');
    console.log('Check logs directory for intermediate logs');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
  
  // Check what logs were created
  const fs = require('fs').promises;
  const path = require('path');
  const logsDir = path.join(__dirname, 'logs');
  
  const files = await fs.readdir(logsDir);
  const iterativeLogs = files.filter(f => f.includes('iterative_debate'));
  
  console.log('\n📁 Iterative debate logs found:', iterativeLogs.length);
  
  // Show latest log
  if (iterativeLogs.length > 0) {
    const latestLog = iterativeLogs.sort().pop();
    const content = await fs.readFile(path.join(logsDir, latestLog), 'utf8');
    const data = JSON.parse(content);
    
    console.log('\n📋 Latest log:', latestLog);
    console.log('Question:', data.question);
    console.log('Iterations:', data.iterations || data.currentIteration);
    console.log('Consensus:', data.consensusEvolution);
    
    if (data.debateHistory && data.debateHistory.history && data.debateHistory.history[0]) {
      console.log('\n📝 Model responses saved:', Object.keys(data.debateHistory.history[0].responses));
    }
  }
}

testWithLogging().catch(console.error);