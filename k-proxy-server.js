#!/usr/bin/env node

/**
 * K-Proxy Server: Claude API to OpenRouter proxy for k1-k4 debate models
 *
 * This server intercepts Claude CLI API calls and routes them through OpenRouter,
 * allowing each k1-k4 instance to use different models while maintaining
 * full MCP tool access through the Claude CLI.
 */

import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Security } from './src/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Configurable timeout (default: 60 minutes)
const DEBATE_TIMEOUT_MINUTES = parseInt(process.env.DEBATE_TIMEOUT_MINUTES) || 60;
const TIMEOUT_MS = DEBATE_TIMEOUT_MINUTES * 60 * 1000; // Convert to milliseconds

if (!OPENROUTER_API_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

console.log(`⏱️  Timeout configured: ${DEBATE_TIMEOUT_MINUTES} minutes (${TIMEOUT_MS}ms)`);

// Initialize security module
const security = new Security();

// Log security configuration
console.log('🔒 Security Configuration:', security.getSecurityStatus());

// Model mapping for k1-k8 (updated with specified OpenRouter models)
const modelMap = {
  'k1': 'anthropic/claude-sonnet-4.5',  // Architecture expert (Claude Sonnet 4.5)
  'k2': 'openai/gpt-5',                 // Testing expert (GPT-5)
  'k3': 'qwen/qwen3-max',               // Algorithm expert (Qwen 3 Max)
  'k4': 'google/gemini-2.5-pro',        // Integration expert (Gemini 2.5 Pro)
  'k5': 'x-ai/grok-4-fast:free',        // Fast reasoning (Grok 4 Fast - free tier)
  'k7': 'deepseek/deepseek-r1',         // Budget validator (DeepSeek R1 - MIT licensed)
  'k8': 'z-ai/glm-4.5'                  // Open-source backup (GLM-4.5 - powerful MoE)
};

// Conservative token limits for each model (for cost-effectiveness)
const maxTokensMap = {
  'k1': 16000,   // Claude Opus 4.1 (max: 32k)
  'k2': 32000,   // GPT-5 (max: 128k!)
  'k3': 16000,   // Qwen 3 Max (max: 32k)
  'k4': 32000,   // Gemini 2.5 Pro (max: 66k)
  'k5': 8000,    // Grok 4 Fast (free tier - conservative)
  'k7': 8000,    // DeepSeek R1 (conservative for cost)
  'k8': 8000     // GLM-4.5 (conservative for cost)
};

// Port mapping for each k instance
const portMap = {
  'k1': 3457,
  'k2': 3458,
  'k3': 3459,
  'k4': 3460,
  'k5': 3461,
  'k7': 3463,
  'k8': 3464
};

function createProxyServer(kInstance) {
  const app = express();

  // Enable trust proxy for proper IP detection behind reverse proxies
  app.set('trust proxy', true);

  // Apply security middleware
  app.use(security.securityHeadersMiddleware());
  app.use(security.auditMiddleware());

  // Parse JSON with size limit
  app.use(express.json({ limit: '50mb' }));

  // Apply rate limiting (more lenient for proxy servers)
  app.use(security.rateLimitMiddleware({
    maxRequests: 100, // Higher limit for proxy
    windowMs: 60000,  // 1 minute window
    keyGenerator: (req) => {
      // Use combination of IP and k-instance for rate limiting
      return `${req.ip}-${kInstance}`;
    }
  }));

  // Apply signature validation (can be disabled for backward compatibility)
  if (process.env.ENABLE_REQUEST_SIGNING !== 'false') {
    app.use(security.signatureMiddleware());
  }

  const model = modelMap[kInstance];
  const port = portMap[kInstance];

  console.log(`🚀 Starting ${kInstance} proxy server on port ${port} -> ${model}`);

  // Claude API to OpenRouter translation
  app.post('/v1/messages', async (req, res) => {
    try {
      console.log(`[${new Date().toISOString()}] ${kInstance} request received from ${req.ip}`);

      // Validate request body
      if (!req.body || !req.body.messages) {
        return res.status(400).json({
          error: {
            message: 'Invalid request body: messages array is required',
            type: 'validation_error'
          }
        });
      }

      // Transform Claude format to OpenRouter format
      const openRouterRequest = {
        model: model,
        messages: req.body.messages,
        max_tokens: req.body.max_tokens || maxTokensMap[kInstance] || 16000,
        temperature: req.body.temperature || 0.7,
        stream: false // Force non-streaming for simplicity
      };

      console.log(`[${new Date().toISOString()}] ${kInstance} -> OpenRouter: ${model}`);

      // Sign outgoing request if enabled
      const requestHeaders = {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:' + port,
        'X-Title': `Debate Consensus MCP - ${kInstance}`
      };

      // Add signature headers for enhanced security
      if (process.env.SIGN_OUTGOING_REQUESTS === 'true') {
        const signatureData = security.signOutgoingRequest(
          'POST',
          'https://openrouter.ai/api/v1/chat/completions',
          openRouterRequest,
          OPENROUTER_API_KEY
        );
        Object.assign(requestHeaders, signatureData.headers);
      }

      // Make request to OpenRouter
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        openRouterRequest,
        {
          headers: requestHeaders,
          timeout: TIMEOUT_MS
        }
      );

      // Transform OpenRouter response to Claude format
      if (!response.data.choices || !response.data.choices[0]) {
        throw new Error(`Invalid OpenRouter response: ${JSON.stringify(response.data).substring(0, 200)}`);
      }

      // Get content from response, handle different formats
      let messageContent = response.data.choices[0].message.content;

      // If content is empty or just whitespace, provide a default
      if (!messageContent || messageContent.trim() === '') {
        messageContent = 'Model response was empty. Please try rephrasing the question.';
      }

      // Sanitize output to remove any sensitive information
      messageContent = security.sanitizeOutput(messageContent);

      const claudeResponse = {
        id: response.data.id,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: messageContent
        }],
        model: model,
        stop_reason: response.data.choices[0].finish_reason,
        usage: {
          input_tokens: response.data.usage?.prompt_tokens || 0,
          output_tokens: response.data.usage?.completion_tokens || 0
        }
      };

      console.log(`[${new Date().toISOString()}] ${kInstance} response: ${claudeResponse.content[0].text.length} chars`);
      res.json(claudeResponse);

    } catch (error) {
      const timestamp = new Date().toISOString();
      const errorType = error.code === 'ECONNABORTED' ? 'timeout' :
                       error.response?.status === 401 ? 'authentication' :
                       error.response?.status === 403 ? 'authorization' :
                       error.response?.status === 429 ? 'rate_limit' :
                       error.response?.status >= 500 ? 'server_error' : 'unknown';

      const errorDetails = {
        model: model,
        instance: kInstance,
        errorType: errorType,
        statusCode: error.response?.status,
        originalMessage: error.response?.data?.error?.message || error.message,
        timestamp: timestamp,
        clientIp: req.ip
      };

      console.error(`[${timestamp}] ${kInstance} (${model}) failed:`, {
        type: errorType,
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.message,
        details: error.response?.data,
        clientIp: req.ip
      });

      // Sanitize error message
      const sanitizedErrorMessage = security.sanitizeOutput(
        error.response?.data?.error?.message || error.message
      );

      res.status(error.response?.status || 500).json({
        error: {
          message: `Model ${kInstance} (${model}) failed: ${errorType === 'timeout' ? `Request timed out after ${DEBATE_TIMEOUT_MINUTES} minutes` :
                   errorType === 'authentication' ? 'Invalid API key' :
                   errorType === 'authorization' ? 'Access denied to model' :
                   errorType === 'rate_limit' ? 'Rate limit exceeded' :
                   errorType === 'server_error' ? 'OpenRouter server error' :
                   sanitizedErrorMessage}`,
          type: 'proxy_error',
          details: errorDetails
        }
      });
    }
  });

  // Simple health check (no authentication required)
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      instance: kInstance,
      model: model,
      port: port,
      timestamp: new Date().toISOString(),
      security: {
        requestSigning: security.ENABLE_REQUEST_SIGNING,
        rateLimiting: true,
        securityHeaders: true
      }
    });
  });

  // Deep health check that actually tests the model
  app.post('/health/test', async (req, res) => {
    try {
      const testRequest = {
        model: model,
        messages: [{
          role: 'user',
          content: 'This is a health check test. Please respond with exactly: OK'
        }],
        max_tokens: 20,  // Minimum 20 tokens for health check
        temperature: 0.1,
        stream: false
      };

      const requestHeaders = {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:' + port,
        'X-Title': `Health Check - ${kInstance}`
      };

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        testRequest,
        {
          headers: requestHeaders,
          timeout: 10000  // 10 second timeout for health check
        }
      );

      res.json({
        status: 'healthy',
        instance: kInstance,
        model: model,
        response: security.sanitizeOutput(response.data.choices?.[0]?.message?.content || 'No response'),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        instance: kInstance,
        model: model,
        error: security.sanitizeOutput(error.response?.data?.error?.message || error.message),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Security status endpoint (no authentication required for monitoring)
  app.get('/security/status', (req, res) => {
    res.json({
      instance: kInstance,
      security: security.getSecurityStatus(),
      timestamp: new Date().toISOString()
    });
  });

  return { app, port };
}

// Start proxy servers for all k instances
const servers = [];

Object.keys(modelMap).forEach(kInstance => {
  const { app, port } = createProxyServer(kInstance);

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`✅ ${kInstance} proxy running on http://0.0.0.0:${port} -> ${modelMap[kInstance]}`);
  });

  // Set server timeout
  server.timeout = TIMEOUT_MS + 10000; // Add 10 seconds buffer

  servers.push({ instance: kInstance, server, port });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down k-proxy servers...');
  servers.forEach(({ instance, server }) => {
    server.close(() => {
      console.log(`✅ ${instance} proxy server closed`);
    });
  });
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down k-proxy servers...');
  servers.forEach(({ instance, server }) => {
    server.close(() => {
      console.log(`✅ ${instance} proxy server closed`);
    });
  });
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  console.log('Shutting down due to uncaught exception...');
  servers.forEach(({ instance, server }) => {
    server.close();
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit for unhandled rejections, just log them
});

console.log('\n📡 K-Proxy Server Status:');
console.log('k1 (Claude Sonnet 4.5):  http://localhost:3457');
console.log('k2 (GPT-5):              http://localhost:3458');
console.log('k3 (Qwen 3 Max):         http://localhost:3459');
console.log('k4 (Gemini 2.5 Pro):     http://localhost:3460');
console.log('k7 (DeepSeek R1):        http://localhost:3463');
console.log('k8 (GLM-4.5):            http://localhost:3464');
console.log(`\nTimeout: ${DEBATE_TIMEOUT_MINUTES} minutes per request (configurable via DEBATE_TIMEOUT_MINUTES env var)`);
console.log('Security Features: Request signing, Rate limiting, Security headers, Audit logging');
console.log('Press Ctrl+C to stop all proxies\n');