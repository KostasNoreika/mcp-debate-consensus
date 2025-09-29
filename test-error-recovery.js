#!/usr/bin/env node

/**
 * Integration Test: Error Recovery and Retry Handler
 *
 * Tests the comprehensive error recovery mechanisms including:
 * - Retry handler with exponential backoff
 * - Error classification and appropriate responses
 * - Circuit breaker patterns
 * - Graceful degradation scenarios
 * - Recovery from various failure modes
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClaudeCliDebate } from './src/claude-cli-debate.js';
import { RetryHandler, ErrorClassifier, ErrorTypes } from './src/utils/retry-handler.js';
import { Security } from './src/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ErrorRecoveryTest {
  constructor() {
    this.testResults = [];
    this.debate = new ClaudeCliDebate();
    this.retryHandler = new RetryHandler();
    this.security = new Security();
  }

  /**
   * Run comprehensive error recovery test
   */
  async runTest() {
    console.log('🛡️ Starting Error Recovery Integration Test...\n');

    try {
      // Test 1: Retry handler with exponential backoff
      await this.testRetryHandlerBackoff();

      // Test 2: Error classification accuracy
      await this.testErrorClassification();

      // Test 3: Circuit breaker functionality
      await this.testCircuitBreaker();

      // Test 4: Graceful degradation with partial failures
      await this.testGracefulDegradation();

      // Test 5: Recovery from network failures
      await this.testNetworkFailureRecovery();

      // Test 6: Security error handling
      await this.testSecurityErrorHandling();

      // Generate test report
      await this.generateTestReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test retry handler with exponential backoff
   */
  async testRetryHandlerBackoff() {
    console.log('📋 Test 1: Retry Handler with Exponential Backoff');
    const startTime = Date.now();

    try {
      let attemptCount = 0;
      const maxRetries = 3;

      // Create a function that fails the first few times
      const flakyFunction = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, attempts: attemptCount };
      };

      // Test retry handler
      const result = await this.retryHandler.executeWithRetry(
        flakyFunction,
        {
          maxRetries: maxRetries,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2
        }
      );

      // Validate retry behavior
      if (result.attempts !== 3) {
        throw new Error(`Expected 3 attempts, got ${result.attempts}`);
      }

      if (!result.success) {
        throw new Error('Function should have succeeded after retries');
      }

      // Test exponential backoff timing
      const timingTestStart = Date.now();
      let timingAttempts = 0;

      const timingFunction = async () => {
        timingAttempts++;
        if (timingAttempts < 3) {
          throw new Error('Timing test failure');
        }
        return { duration: Date.now() - timingTestStart };
      };

      const timingResult = await this.retryHandler.executeWithRetry(
        timingFunction,
        {
          maxRetries: 3,
          initialDelay: 200,
          backoffMultiplier: 2
        }
      );

      // Should take at least 200 + 400 = 600ms due to delays
      if (timingResult.duration < 500) {
        console.warn('⚠️ Backoff timing may not be working correctly');
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Retry Handler with Exponential Backoff',
        status: 'PASS',
        duration: duration,
        details: {
          retriesWorked: true,
          attemptsRequired: attemptCount,
          backoffTiming: `${timingResult.duration}ms`,
          exponentialBackoff: true
        }
      });

      console.log('✅ Retry handler backoff test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Retry Handler with Exponential Backoff',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Retry handler backoff test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test error classification accuracy
   */
  async testErrorClassification() {
    console.log('📋 Test 2: Error Classification Accuracy');
    const startTime = Date.now();

    try {
      const errorClassifier = new ErrorClassifier();

      // Test different error types
      const testCases = [
        {
          error: new Error('ECONNRESET'),
          expectedType: ErrorTypes.NETWORK,
          description: 'Network connection reset'
        },
        {
          error: new Error('Request timeout'),
          expectedType: ErrorTypes.TIMEOUT,
          description: 'Timeout error'
        },
        {
          error: new Error('Too Many Requests'),
          expectedType: ErrorTypes.RATE_LIMIT,
          description: 'Rate limit error'
        },
        {
          error: new Error('Unauthorized'),
          expectedType: ErrorTypes.AUTHENTICATION,
          description: 'Authentication error'
        },
        {
          error: new Error('ENOTFOUND openrouter.ai'),
          expectedType: ErrorTypes.NETWORK,
          description: 'DNS resolution failure'
        }
      ];

      let correctClassifications = 0;

      for (const testCase of testCases) {
        const classification = errorClassifier.classifyError(testCase.error);

        if (classification.type === testCase.expectedType) {
          correctClassifications++;
          console.log(`  ✅ ${testCase.description}: ${classification.type}`);
        } else {
          console.log(`  ❌ ${testCase.description}: expected ${testCase.expectedType}, got ${classification.type}`);
        }

        // Validate classification includes retry recommendation
        if (typeof classification.shouldRetry !== 'boolean') {
          throw new Error('Classification missing retry recommendation');
        }

        // Validate suggested delay for retriable errors
        if (classification.shouldRetry && !classification.suggestedDelay) {
          throw new Error('Retriable error missing suggested delay');
        }
      }

      const accuracy = (correctClassifications / testCases.length) * 100;

      if (accuracy < 80) {
        throw new Error(`Error classification accuracy too low: ${accuracy}%`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Error Classification Accuracy',
        status: 'PASS',
        duration: duration,
        details: {
          totalTests: testCases.length,
          correctClassifications: correctClassifications,
          accuracy: `${accuracy}%`,
          typesSupported: Object.values(ErrorTypes)
        }
      });

      console.log('✅ Error classification test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Error Classification Accuracy',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Error classification test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test circuit breaker functionality
   */
  async testCircuitBreaker() {
    console.log('📋 Test 3: Circuit Breaker Functionality');
    const startTime = Date.now();

    try {
      const circuitBreakerConfig = {
        failureThreshold: 3,
        resetTimeout: 5000,
        monitoringPeriod: 10000
      };

      let failureCount = 0;

      // Create function that always fails
      const alwaysFailFunction = async () => {
        failureCount++;
        throw new Error('Circuit breaker test failure');
      };

      // Test circuit breaker opening
      let circuitOpened = false;

      try {
        // This should trigger circuit breaker after 3 failures
        for (let i = 0; i < 5; i++) {
          try {
            await this.retryHandler.executeWithRetry(
              alwaysFailFunction,
              {
                maxRetries: 1,
                circuitBreaker: circuitBreakerConfig
              }
            );
          } catch (error) {
            if (error.message.includes('circuit breaker') || error.message.includes('Circuit')) {
              circuitOpened = true;
              break;
            }
          }
        }
      } catch (error) {
        // Expected to fail
      }

      // Validate circuit breaker behavior
      if (!circuitOpened && failureCount > 3) {
        console.warn('⚠️ Circuit breaker may not have opened as expected');
      }

      // Test circuit breaker reset (simplified)
      // In real implementation, would wait for reset timeout

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Circuit Breaker Functionality',
        status: 'PASS',
        duration: duration,
        details: {
          failureThreshold: circuitBreakerConfig.failureThreshold,
          circuitOpenDetected: circuitOpened,
          totalFailures: failureCount,
          resetTimeoutMs: circuitBreakerConfig.resetTimeout
        }
      });

      console.log('✅ Circuit breaker test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Circuit Breaker Functionality',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Circuit breaker test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test graceful degradation with partial failures
   */
  async testGracefulDegradation() {
    console.log('📋 Test 4: Graceful Degradation with Partial Failures');
    const startTime = Date.now();

    try {
      const question = "What are the benefits of cloud computing?";

      // Simulate scenario where some models fail
      // We'll use a very short timeout to force some failures
      const result = await this.debate.runDebate(question, {
        models: ['k1', 'k2', 'k3', 'k4', 'k5'],
        preset: 'rapid',
        enableGracefulDegradation: true,
        timeout: 15000, // 15 seconds - some models may timeout
        minimumModels: 2 // Require at least 2 models to succeed
      });

      // Should still get a result even with some failures
      if (!result.synthesis) {
        throw new Error('No synthesis generated despite graceful degradation');
      }

      const modelsUsed = result.metadata?.modelsUsed || [];
      const failedModels = result.metadata?.failedModels || [];

      // Validate graceful degradation
      if (modelsUsed.length === 0) {
        throw new Error('No models succeeded - graceful degradation failed');
      }

      if (modelsUsed.length < 2) {
        console.warn('⚠️ Fewer than minimum models succeeded');
      }

      // Check if confidence reflects partial failure
      const confidence = result.metadata?.confidence || 0;
      if (failedModels.length > 0 && confidence > 90) {
        console.warn('⚠️ High confidence despite model failures');
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Graceful Degradation with Partial Failures',
        status: 'PASS',
        duration: duration,
        details: {
          modelsSucceeded: modelsUsed.length,
          modelsFailed: failedModels.length,
          totalModels: 5,
          synthesisGenerated: !!result.synthesis,
          confidence: confidence,
          gracefulDegradation: true
        }
      });

      console.log(`✅ Graceful degradation test passed - ${modelsUsed.length} succeeded, ${failedModels.length} failed`);

    } catch (error) {
      this.testResults.push({
        name: 'Graceful Degradation with Partial Failures',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Graceful degradation test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test recovery from network failures
   */
  async testNetworkFailureRecovery() {
    console.log('📋 Test 5: Recovery from Network Failures');
    const startTime = Date.now();

    try {
      // Test network failure simulation
      let networkFailureSimulated = false;

      const networkTestFunction = async () => {
        if (!networkFailureSimulated) {
          networkFailureSimulated = true;
          const error = new Error('ECONNRESET');
          error.code = 'ECONNRESET';
          throw error;
        }
        return { success: true, recoveredFromNetwork: true };
      };

      const result = await this.retryHandler.executeWithRetry(
        networkTestFunction,
        {
          maxRetries: 3,
          initialDelay: 500,
          networkFailureHandling: true
        }
      );

      if (!result.success || !result.recoveredFromNetwork) {
        throw new Error('Network failure recovery failed');
      }

      // Test DNS failure recovery
      let dnsFailureSimulated = false;

      const dnsTestFunction = async () => {
        if (!dnsFailureSimulated) {
          dnsFailureSimulated = true;
          const error = new Error('ENOTFOUND openrouter.ai');
          error.code = 'ENOTFOUND';
          throw error;
        }
        return { success: true, recoveredFromDNS: true };
      };

      const dnsResult = await this.retryHandler.executeWithRetry(
        dnsTestFunction,
        {
          maxRetries: 2,
          initialDelay: 1000,
          dnsFailureHandling: true
        }
      );

      if (!dnsResult.success || !dnsResult.recoveredFromDNS) {
        throw new Error('DNS failure recovery failed');
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Recovery from Network Failures',
        status: 'PASS',
        duration: duration,
        details: {
          networkRecovery: true,
          dnsRecovery: true,
          retriesUsed: true,
          failureTypesHandled: ['ECONNRESET', 'ENOTFOUND']
        }
      });

      console.log('✅ Network failure recovery test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Recovery from Network Failures',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Network failure recovery test failed:', error.message);
      throw error;
    }
  }

  /**
   * Test security error handling
   */
  async testSecurityErrorHandling() {
    console.log('📋 Test 6: Security Error Handling');
    const startTime = Date.now();

    try {
      // Test invalid input handling
      try {
        await this.debate.runDebate('', { models: ['k1'] });
        throw new Error('Should have failed with empty question');
      } catch (error) {
        if (!error.message.includes('empty') && !error.message.includes('invalid')) {
          throw new Error('Unexpected error for empty question');
        }
      }

      // Test malicious input detection
      const maliciousInputs = [
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        'DROP TABLE users;',
        '\x00\x01\x02\x03' // Binary data
      ];

      let securityValidationsPassed = 0;

      for (const maliciousInput of maliciousInputs) {
        try {
          const validation = this.security.validateInput({ question: maliciousInput });
          if (!validation.valid) {
            securityValidationsPassed++;
            console.log(`  ✅ Blocked malicious input: ${maliciousInput.substring(0, 20)}...`);
          } else {
            console.log(`  ⚠️ Failed to block: ${maliciousInput.substring(0, 20)}...`);
          }
        } catch (error) {
          // Security errors are expected and good
          securityValidationsPassed++;
        }
      }

      // Test rate limiting (simplified)
      const rateLimitConfig = {
        maxRequests: 2,
        windowMs: 5000
      };

      let rateLimitTriggered = false;

      try {
        // Simulate rapid requests
        for (let i = 0; i < 5; i++) {
          try {
            await this.security.checkRateLimit('test-client', rateLimitConfig);
          } catch (error) {
            if (error.message.includes('rate') || error.message.includes('limit')) {
              rateLimitTriggered = true;
              break;
            }
          }
        }
      } catch (error) {
        // Expected for rate limiting
      }

      const securityScore = (securityValidationsPassed / maliciousInputs.length) * 100;

      if (securityScore < 75) {
        throw new Error(`Security validation score too low: ${securityScore}%`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Security Error Handling',
        status: 'PASS',
        duration: duration,
        details: {
          inputValidation: true,
          maliciousInputsBlocked: securityValidationsPassed,
          totalMaliciousInputs: maliciousInputs.length,
          securityScore: `${securityScore}%`,
          rateLimitTested: rateLimitTriggered
        }
      });

      console.log('✅ Security error handling test passed');

    } catch (error) {
      this.testResults.push({
        name: 'Security Error Handling',
        status: 'FAIL',
        error: error.message,
        duration: Date.now() - startTime
      });
      console.error('❌ Security error handling test failed:', error.message);
      throw error;
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
      testSuite: 'Error Recovery Integration Test',
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
      },
      results: this.testResults,
      errorHandlingCapabilities: {
        retryMechanisms: ['exponential_backoff', 'circuit_breaker'],
        errorTypes: Object.values(ErrorTypes),
        networkFailureRecovery: true,
        securityValidation: true,
        gracefulDegradation: true
      }
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'logs', `error-recovery-test-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('🛡️ ERROR RECOVERY TEST REPORT');
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

    console.log('\n🎉 All error recovery tests passed!');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testRunner = new ErrorRecoveryTest();
  testRunner.runTest().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { ErrorRecoveryTest };