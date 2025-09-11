#!/usr/bin/env node

/**
 * Test script for synchronous debate flow
 * Verifies that the restored synchronous MCP server works correctly
 */

const { SimpleDebate } = require('./src/simple-debate-fixed.js');
const { DebateHistory } = require('./src/history.js');

async function testSynchronousDebate() {
    console.log('🧪 Testing Synchronous Debate Flow\n');
    console.log('='.repeat(50));
    
    const startTime = Date.now();
    
    try {
        // Initialize components
        const debate = new SimpleDebate();
        const history = new DebateHistory();
        
        // Test question
        const question = "How to implement a simple caching mechanism in JavaScript?";
        
        console.log(`\n📝 Question: ${question}\n`);
        
        // Run synchronous debate
        console.log('🚀 Starting synchronous debate...\n');
        const result = await debate.runDebate(question, process.cwd());
        
        console.log('\n' + '='.repeat(50));
        console.log('🎉 DEBATE RESULTS\n');
        
        console.log(`Winner: ${result.winner}`);
        console.log(`Score: ${result.score.toFixed(2)}`);
        console.log(`Contributors: ${result.contributors.join(', ')}`);
        console.log(`\nSolution Preview:\n${result.solution.substring(0, 200)}...`);
        
        // Save to history
        const historyId = await history.save({
            question,
            ...result
        });
        
        console.log(`\n💾 Saved to history: ${historyId}`);
        
        const totalTime = Math.round((Date.now() - startTime) / 1000);
        console.log(`⏱️ Total time: ${totalTime}s`);
        
        console.log('\n✅ Synchronous debate test completed successfully!');
        
        // Test history retrieval
        console.log('\n📚 Testing history retrieval...');
        const debates = await history.list(5);
        console.log(`Found ${debates.length} historical debates`);
        
        return {
            success: true,
            result,
            historyId,
            duration: totalTime
        };
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Test MCP interface simulation
async function testMCPInterface() {
    console.log('\n' + '='.repeat(50));
    console.log('🧪 Testing MCP Interface Simulation\n');
    
    try {
        // Simulate MCP call structure
        const mcpRequest = {
            params: {
                name: 'debate',
                arguments: {
                    question: "What are the best practices for error handling in Node.js?"
                }
            }
        };
        
        console.log('📤 Simulating MCP tool call...');
        console.log(`Tool: ${mcpRequest.params.name}`);
        console.log(`Question: ${mcpRequest.params.arguments.question}`);
        
        // This would be handled by the MCP server
        const debate = new SimpleDebate();
        const history = new DebateHistory();
        
        const result = await debate.runDebate(
            mcpRequest.params.arguments.question,
            process.cwd()
        );
        
        const historyId = await history.save({
            question: mcpRequest.params.arguments.question,
            ...result
        });
        
        // Simulate MCP response format
        const mcpResponse = {
            content: [{
                type: 'text',
                text: `✅ Debate Complete!\n\n**Question:** ${mcpRequest.params.arguments.question}\n**History ID:** ${historyId}\n**Winner:** ${result.winner}\n**Score:** ${result.score.toFixed(2)}\n**Contributors:** ${result.contributors.join(', ')}\n\n## Solution\n\n${result.solution}\n\n---\n*Multi-model consensus reached using k1-k4 models*`
            }]
        };
        
        console.log('\n📥 MCP Response preview:');
        console.log(mcpResponse.content[0].text.substring(0, 300) + '...');
        
        console.log('\n✅ MCP interface test completed successfully!');
        return { success: true };
        
    } catch (error) {
        console.error('\n❌ MCP interface test failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Main execution
if (require.main === module) {
    (async () => {
        try {
            console.log('🎯 Synchronous Debate Test Suite');
            console.log(`📍 Working Directory: ${process.cwd()}`);
            console.log(`⏰ Started: ${new Date().toISOString()}\n`);
            
            // Test 1: Direct debate functionality
            const debateResult = await testSynchronousDebate();
            
            // Test 2: MCP interface simulation
            const mcpResult = await testMCPInterface();
            
            console.log('\n' + '='.repeat(50));
            console.log('📊 FINAL RESULTS\n');
            
            console.log(`Direct Debate Test: ${debateResult.success ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`MCP Interface Test: ${mcpResult.success ? '✅ PASS' : '❌ FAIL'}`);
            
            if (debateResult.success && mcpResult.success) {
                console.log('\n🎉 ALL TESTS PASSED! Synchronous debate flow is working correctly.');
                process.exit(0);
            } else {
                console.log('\n💥 SOME TESTS FAILED. Check the output above for details.');
                process.exit(1);
            }
            
        } catch (error) {
            console.error('\n💥 Test suite failed:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = { testSynchronousDebate, testMCPInterface };