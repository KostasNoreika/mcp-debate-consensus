#!/usr/bin/env node

/**
 * K-Proxy Server: Claude API to OpenRouter proxy for k1-k4 debate models
 * 
 * This server intercepts Claude CLI API calls and routes them through OpenRouter,
 * allowing each k1-k4 instance to use different models while maintaining
 * full MCP tool access through the Claude CLI.
 */

const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(express.json({ limit: '50mb' }));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

// Model mapping for k1-k4 (updated with actually available models)
const modelMap = {
  'k1': 'anthropic/claude-3-5-sonnet-20241022',  // Architecture expert (Claude 3.5 Sonnet)
  'k2': 'openai/gpt-4o',                         // Testing expert (GPT-4o)
  'k3': 'qwen/qwen-2.5-72b-instruct',           // Algorithm expert (Qwen 2.5)
  'k4': 'google/gemini-pro-1.5'                 // Integration expert (Gemini Pro)
};

// Port mapping for each k instance
const portMap = {
  'k1': 3457,
  'k2': 3458, 
  'k3': 3459,
  'k4': 3460
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
        max_tokens: req.body.max_tokens || 4096,
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
          timeout: 120000 // 2 minutes
        }
      );
      
      // Transform OpenRouter response to Claude format
      if (!response.data.choices || !response.data.choices[0]) {
        throw new Error(`Invalid OpenRouter response: ${JSON.stringify(response.data).substring(0, 200)}`);
      }
      
      const claudeResponse = {
        id: response.data.id,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: response.data.choices[0].message.content
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
      console.error(`[${new Date().toISOString()}] ${kInstance} error:`, error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: {
          message: error.response?.data?.error?.message || error.message,
          type: 'proxy_error'
        }
      });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      instance: kInstance,
      model: model,
      port: port,
      timestamp: new Date().toISOString()
    });
  });

  return { app, port };
}

// Start proxy servers for all k instances
const servers = [];

Object.keys(modelMap).forEach(kInstance => {
  const { app, port } = createProxyServer(kInstance);
  
  const server = app.listen(port, 'localhost', () => {
    console.log(`✅ ${kInstance} proxy running on http://localhost:${port} -> ${modelMap[kInstance]}`);
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
console.log('k1 (Claude 3.5 Sonnet):  http://localhost:3457');
console.log('k2 (GPT-4o):             http://localhost:3458'); 
console.log('k3 (Qwen 2.5):           http://localhost:3459');
console.log('k4 (Gemini Pro 1.5):     http://localhost:3460');
console.log('\nPress Ctrl+C to stop all proxies\n');