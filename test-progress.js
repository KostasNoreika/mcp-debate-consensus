#!/usr/bin/env node

/**
 * Test script for progress reporting functionality
 * Run this to verify progress messages are appearing correctly
 */

const { ProgressReporter } = require('./src/progress-reporter');

console.log('🧪 Testing Progress Reporter\n');
console.log('=' .repeat(50));

// Create a progress reporter with short interval for testing
const reporter = new ProgressReporter({
  interval: 5000, // 5 seconds for testing
  enabled: true,
  verbose: true
});

// Start the heartbeat
console.log('\n📍 Starting heartbeat (5 second intervals)...\n');
reporter.startHeartbeat();

// Simulate debate phases
async function simulateDebate() {
  // Phase 1: Initialization
  reporter.setPhase('Initializing debate');
  await sleep(2000);

  // Phase 2: Round 1
  reporter.setPhase('Round 1: Independent Analysis');

  // Update model statuses
  const models = ['Claude Opus 4.1', 'GPT-5', 'Qwen 3 Max', 'Gemini 2.5 Pro'];

  for (const model of models) {
    reporter.updateModelStatus(model, 'waiting');
  }

  await sleep(3000);

  // Start models one by one
  for (let i = 0; i < models.length; i++) {
    reporter.updateModelStatus(models[i], 'starting');
    await sleep(1000);
    reporter.updateModelStatus(models[i], 'running');

    if (i === 1) {
      // Wait for heartbeat to show
      await sleep(6000);
    }
  }

  // Complete models
  for (const model of models) {
    await sleep(2000);
    reporter.updateModelStatus(model, 'completed');
    reporter.progress(`${model} analysis complete`, {
      model: model,
      percentage: 25 * (models.indexOf(model) + 1)
    });
  }

  // Phase 3: Evaluation
  reporter.setPhase('Evaluating proposals');
  await sleep(3000);

  reporter.progress('Selected best proposal', {
    model: 'Claude Opus 4.1',
    percentage: 50,
    details: 'Score: 92.5'
  });

  // Phase 4: Round 2
  reporter.setPhase('Round 2: Collaborative Improvements');
  await sleep(5000);

  // Show warning
  reporter.warning('One model failed to respond');
  await sleep(2000);

  // Phase 5: Synthesis
  reporter.setPhase('Final Synthesis');
  reporter.progress('Creating consensus solution', {
    percentage: 90
  });
  await sleep(3000);

  // Complete
  reporter.complete('Debate simulation completed successfully');
}

// Helper function to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run simulation
simulateDebate().catch(error => {
  reporter.error('Simulation failed', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted by user');
  reporter.stopHeartbeat();
  process.exit(0);
});