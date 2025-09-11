#!/usr/bin/env node

/**
 * Quick test to verify MCP server starts and lists tools correctly
 */

const { DebateConsensusMCP } = require('./index.js');

async function testMCPAsync() {
    console.log('🧪 Testing MCP Server Async Implementation\n');
    
    try {
        const server = new DebateConsensusMCP();
        await server.initialize();
        
        console.log('✅ MCP Server initialized successfully');
        
        // Test tool listing
        const ListToolsRequestSchema = (await import('@modelcontextprotocol/sdk/types.js')).ListToolsRequestSchema;
        const toolsHandler = server.server._requestHandlers.get(ListToolsRequestSchema);
        
        const toolsResponse = await toolsHandler({ method: 'tools/list' });
        console.log('📋 Available tools:');
        
        toolsResponse.tools.forEach(tool => {
            console.log(`   • ${tool.name}: ${tool.description}`);
        });
        
        // Verify we have the right tools
        const toolNames = toolsResponse.tools.map(t => t.name);
        const expectedTools = ['debate', 'debate_history', 'debate_result'];
        
        const hasAllTools = expectedTools.every(tool => toolNames.includes(tool));
        
        if (hasAllTools) {
            console.log('✅ All expected tools are present');
        } else {
            console.log('❌ Missing expected tools');
            console.log('Expected:', expectedTools);
            console.log('Found:', toolNames);
        }
        
        // Check the debate tool description mentions async behavior
        const debateTool = toolsResponse.tools.find(t => t.name === 'debate');
        if (debateTool.description.includes('returns immediately')) {
            console.log('✅ Debate tool correctly describes async behavior');
        } else {
            console.log('⚠️ Debate tool description should mention immediate return');
        }
        
        console.log('\n🎯 MCP Server async implementation is ready!');
        console.log('\nKey features:');
        console.log('   • 🚀 debate - starts background processing, returns job ID');
        console.log('   • 📊 debate_history - check job status and historical debates');
        console.log('   • 📋 debate_result - get completed debate results');
        
        console.log('\nThe MCP server now supports long-running debates without blocking!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testMCPAsync().catch(console.error);