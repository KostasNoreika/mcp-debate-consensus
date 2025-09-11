#!/usr/bin/env node

/**
 * Test script for Claude CLI-based debate system
 * 
 * This tests the new implementation that uses actual Claude CLI instances
 * with full MCP tool access instead of HTTP calls.
 */

const { ClaudeCliDebate } = require('./src/claude-cli-debate');
const { spawn } = require('child_process');

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  // Check if proxy server is running
  console.log('Checking k-proxy servers...');
  const checks = [
    { alias: 'k1', port: 3457 },
    { alias: 'k2', port: 3458 },
    { alias: 'k3', port: 3459 },
    { alias: 'k4', port: 3460 }
  ];
  
  let proxyRunning = false;
  for (const check of checks) {
    try {
      const response = await fetch(`http://localhost:${check.port}/health`);
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ ${check.alias} proxy: ${data.model} (${data.instance})`);
        proxyRunning = true;
      }
    } catch (error) {
      console.log(`  ❌ ${check.alias} proxy: Not running on port ${check.port}`);
    }
  }
  
  if (!proxyRunning) {
    console.log('\n⚠️  No proxy servers running. Starting k-proxy-server...');
    
    // Start proxy server in background
    const proxyProcess = spawn('node', ['/opt/mcp/servers/debate-consensus/k-proxy-server.js'], {
      detached: true,
      stdio: 'ignore'
    });
    
    proxyProcess.unref();
    
    // Wait for proxies to start
    console.log('Waiting for proxies to start...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check again
    let started = false;
    for (const check of checks) {
      try {
        const response = await fetch(`http://localhost:${check.port}/health`);
        if (response.ok) {
          started = true;
          break;
        }
      } catch (error) {
        // Still starting
      }
    }
    
    if (!started) {
      console.error('❌ Failed to start proxy servers. Please run manually:');
      console.error('   node /opt/mcp/servers/debate-consensus/k-proxy-server.js');
      process.exit(1);
    }
    
    console.log('✅ Proxy servers started');
  }
  
  // Check Claude CLI
  console.log('\nChecking Claude CLI installation...');
  try {
    const fs = require('fs');
    const claudePath = '/Users/kostasnoreika/.claude/local/claude';
    if (fs.existsSync(claudePath)) {
      console.log('  ✅ Claude CLI found at', claudePath);
    } else {
      throw new Error('Claude CLI binary not found');
    }
  } catch (error) {
    console.error('  ❌ Claude CLI not found. Please install Claude CLI first.');
    process.exit(1);
  }
  
  console.log('\n✅ All prerequisites met!\n');
}

async function runTest() {
  try {
    await checkPrerequisites();
    
    const debate = new ClaudeCliDebate();
    
    console.log('🚀 Starting Claude CLI Debate Test\n');
    
    const question = process.argv[2] || "Create a simple Node.js REST API with error handling and logging. Include authentication middleware and database integration.";
    
    console.log(`Question: ${question}\n`);
    
    const result = await debate.runDebate(question, process.cwd());
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 DEBATE COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log(`Winner: ${result.winner}`);
    console.log(`Score: ${result.score.toFixed(2)}`);
    console.log(`Contributors: ${result.contributors.join(', ')}`);
    console.log(`Tools Used: ${result.toolsUsed ? 'Yes' : 'No'}`);
    console.log(`Solution Length: ${result.solution.length} characters`);
    
    // Show first part of solution
    console.log('\n📝 Solution Preview:');
    console.log('-'.repeat(50));
    console.log(result.solution.substring(0, 500) + '...');
    console.log('-'.repeat(50));
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Add graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Test terminated');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  runTest();
}

module.exports = { runTest };