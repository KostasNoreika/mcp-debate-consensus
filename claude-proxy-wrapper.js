#!/usr/bin/env node

/**
 * Wrapper script to run Claude CLI with specific model via proxy
 * Usage: node claude-proxy-wrapper.js [k1|k2|k3|k4|k5] [claude arguments]
 */

const { spawn } = require('child_process');
const path = require('path');

// Get model alias from first argument
const modelAlias = process.argv[2];
const claudeArgs = process.argv.slice(3);

// Validate model alias
const validModels = ['k1', 'k2', 'k3', 'k4', 'k5'];
if (!validModels.includes(modelAlias)) {
  console.error(`Invalid model: ${modelAlias}`);
  console.error(`Valid models: ${validModels.join(', ')}`);
  process.exit(1);
}

// Set environment variables for the proxy
const env = {
  ...process.env,
  MODEL_OVERRIDE: modelAlias,
  ANTHROPIC_API_KEY: `proxy-key-${modelAlias}`,
  ANTHROPIC_BASE_URL: 'http://localhost:3456'
};

// Spawn Claude CLI with the environment
// Use the actual claude binary path
const claudePath = '/Users/kostasnoreika/.claude/local/claude';
const claudeProcess = spawn(claudePath, claudeArgs, {
  env,
  stdio: 'inherit'
});

// Pass through exit code
claudeProcess.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle errors
claudeProcess.on('error', (error) => {
  console.error(`Error running Claude: ${error.message}`);
  process.exit(1);
});