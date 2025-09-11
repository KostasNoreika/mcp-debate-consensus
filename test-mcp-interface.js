#!/usr/bin/env node

/**
 * Test MCP Interface Directly
 * Simulates what happens when Claude Code CLI tries to communicate with the MCP server
 */

const { spawn } = require('child_process');

// Test the MCP server by simulating the interface calls
async function testMCPInterface() {
    console.log('🧪 Testing MCP Server Interface\n');
    
    // Start the MCP server as a child process
    const serverProcess = spawn('node', ['index.js'], {
        cwd: '/opt/mcp/servers/debate-consensus',
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let responseData = '';
    let errorData = '';
    
    // Set up data handlers
    serverProcess.stdout.on('data', (data) => {
        responseData += data.toString();
    });
    
    serverProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        console.log('📝 Server stderr:', data.toString());
    });
    
    // Handle server startup
    console.log('🚀 Starting MCP server...');
    
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: List tools
    console.log('📋 Test 1: List tools');
    const listToolsRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
    };
    
    serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('📤 Server response for tools/list:');
    console.log(responseData);
    
    // Reset response data
    responseData = '';
    
    // Test 2: Call debate tool
    console.log('\n📞 Test 2: Call debate tool');
    const callToolRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'debate',
            arguments: {
                question: 'What is the best programming language for web development?',
                projectPath: '/opt/mcp/servers/debate-consensus'
            }
        }
    };
    
    serverProcess.stdin.write(JSON.stringify(callToolRequest) + '\n');
    
    // Wait longer for debate to complete
    console.log('⏳ Waiting for debate to complete (this may take a few minutes)...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
    
    console.log('📤 Server response for tools/call:');
    console.log(responseData);
    
    // Clean up
    console.log('\n🛑 Stopping server...');
    serverProcess.kill('SIGTERM');
    
    serverProcess.on('close', (code) => {
        console.log(`✅ Server process exited with code ${code}`);
        console.log('\n📊 Final error output:', errorData);
    });
}

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled rejection:', reason);
    process.exit(1);
});

// Run the test
testMCPInterface().catch(console.error);