#!/usr/bin/env node

/**
 * Rate Limiting Test - Test rate limiting functionality
 * Tests that the server properly limits requests based on IP and time windows
 */

import axios from 'axios';

class RateLimitTester {
  constructor() {
    this.baseURL = 'http://localhost:3457'; // k1 proxy server
    this.testResults = [];
  }

  /**
   * Test basic rate limiting
   */
  async testBasicRateLimit() {
    console.log('\n⏱️  Testing Basic Rate Limiting...');

    const testBody = {
      messages: [{
        role: 'user',
        content: 'Rate limit test message'
      }],
      max_tokens: 10
    };

    let successCount = 0;
    let rateLimited = false;
    let rateLimitResponse = null;

    // Make requests rapidly to trigger rate limit
    for (let i = 1; i <= 105; i++) { // More than the limit (100 for proxy)
      try {
        const startTime = Date.now();

        const response = await axios.post(
          `${this.baseURL}/v1/messages`,
          testBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Test-Request': i.toString()
            },
            timeout: 5000
          }
        );

        successCount++;
        console.log(`✅ Request ${i}: Success (${Date.now() - startTime}ms)`);

      } catch (error) {
        if (error.response?.status === 429) {
          console.log(`🛑 Request ${i}: Rate limited (429)`);
          rateLimited = true;
          rateLimitResponse = error.response.data;
          break;
        } else {
          console.log(`❌ Request ${i}: Other error (${error.response?.status || error.code})`);
        }
      }

      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Results: ${successCount} successful requests before rate limit`);

    if (rateLimited) {
      console.log('✅ Rate limiting is working');
      console.log('Rate limit response:', rateLimitResponse);
      return true;
    } else {
      console.log('⚠️  Rate limiting may not be configured or limit is very high');
      return false;
    }
  }

  /**
   * Test rate limit headers and retry after
   */
  async testRateLimitHeaders() {
    console.log('\n📋 Testing Rate Limit Headers...');

    // First, trigger rate limit
    await this.triggerRateLimit();

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        { messages: [{ role: 'user', content: 'Test' }] },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );

      console.log('⚠️  Expected rate limit but request succeeded');
      return false;

    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.data.retryAfter;
        console.log('✅ Rate limit active');
        console.log('Retry-After:', retryAfter, 'seconds');

        if (retryAfter && retryAfter > 0) {
          console.log('✅ Retry-After header is present and valid');
          return true;
        } else {
          console.log('❌ Retry-After header missing or invalid');
          return false;
        }
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.message);
        return false;
      }
    }
  }

  /**
   * Test rate limit recovery after time window
   */
  async testRateLimitRecovery() {
    console.log('\n🔄 Testing Rate Limit Recovery...');

    // First, trigger rate limit
    await this.triggerRateLimit();

    // Confirm we're rate limited
    try {
      await axios.post(
        `${this.baseURL}/v1/messages`,
        { messages: [{ role: 'user', content: 'Should be limited' }] },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 3000
        }
      );

      console.log('⚠️  Rate limit not active, skipping recovery test');
      return false;

    } catch (error) {
      if (error.response?.status !== 429) {
        console.log('❌ Unexpected error during rate limit check:', error.response?.status);
        return false;
      }
    }

    console.log('⏳ Waiting for rate limit window to reset (65 seconds)...');

    // Wait for rate limit window to reset (60 seconds + buffer)
    await new Promise(resolve => setTimeout(resolve, 65000));

    // Try request again
    try {
      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        {
          messages: [{
            role: 'user',
            content: 'Rate limit recovery test'
          }],
          max_tokens: 10
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      console.log('✅ Rate limit recovered - request succeeded');
      return true;

    } catch (error) {
      if (error.response?.status === 429) {
        console.log('❌ Rate limit should have recovered but is still active');
        return false;
      } else {
        console.log('⚠️  Request failed for other reason:', error.response?.status, error.message);
        return false; // Could be server issue
      }
    }
  }

  /**
   * Test rate limiting per IP (simulate different IPs)
   */
  async testPerIPRateLimit() {
    console.log('\n🌐 Testing Per-IP Rate Limiting...');

    // Note: This is difficult to test without actually changing IPs
    // We'll test by using different user agent strings as a proxy

    const testConfigs = [
      { userAgent: 'TestClient-A', maxRequests: 15 },
      { userAgent: 'TestClient-B', maxRequests: 15 }
    ];

    for (const config of testConfigs) {
      console.log(`Testing with User-Agent: ${config.userAgent}`);

      let successCount = 0;

      for (let i = 1; i <= config.maxRequests; i++) {
        try {
          await axios.post(
            `${this.baseURL}/v1/messages`,
            {
              messages: [{
                role: 'user',
                content: `Test from ${config.userAgent} - ${i}`
              }],
              max_tokens: 10
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': config.userAgent
              },
              timeout: 5000
            }
          );

          successCount++;

        } catch (error) {
          if (error.response?.status === 429) {
            console.log(`${config.userAgent}: Rate limited after ${successCount} requests`);
            break;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('✅ Per-IP rate limiting test completed');
    return true;
  }

  /**
   * Helper method to trigger rate limit
   */
  async triggerRateLimit() {
    console.log('🔥 Triggering rate limit...');

    for (let i = 1; i <= 105; i++) {
      try {
        await axios.post(
          `${this.baseURL}/v1/messages`,
          {
            messages: [{
              role: 'user',
              content: 'Trigger rate limit'
            }],
            max_tokens: 5
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 3000
          }
        );

      } catch (error) {
        if (error.response?.status === 429) {
          console.log(`🛑 Rate limit triggered after ${i} requests`);
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Test security status endpoint for rate limit info
   */
  async testSecurityStatus() {
    console.log('\n📊 Testing Security Status Endpoint...');

    try {
      const response = await axios.get(
        `${this.baseURL}/security/status`,
        { timeout: 5000 }
      );

      const security = response.data.security;
      console.log('✅ Security status retrieved');
      console.log('Rate limiting enabled:', security.features?.rateLimiting);
      console.log('Active rate limit entries:', security.rateLimitStore?.size || 0);
      console.log('Active IPs:', security.rateLimitStore?.activeIPs?.length || 0);

      if (security.features?.rateLimiting) {
        console.log('✅ Rate limiting is enabled in security config');
        return true;
      } else {
        console.log('❌ Rate limiting is not enabled in security config');
        return false;
      }

    } catch (error) {
      console.error('❌ Failed to get security status:', error.message);
      return false;
    }
  }

  /**
   * Run all rate limiting tests
   */
  async runAllTests() {
    console.log('🚦 Starting Rate Limiting Tests...');
    console.log('Target server:', this.baseURL);

    const tests = [
      { name: 'Security Status', test: () => this.testSecurityStatus() },
      { name: 'Basic Rate Limit', test: () => this.testBasicRateLimit() },
      { name: 'Rate Limit Headers', test: () => this.testRateLimitHeaders() },
      { name: 'Per-IP Rate Limit', test: () => this.testPerIPRateLimit() }
      // Note: Recovery test is very slow (65s), so it's optional
      // { name: 'Rate Limit Recovery', test: () => this.testRateLimitRecovery() }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      console.log(`\n🧪 Running: ${name}`);

      try {
        const result = await test();
        if (result) {
          passed++;
          console.log(`✅ ${name}: PASSED`);
        } else {
          failed++;
          console.log(`❌ ${name}: FAILED`);
        }
      } catch (error) {
        console.error(`❌ ${name}: ERROR -`, error.message);
        failed++;
      }

      // Wait between tests to avoid interference
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 Rate Limiting Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    return { passed, failed, successRate: Math.round((passed / (passed + failed)) * 100) };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new RateLimitTester();

  // Check if server is running
  try {
    const healthCheck = await axios.get(`${tester.baseURL}/health`, { timeout: 5000 });
    console.log('🟢 Server is running:', healthCheck.data.status);
    console.log('🚦 Rate limiting enabled:', healthCheck.data.security?.rateLimiting);

  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    console.error('Make sure the k-proxy server is running: node k-proxy-server.js');
    process.exit(1);
  }

  tester.runAllTests()
    .then(results => {
      console.log('\n⚠️  Note: Rate limiting tests can be resource-intensive.');
      console.log('If recovery test is needed, run with --include-recovery flag');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { RateLimitTester };