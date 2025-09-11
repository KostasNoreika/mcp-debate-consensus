#!/usr/bin/env node

/**
 * Claude CLI Proxy Wrapper
 * Ensures proper API key handling for k1-k4 model aliases
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// Extract model from command arguments or environment
const modelKey = process.argv[2]; // k1, k2, k3, or k4
const prompt = process.argv.slice(3).join(' ');

if (!modelKey || !['k1', 'k2', 'k3', 'k4'].includes(modelKey)) {
  console.error('Usage: node claude-proxy-wrapper.js <k1|k2|k3|k4> <prompt>');
  process.exit(1);
}

if (!prompt) {
  console.error('Please provide a prompt');
  process.exit(1);
}

// Direct HTTP call to proxy with proper headers
const makeDirectCall = async (modelKey, prompt) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: 4096,
      temperature: 0.7
    });

    const options = {
      hostname: 'localhost',
      port: 3456,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer proxy-key-${modelKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.content && response.content[0] && response.content[0].text) {
            resolve(response.content[0].text);
          } else if (response.error) {
            reject(new Error(response.error.message || 'API Error'));
          } else {
            reject(new Error('Invalid response format'));
          }
        } catch (error) {
          reject(new Error(`Parse error: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
};

// Main execution
(async () => {
  try {
    const response = await makeDirectCall(modelKey, prompt);
    console.log(response);
  } catch (error) {
    console.error(`${modelKey} error:`, error.message);
    process.exit(1);
  }
})();