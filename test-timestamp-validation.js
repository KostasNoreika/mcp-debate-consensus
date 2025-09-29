#!/usr/bin/env node

/**
 * Timestamp Validation Test - Test timestamp-based security validation
 * Tests that the server properly validates request timestamps and rejects old requests
 */

import crypto from 'crypto';
import axios from 'axios';
import { Security } from './src/security.js';

class TimestampValidationTester {
  constructor() {
    this.security = new Security();
    this.secret = process.env.HMAC_SECRET || this.security.HMAC_SECRET;
    this.baseURL = 'http://localhost:3457'; // k1 proxy server
    this.validityWindow = this.security.SIGNATURE_VALIDITY_WINDOW; // seconds
  }

  /**
   * Create signed request with specific timestamp
   */
  createSignedRequest(method, url, body, customTimestamp = null) {
    const timestamp = customTimestamp || Date.now().toString();
    const nonce = this.security.generateNonce();
    const bodyString = typeof body === 'object' ? JSON.stringify(body) : body.toString();

    const dataToSign = `${method}:${url}:${timestamp}:${nonce}:${bodyString}`;
    const signature = this.security.generateSignature(dataToSign, this.secret);

    return {
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature
      },
      timestamp: timestamp,
      nonce: nonce
    };
  }

  /**
   * Test timestamp validation logic
   */
  testTimestampValidationLogic() {
    console.log('\n⏰ Testing Timestamp Validation Logic...');
    console.log(`Validity window: ${this.validityWindow} seconds`);

    const now = Date.now();

    // Test valid timestamp (current time)
    const validTimestamp = now.toString();
    if (!this.security.validateTimestamp(validTimestamp)) {
      console.log('❌ Current timestamp rejected');
      return false;
    }
    console.log('✅ Current timestamp accepted');

    // Test timestamp within validity window
    const recentTimestamp = (now - (this.validityWindow / 2) * 1000).toString();
    if (!this.security.validateTimestamp(recentTimestamp)) {
      console.log('❌ Recent timestamp within window rejected');
      return false;
    }
    console.log('✅ Recent timestamp within window accepted');

    // Test expired timestamp
    const expiredTimestamp = (now - (this.validityWindow + 10) * 1000).toString();
    if (this.security.validateTimestamp(expiredTimestamp)) {
      console.log('❌ Expired timestamp accepted (should be rejected)');
      return false;
    }
    console.log('✅ Expired timestamp correctly rejected');

    // Test future timestamp (slightly ahead)
    const futureTimestamp = (now + (this.validityWindow / 2) * 1000).toString();
    if (!this.security.validateTimestamp(futureTimestamp)) {
      console.log('❌ Future timestamp within window rejected');
      return false;
    }
    console.log('✅ Future timestamp within window accepted');

    // Test far future timestamp
    const farFutureTimestamp = (now + (this.validityWindow + 10) * 1000).toString();
    if (this.security.validateTimestamp(farFutureTimestamp)) {
      console.log('❌ Far future timestamp accepted (should be rejected)');
      return false;
    }
    console.log('✅ Far future timestamp correctly rejected');

    // Test invalid timestamp formats
    const invalidTimestamps = ['', null, undefined, 'invalid', 'abc123', '0'];
    for (const invalidTimestamp of invalidTimestamps) {
      if (this.security.validateTimestamp(invalidTimestamp)) {
        console.log('❌ Invalid timestamp format accepted:', invalidTimestamp);
        return false;
      }
    }
    console.log('✅ Invalid timestamp formats correctly rejected');

    return true;
  }

  /**
   * Test request with valid timestamp
   */
  async testValidTimestamp() {
    console.log('\n✅ Testing Valid Timestamp Request...');

    const testBody = {
      messages: [{
        role: 'user',
        content: 'Valid timestamp test'
      }],
      max_tokens: 20
    };

    const signedRequest = this.createSignedRequest('POST', '/v1/messages', testBody);

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: signedRequest.headers,
          timeout: 10000
        }
      );

      console.log('✅ Valid timestamp request succeeded');
      console.log('Response status:', response.status);
      return true;

    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error.includes('timestamp')) {
        console.log('❌ Valid timestamp was rejected:', error.response.data.error);
        return false;
      } else {
        console.log('⚠️  Request failed for other reason:', error.response?.data || error.message);
        return false;
      }
    }
  }

  /**
   * Test request with expired timestamp
   */
  async testExpiredTimestamp() {
    console.log('\n⌛ Testing Expired Timestamp Request...');

    const testBody = {
      messages: [{
        role: 'user',
        content: 'Expired timestamp test'
      }],
      max_tokens: 20
    };

    // Create request with timestamp 10 minutes ago
    const expiredTimestamp = (Date.now() - 10 * 60 * 1000).toString();
    const signedRequest = this.createSignedRequest('POST', '/v1/messages', testBody, expiredTimestamp);

    console.log(`Using timestamp: ${expiredTimestamp} (${new Date(parseInt(expiredTimestamp)).toISOString()})`);
    console.log(`Current time: ${Date.now()} (${new Date().toISOString()})`);

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: signedRequest.headers,
          timeout: 5000
        }
      );

      console.log('❌ Expired timestamp request should have failed but succeeded');
      return false;

    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error.includes('timestamp')) {
        console.log('✅ Expired timestamp correctly rejected');
        console.log('Error message:', error.response.data.error);
        return true;
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }
  }

  /**
   * Test request with future timestamp
   */
  async testFutureTimestamp() {
    console.log('\n⏭️  Testing Future Timestamp Request...');

    const testBody = {
      messages: [{
        role: 'user',
        content: 'Future timestamp test'
      }],
      max_tokens: 20
    };

    // Create request with timestamp 10 minutes in the future
    const futureTimestamp = (Date.now() + 10 * 60 * 1000).toString();
    const signedRequest = this.createSignedRequest('POST', '/v1/messages', testBody, futureTimestamp);

    console.log(`Using timestamp: ${futureTimestamp} (${new Date(parseInt(futureTimestamp)).toISOString()})`);
    console.log(`Current time: ${Date.now()} (${new Date().toISOString()})`);

    try {
      const response = await axios.post(
        `${this.baseURL}/v1/messages`,
        testBody,
        {
          headers: signedRequest.headers,
          timeout: 5000
        }
      );

      console.log('❌ Future timestamp request should have failed but succeeded');
      return false;

    } catch (error) {
      if (error.response?.status === 401 && error.response.data.error.includes('timestamp')) {
        console.log('✅ Future timestamp correctly rejected');
        console.log('Error message:', error.response.data.error);
        return true;
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
        return false;
      }
    }
  }

  /**
   * Test timestamp boundary conditions
   */
  async testTimestampBoundaries() {
    console.log('\n🎯 Testing Timestamp Boundary Conditions...');

    const testBody = {
      messages: [{
        role: 'user',
        content: 'Boundary test'
      }],
      max_tokens: 10
    };

    const now = Date.now();
    const boundaries = [
      {
        name: 'Just within window (past)',
        timestamp: now - (this.validityWindow * 1000 - 1000), // 1 second before expiry
        shouldPass: true
      },
      {
        name: 'Just outside window (past)',
        timestamp: now - (this.validityWindow * 1000 + 1000), // 1 second after expiry
        shouldPass: false
      },
      {
        name: 'Just within window (future)',
        timestamp: now + (this.validityWindow * 1000 - 1000), // 1 second before future limit
        shouldPass: true
      },
      {
        name: 'Just outside window (future)',
        timestamp: now + (this.validityWindow * 1000 + 1000), // 1 second after future limit
        shouldPass: false
      }
    ];

    let passed = 0;

    for (const boundary of boundaries) {
      console.log(`\nTesting: ${boundary.name}`);
      console.log(`Timestamp: ${boundary.timestamp} (${new Date(boundary.timestamp).toISOString()})`);

      const signedRequest = this.createSignedRequest('POST', '/v1/messages', testBody, boundary.timestamp.toString());

      try {
        const response = await axios.post(
          `${this.baseURL}/v1/messages`,
          testBody,
          {
            headers: signedRequest.headers,
            timeout: 5000
          }
        );

        if (boundary.shouldPass) {
          console.log('✅ Request succeeded as expected');
          passed++;
        } else {
          console.log('❌ Request should have failed but succeeded');
        }

      } catch (error) {
        if (!boundary.shouldPass && error.response?.status === 401) {
          console.log('✅ Request failed as expected');
          passed++;
        } else {
          console.log('❌ Unexpected result:', error.response?.status, error.response?.data?.error);
        }
      }

      // Wait between boundary tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n📊 Boundary tests: ${passed}/${boundaries.length} passed`);
    return passed === boundaries.length;
  }

  /**
   * Test timestamp format validation
   */
  async testTimestampFormats() {
    console.log('\n📝 Testing Timestamp Format Validation...');

    const testBody = {
      messages: [{
        role: 'user',
        content: 'Format test'
      }],
      max_tokens: 10
    };

    const invalidFormats = [
      { name: 'Empty string', value: '' },
      { name: 'Non-numeric', value: 'abc123' },
      { name: 'Negative number', value: '-1234567890' },
      { name: 'Float', value: '1234567890.123' },
      { name: 'Very large number', value: '999999999999999999999' },
      { name: 'Zero', value: '0' }
    ];

    let rejectedCount = 0;

    for (const format of invalidFormats) {
      console.log(`Testing format: ${format.name} (${format.value})`);

      // Create proper signature with invalid timestamp
      const nonce = this.security.generateNonce();
      const bodyString = JSON.stringify(testBody);
      const dataToSign = `POST:/v1/messages:${format.value}:${nonce}:${bodyString}`;
      const signature = this.security.generateSignature(dataToSign, this.secret);

      try {
        const response = await axios.post(
          `${this.baseURL}/v1/messages`,
          testBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Timestamp': format.value,
              'X-Nonce': nonce,
              'X-Signature': signature
            },
            timeout: 3000
          }
        );

        console.log(`❌ Invalid format ${format.name} was accepted`);

      } catch (error) {
        if (error.response?.status === 401) {
          console.log(`✅ Invalid format ${format.name} correctly rejected`);
          rejectedCount++;
        } else {
          console.log(`⚠️  Unexpected error for ${format.name}:`, error.response?.status);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n📊 Format validation: ${rejectedCount}/${invalidFormats.length} correctly rejected`);
    return rejectedCount === invalidFormats.length;
  }

  /**
   * Test timestamp synchronization tolerance
   */
  testTimestampTolerance() {
    console.log('\n🔄 Testing Timestamp Synchronization Tolerance...');

    const testTimestamps = [
      { offset: 0, name: 'Exact current time' },
      { offset: -30, name: '30 seconds ago' },
      { offset: 30, name: '30 seconds ahead' },
      { offset: -this.validityWindow + 10, name: 'Near expiry (past)' },
      { offset: this.validityWindow - 10, name: 'Near expiry (future)' }
    ];

    let validCount = 0;

    for (const test of testTimestamps) {
      const timestamp = (Date.now() + test.offset * 1000).toString();
      const isValid = this.security.validateTimestamp(timestamp);

      console.log(`${test.name}: ${isValid ? '✅' : '❌'}`);
      if (isValid) validCount++;
    }

    console.log(`\n📊 Tolerance test: ${validCount}/${testTimestamps.length} within tolerance`);
    return validCount >= 4; // Allow some variation
  }

  /**
   * Run all timestamp validation tests
   */
  async runAllTests() {
    console.log('⏰ Starting Timestamp Validation Tests...');
    console.log('Target server:', this.baseURL);
    console.log(`Validity window: ${this.validityWindow} seconds`);

    const tests = [
      { name: 'Timestamp Logic', test: () => this.testTimestampValidationLogic() },
      { name: 'Timestamp Tolerance', test: () => this.testTimestampTolerance() },
      { name: 'Valid Timestamp', test: () => this.testValidTimestamp() },
      { name: 'Expired Timestamp', test: () => this.testExpiredTimestamp() },
      { name: 'Future Timestamp', test: () => this.testFutureTimestamp() },
      { name: 'Timestamp Boundaries', test: () => this.testTimestampBoundaries() },
      { name: 'Timestamp Formats', test: () => this.testTimestampFormats() }
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

    console.log('\n📊 Timestamp Validation Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    return { passed, failed, successRate: Math.round((passed / (passed + failed)) * 100) };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new TimestampValidationTester();

  // Check if server is running
  try {
    const healthCheck = await axios.get(`${tester.baseURL}/health`, { timeout: 5000 });
    console.log('🟢 Server is running:', healthCheck.data.status);
    console.log('⏰ Request signing enabled:', healthCheck.data.security?.requestSigning);

    if (!healthCheck.data.security?.requestSigning) {
      console.log('\n⚠️  WARNING: Request signing is disabled on the server.');
      console.log('Timestamp validation tests require request signing to be enabled.');
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

export { TimestampValidationTester };