const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || process.env.PROXY_PORT || 3456;

// Load from .env file
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY environment variable is required');
  console.error('Please set it in your .env file');
  process.exit(1);
}

// Model mapping based on MODEL_OVERRIDE environment variable
const modelMap = {
  'k1': 'anthropic/claude-opus-4.1',
  'k2': 'openai/gpt-5',
  'k3': 'qwen/qwen3-max',
  'k4': 'google/gemini-2.5-pro'
};

// Conservative token limits for each model (for cost-effectiveness)
const maxTokensMap = {
  'k1': 16000,   // Claude Opus 4.1 (max: 32k)
  'k2': 32000,   // GPT-5 (max: 128k!)
  'k3': 16000,   // Qwen 3 Max (max: 32k)
  'k4': 32000    // Gemini 2.5 Pro (max: 66k)
};

// Claude API to OpenRouter translation
app.post('/v1/messages', async (req, res) => {
  try {
    // Check for model selection from various sources
    const authHeader = req.headers.authorization || '';
    const apiKey = authHeader.replace('Bearer ', '');
    
    // Try to determine model from:
    // 1. Custom header x-model
    // 2. API key suffix (if ends with -k1, -k2, etc)
    // 3. Environment variable MODEL_OVERRIDE
    // 4. Default to k1
    
    let modelOverride = 'k1';
    
    // Check custom header first
    if (req.headers['x-model']) {
      modelOverride = req.headers['x-model'];
      console.log(`[${new Date().toISOString()}] Model from header: ${modelOverride}`);
    }
    // Check API key pattern
    else if (apiKey.endsWith('-k1')) modelOverride = 'k1';
    else if (apiKey.endsWith('-k2')) modelOverride = 'k2';
    else if (apiKey.endsWith('-k3')) modelOverride = 'k3';
    else if (apiKey.endsWith('-k4')) modelOverride = 'k4';
    // Check exact API keys
    else if (apiKey === 'proxy-key-k1') modelOverride = 'k1';
    else if (apiKey === 'proxy-key-k2') modelOverride = 'k2';
    else if (apiKey === 'proxy-key-k3') modelOverride = 'k3';
    else if (apiKey === 'proxy-key-k4') modelOverride = 'k4';
    // Fall back to environment variable
    else if (process.env.MODEL_OVERRIDE) {
      modelOverride = process.env.MODEL_OVERRIDE;
    }
    
    const model = modelMap[modelOverride] || modelMap['k1'];
    console.log(`[${new Date().toISOString()}] API key: ${apiKey || 'empty'}, Using model: ${model} (${modelOverride})`);
    
    // Transform Claude format to OpenRouter format
    const openRouterRequest = {
      model: model,
      messages: req.body.messages,
      max_tokens: req.body.max_tokens || maxTokensMap[modelOverride] || 16000,
      temperature: req.body.temperature || 0.7,
      stream: req.body.stream || false
    };
    
    // Make request to OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      openRouterRequest,
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3456',
          'X-Title': 'Debate Consensus MCP'
        }
      }
    );
    
    // Log the response for debugging
    console.log(`[${new Date().toISOString()}] OpenRouter response:`, JSON.stringify(response.data).substring(0, 500));
    
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
    
    res.json(claudeResponse);
  } catch (error) {
    console.error('Proxy error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.response?.data?.error?.message || error.message,
        type: 'proxy_error'
      }
    });
  }
});

// Simple health check
app.get('/health', (req, res) => {
  const modelOverride = process.env.MODEL_OVERRIDE || 'k1';
  const model = modelMap[modelOverride] || modelMap['k1'];
  res.json({
    status: 'ok',
    model: model,
    alias: modelOverride,
    timestamp: new Date().toISOString()
  });
});

// Deep health check that actually tests the model
app.post('/health/test', async (req, res) => {
  const modelOverride = process.env.MODEL_OVERRIDE || 'k1';
  const model = modelMap[modelOverride] || modelMap['k1'];

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
          'HTTP-Referer': 'http://localhost:3456',
          'X-Title': 'Health Check - Claude Router'
        },
        timeout: 10000  // 10 second timeout for health check
      }
    );

    res.json({
      status: 'healthy',
      model: model,
      alias: modelOverride,
      response: response.data.choices?.[0]?.message?.content || 'No response',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      model: model,
      alias: modelOverride,
      error: error.response?.data?.error?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Claude Router Proxy started on http://localhost:${PORT}`);
  console.log(`📡 Models available: k1, k2, k3, k4`);
  console.log(`🔧 Use MODEL_OVERRIDE env var to switch models`);
});