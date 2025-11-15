#!/usr/bin/env node

/**
 * Test all 9 models (k1-k9) with a simple question
 * Verifies that each model can respond through the debate system
 */

import { ClaudeCliDebate } from '../src/claude-cli-debate.js';
import http from 'http';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => {
    console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}`);
    console.log(`  ${msg}`);
    console.log(`${'='.repeat(60)}${colors.reset}\n`);
  },
  model: (alias, name, status) => {
    const symbol = status === 'ok' ? '✅' : status === 'error' ? '❌' : '⏳';
    const color = status === 'ok' ? colors.green : status === 'error' ? colors.red : colors.yellow;
    console.log(`${color}${symbol} ${alias} (${name})${colors.reset}`);
  }
};

// All 9 models configuration
const ALL_MODELS = [
  { alias: 'k1', name: 'Claude Sonnet 4.5 Thinking', port: 3457 },
  { alias: 'k2', name: 'GPT-5', port: 3458 },
  { alias: 'k3', name: 'Qwen 3 Max', port: 3459 },
  { alias: 'k4', name: 'Gemini 2.5 Pro', port: 3460 },
  { alias: 'k5', name: 'Grok 4 Fast', port: 3461 },
  { alias: 'k6', name: 'GPT-5 Max Thinking', port: 3462 },
  { alias: 'k7', name: 'Kimi K2 Thinking', port: 3463 },
  { alias: 'k8', name: 'GLM-4.6 Exacto', port: 3464 },
  { alias: 'k9', name: 'Claude Opus 4.1', port: 3465 }
];

// Check if a proxy server is running
async function checkProxy(port, name) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Main test function
async function testAllModels() {
  log.header('Testing All 9 Models (k1-k9)');

  // Step 1: Check proxy servers
  console.log('1. Checking Proxy Servers (ports 3457-3465)');
  console.log('─'.repeat(60) + '\n');

  const availableModels = [];
  const unavailableModels = [];

  for (const model of ALL_MODELS) {
    const isRunning = await checkProxy(model.port, model.name);
    if (isRunning) {
      log.model(model.alias, model.name, 'ok');
      availableModels.push(model.alias);
    } else {
      log.model(model.alias, model.name, 'error');
      unavailableModels.push(model);
    }
  }

  console.log(`\n${colors.cyan}Proxy Status: ${availableModels.length}/9 running${colors.reset}\n`);

  // Check if we have minimum required models
  if (availableModels.length < 2) {
    log.error('Need at least 2 models running to test debate system');
    console.log('\nTo start proxy servers:');
    console.log('  node k-proxy-server.js &\n');
    process.exit(1);
  }

  if (unavailableModels.length > 0) {
    log.warning(`${unavailableModels.length} model(s) not available: ${unavailableModels.map(m => m.alias).join(', ')}`);
    console.log(`Testing with ${availableModels.length} available models\n`);
  }

  // Step 2: Run debate with all available models
  log.header('Running Debate with Available Models');

  const question = 'What is 2+2? Reply with just the number.';
  console.log(`Question: ${colors.cyan}${question}${colors.reset}\n`);

  const debate = new ClaudeCliDebate();
  const modelConfig = availableModels.join(',');

  console.log(`Using models: ${colors.magenta}${modelConfig}${colors.reset}`);
  console.log(`Timeout: ${colors.cyan}180 seconds${colors.reset}\n`);

  log.info('Starting debate (this may take 2-3 minutes)...\n');

  const startTime = Date.now();
  const respondedModels = new Set();

  try {
    const result = await debate.runDebate(
      question,              // First parameter: question string
      process.cwd(),         // Second parameter: project path
      modelConfig,           // Third parameter: model config
      {                      // Fourth parameter: options object
        timeout: 180000,     // 3 minutes
        progressCallback: (progress) => {
          if (progress.type === 'model_start') {
            console.log(`${colors.yellow}⏳ ${progress.model}: Starting...${colors.reset}`);
          } else if (progress.type === 'model_response') {
            respondedModels.add(progress.model);
            console.log(`${colors.green}✅ ${progress.model}: ${progress.status}${colors.reset}`);
          } else if (progress.type === 'model_error') {
            console.log(`${colors.red}❌ ${progress.model}: ${progress.error}${colors.reset}`);
          }
        }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Step 3: Display results
    log.header('Test Results');

    log.success(`Debate completed in ${duration}s`);
    console.log(`${colors.cyan}Models participated: ${respondedModels.size}/${availableModels.length}${colors.reset}\n`);

    // Show individual model responses
    if (result.proposals && Object.keys(result.proposals).length > 0) {
      console.log('Individual Responses:');
      console.log('─'.repeat(60));
      for (const [model, response] of Object.entries(result.proposals)) {
        const preview = response.substring(0, 100).replace(/\n/g, ' ');
        console.log(`${colors.magenta}${model}${colors.reset}: ${preview}${response.length > 100 ? '...' : ''}`);
      }
      console.log();
    }

    // Show final consensus
    if (result.finalAnswer) {
      console.log(`${colors.bright}Final Consensus:${colors.reset}`);
      console.log(`  ${colors.cyan}${result.finalAnswer}${colors.reset}\n`);
    }

    // Show confidence score
    if (result.confidence !== undefined) {
      const confidencePercent = (result.confidence * 100).toFixed(1);
      const confidenceColor = result.confidence >= 0.8 ? colors.green :
                              result.confidence >= 0.6 ? colors.yellow : colors.red;
      console.log(`Confidence: ${confidenceColor}${confidencePercent}%${colors.reset}\n`);
    }

    // Summary
    log.header('Summary');

    if (respondedModels.size === 9) {
      log.success('Perfect! All 9 models responded! 🎉');
    } else if (respondedModels.size >= 2) {
      log.warning(`${respondedModels.size}/${availableModels.length} models responded`);
      const missing = availableModels.filter(m => !respondedModels.has(m));
      if (missing.length > 0) {
        console.log(`  Missing: ${missing.join(', ')}`);
      }
    } else {
      log.error('Too few models responded');
    }

    console.log(`\nModels that responded:`);
    for (const model of respondedModels) {
      const modelInfo = ALL_MODELS.find(m => m.alias === model);
      console.log(`  ${colors.green}✅${colors.reset} ${model} (${modelInfo?.name || 'Unknown'})`);
    }

    console.log('\n' + '='.repeat(60));
    log.success('Test completed successfully!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    log.header('Test Failed');
    log.error(`Debate failed after ${duration}s`);
    console.log(`\nError: ${error.message}\n`);

    if (respondedModels.size > 0) {
      console.log(`Models that responded before failure:`);
      for (const model of respondedModels) {
        console.log(`  ${colors.green}✅${colors.reset} ${model}`);
      }
      console.log();
    }

    console.log('Troubleshooting:');
    console.log('  1. Check proxy servers: node health-check.js');
    console.log('  2. Check logs: logs/debate-*.json');
    console.log('  3. Verify OPENROUTER_API_KEY in .env');
    console.log('  4. Try with fewer models: npm run test:debate\n');

    process.exit(1);
  }
}

// Run the test
testAllModels().catch(error => {
  log.error(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
