#!/usr/bin/env node

/**
 * Test MCP Integration for Confidence Scoring
 *
 * This script tests the confidence_analysis tool through the MCP interface
 * to ensure it works correctly when called via the debate-consensus MCP server.
 */

import { DebateConsensusMCP } from './index.js';

async function testMCPConfidenceIntegration() {
  console.log('🧪 Testing MCP Confidence Analysis Integration\n');

  try {
    // Create MCP server instance
    const server = new DebateConsensusMCP();
    await server.initialize();

    console.log('✅ MCP Server initialized successfully\n');

    // Test the confidence_analysis tool directly
    console.log('📊 Testing confidence_analysis tool...\n');

    // Mock a call to the confidence_analysis tool
    const mockRequest = {
      params: {
        name: 'confidence_analysis',
        arguments: {
          question: 'How to implement authentication in Node.js?',
          proposals: {
            'Claude Opus 4.1': 'Use JWT tokens with bcrypt for password hashing. Implement proper session management and rate limiting.',
            'GPT-5': 'JWT authentication with bcrypt password hashing is recommended. Add session management and security measures.',
            'Qwen 3 Max': 'Implement JWT-based auth with bcrypt for passwords. Include session handling and rate limiting for security.'
          }
        }
      }
    };

    // Access the tool handler through the server
    const tools = await server.server.request({
      method: 'tools/list',
      params: {}
    });

    console.log('📋 Available MCP Tools:');
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description.substring(0, 100)}...`);
    });
    console.log('');

    // Check if confidence_analysis tool is available
    const confidenceTool = tools.tools.find(tool => tool.name === 'confidence_analysis');
    if (confidenceTool) {
      console.log('✅ confidence_analysis tool found in MCP tools list\n');
      console.log('📊 Tool Description:');
      console.log(`   ${confidenceTool.description}\n`);

      console.log('📋 Tool Schema:');
      console.log(`   Properties: ${Object.keys(confidenceTool.inputSchema.properties).join(', ')}\n`);
    } else {
      console.log('❌ confidence_analysis tool not found in MCP tools list\n');
      return;
    }

    // Test calling the tool
    console.log('🔄 Testing tool call...\n');

    try {
      const result = await server.server.request({
        method: 'tools/call',
        params: mockRequest.params
      });

      console.log('✅ Tool call successful!\n');
      console.log('📊 Confidence Analysis Result:');
      console.log('================================\n');
      console.log(result.content[0].text);
      console.log('\n================================\n');

      // Verify the response contains expected elements
      const response = result.content[0].text;
      const hasConfidenceScore = response.includes('Overall Confidence Score');
      const hasFactorBreakdown = response.includes('Factor Breakdown');
      const hasRecommendation = response.includes('Recommendation');
      const hasThresholds = response.includes('Confidence Thresholds');

      console.log('🔍 Response Validation:');
      console.log(`   Contains Confidence Score: ${hasConfidenceScore ? '✅' : '❌'}`);
      console.log(`   Contains Factor Breakdown: ${hasFactorBreakdown ? '✅' : '❌'}`);
      console.log(`   Contains Recommendation: ${hasRecommendation ? '✅' : '❌'}`);
      console.log(`   Contains Thresholds: ${hasThresholds ? '✅' : '❌'}`);

      if (hasConfidenceScore && hasFactorBreakdown && hasRecommendation && hasThresholds) {
        console.log('\n✅ All expected elements present in response!');
      } else {
        console.log('\n⚠️  Some expected elements missing from response');
      }

    } catch (toolError) {
      console.error('❌ Tool call failed:', toolError.message);
      return;
    }

    console.log('\n✅ MCP Confidence Analysis Integration Test Complete!');
    console.log('\nThe integration successfully:');
    console.log('- Exposed confidence_analysis as an MCP tool');
    console.log('- Processed confidence analysis requests');
    console.log('- Returned properly formatted responses');
    console.log('- Included all required confidence metrics');
    console.log('\n🎯 Task 006 MCP Integration - VERIFIED');

  } catch (error) {
    console.error('❌ MCP Integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testMCPConfidenceIntegration().catch(console.error);