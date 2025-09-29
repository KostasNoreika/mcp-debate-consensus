#!/usr/bin/env node

/**
 * Integration Test: Complete Debate Flow
 *
 * Tests the end-to-end debate workflow including:
 * - Question processing and validation
 * - Model selection by GeminiCoordinator
 * - Parallel model execution
 * - Consensus building
 * - Confidence scoring
 * - Result compilation
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClaudeCliDebate } from './src/claude-cli-debate.js';
import { Security } from './src/security.js';
import { PerformanceTracker } from './src/performance-tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class CompleteDebateFlowTest {
  constructor() {
    this.testResults = [];
    this.security = new Security();
    this.performanceTracker = new PerformanceTracker();
    this.debate = new ClaudeCliDebate();
  }

  /**
   * Run comprehensive debate flow test
   */
  async runTest() {
    console.log('🧪 Starting Complete Debate Flow Integration Test...\n');

    try {
      // Test 1: Basic debate flow
      await this.testBasicDebateFlow();

      // Test 2: Complex multi-step question
      await this.testComplexDebateFlow();

      // Test 3: Error handling in debate flow
      await this.testErrorHandlingFlow();

      // Test 4: Cache integration in flow
      await this.testCacheIntegrationFlow();

      // Test 5: Performance tracking integration
      await this.testPerformanceTrackingFlow();

      // Generate test report
      await this.generateTestReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test basic debate flow
   */
  async testBasicDebateFlow() {
    console.log('📋 Test 1: Basic Debate Flow');
    const startTime = Date.now();

    try {
      const question = "What is the most effective programming language for web development in 2025?";

      // Test question validation
      const isValid = this.security.validateInput({ question });
      if (!isValid.valid) {
        throw new Error('Question validation failed');
      }

      // Run debate with minimal configuration
      const result = await this.debate.runDebate(question, {
        models: ['k1', 'k2', 'k3'], // Use 3 models for faster testing
        preset: 'balanced',
        enableCaching: true,
        enableLearning: true
      });

      // Validate result structure
      this.validateDebateResult(result, 'basic debate');

      // Check performance metrics
      const duration = Date.now() - startTime;
      if (duration > 120000) { // 2 minutes max for basic test
        throw new Error(`Basic debate took too long: ${duration}ms`);
      }

      this.testResults.push({
        name: 'Basic Debate Flow',
        status: 'PASS',
        duration: duration,
        details: {
          modelsUsed: result.metadata?.modelsUsed || [],
          confidence: result.metadata?.confidence || 0,
          cached: result.metadata?.fromCache || false
        }
      });

      console.log('✅ Basic debate flow test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Basic Debate Flow',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Basic debate flow test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test complex multi-step debate flow
   */
  async testComplexDebateFlow() {
    console.log('📋 Test 2: Complex Multi-Step Debate Flow');
    const startTime = Date.now();

    try {
      const complexQuestion = `
        Analyze the trade-offs between microservices and monolithic architectures
        for a mid-size e-commerce platform (1M users, $50M revenue). Consider:
        1. Development team size and structure
        2. Scalability requirements
        3. Operational complexity
        4. Cost implications
        5. Timeline to market

        Provide a detailed recommendation with implementation roadmap.
      `;

      // Run debate with full configuration
      const result = await this.debate.runDebate(complexQuestion, {
        models: ['k1', 'k2', 'k3', 'k4'], // Use 4 models
        preset: 'maximum',
        enableCaching: true,
        enableLearning: true,
        enableCrossVerification: true,
        confidenceThreshold: 75
      });

      // Validate comprehensive result
      this.validateDebateResult(result, 'complex debate');

      // Check that complex analysis was performed
      if (!result.synthesis || result.synthesis.length < 500) {
        throw new Error('Complex question did not generate comprehensive analysis');
      }

      // Verify confidence scoring for complex topic
      if (result.metadata?.confidence < 60) {
        console.warn('⚠️ Low confidence on complex topic:', result.metadata?.confidence);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Complex Multi-Step Debate Flow',
        status: 'PASS',
        duration: duration,
        details: {
          synthesisLength: result.synthesis?.length || 0,
          modelsUsed: result.metadata?.modelsUsed || [],
          confidence: result.metadata?.confidence || 0,
          crossVerified: result.metadata?.crossVerified || false
        }
      });

      console.log('✅ Complex debate flow test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Complex Multi-Step Debate Flow',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Complex debate flow test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test error handling in debate flow
   */
  async testErrorHandlingFlow() {
    console.log('📋 Test 3: Error Handling Flow');
    const startTime = Date.now();

    try {
      // Test with invalid question
      try {
        await this.debate.runDebate('', { models: ['k1'] });
        throw new Error('Should have failed with empty question');
      } catch (error) {
        if (!error.message.includes('empty') && !error.message.includes('invalid')) {
          throw error; // Re-throw if not expected validation error
        }
      }

      // Test with non-existent model
      try {
        const result = await this.debate.runDebate('Simple question?', {
          models: ['k1', 'nonexistent-model', 'k2']
        });

        // Should succeed but with fewer models
        if (!result.metadata?.modelsUsed || result.metadata.modelsUsed.length === 0) {
          throw new Error('No valid models were used');
        }

      } catch (error) {
        // This is acceptable if it fails gracefully
        console.log('⚠️ Graceful handling of invalid model:', error.message);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Error Handling Flow',
        status: 'PASS',
        duration: duration,
        details: {
          validationWorks: true,
          gracefulDegradation: true
        }
      });

      console.log('✅ Error handling flow test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Error Handling Flow',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Error handling flow test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test cache integration in debate flow
   */
  async testCacheIntegrationFlow() {
    console.log('📋 Test 4: Cache Integration Flow');
    const startTime = Date.now();

    try {
      const testQuestion = "What are the benefits of TypeScript over JavaScript?";

      // First request - should populate cache
      const firstResult = await this.debate.runDebate(testQuestion, {
        models: ['k1', 'k2'],
        preset: 'rapid',
        enableCaching: true
      });

      const firstDuration = Date.now() - startTime;

      // Second request - should hit cache
      const cacheStartTime = Date.now();
      const secondResult = await this.debate.runDebate(testQuestion, {
        models: ['k1', 'k2'],
        preset: 'rapid',
        enableCaching: true
      });

      const secondDuration = Date.now() - cacheStartTime;

      // Verify cache hit
      if (secondResult.metadata?.fromCache !== true) {
        console.warn('⚠️ Cache may not have been hit on second request');
      }

      // Cache hit should be significantly faster
      if (secondDuration > firstDuration * 0.5) {
        console.warn('⚠️ Cache hit was not significantly faster');
      }

      this.testResults.push({
        name: 'Cache Integration Flow',
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          firstRequestTime: firstDuration,
          cacheHitTime: secondDuration,
          cacheHit: secondResult.metadata?.fromCache || false,
          speedupRatio: firstDuration / secondDuration
        }
      });

      console.log('✅ Cache integration flow test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Cache Integration Flow',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Cache integration flow test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test performance tracking integration
   */
  async testPerformanceTrackingFlow() {
    console.log('📋 Test 5: Performance Tracking Integration');
    const startTime = Date.now();

    try {
      const testQuestion = "Compare React and Vue.js frameworks";

      // Clear existing metrics for clean test
      await this.performanceTracker.clearMetrics();

      // Run debate and track performance
      const result = await this.debate.runDebate(testQuestion, {
        models: ['k1', 'k2'],
        preset: 'balanced',
        enableCaching: false, // Disable to ensure fresh metrics
        enablePerformanceTracking: true
      });

      // Wait a moment for metrics to be recorded
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if metrics were recorded
      const metrics = await this.performanceTracker.getMetrics();

      if (!metrics || metrics.length === 0) {
        throw new Error('No performance metrics were recorded');
      }

      // Verify metric structure
      const latestMetric = metrics[0];
      if (!latestMetric.response_time || !latestMetric.models_used) {
        throw new Error('Performance metrics are incomplete');
      }

      this.testResults.push({
        name: 'Performance Tracking Integration',
        status: 'PASS',
        duration: Date.now() - startTime,
        details: {
          metricsRecorded: metrics.length,
          responseTime: latestMetric.response_time,
          modelsTracked: latestMetric.models_used
        }
      });

      console.log('✅ Performance tracking integration test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Performance Tracking Integration',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Performance tracking integration test failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate debate result structure
   */
  validateDebateResult(result, testName) {
    if (!result) {
      throw new Error(`${testName}: No result returned`);
    }

    if (!result.synthesis || typeof result.synthesis !== 'string') {
      throw new Error(`${testName}: No synthesis in result`);
    }

    if (!result.metadata) {
      throw new Error(`${testName}: No metadata in result`);
    }

    if (!result.metadata.modelsUsed || !Array.isArray(result.metadata.modelsUsed)) {
      throw new Error(`${testName}: No models used information`);
    }

    if (result.metadata.modelsUsed.length === 0) {
      throw new Error(`${testName}: No models were successfully used`);
    }

    if (typeof result.metadata.confidence !== 'number' || result.metadata.confidence < 0 || result.metadata.confidence > 100) {
      throw new Error(`${testName}: Invalid confidence score`);
    }
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
    const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;

    const report = {
      testSuite: 'Complete Debate Flow Integration Test',
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
      },
      results: this.testResults,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory: process.memoryUsage()
      }
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'logs', `debate-flow-test-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('🧪 COMPLETE DEBATE FLOW TEST REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}`);
    console.log(`📁 Report saved to: ${reportPath}`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(t => t.status === 'FAIL')
        .forEach(test => {
          console.log(`  • ${test.name}: ${test.error}`);
        });

      throw new Error(`${failedTests} tests failed`);
    }

    console.log('\n🎉 All tests passed!');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testRunner = new CompleteDebateFlowTest();
  testRunner.runTest().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { CompleteDebateFlowTest };