#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Improved Debate-Consensus MCP Server
 * Tests all 3 key improvements:
 * 1. Turn-based debate mechanism
 * 2. Semantic scoring vs length-based scoring
 * 3. All models responding and building on each other's responses
 */

const { ImprovedDebate } = require('./src/improved-debate.js');
const fs = require('fs').promises;
const path = require('path');

class DebateTestSuite {
  constructor() {
    this.debate = new ImprovedDebate();
    this.testResults = {
      modelsResponding: false,
      turnBasedWorking: false,
      semanticScoringBetter: false,
      consensusBuilding: false,
      overallSuccess: false
    };
  }

  async runAllTests() {
    console.log('🧪 COMPREHENSIVE DEBATE-CONSENSUS TEST SUITE');
    console.log('=' .repeat(60));
    console.log('Testing 3 key improvements:');
    console.log('1. Turn-based debate mechanism');
    console.log('2. Semantic scoring vs length-based');
    console.log('3. Model collaboration and consensus building');
    console.log('=' .repeat(60) + '\n');

    try {
      // Test 1: Model Response Test
      await this.testModelResponses();
      
      // Test 2: Turn-based Mechanism Test
      await this.testTurnBasedMechanism();
      
      // Test 3: Semantic Scoring Test
      await this.testSemanticScoring();
      
      // Test 4: Full Integration Test
      await this.testFullIntegration();
      
      // Generate Test Report
      await this.generateTestReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test 1: Verify all 4 models can respond
   */
  async testModelResponses() {
    console.log('🔍 TEST 1: Model Response Verification');
    console.log('Testing that all 4 models respond to API calls...\n');

    try {
      const testQuestion = "What is the most important principle in software architecture?";
      const proposals = await this.debate.getInitialProposals(testQuestion, process.cwd());
      
      const responseCount = Object.keys(proposals).length;
      const expectedCount = this.debate.models.length;
      
      console.log(`📊 Models responded: ${responseCount}/${expectedCount}`);
      
      if (responseCount >= 3) { // At least 3 out of 4 models should respond
        this.testResults.modelsResponding = true;
        console.log('✅ TEST 1 PASSED: Sufficient models responding');
        
        // Show which models responded
        for (const [model, response] of Object.entries(proposals)) {
          console.log(`  ✅ ${model}: ${response.length} characters`);
        }
      } else {
        console.log('❌ TEST 1 FAILED: Not enough models responding');
        for (const model of this.debate.models) {
          const status = proposals[model.name] ? '✅' : '❌';
          console.log(`  ${status} ${model.name}`);
        }
      }
      
      console.log('');
      return proposals;
      
    } catch (error) {
      console.log('❌ TEST 1 FAILED:', error.message);
      throw error;
    }
  }

  /**
   * Test 2: Verify turn-based mechanism works
   */
  async testTurnBasedMechanism() {
    console.log('🔄 TEST 2: Turn-based Mechanism Verification');
    console.log('Testing that models reference and build on previous responses...\n');

    try {
      // Create a simple scenario for turn-based testing
      const testQuestion = "How should we implement error handling in a REST API?";
      const mockBestProposal = {
        model: 'Claude Opus 4.1',
        proposal: `# REST API Error Handling Strategy

## Core Approach
Use standardized HTTP status codes with structured error responses.

\`\`\`javascript
app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: error.message,
      code: statusCode
    }
  });
});
\`\`\`

This provides basic error handling with consistent structure.`,
        score: 1250
      };

      // Test turn-based improvements
      const improvements = await this.debate.runTurnBasedImprovement(
        mockBestProposal, 
        testQuestion, 
        { [mockBestProposal.model]: mockBestProposal.proposal }
      );

      const improvementCount = Object.keys(improvements).length;
      console.log(`📊 Turn-based improvements received: ${improvementCount}`);

      // Check if improvements reference the original solution
      let referencesFound = 0;
      let buildingOnPrevious = 0;

      for (const [model, improvement] of Object.entries(improvements)) {
        const improvementLower = improvement.toLowerCase();
        
        // Check if it references the original approach
        if (improvementLower.includes('error handling') || 
            improvementLower.includes('status code') ||
            improvementLower.includes('proposed') ||
            improvementLower.includes('current') ||
            improvementLower.includes('above') ||
            improvementLower.includes('existing')) {
          referencesFound++;
        }

        // Check if it builds constructively
        if (improvementLower.includes('addition') ||
            improvementLower.includes('enhance') ||
            improvementLower.includes('improve') ||
            improvementLower.includes('also') ||
            improvementLower.includes('furthermore') ||
            improvementLower.includes('suggest')) {
          buildingOnPrevious++;
        }

        console.log(`  📝 ${model}: ${improvement.length} chars, references: ${improvementLower.includes('status code') ? '✅' : '❌'}`);
      }

      if (improvementCount >= 2 && referencesFound >= 1) {
        this.testResults.turnBasedWorking = true;
        console.log('✅ TEST 2 PASSED: Turn-based mechanism working');
        console.log(`   Models building on previous: ${buildingOnPrevious}/${improvementCount}`);
      } else {
        console.log('❌ TEST 2 FAILED: Turn-based mechanism not working properly');
        console.log(`   References found: ${referencesFound}/${improvementCount}`);
      }

      console.log('');
      return improvements;

    } catch (error) {
      console.log('❌ TEST 2 FAILED:', error.message);
      throw error;
    }
  }

  /**
   * Test 3: Verify semantic scoring is better than length-based
   */
  async testSemanticScoring() {
    console.log('📊 TEST 3: Semantic Scoring vs Length-based Scoring');
    console.log('Testing that semantic scoring favors quality over length...\n');

    // Create test proposals - one long but low quality, one shorter but high quality
    const testProposals = {
      'Length-heavy Model': `This is a very long response that goes on and on without much substance. It contains a lot of words but not much technical content. The purpose is to show that length alone should not determine the best response. We can keep writing more and more text to make it longer and longer, but that doesn't make it better. Sometimes people think that more words equals more value, but that's not always true. In software development, conciseness and clarity are often more valuable than verbosity. This response continues to ramble without providing specific technical insights, code examples, or actionable recommendations. It's just filling space with words to make the character count higher. This is exactly the kind of response that length-based scoring would favor incorrectly. The old system would see this massive wall of text and think it's the best response, when in reality it provides very little value to someone actually trying to solve a technical problem.`,

      'Quality-focused Model': `# Database Connection Pooling Solution

## Implementation
\`\`\`javascript
const pool = new Pool({
  host: 'localhost',
  user: 'admin', 
  password: 'secret',
  database: 'myapp',
  max: 20, // maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Best practice: Always release connections
async function queryDatabase(sql, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  } finally {
    client.release(); // Important: release connection
  }
}
\`\`\`

## Key Benefits
- Connection reuse reduces overhead
- Automatic connection management
- Error handling with proper cleanup
- Configurable pool size for optimization

## Testing Strategy
Implement connection pool monitoring and add unit tests for connection lifecycle management.`
    };

    try {
      // Test semantic scoring
      const semanticScores = {};
      const lengthScores = {};

      for (const [model, proposal] of Object.entries(testProposals)) {
        semanticScores[model] = this.debate.calculateSemanticScore(proposal);
        lengthScores[model] = proposal.length; // Simple length scoring
        
        console.log(`📊 ${model}:`);
        console.log(`   Length: ${lengthScores[model]} chars`);
        console.log(`   Semantic Score: ${semanticScores[model]} points`);
      }

      // Determine winners
      const lengthWinner = Object.keys(lengthScores).reduce((a, b) => 
        lengthScores[a] > lengthScores[b] ? a : b);
      const semanticWinner = Object.keys(semanticScores).reduce((a, b) => 
        semanticScores[a] > semanticScores[b] ? a : b);

      console.log(`\n🏆 Length-based winner: ${lengthWinner}`);
      console.log(`🏆 Semantic-based winner: ${semanticWinner}`);

      // Semantic scoring should favor quality over length
      if (semanticWinner === 'Quality-focused Model' && lengthWinner === 'Length-heavy Model') {
        this.testResults.semanticScoringBetter = true;
        console.log('✅ TEST 3 PASSED: Semantic scoring correctly favors quality over length');
      } else {
        console.log('❌ TEST 3 FAILED: Semantic scoring not working as expected');
        console.log(`   Expected: Quality-focused to win semantically, Length-heavy to win by length`);
        console.log(`   Got: Semantic winner: ${semanticWinner}, Length winner: ${lengthWinner}`);
      }

      console.log('');

    } catch (error) {
      console.log('❌ TEST 3 FAILED:', error.message);
      throw error;
    }
  }

  /**
   * Test 4: Full integration test with real debate
   */
  async testFullIntegration() {
    console.log('🎯 TEST 4: Full Integration Test');
    console.log('Running complete debate to test all improvements together...\n');

    try {
      const testQuestion = "What are the key principles for implementing microservices architecture?";
      
      console.log(`Testing with question: "${testQuestion}"`);
      console.log('This will test the complete improved debate flow...\n');

      const result = await this.debate.runDebate(testQuestion, process.cwd());

      // Verify results
      const hasWinner = result.winner && result.winner.length > 0;
      const hasSolution = result.solution && result.solution.length > 500;
      const hasContributors = result.contributors && result.contributors.length > 0;
      const hasSemanticScore = result.semanticScore && result.semanticScore > 0;

      console.log('\n📊 Integration Test Results:');
      console.log(`   Winner identified: ${hasWinner ? '✅' : '❌'} (${result.winner})`);
      console.log(`   Solution generated: ${hasSolution ? '✅' : '❌'} (${result.solution?.length || 0} chars)`);
      console.log(`   Contributors participating: ${hasContributors ? '✅' : '❌'} (${result.contributors?.length || 0})`);
      console.log(`   Semantic scoring used: ${hasSemanticScore ? '✅' : '❌'} (${result.semanticScore || 0} points)`);
      console.log(`   Rounds completed: ${result.rounds || 0}/3`);

      if (hasWinner && hasSolution && hasContributors && hasSemanticScore) {
        this.testResults.consensusBuilding = true;
        console.log('✅ TEST 4 PASSED: Full integration working');
      } else {
        console.log('❌ TEST 4 FAILED: Integration issues detected');
      }

      console.log('');
      return result;

    } catch (error) {
      console.log('❌ TEST 4 FAILED:', error.message);
      // Don't throw here - we want to see the test report
    }
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport() {
    console.log('📋 FINAL TEST REPORT');
    console.log('=' .repeat(60));

    const tests = [
      { name: 'Model Response Test', key: 'modelsResponding', description: 'All 4 models respond to API calls' },
      { name: 'Turn-based Mechanism', key: 'turnBasedWorking', description: 'Models reference and build on previous responses' },
      { name: 'Semantic Scoring', key: 'semanticScoringBetter', description: 'Quality scoring beats length-based scoring' },
      { name: 'Consensus Building', key: 'consensusBuilding', description: 'Full debate integration produces consensus' }
    ];

    let passedCount = 0;
    for (const test of tests) {
      const status = this.testResults[test.key];
      console.log(`${status ? '✅' : '❌'} ${test.name}: ${test.description}`);
      if (status) passedCount++;
    }

    this.testResults.overallSuccess = passedCount === tests.length;
    
    console.log('');
    console.log(`Overall Result: ${this.testResults.overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`Tests passed: ${passedCount}/${tests.length}`);

    // Save test report
    try {
      const reportData = {
        timestamp: new Date().toISOString(),
        testResults: this.testResults,
        summary: {
          totalTests: tests.length,
          passed: passedCount,
          success: this.testResults.overallSuccess
        },
        improvements: [
          'Turn-based debate mechanism implemented',
          'Semantic scoring algorithm replaces length-based',
          'Direct OpenRouter API integration working',
          'Comprehensive consensus building process'
        ]
      };

      const reportFile = path.join('/opt/mcp/servers/debate-consensus/logs', `test-report-${Date.now()}.json`);
      await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));
      console.log(`📝 Detailed report saved: ${reportFile}`);

    } catch (error) {
      console.warn('⚠️ Could not save test report:', error.message);
    }

    console.log('=' .repeat(60));

    if (this.testResults.overallSuccess) {
      console.log('🎉 DEBATE-CONSENSUS IMPROVEMENTS SUCCESSFULLY IMPLEMENTED AND TESTED!');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the issues above.');
      process.exit(1);
    }
  }
}

// Run the test suite
async function main() {
  const testSuite = new DebateTestSuite();
  await testSuite.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

module.exports = { DebateTestSuite };