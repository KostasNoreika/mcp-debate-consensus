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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(express.json({ limit: '50mb' }));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Configurable timeout (default: 60 minutes)
const DEBATE_TIMEOUT_MINUTES = parseInt(process.env.DEBATE_TIMEOUT_MINUTES) || 60;
const TIMEOUT_MS = DEBATE_TIMEOUT_MINUTES * 60 * 1000; // Convert to milliseconds

if (!OPENROUTER_API_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

console.log(`⏱️  Timeout configured: ${DEBATE_TIMEOUT_MINUTES} minutes (${TIMEOUT_MS}ms)`);

// Model mapping for k1-k8 (updated with specified OpenRouter models)
const modelMap = {
  'k1': 'anthropic/claude-opus-4.1',    // Architecture expert (Claude Opus 4.1)
  'k2': 'openai/gpt-5',                 // Testing expert (GPT-5)
  'k3': 'qwen/qwen3-max',               // Algorithm expert (Qwen 3 Max)
  'k4': 'google/gemini-2.5-pro',        // Integration expert (Gemini 2.5 Pro)
  'k7': 'deepseek/deepseek-r1',         // Budget validator (DeepSeek R1 - MIT licensed)
  'k8': 'z-ai/glm-4.5'                  // Open-source backup (GLM-4.5 - powerful MoE)
};

// Conservative token limits for each model (for cost-effectiveness)
const maxTokensMap = {
  'k1': 16000,   // Claude Opus 4.1 (max: 32k)
  'k2': 32000,   // GPT-5 (max: 128k!)
  'k3': 16000,   // Qwen 3 Max (max: 32k)
  'k4': 32000,   // Gemini 2.5 Pro (max: 66k)
  'k7': 8000,    // DeepSeek R1 (conservative for cost)
  'k8': 8000     // GLM-4.5 (conservative for cost)
};

// Port mapping for each k instance
const portMap = {
  'k1': 3457,
  'k2': 3458,
  'k3': 3459,
  'k4': 3460,
  'k7': 3463,
  'k8': 3464
};

function createProxyServer(kInstance) {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  
  const model = modelMap[kInstance];
  const port = portMap[kInstance];
  
  console.log(`🚀 Starting ${kInstance} proxy server on port ${port} -> ${model}`);

  // Claude API to OpenRouter translation
  app.post('/v1/messages', async (req, res) => {
    try {
      console.log(`[${new Date().toISOString()}] ${kInstance} request received`);
      
      // Transform Claude format to OpenRouter format
      const openRouterRequest = {
        model: model,
        messages: req.body.messages,
        max_tokens: req.body.max_tokens || maxTokensMap[kInstance] || 16000,
        temperature: req.body.temperature || 0.7,
        stream: false // Force non-streaming for simplicity
      };
      
      console.log(`[${new Date().toISOString()}] ${kInstance} -> OpenRouter: ${model}`);
      
      // Make request to OpenRouter
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        openRouterRequest,
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:' + port,
            'X-Title': `Debate Consensus MCP - ${kInstance}`
          },
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
        timestamp: timestamp
      };
      
      console.error(`[${timestamp}] ${kInstance} (${model}) failed:`, {
        type: errorType,
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.message,
        details: error.response?.data
      });
      
      res.status(error.response?.status || 500).json({
        error: {
          message: `Model ${kInstance} (${model}) failed: ${errorType === 'timeout' ? `Request timed out after ${DEBATE_TIMEOUT_MINUTES} minutes` : 
                   errorType === 'authentication' ? 'Invalid API key' :
                   errorType === 'authorization' ? 'Access denied to model' :
                   errorType === 'rate_limit' ? 'Rate limit exceeded' :
                   errorType === 'server_error' ? 'OpenRouter server error' :
                   error.response?.data?.error?.message || error.message}`,
          type: 'proxy_error',
          details: errorDetails
        }
      });
    }
  });

  // Simple health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      instance: kInstance,
      model: model,
      port: port,
      timestamp: new Date().toISOString()
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

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        testRequest,
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:' + port,
            'X-Title': `Health Check - ${kInstance}`
          },
          timeout: 10000  // 10 second timeout for health check
        }
      );

      res.json({
        status: 'healthy',
        instance: kInstance,
        model: model,
        response: response.data.choices?.[0]?.message?.content || 'No response',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        instance: kInstance,
        model: model,
        error: error.response?.data?.error?.message || error.message,
        timestamp: new Date().toISOString()
      });
    }
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

console.log('\n📡 K-Proxy Server Status:');
console.log('k1 (Claude Opus 4.1):    http://localhost:3457');
console.log('k2 (GPT-5):              http://localhost:3458');
console.log('k3 (Qwen 3 Max):         http://localhost:3459');
console.log('k4 (Gemini 2.5 Pro):     http://localhost:3460');
console.log('k7 (DeepSeek R1):        http://localhost:3463');
console.log('k8 (GLM-4.5):            http://localhost:3464');
console.log(`\nTimeout: ${DEBATE_TIMEOUT_MINUTES} minutes per request (configurable via DEBATE_TIMEOUT_MINUTES env var)`);
console.log('Press Ctrl+C to stop all proxies\n');