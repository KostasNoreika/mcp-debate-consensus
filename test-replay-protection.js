#!/usr/bin/env node

/**
 * Replay Protection Test - Test nonce-based replay attack protection
 * Tests that the server prevents replay attacks using nonce validation
 */

import crypto from 'crypto';
import axios from 'axios';
import { Security } from './src/security.js';

class ReplayProtectionTester {
  constructor() {
    this.security = new Security();
    this.secret = process.env.HMAC_SECRET || this.security.HMAC_SECRET;
    this.baseURL = 'http://localhost:3457'; // k1 proxy server
  }

  /**
   * Create signed request with specific nonce
   */
  createSignedRequest(method, url, body, nonce = null) {
    const timestamp = Date.now().toString();
    const requestNonce = nonce || this.security.generateNonce();
    const bodyString = typeof body === 'object' ? JSON.stringify(body) : body.toString();

    const dataToSign = `${method}:${url}:${timestamp}:${requestNonce}:${bodyString}`;
    const signature = this.security.generateSignature(dataToSign, this.secret);

    return {
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Nonce': requestNonce,
        'X-Signature': signature
      },
      body: bodyString,
      nonce: requestNonce,
      timestamp: timestamp
    };
  }

  /**
   * Test basic nonce generation and uniqueness
   */
  testNonceGeneration() {
    console.log('\n🔢 Testing Nonce Generation...');

    const nonces = new Set();
    const numNonces = 1000;

    for (let i = 0; i < numNonces; i++) {
      const nonce = this.security.generateNonce();

      // Check format (should be hex string)
      if (!/^[a-f0-9]{32}$/.test(nonce)) {
        console.log('❌ Invalid nonce format:', nonce);
        return false;
      }

      // Check uniqueness
      if (nonces.has(nonce)) {
        console.log('❌ Duplicate nonce detected:', nonce);
        return false;
      }

      nonces.add(nonce);
    }

    console.log(`✅ Generated ${numNonces} unique nonces`);
    console.log('Sample nonce:', Array.from(nonces)[0]);
    return true;
  }

  /**
   * Test nonce validation logic
   */
  testNonceValidation() {
    console.log('\n✅ Testing Nonce Validation Logic...');

    // Test valid nonce
    const validNonce = this.security.generateNonce();
    if (!this.security.validateNonce(validNonce)) {
      console.log('❌ Valid nonce rejected');
      return false;
    }
    console.log('✅ Valid nonce accepted');

    // Test reused nonce
    if (this.security.validateNonce(validNonce)) {
      console.log('❌ Reused nonce accepted (should be rejected)');
      return false;
    }
    console.log('✅ Reused nonce correctly rejected');

    // Test invalid nonce formats
    const invalidNonces = ['', null, undefined, 'invalid', '123', 'x'.repeat(100)];
    for (const invalidNonce of invalidNonces) {
      if (this.security.validateNonce(invalidNonce)) {
        console.log('❌ Invalid nonce accepted:', invalidNonce);
        return false;
      }
    }
    console.log('✅ Invalid nonce formats correctly rejected');

    return true;
  }

  /**
   * Test replay attack with same nonce
   */
  async testSameNonceReplay() {
    console.log('\n🔁 Testing Same Nonce Replay Attack...');

    const testBody = {
      messages: [{
        role: 'user',
        content: 'Replay test with same nonce'
      }],
      max_tokens: 20
    };

    const nonce = this.security.generateNonce();
    console.log('Using nonce:', nonce);

    // First request
    const firstRequest = this.createSignedRequest('POST', '/v1/messages', testBody, nonce);

    try {
      const firstResponse = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: firstRequest.headers,
          timeout: 10000
        }
      );

      console.log('✅ First request succeeded (expected)');

    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️  First request was rejected - server might have strict settings');
        console.log('Error:', error.response.data.error);
        return false; // Can't test replay if first request fails
      } else {
        console.log('❌ First request failed with unexpected error:', error.message);
        return false;
      }
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second request with same nonce (replay attack)
    const secondRequest = this.createSignedRequest('POST', '/v1/messages', testBody, nonce);

    try {
      const secondResponse = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: secondRequest.headers,
          timeout: 5000
        }
      );

      console.log('❌ Replay attack succeeded (should have been blocked)');
      return false;

    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error.includes('nonce')) {
        console.log('✅ Replay attack correctly blocked');
        console.log('Error message:', error.response.data.error);
        return true;
      } else {
        console.log('❌ Unexpected error during replay attempt:', error.response?.data || error.message);
        return false;
      }
    }
  }

  /**
   * Test multiple replay attempts with same nonce
   */
  async testMultipleReplayAttempts() {
    console.log('\n🔄 Testing Multiple Replay Attempts...');

    const testBody = {
      messages: [{
        role: 'user',
        content: 'Multiple replay test'
      }],
      max_tokens: 15
    };

    const nonce = this.security.generateNonce();

    // First legitimate request
    const originalRequest = this.createSignedRequest('POST', '/v1/messages', testBody, nonce);

    try {
      await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: originalRequest.headers,
          timeout: 10000
        }
      );

      console.log('✅ Original request succeeded');

    } catch (error) {
      console.log('⚠️  Original request failed, skipping multiple replay test');
      return false;
    }

    // Attempt multiple replays with same nonce
    let blockedCount = 0;
    const replayAttempts = 5;

    for (let i = 1; i <= replayAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const replayRequest = this.createSignedRequest('POST', '/v1/messages', testBody, nonce);

      try {
        await axios.post(
          `${this.baseURL}/v1/messages`,
          testBody,
          {
            headers: replayRequest.headers,
            timeout: 5000
          }
        );

        console.log(`❌ Replay attempt ${i} succeeded (should be blocked)`);

      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`✅ Replay attempt ${i} blocked`);
          blockedCount++;
        } else {
          console.log(`⚠️  Replay attempt ${i} failed with other error:`, error.response?.status);
        }
      }
    }

    if (blockedCount === replayAttempts) {
      console.log('✅ All replay attempts were correctly blocked');
      return true;
    } else {
      console.log(`❌ Only ${blockedCount}/${replayAttempts} replay attempts were blocked`);
      return false;
    }
  }

  /**
   * Test nonce expiration
   */
  async testNonceExpiration() {
    console.log('\n⏰ Testing Nonce Expiration...');

    // Create nonce and wait for expiration
    const nonce = this.security.generateNonce();

    // Store the nonce manually to simulate an old nonce
    this.security.nonceStore.set(nonce, Date.now() - (6 * 60 * 1000)); // 6 minutes ago

    // Trigger cleanup
    this.security._cleanupExpiredNonces();

    // Check if expired nonce was cleaned up
    if (this.security.nonceStore.has(nonce)) {
      console.log('❌ Expired nonce was not cleaned up');
      return false;
    } else {
      console.log('✅ Expired nonce was correctly cleaned up');
    }

    // Test that expired nonce can be reused after cleanup
    if (this.security.validateNonce(nonce)) {
      console.log('✅ Expired nonce can be reused after cleanup');
      return true;
    } else {
      console.log('❌ Expired nonce cannot be reused after cleanup');
      return false;
    }
  }

  /**
   * Test nonce store size limits and cleanup
   */
  testNonceStoreCleanup() {
    console.log('\n🧹 Testing Nonce Store Cleanup...');

    // Clear existing nonces
    this.security.nonceStore.clear();

    // Add many nonces with different timestamps
    const now = Date.now();
    const oldNonces = [];
    const recentNonces = [];

    // Add old nonces (expired)
    for (let i = 0; i < 50; i++) {
      const nonce = this.security.generateNonce();
      this.security.nonceStore.set(nonce, now - (10 * 60 * 1000)); // 10 minutes ago
      oldNonces.push(nonce);
    }

    // Add recent nonces (valid)
    for (let i = 0; i < 30; i++) {
      const nonce = this.security.generateNonce();
      this.security.nonceStore.set(nonce, now - (2 * 60 * 1000)); // 2 minutes ago
      recentNonces.push(nonce);
    }

    const totalBefore = this.security.nonceStore.size;
    console.log('Nonces before cleanup:', totalBefore);

    // Trigger cleanup
    this.security._cleanupExpiredNonces();

    const totalAfter = this.security.nonceStore.size;
    console.log('Nonces after cleanup:', totalAfter);

    // Check that old nonces were removed
    const oldNoncesRemaining = oldNonces.filter(nonce => this.security.nonceStore.has(nonce));
    const recentNoncesRemaining = recentNonces.filter(nonce => this.security.nonceStore.has(nonce));

    if (oldNoncesRemaining.length === 0) {
      console.log('✅ All expired nonces were removed');
    } else {
      console.log(`❌ ${oldNoncesRemaining.length} expired nonces remain`);
      return false;
    }

    if (recentNoncesRemaining.length === recentNonces.length) {
      console.log('✅ All recent nonces were preserved');
      return true;
    } else {
      console.log(`❌ ${recentNonces.length - recentNoncesRemaining.length} recent nonces were incorrectly removed`);
      return false;
    }
  }

  /**
   * Run all replay protection tests
   */
  async runAllTests() {
    console.log('🛡️  Starting Replay Protection Tests...');
    console.log('Target server:', this.baseURL);

    const tests = [
      { name: 'Nonce Generation', test: () => this.testNonceGeneration() },
      { name: 'Nonce Validation', test: () => this.testNonceValidation() },
      { name: 'Nonce Store Cleanup', test: () => this.testNonceStoreCleanup() },
      { name: 'Nonce Expiration', test: () => this.testNonceExpiration() },
      { name: 'Same Nonce Replay', test: () => this.testSameNonceReplay() },
      { name: 'Multiple Replay Attempts', test: () => this.testMultipleReplayAttempts() }
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

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 Replay Protection Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    return { passed, failed, successRate: Math.round((passed / (passed + failed)) * 100) };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ReplayProtectionTester();

  // Check if server is running
  try {
    const healthCheck = await axios.get(`${tester.baseURL}/health`, { timeout: 5000 });
    console.log('🟢 Server is running:', healthCheck.data.status);
    console.log('🔐 Request signing enabled:', healthCheck.data.security?.requestSigning);

    if (!healthCheck.data.security?.requestSigning) {
      console.log('\n⚠️  WARNING: Request signing is disabled on the server.');
      console.log('Replay protection tests require request signing to be enabled.');
      console.log('To enable: set ENABLE_REQUEST_SIGNING=true in .env\n');
    }

  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    console.error('Make sure the k-proxy server is running: node k-proxy-server.js');
    process.exit(1);
  }

  tester.runAllTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { ReplayProtectionTester };