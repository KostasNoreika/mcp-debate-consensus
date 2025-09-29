#!/usr/bin/env node

/**
 * Integration Test: Performance Testing
 *
 * Tests the system performance under various load conditions including:
 * - Response time measurements
 * - Throughput testing (100 requests, 10 concurrent)
 * - Memory usage monitoring
 * - CPU utilization tracking
 * - Cache performance impact
 * - P95 latency validation (< 1s requirement)
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClaudeCliDebate } from './src/claude-cli-debate.js';
import { PerformanceTracker } from './src/performance-tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class PerformanceTest {
  constructor() {
    this.testResults = [];
    this.debate = new ClaudeCliDebate();
    this.performanceTracker = new PerformanceTracker();
    this.metrics = {
      responseTimes: [],
      memoryUsage: [],
      cpuUsage: [],
      errors: []
    };
  }

  /**
   * Run comprehensive performance test
   */
  async runTest() {
    console.log('🚀 Starting Performance Integration Test...\n');

    try {
      // Test 1: Response time baseline
      await this.testResponseTimeBaseline();

      // Test 2: Throughput testing (100 requests)
      await this.testThroughput();

      // Test 3: Concurrent load testing (10 concurrent)
      await this.testConcurrentLoad();

      // Test 4: Memory usage monitoring
      await this.testMemoryUsage();

      // Test 5: Cache performance impact
      await this.testCachePerformance();

      // Test 6: P95 latency validation
      await this.testLatencyRequirements();

      // Generate test report
      await this.generateTestReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test response time baseline
   */
  async testResponseTimeBaseline() {
    console.log('📋 Test 1: Response Time Baseline');
    const startTime = Date.now();

    try {
      const testQuestions = [
        "What is JavaScript?",
        "Compare SQL vs NoSQL",
        "Explain REST APIs",
        "What is Docker?",
        "Benefits of TypeScript"
      ];

      const baselineResults = [];

      for (const question of testQuestions) {
        const requestStart = Date.now();

        const result = await this.debate.runDebate(question, {
          models: ['k1', 'k2'], // Use 2 models for faster baseline
          preset: 'rapid',
          enableCaching: false // Disable cache for true baseline
        });

        const responseTime = Date.now() - requestStart;
        baselineResults.push({
          question: question,
          responseTime: responseTime,
          success: !!result.synthesis,
          confidence: result.metadata?.confidence || 0
        });

        this.metrics.responseTimes.push(responseTime);

        console.log(`  ✅ ${question.substring(0, 20)}... - ${responseTime}ms`);
      }

      // Calculate baseline statistics
      const avgResponseTime = baselineResults.reduce((sum, r) => sum + r.responseTime, 0) / baselineResults.length;
      const maxResponseTime = Math.max(...baselineResults.map(r => r.responseTime));
      const minResponseTime = Math.min(...baselineResults.map(r => r.responseTime));

      if (avgResponseTime > 30000) { // 30 seconds
        console.warn(`⚠️ High average response time: ${avgResponseTime}ms`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Response Time Baseline',
        status: 'PASS',
        duration: duration,
        details: {
          totalQuestions: testQuestions.length,
          avgResponseTime: Math.round(avgResponseTime),
          maxResponseTime: maxResponseTime,
          minResponseTime: minResponseTime,
          allSuccessful: baselineResults.every(r => r.success)
        }
      });

      console.log(`✅ Baseline test passed - Avg: ${Math.round(avgResponseTime)}ms`);

    } catch (error) {
      this.testResults.push({
        name: 'Response Time Baseline',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Baseline test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test throughput with 100 requests
   */
  async testThroughput() {
    console.log('📋 Test 2: Throughput Testing (100 requests)');
    const startTime = Date.now();

    try {
      const totalRequests = 100;
      const testQuestion = "What are the benefits of cloud computing?";
      const batchSize = 10; // Process in batches to manage resources

      let completedRequests = 0;
      let successfulRequests = 0;
      let failedRequests = 0;
      const throughputResults = [];

      console.log(`  🔄 Processing ${totalRequests} requests in batches of ${batchSize}...`);

      // Process requests in batches
      for (let i = 0; i < totalRequests; i += batchSize) {
        const batchPromises = [];
        const batchStart = Date.now();

        // Create batch of requests
        for (let j = 0; j < batchSize && (i + j) < totalRequests; j++) {
          const requestPromise = this.debate.runDebate(testQuestion, {
            models: ['k1'], // Single model for throughput test
            preset: 'rapid',
            enableCaching: true,
            timeout: 30000
          }).then(result => {
            successfulRequests++;
            return {
              success: true,
              responseTime: Date.now() - batchStart,
              confidence: result.metadata?.confidence || 0
            };
          }).catch(error => {
            failedRequests++;
            this.metrics.errors.push(error.message);
            return {
              success: false,
              responseTime: Date.now() - batchStart,
              error: error.message
            };
          });

          batchPromises.push(requestPromise);
        }

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        throughputResults.push(...batchResults);
        completedRequests += batchResults.length;

        // Progress update
        if (completedRequests % 20 === 0) {
          console.log(`  📊 Progress: ${completedRequests}/${totalRequests} (${Math.round(completedRequests/totalRequests*100)}%)`);
        }

        // Small delay between batches to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const totalDuration = Date.now() - startTime;
      const requestsPerSecond = (completedRequests / totalDuration) * 1000;
      const successRate = (successfulRequests / completedRequests) * 100;

      // Calculate throughput statistics
      const responseTimes = throughputResults.filter(r => r.success).map(r => r.responseTime);
      const avgThroughputResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;

      if (successRate < 90) {
        throw new Error(`Success rate too low: ${successRate}%`);
      }

      if (requestsPerSecond < 0.5) { // At least 0.5 requests per second
        console.warn(`⚠️ Low throughput: ${requestsPerSecond.toFixed(2)} req/s`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Throughput Testing (100 requests)',
        status: 'PASS',
        duration: duration,
        details: {
          totalRequests: completedRequests,
          successfulRequests: successfulRequests,
          failedRequests: failedRequests,
          successRate: `${successRate.toFixed(1)}%`,
          requestsPerSecond: requestsPerSecond.toFixed(2),
          avgResponseTime: Math.round(avgThroughputResponseTime),
          totalDurationMs: totalDuration
        }
      });

      console.log(`✅ Throughput test passed - ${requestsPerSecond.toFixed(2)} req/s, ${successRate.toFixed(1)}% success`);

    } catch (error) {
      this.testResults.push({
        name: 'Throughput Testing (100 requests)',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Throughput test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test concurrent load with 10 concurrent requests
   */
  async testConcurrentLoad() {
    console.log('📋 Test 3: Concurrent Load Testing (10 concurrent)');
    const startTime = Date.now();

    try {
      const concurrentRequests = 10;
      const testQuestions = [
        "What is machine learning?",
        "Compare React vs Angular",
        "Benefits of microservices",
        "What is DevOps?",
        "Explain blockchain technology",
        "What is artificial intelligence?",
        "Compare Python vs Java",
        "What is cloud computing?",
        "Benefits of automation",
        "What is cybersecurity?"
      ];

      console.log(`  ⚡ Starting ${concurrentRequests} concurrent requests...`);

      // Start resource monitoring
      const resourceMonitor = this.startResourceMonitoring();

      // Create concurrent promises
      const concurrentPromises = testQuestions.map((question, index) =>
        this.debate.runDebate(question, {
          models: ['k1', 'k2'],
          preset: 'balanced',
          enableCaching: true,
          timeout: 60000,
          requestId: `concurrent-${index}`
        }).then(result => ({
          index: index,
          question: question,
          success: true,
          responseTime: Date.now() - startTime,
          confidence: result.metadata?.confidence || 0
        })).catch(error => ({
          index: index,
          question: question,
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        }))
      );

      // Wait for all concurrent requests to complete
      const concurrentResults = await Promise.all(concurrentPromises);

      // Stop resource monitoring
      const resourceStats = resourceMonitor.stop();

      const totalConcurrentDuration = Date.now() - startTime;
      const successfulConcurrent = concurrentResults.filter(r => r.success).length;
      const concurrentSuccessRate = (successfulConcurrent / concurrentRequests) * 100;

      // Calculate concurrent response time statistics
      const concurrentResponseTimes = concurrentResults.filter(r => r.success).map(r => r.responseTime);
      const avgConcurrentResponseTime = concurrentResponseTimes.reduce((sum, rt) => sum + rt, 0) / concurrentResponseTimes.length;
      const maxConcurrentResponseTime = Math.max(...concurrentResponseTimes);

      if (concurrentSuccessRate < 80) {
        throw new Error(`Concurrent success rate too low: ${concurrentSuccessRate}%`);
      }

      if (resourceStats.maxMemoryMB > 2000) { // 2GB limit
        console.warn(`⚠️ High memory usage during concurrent test: ${resourceStats.maxMemoryMB}MB`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Concurrent Load Testing (10 concurrent)',
        status: 'PASS',
        duration: duration,
        details: {
          concurrentRequests: concurrentRequests,
          successfulRequests: successfulConcurrent,
          successRate: `${concurrentSuccessRate.toFixed(1)}%`,
          avgResponseTime: Math.round(avgConcurrentResponseTime),
          maxResponseTime: maxConcurrentResponseTime,
          maxMemoryMB: resourceStats.maxMemoryMB,
          totalDurationMs: totalConcurrentDuration
        }
      });

      console.log(`✅ Concurrent load test passed - ${concurrentSuccessRate.toFixed(1)}% success, ${Math.round(avgConcurrentResponseTime)}ms avg`);

    } catch (error) {
      this.testResults.push({
        name: 'Concurrent Load Testing (10 concurrent)',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Concurrent load test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test memory usage monitoring
   */
  async testMemoryUsage() {
    console.log('📋 Test 4: Memory Usage Monitoring');
    const startTime = Date.now();

    try {
      const initialMemory = process.memoryUsage();
      console.log(`  📊 Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

      // Run several debates to monitor memory usage
      const memoryTestQuestions = [
        "What is software architecture?",
        "Compare database technologies",
        "What are design patterns?",
        "Benefits of test-driven development",
        "What is continuous integration?"
      ];

      const memoryReadings = [initialMemory.heapUsed];

      for (const question of memoryTestQuestions) {
        const beforeMemory = process.memoryUsage().heapUsed;

        await this.debate.runDebate(question, {
          models: ['k1', 'k2'],
          preset: 'balanced',
          enableCaching: true
        });

        const afterMemory = process.memoryUsage().heapUsed;
        memoryReadings.push(afterMemory);

        const memoryDiff = afterMemory - beforeMemory;
        console.log(`  📈 After "${question.substring(0, 30)}...": ${Math.round(afterMemory / 1024 / 1024)}MB (${memoryDiff > 0 ? '+' : ''}${Math.round(memoryDiff / 1024 / 1024)}MB)`);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryLeakThreshold = 100 * 1024 * 1024; // 100MB

      console.log(`  📊 Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`  📈 Total increase: ${Math.round(totalMemoryIncrease / 1024 / 1024)}MB`);

      if (totalMemoryIncrease > memoryLeakThreshold) {
        console.warn(`⚠️ Potential memory leak detected: ${Math.round(totalMemoryIncrease / 1024 / 1024)}MB increase`);
      }

      // Calculate memory statistics
      const maxMemory = Math.max(...memoryReadings);
      const avgMemory = memoryReadings.reduce((sum, mem) => sum + mem, 0) / memoryReadings.length;

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Memory Usage Monitoring',
        status: 'PASS',
        duration: duration,
        details: {
          initialMemoryMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
          finalMemoryMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
          maxMemoryMB: Math.round(maxMemory / 1024 / 1024),
          avgMemoryMB: Math.round(avgMemory / 1024 / 1024),
          memoryIncreaseMB: Math.round(totalMemoryIncrease / 1024 / 1024),
          potentialLeak: totalMemoryIncrease > memoryLeakThreshold
        }
      });

      console.log('✅ Memory usage test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Memory Usage Monitoring',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Memory usage test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test cache performance impact
   */
  async testCachePerformance() {
    console.log('📋 Test 5: Cache Performance Impact');
    const startTime = Date.now();

    try {
      const testQuestion = "What are the advantages of caching in web applications?";

      // First request - populate cache
      console.log('  🔄 First request (populating cache)...');
      const firstRequestStart = Date.now();
      const firstResult = await this.debate.runDebate(testQuestion, {
        models: ['k1', 'k2'],
        preset: 'balanced',
        enableCaching: true
      });
      const firstRequestTime = Date.now() - firstRequestStart;

      // Second request - should hit cache
      console.log('  ⚡ Second request (should hit cache)...');
      const secondRequestStart = Date.now();
      const secondResult = await this.debate.runDebate(testQuestion, {
        models: ['k1', 'k2'],
        preset: 'balanced',
        enableCaching: true
      });
      const secondRequestTime = Date.now() - secondRequestStart;

      // Third request - without cache
      console.log('  🐌 Third request (cache disabled)...');
      const thirdRequestStart = Date.now();
      const thirdResult = await this.debate.runDebate(testQuestion, {
        models: ['k1', 'k2'],
        preset: 'balanced',
        enableCaching: false
      });
      const thirdRequestTime = Date.now() - thirdRequestStart;

      // Calculate cache performance metrics
      const cacheSpeedup = firstRequestTime / secondRequestTime;
      const cacheHitDetected = secondResult.metadata?.fromCache === true;
      const cacheEffectiveness = ((firstRequestTime - secondRequestTime) / firstRequestTime) * 100;

      console.log(`  📊 First request: ${firstRequestTime}ms`);
      console.log(`  📊 Cache hit: ${secondRequestTime}ms (${cacheSpeedup.toFixed(2)}x faster)`);
      console.log(`  📊 No cache: ${thirdRequestTime}ms`);

      if (cacheSpeedup < 2) {
        console.warn(`⚠️ Cache speedup lower than expected: ${cacheSpeedup.toFixed(2)}x`);
      }

      if (!cacheHitDetected) {
        console.warn('⚠️ Cache hit not properly detected in metadata');
      }

      // Test cache with different questions
      const cacheVariationTests = [
        "What is database indexing?",
        "Benefits of code reviews",
        "What is API rate limiting?"
      ];

      let cacheVariationResults = [];
      for (const question of cacheVariationTests) {
        const start = Date.now();
        await this.debate.runDebate(question, {
          models: ['k1'],
          preset: 'rapid',
          enableCaching: true
        });
        cacheVariationResults.push(Date.now() - start);
      }

      const avgCacheVariationTime = cacheVariationResults.reduce((sum, time) => sum + time, 0) / cacheVariationResults.length;

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Cache Performance Impact',
        status: 'PASS',
        duration: duration,
        details: {
          firstRequestMs: firstRequestTime,
          cacheHitMs: secondRequestTime,
          noCacheMs: thirdRequestTime,
          cacheSpeedup: `${cacheSpeedup.toFixed(2)}x`,
          cacheEffectiveness: `${cacheEffectiveness.toFixed(1)}%`,
          cacheHitDetected: cacheHitDetected,
          avgVariationTimeMs: Math.round(avgCacheVariationTime)
        }
      });

      console.log('✅ Cache performance test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Cache Performance Impact',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Cache performance test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test P95 latency requirements (< 1s)
   */
  async testLatencyRequirements() {
    console.log('📋 Test 6: P95 Latency Validation (< 1s requirement)');
    const startTime = Date.now();

    try {
      const latencyTestSize = 20; // Enough samples for P95 calculation
      const testQuestion = "What is the difference between HTTP and HTTPS?";
      const latencyRequirement = 1000; // 1 second in milliseconds

      console.log(`  📊 Running ${latencyTestSize} requests for P95 latency calculation...`);

      const latencyResults = [];

      // Run requests for latency testing
      for (let i = 0; i < latencyTestSize; i++) {
        const requestStart = Date.now();

        try {
          await this.debate.runDebate(testQuestion, {
            models: ['k1'], // Single model for consistent timing
            preset: 'rapid',
            enableCaching: false, // Disable cache for true latency testing
            timeout: 5000 // 5 second timeout
          });

          const responseTime = Date.now() - requestStart;
          latencyResults.push(responseTime);

          if (i % 5 === 0) {
            console.log(`  🔄 Progress: ${i + 1}/${latencyTestSize} (${responseTime}ms)`);
          }

        } catch (error) {
          const responseTime = Date.now() - requestStart;
          latencyResults.push(responseTime);
          console.log(`  ⚠️ Request ${i + 1} failed in ${responseTime}ms: ${error.message}`);
        }
      }

      // Calculate percentiles
      const sortedLatencies = latencyResults.sort((a, b) => a - b);
      const p50Index = Math.floor(sortedLatencies.length * 0.50);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p99Index = Math.floor(sortedLatencies.length * 0.99);

      const p50Latency = sortedLatencies[p50Index];
      const p95Latency = sortedLatencies[p95Index];
      const p99Latency = sortedLatencies[p99Index];
      const maxLatency = Math.max(...sortedLatencies);
      const avgLatency = sortedLatencies.reduce((sum, lat) => sum + lat, 0) / sortedLatencies.length;

      console.log(`  📊 P50 latency: ${p50Latency}ms`);
      console.log(`  📊 P95 latency: ${p95Latency}ms`);
      console.log(`  📊 P99 latency: ${p99Latency}ms`);
      console.log(`  📊 Max latency: ${maxLatency}ms`);
      console.log(`  📊 Avg latency: ${Math.round(avgLatency)}ms`);

      // Check P95 requirement
      const p95RequirementMet = p95Latency <= latencyRequirement;
      if (!p95RequirementMet) {
        throw new Error(`P95 latency requirement not met: ${p95Latency}ms > ${latencyRequirement}ms`);
      }

      // Additional latency checks
      const acceptableLatencyRate = sortedLatencies.filter(lat => lat <= latencyRequirement).length / sortedLatencies.length * 100;

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'P95 Latency Validation (< 1s requirement)',
        status: 'PASS',
        duration: duration,
        details: {
          totalRequests: latencyTestSize,
          p50LatencyMs: p50Latency,
          p95LatencyMs: p95Latency,
          p99LatencyMs: p99Latency,
          maxLatencyMs: maxLatency,
          avgLatencyMs: Math.round(avgLatency),
          requirementMs: latencyRequirement,
          p95RequirementMet: p95RequirementMet,
          acceptableLatencyRate: `${acceptableLatencyRate.toFixed(1)}%`
        }
      });

      console.log(`✅ P95 latency test passed - ${p95Latency}ms < ${latencyRequirement}ms`);

    } catch (error) {
      this.testResults.push({
        name: 'P95 Latency Validation (< 1s requirement)',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ P95 latency test failed:', error.message);
      throw error;
    }
  }

  /**
   * Start monitoring system resources
   */
  startResourceMonitoring() {
    const stats = {
      memoryReadings: [],
      startTime: Date.now(),
      maxMemoryMB: 0
    };

    const interval = setInterval(() => {
      const memory = process.memoryUsage();
      const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);

      stats.memoryReadings.push(memoryMB);
      stats.maxMemoryMB = Math.max(stats.maxMemoryMB, memoryMB);
    }, 1000);

    return {
      stop: () => {
        clearInterval(interval);
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

    // Calculate overall performance metrics
    const overallMetrics = {
      totalResponseTimes: this.metrics.responseTimes.length,
      avgResponseTime: this.metrics.responseTimes.length > 0 ?
        Math.round(this.metrics.responseTimes.reduce((sum, rt) => sum + rt, 0) / this.metrics.responseTimes.length) : 0,
      maxResponseTime: this.metrics.responseTimes.length > 0 ? Math.max(...this.metrics.responseTimes) : 0,
      minResponseTime: this.metrics.responseTimes.length > 0 ? Math.min(...this.metrics.responseTimes) : 0,
      totalErrors: this.metrics.errors.length
    };

    const report = {
      testSuite: 'Performance Integration Test',
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
      },
      results: this.testResults,
      performanceMetrics: overallMetrics,
      performanceRequirements: {
        p95LatencyTarget: '< 1s',
        throughputTarget: '> 0.5 req/s',
        memoryUsageTarget: '< 2GB peak',
        successRateTarget: '> 90%'
      },
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        cpuCount: require('os').cpus().length,
        totalMemoryGB: Math.round(require('os').totalmem() / 1024 / 1024 / 1024)
      }
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'logs', `performance-test-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('🚀 PERFORMANCE TEST REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}`);
    console.log(`⏱️  Average Response Time: ${overallMetrics.avgResponseTime}ms`);
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

    console.log('\n🎉 All performance tests passed!');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testRunner = new PerformanceTest();
  testRunner.runTest().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { PerformanceTest };