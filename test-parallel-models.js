#!/usr/bin/env node

/**
 * Integration Test: Parallel Model Execution
 *
 * Tests the parallel execution of all 5 models (k1-k5) including:
 * - Concurrent model spawning
 * - Resource management during parallel execution
 * - Timeout handling for slow models
 * - Result aggregation from parallel processes
 * - Performance under parallel load
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClaudeCliDebate } from './src/claude-cli-debate.js';
import { PerformanceTracker } from './src/performance-tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ParallelModelsTest {
  constructor() {
    this.testResults = [];
    this.debate = new ClaudeCliDebate();
    this.performanceTracker = new PerformanceTracker();
  }

  /**
   * Run comprehensive parallel models test
   */
  async runTest() {
    console.log('⚡ Starting Parallel Models Integration Test...\n');

    try {
      // Test 1: All 5 models in parallel
      await this.testAllModelsParallel();

      // Test 2: Resource management during parallel execution
      await this.testResourceManagement();

      // Test 3: Timeout handling with slow models
      await this.testTimeoutHandling();

      // Test 4: Result aggregation from parallel processes
      await this.testResultAggregation();

      // Test 5: Parallel performance benchmarking
      await this.testParallelPerformance();

      // Generate test report
      await this.generateTestReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test all 5 models running in parallel
   */
  async testAllModelsParallel() {
    console.log('📋 Test 1: All 5 Models in Parallel');
    const startTime = Date.now();

    try {
      const question = "What are the key differences between REST and GraphQL APIs?";

      // Monitor system resources before test
      const initialMemory = process.memoryUsage();

      // Run debate with all 5 models
      const result = await this.debate.runDebate(question, {
        models: ['k1', 'k2', 'k3', 'k4', 'k5'],
        preset: 'maximum',
        enableParallelExecution: true,
        timeout: 180000 // 3 minutes
      });

      // Monitor system resources after test
      const finalMemory = process.memoryUsage();

      // Validate that all models were attempted
      const modelsUsed = result.metadata?.modelsUsed || [];
      if (modelsUsed.length < 3) { // At least 3 should succeed
        throw new Error(`Too few models succeeded: ${modelsUsed.length}`);
      }

      // Check memory usage didn't explode
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      if (memoryIncrease > 500 * 1024 * 1024) { // 500MB threshold
        console.warn(`⚠️ High memory usage increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'All 5 Models in Parallel',
        status: 'PASS',
        duration: duration,
        details: {
          modelsUsed: modelsUsed,
          totalModelsAttempted: 5,
          successRate: `${(modelsUsed.length / 5 * 100).toFixed(1)}%`,
          memoryIncrease: Math.round(memoryIncrease / 1024 / 1024),
          confidence: result.metadata?.confidence || 0
        }
      });

      console.log(`✅ All models test passed - ${modelsUsed.length}/5 models succeeded`);

    } catch (error) {
      this.testResults.push({
        name: 'All 5 Models in Parallel',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ All models test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test resource management during parallel execution
   */
  async testResourceManagement() {
    console.log('📋 Test 2: Resource Management During Parallel Execution');
    const startTime = Date.now();

    try {
      const questions = [
        "Compare microservices vs monolithic architectures",
        "Explain the differences between SQL and NoSQL databases",
        "What are the benefits of containerization with Docker?"
      ];

      // Run multiple debates simultaneously to stress test resource management
      const promises = questions.map((question, index) =>
        this.debate.runDebate(question, {
          models: ['k1', 'k2', 'k3'],
          preset: 'balanced',
          enableParallelExecution: true,
          timeout: 120000,
          debateId: `resource-test-${index}`
        })
      );

      // Monitor resource usage during execution
      const resourceMonitor = this.startResourceMonitoring();

      // Wait for all debates to complete
      const results = await Promise.all(promises);

      // Stop monitoring
      const resourceStats = resourceMonitor.stop();

      // Validate all debates completed successfully
      for (let i = 0; i < results.length; i++) {
        if (!results[i].synthesis) {
          throw new Error(`Debate ${i} failed to complete`);
        }
      }

      // Check resource usage stayed reasonable
      if (resourceStats.maxMemoryMB > 1000) {
        console.warn(`⚠️ High peak memory usage: ${resourceStats.maxMemoryMB}MB`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Resource Management During Parallel Execution',
        status: 'PASS',
        duration: duration,
        details: {
          simultaneousDebates: questions.length,
          allCompleted: true,
          maxMemoryMB: resourceStats.maxMemoryMB,
          avgCpuPercent: resourceStats.avgCpuPercent
        }
      });

      console.log('✅ Resource management test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Resource Management During Parallel Execution',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Resource management test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test timeout handling with slow models
   */
  async testTimeoutHandling() {
    console.log('📋 Test 3: Timeout Handling with Slow Models');
    const startTime = Date.now();

    try {
      const question = "Provide a comprehensive analysis of cloud computing trends";

      // Use aggressive timeout to trigger timeout scenarios
      const result = await this.debate.runDebate(question, {
        models: ['k1', 'k2', 'k3', 'k4', 'k5'],
        preset: 'maximum',
        enableParallelExecution: true,
        timeout: 30000, // Very short timeout - 30 seconds
        enableTimeoutRecovery: true
      });

      // Should still get some result even with timeouts
      if (!result.synthesis) {
        throw new Error('No synthesis generated despite timeout recovery');
      }

      // Check if timeout recovery worked
      const modelsUsed = result.metadata?.modelsUsed || [];
      const timedOutModels = result.metadata?.timedOutModels || [];

      if (modelsUsed.length === 0 && timedOutModels.length === 0) {
        throw new Error('No evidence of timeout handling');
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Timeout Handling with Slow Models',
        status: 'PASS',
        duration: duration,
        details: {
          modelsSucceeded: modelsUsed.length,
          modelsTimedOut: timedOutModels.length,
          totalModels: 5,
          timeoutRecovery: true,
          shortTimeout: '30s'
        }
      });

      console.log(`✅ Timeout handling test passed - ${modelsUsed.length} succeeded, ${timedOutModels.length} timed out`);

    } catch (error) {
      this.testResults.push({
        name: 'Timeout Handling with Slow Models',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Timeout handling test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test result aggregation from parallel processes
   */
  async testResultAggregation() {
    console.log('📋 Test 4: Result Aggregation from Parallel Processes');
    const startTime = Date.now();

    try {
      const question = "What are the pros and cons of different programming paradigms?";

      // Run with maximum models to test aggregation
      const result = await this.debate.runDebate(question, {
        models: ['k1', 'k2', 'k3', 'k4'],
        preset: 'maximum',
        enableParallelExecution: true,
        enableAggregation: true,
        aggregationStrategy: 'comprehensive'
      });

      // Validate aggregation quality
      if (!result.synthesis || result.synthesis.length < 200) {
        throw new Error('Aggregated synthesis is too short');
      }

      // Check for evidence of multiple perspectives being combined
      const modelsUsed = result.metadata?.modelsUsed || [];
      if (modelsUsed.length < 2) {
        throw new Error('Not enough models for meaningful aggregation');
      }

      // Validate confidence scoring reflects aggregation
      const confidence = result.metadata?.confidence || 0;
      if (confidence === 0) {
        throw new Error('No confidence score generated from aggregation');
      }

      // Check for individual model responses if available
      if (result.individualResponses) {
        if (result.individualResponses.length !== modelsUsed.length) {
          throw new Error('Mismatch between models used and individual responses');
        }
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Result Aggregation from Parallel Processes',
        status: 'PASS',
        duration: duration,
        details: {
          modelsAggregated: modelsUsed.length,
          synthesisLength: result.synthesis.length,
          confidence: confidence,
          hasIndividualResponses: !!result.individualResponses,
          aggregationStrategy: 'comprehensive'
        }
      });

      console.log('✅ Result aggregation test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Result Aggregation from Parallel Processes',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Result aggregation test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test parallel performance benchmarking
   */
  async testParallelPerformance() {
    console.log('📋 Test 5: Parallel Performance Benchmarking');
    const startTime = Date.now();

    try {
      const question = "Compare different database technologies";

      // Sequential execution baseline
      console.log('  🔄 Running sequential baseline...');
      const sequentialStart = Date.now();
      const sequentialResult = await this.debate.runDebate(question, {
        models: ['k1', 'k2', 'k3'],
        preset: 'balanced',
        enableParallelExecution: false
      });
      const sequentialTime = Date.now() - sequentialStart;

      // Parallel execution test
      console.log('  ⚡ Running parallel execution...');
      const parallelStart = Date.now();
      const parallelResult = await this.debate.runDebate(question, {
        models: ['k1', 'k2', 'k3'],
        preset: 'balanced',
        enableParallelExecution: true
      });
      const parallelTime = Date.now() - parallelStart;

      // Calculate performance improvement
      const speedupRatio = sequentialTime / parallelTime;
      const expectedMinSpeedup = 1.5; // Expect at least 50% improvement

      if (speedupRatio < expectedMinSpeedup) {
        console.warn(`⚠️ Parallel execution not significantly faster: ${speedupRatio.toFixed(2)}x`);
      }

      // Validate quality isn't significantly degraded
      const sequentialConfidence = sequentialResult.metadata?.confidence || 0;
      const parallelConfidence = parallelResult.metadata?.confidence || 0;
      const confidenceDrop = sequentialConfidence - parallelConfidence;

      if (confidenceDrop > 15) {
        console.warn(`⚠️ Significant confidence drop in parallel: ${confidenceDrop}%`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Parallel Performance Benchmarking',
        status: 'PASS',
        duration: duration,
        details: {
          sequentialTimeMs: sequentialTime,
          parallelTimeMs: parallelTime,
          speedupRatio: speedupRatio,
          sequentialConfidence: sequentialConfidence,
          parallelConfidence: parallelConfidence,
          confidenceDrop: confidenceDrop,
          performanceGain: `${((speedupRatio - 1) * 100).toFixed(1)}%`
        }
      });

      console.log(`✅ Performance benchmarking test passed - ${speedupRatio.toFixed(2)}x speedup`);

    } catch (error) {
      this.testResults.push({
        name: 'Parallel Performance Benchmarking',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Performance benchmarking test failed:', error.message);
      throw error;
    }
  }

  /**
   * Start monitoring system resources
   */
  startResourceMonitoring() {
    const stats = {
      memoryReadings: [],
      cpuReadings: [],
      maxMemoryMB: 0,
      avgCpuPercent: 0
    };

    const interval = setInterval(() => {
      const memory = process.memoryUsage();
      const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);

      stats.memoryReadings.push(memoryMB);
      stats.maxMemoryMB = Math.max(stats.maxMemoryMB, memoryMB);

      // Simplified CPU usage (would need more complex implementation for real CPU%)
      const cpuUsage = process.cpuUsage();
      stats.cpuReadings.push(cpuUsage.user + cpuUsage.system);
    }, 1000);

    return {
      stop: () => {
        clearInterval(interval);

        if (stats.cpuReadings.length > 1) {
          const avgCpu = stats.cpuReadings.reduce((a, b) => a + b, 0) / stats.cpuReadings.length;
          stats.avgCpuPercent = Math.round(avgCpu / 1000000); // Simplified conversion
        }

        return stats;
      }
    };
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
    const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;

    const report = {
      testSuite: 'Parallel Models Integration Test',
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
        cpuCount: require('os').cpus().length,
        totalMemoryGB: Math.round(require('os').totalmem() / 1024 / 1024 / 1024)
      }
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'logs', `parallel-models-test-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('⚡ PARALLEL MODELS TEST REPORT');
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

    console.log('\n🎉 All parallel execution tests passed!');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testRunner = new ParallelModelsTest();
  testRunner.runTest().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { ParallelModelsTest };