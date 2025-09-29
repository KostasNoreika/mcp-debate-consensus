#!/usr/bin/env node

/**
 * Security Client Test - Test HMAC request signing and validation
 * Tests the complete flow of signing requests and validating them on the server
 */

import crypto from 'crypto';
import axios from 'axios';
import { Security } from './src/security.js';

class SecurityClient {
  constructor(secret) {
    this.security = new Security();
    this.secret = secret || process.env.HMAC_SECRET || this.security.HMAC_SECRET;
    this.baseURL = 'http://localhost:3457'; // k1 proxy server
  }

  /**
   * Create signed request headers
   */
  createSignedRequest(method, url, body = {}) {
    const timestamp = Date.now().toString();
    const nonce = this.security.generateNonce();
    const bodyString = typeof body === 'object' ? JSON.stringify(body) : body.toString();

    // Create data to sign (method:url:timestamp:nonce:body)
    const dataToSign = `${method}:${url}:${timestamp}:${nonce}:${bodyString}`;

    // Generate HMAC signature
    const signature = this.security.generateSignature(dataToSign, this.secret);

    return {
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature
      },
      body: bodyString,
      signedData: dataToSign
    };
  }

  /**
   * Test valid signed request
   */
  async testValidSignedRequest() {
    console.log('\n🔐 Testing Valid Signed Request...');

    try {
      const testBody = {
        messages: [{
          role: 'user',
          content: 'This is a security test. Please respond with: SECURITY_TEST_PASSED'
        }],
        max_tokens: 50
      };

      const signedRequest = this.createSignedRequest('POST', '/v1/messages', testBody);

      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: signedRequest.headers,
          timeout: 10000
        }
      );

      console.log('✅ Valid signed request succeeded');
      console.log('Response status:', response.status);
      console.log('Response content:', response.data.content?.[0]?.text?.substring(0, 100) || 'No content');
      return true;

    } catch (error) {
      console.error('❌ Valid signed request failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Test request with invalid signature
   */
  async testInvalidSignature() {
    console.log('\n🚫 Testing Invalid Signature...');

    try {
      const testBody = {
        messages: [{
          role: 'user',
          content: 'This should fail due to invalid signature'
        }]
      };

      const signedRequest = this.createSignedRequest('POST', '/v1/messages', testBody);

      // Tamper with the signature
      signedRequest.headers['X-Signature'] = 'invalid_signature_' + signedRequest.headers['X-Signature'];

      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: signedRequest.headers,
          timeout: 5000
        }
      );

      console.log('❌ Invalid signature request should have failed but succeeded');
      return false;

    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Invalid signature correctly rejected (401)');
        console.log('Error message:', error.response.data.error);
        return true;
      } else {
        console.error('❌ Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }
  }

  /**
   * Test request with expired timestamp
   */
  async testExpiredTimestamp() {
    console.log('\n⏰ Testing Expired Timestamp...');

    try {
      const testBody = {
        messages: [{
          role: 'user',
          content: 'This should fail due to expired timestamp'
        }]
      };

      // Create request with old timestamp (10 minutes ago)
      const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString();
      const nonce = this.security.generateNonce();
      const bodyString = JSON.stringify(testBody);
      const dataToSign = `POST:/v1/messages:${oldTimestamp}:${nonce}:${bodyString}`;
      const signature = this.security.generateSignature(dataToSign, this.secret);

      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Timestamp': oldTimestamp,
            'X-Nonce': nonce,
            'X-Signature': signature
          },
          timeout: 5000
        }
      );

      console.log('❌ Expired timestamp request should have failed but succeeded');
      return false;

    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Expired timestamp correctly rejected (401)');
        console.log('Error message:', error.response.data.error);
        return true;
      } else {
        console.error('❌ Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }
  }

  /**
   * Test replay attack (reused nonce)
   */
  async testReplayAttack() {
    console.log('\n🔁 Testing Replay Attack Protection...');

    try {
      const testBody = {
        messages: [{
          role: 'user',
          content: 'First request - should succeed'
        }],
        max_tokens: 20
      };

      const signedRequest = this.createSignedRequest('POST', '/v1/messages', testBody);

      // First request should succeed
      try {
        const firstResponse = await axios.post(
          `${this.baseURL}/v1/messages`,
          testBody,
          {
            headers: signedRequest.headers,
            timeout: 10000
          }
        );
        console.log('✅ First request succeeded (expected)');
      } catch (error) {
        console.log('⚠️  First request failed - server might not be running or signing disabled');
        console.log('Error:', error.response?.data?.error || error.message);
        return false;
      }

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Second request with same nonce should fail
      try {
        const secondResponse = await axios.post(
          `${this.baseURL}/v1/messages`,
          testBody,
          {
            headers: signedRequest.headers, // Same headers including nonce
            timeout: 5000
          }
        );

        console.log('❌ Replay attack should have failed but succeeded');
        return false;

      } catch (error) {
        if (error.response?.status === 401 && error.response.data.error.includes('nonce')) {
          console.log('✅ Replay attack correctly rejected (401)');
          console.log('Error message:', error.response.data.error);
          return true;
        } else {
          console.error('❌ Unexpected error on replay:', error.response?.data || error.message);
          return false;
        }
      }

    } catch (error) {
      console.error('❌ Replay test setup failed:', error.message);
      return false;
    }
  }

  /**
   * Test missing signature headers
   */
  async testMissingHeaders() {
    console.log('\n❓ Testing Missing Signature Headers...');

    try {
      const testBody = {
        messages: [{
          role: 'user',
          content: 'This should fail due to missing headers'
        }]
      };

      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: {
            'Content-Type': 'application/json'
            // No signature headers
          },
          timeout: 5000
        }
      );

      console.log('❌ Request without signature headers should have failed');
      return false;

    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Missing headers correctly rejected (401)');
        console.log('Error message:', error.response.data.error);
        return true;
      } else {
        console.error('❌ Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }
  }

  /**
   * Test signature validation with different secrets
   */
  async testWrongSecret() {
    console.log('\n🔑 Testing Wrong Secret...');

    try {
      const wrongSecret = 'wrong_secret_' + crypto.randomBytes(16).toString('hex');
      const testBody = {
        messages: [{
          role: 'user',
          content: 'This should fail due to wrong secret'
        }]
      };

      const timestamp = Date.now().toString();
      const nonce = this.security.generateNonce();
      const bodyString = JSON.stringify(testBody);
      const dataToSign = `POST:/v1/messages:${timestamp}:${nonce}:${bodyString}`;

      // Sign with wrong secret
      const wrongSignature = this.security.generateSignature(dataToSign, wrongSecret);

      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Timestamp': timestamp,
            'X-Nonce': nonce,
            'X-Signature': wrongSignature
          },
          timeout: 5000
        }
      );

      console.log('❌ Request with wrong secret should have failed');
      return false;

    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Wrong secret correctly rejected (401)');
        console.log('Error message:', error.response.data.error);
        return true;
      } else {
        console.error('❌ Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }
  }

  /**
   * Run all security tests
   */
  async runAllTests() {
    console.log('🛡️  Starting Security Client Tests...');
    console.log('Target server:', this.baseURL);
    console.log('HMAC Secret length:', this.secret.length, 'chars');

    const tests = [
      { name: 'Valid Signed Request', test: () => this.testValidSignedRequest() },
      { name: 'Invalid Signature', test: () => this.testInvalidSignature() },
      { name: 'Expired Timestamp', test: () => this.testExpiredTimestamp() },
      { name: 'Replay Attack', test: () => this.testReplayAttack() },
      { name: 'Missing Headers', test: () => this.testMissingHeaders() },
      { name: 'Wrong Secret', test: () => this.testWrongSecret() }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      try {
        const result = await test();
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ Test "${name}" threw exception:`, error.message);
        failed++;
      }

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 Security Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    return { passed, failed, successRate: Math.round((passed / (passed + failed)) * 100) };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new SecurityClient();

  // Check if server is running
  try {
    const healthCheck = await axios.get(`${client.baseURL}/health`, { timeout: 5000 });
    console.log('🟢 Server is running:', healthCheck.data.status);
    console.log('🔐 Request signing enabled:', healthCheck.data.security?.requestSigning);

    if (!healthCheck.data.security?.requestSigning) {
      console.log('\n⚠️  WARNING: Request signing is disabled on the server.');
      console.log('Some tests may not work as expected.');
      console.log('To enable: set ENABLE_REQUEST_SIGNING=true in .env\n');
    }

  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    console.error('Make sure the k-proxy server is running: node k-proxy-server.js');
    process.exit(1);
  }

  client.runAllTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { SecurityClient };