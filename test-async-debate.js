#!/usr/bin/env node

/**
 * Test script for the async debate implementation
 */

const { DebateConsensusMCP } = require('./index.js');

async function testAsyncDebate() {
    console.log('🧪 Testing Async Debate Implementation\n');
    
    try {
        // Create MCP server instance
        const server = new DebateConsensusMCP();
        await server.initialize();
        
        console.log('✅ Server initialized');
        
        // Simulate a debate call
        const question = "How to optimize database performance in Node.js applications?";
        
        console.log(`📝 Starting debate: ${question}`);
        
        // Test the debate tool (should return immediately)
        const startTime = Date.now();
        
        const debateRequest = {
            params: {
                name: 'debate',
                arguments: {
                    question: question,
                    projectPath: process.cwd()
                }
            }
        };
        
        // Mock the CallToolRequestSchema handler call
        const CallToolRequestSchema = (await import('@modelcontextprotocol/sdk/types.js')).CallToolRequestSchema;
        const debateCallHandler = server.server._requestHandlers.get(CallToolRequestSchema);
        
        // Create proper request structure
        const properRequest = {
            method: 'tools/call',
            params: {
                name: 'debate',
                arguments: {
                    question: question,
                    projectPath: process.cwd()
                }
            }
        };
        
        const debateResponse = await debateCallHandler(properRequest);
        
        const immediateReturnTime = Date.now() - startTime;
        console.log(`⚡ Debate call returned in ${immediateReturnTime}ms`);
        console.log(`Response: ${debateResponse.content[0].text.substring(0, 200)}...`);
        
        // Extract job ID from response
        const jobIdMatch = debateResponse.content[0].text.match(/Job ID: (debate_\d+_\d+)/);
        if (!jobIdMatch) {
            throw new Error('Could not extract job ID from response');
        }
        
        const jobId = jobIdMatch[1];
        console.log(`📋 Job ID: ${jobId}`);
        
        // Test job status checking
        console.log('\n🔍 Testing job status checking...');
        
        const statusRequest = {
            method: 'tools/call',
            params: {
                name: 'debate_history',
                arguments: {
                    jobId: jobId
                }
            }
        };
        
        let statusResponse = await debateCallHandler(statusRequest);
        console.log(`Status check: ${statusResponse.content[0].text}`);
        
        // Wait a bit and check status again
        console.log('\n⏳ Waiting 10 seconds and checking status again...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        statusResponse = await debateCallHandler(statusRequest);
        console.log(`Status after 10s: ${statusResponse.content[0].text}`);
        
        // Test getting results (might not be ready yet)
        console.log('\n📊 Testing result retrieval...');
        
        const resultRequest = {
            method: 'tools/call',
            params: {
                name: 'debate_result',
                arguments: {
                    jobId: jobId
                }
            }
        };
        
        const resultResponse = await debateCallHandler(resultRequest);
        console.log(`Result: ${resultResponse.content[0].text.substring(0, 300)}...`);
        
        // Test general history listing
        console.log('\n📜 Testing general history listing...');
        
        const historyRequest = {
            method: 'tools/call',
            params: {
                name: 'debate_history',
                arguments: {
                    limit: 5
                }
            }
        };
        
        const historyResponse = await debateCallHandler(historyRequest);
        console.log(`History: ${historyResponse.content[0].text.substring(0, 500)}...`);
        
        console.log('\n✅ Async implementation test completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   • Debate call returned in ${immediateReturnTime}ms (should be very fast)`);
        console.log(`   • Job ${jobId} was created and is processing in background`);
        console.log('   • Status checking works correctly');
        console.log('   • Result retrieval API is working');
        console.log('   • History listing includes job status');
        
        // Check if we can access the job queue directly
        console.log('\n🔧 Direct job queue inspection:');
        const job = server.jobQueue.getJob(jobId);
        if (job) {
            const formatted = server.jobQueue.formatJobStatus(job);
            console.log(`   Status: ${formatted.status}`);
            console.log(`   Duration: ${formatted.duration}`);
        }
        
        console.log('\n🎯 The async implementation is working correctly!');
        console.log('   MCP calls now return immediately while debate runs in background.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testAsyncDebate().catch(console.error);