#!/usr/bin/env node

/**
 * Client-side request signing example for MCP Debate Consensus Server
 * Demonstrates how to properly sign requests for authentication
 */

import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class DebateConsensusClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3457';
    this.hmacSecret = options.hmacSecret || process.env.HMAC_SECRET;
    this.apiKey = options.apiKey || process.env.CLIENT_API_KEY || '';
    this.enableSigning = options.enableSigning !== false;

    if (this.enableSigning && !this.hmacSecret) {
      throw new Error('HMAC_SECRET is required for request signing. Set it in .env or pass via options.');
    }
  }

  /**
   * Generate cryptographically secure nonce
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate timestamp for request signing
   */
  generateTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Create HMAC-SHA256 signature for request
   */
  createSignature(method, path, body, timestamp, nonce) {
    const stringToSign = [
      method.toUpperCase(),
      path,
      timestamp,
      nonce,
      this.apiKey || '',
      body || ''
    ].join('\n');

    return crypto
      .createHmac('sha256', this.hmacSecret)
      .update(stringToSign)
      .digest('hex');
  }

  /**
   * Sign a request and return headers
   */
  signRequest(method, url, body) {
    if (!this.enableSigning) {
      return {};
    }

    const timestamp = this.generateTimestamp();
    const nonce = this.generateNonce();
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body || {});
    const urlPath = new URL(url).pathname;

    const signature = this.createSignature(
      method,
      urlPath,
      bodyString,
      timestamp,
      nonce
    );

    return {
      'X-Signature': signature,
      'X-Timestamp': timestamp.toString(),
      'X-Nonce': nonce,
      'X-Signature-Version': '1.0',
      'X-API-Key': this.apiKey
    };
  }

  /**
   * Make a signed request to the debate consensus API
   */
  async makeRequest(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const body = data ? JSON.stringify(data) : null;

    // Sign the request
    const signatureHeaders = this.signRequest(method, url, body);

    const headers = {
      'Content-Type': 'application/json',
      ...signatureHeaders
    };

    console.log(`🔒 Making ${method} request to ${endpoint}`);
    console.log('Signature headers:', signatureHeaders);

    try {
      const response = await axios({
        method,
        url,
        data,
        headers,
        timeout: 60000 // 1 minute timeout
      });

      console.log('✅ Request successful');
      return response.data;
    } catch (error) {
      console.error('❌ Request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a message to the Claude model via proxy
   */
  async sendMessage(messages, options = {}) {
    const requestData = {
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
      ...options
    };

    return await this.makeRequest('POST', '/v1/messages', requestData);
  }

  /**
   * Check health of the proxy server
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error.message);
      throw error;
    }
  }

  /**
   * Check security status
   */
  async checkSecurityStatus() {
    try {
      const response = await axios.get(`${this.baseUrl}/security/status`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Security status check failed:', error.message);
      throw error;
    }
  }
}

// Example usage and testing
async function demonstrateUsage() {
  console.log('🚀 Debate Consensus Client - Request Signing Demo\n');

  // Initialize client
  const client = new DebateConsensusClient({
    baseUrl: 'http://localhost:3457', // k1 proxy
    enableSigning: true
  });

  console.log('📋 Configuration:');
  console.log('  Base URL:', client.baseUrl);
  console.log('  Signing enabled:', client.enableSigning);
  console.log('  Has HMAC secret:', !!client.hmacSecret);
  console.log('  API Key:', client.apiKey || '(none)');
  console.log('');

  try {
    // Test 1: Health check (no signing required)
    console.log('🏥 Test 1: Health Check');
    const health = await client.checkHealth();
    console.log('Health status:', health);
    console.log('');

    // Test 2: Security status check
    console.log('🔒 Test 2: Security Status');
    const securityStatus = await client.checkSecurityStatus();
    console.log('Security status:', securityStatus);
    console.log('');

    // Test 3: Signed API request
    console.log('💬 Test 3: Signed Message Request');
    const messages = [
      {
        role: 'user',
        content: 'Hello! Please respond with a brief greeting.'
      }
    ];

    const response = await client.sendMessage(messages, {
      maxTokens: 100,
      temperature: 0.7
    });

    console.log('Response received:');
    console.log('  Model:', response.model);
    console.log('  Content length:', response.content[0]?.text?.length || 0);
    console.log('  Usage:', response.usage);
    console.log('');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.log('\n💡 This likely means:');
      console.log('  - Request signing is enabled but HMAC_SECRET is not set');
      console.log('  - HMAC_SECRET doesn\'t match the server secret');
      console.log('  - Request signature is invalid');
      console.log('\n🔧 To fix:');
      console.log('  1. Ensure HMAC_SECRET is set in .env');
      console.log('  2. Make sure server and client use the same secret');
      console.log('  3. Check that the server is running with security enabled');
    }

    process.exit(1);
  }
}

// Utility function to generate a secure HMAC secret
function generateHmacSecret() {
  return crypto.randomBytes(64).toString('hex');
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === 'generate-secret') {
    console.log('Generated HMAC Secret (add to .env):');
    console.log(`HMAC_SECRET=${generateHmacSecret()}`);
    process.exit(0);
  }

  if (process.argv[2] === 'demo') {
    demonstrateUsage().catch(error => {
      console.error('Demo failed:', error.message);
      process.exit(1);
    });
  } else {
    console.log('Usage:');
    console.log('  node client-signing-example.js demo           # Run demonstration');
    console.log('  node client-signing-example.js generate-secret # Generate HMAC secret');
    console.log('');
    console.log('Environment variables:');
    console.log('  HMAC_SECRET      # Shared secret for request signing');
    console.log('  CLIENT_API_KEY   # Optional API key identifier');
  }
}

export { DebateConsensusClient };