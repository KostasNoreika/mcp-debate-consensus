const axios = require('axios');
const { config } = require('./config');

// Get configuration values with fallbacks
const OPENROUTER_API_URL = config.get('api.openrouter.baseUrl') || 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TEMPERATURE = config.get('api.openrouter.defaultTemperature') || 0.7;
const DEFAULT_MAX_TOKENS = config.get('api.openrouter.defaultMaxTokens') || 4096;
const MAX_RETRIES = config.get('api.openrouter.maxRetries') || 3;
const RETRY_DELAY = config.get('api.openrouter.retryDelay') || 1000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callOpenRouter(model, prompt, customParams = {}) {
  // Validate API key - check config first, then environment
  const apiKey = config.get('apiKeys.openrouter') || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const params = {
    model: model,
    messages: [{ role: 'user', content: prompt }],
    temperature: customParams.temperature || DEFAULT_TEMPERATURE,
    max_tokens: customParams.max_tokens || DEFAULT_MAX_TOKENS,
    ...customParams
  };

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': config.get('server.referer') || 'https://github.com/user/debate-consensus',
    'X-Title': config.get('server.name') || 'Debate Consensus System'
  };

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const requestConfig = {
        headers,
        timeout: config.get('api.openrouter.timeout') || 30000
      };
      
      const response = await axios.post(OPENROUTER_API_URL, params, requestConfig);
      
      // Log successful request if logging is enabled
      if (config.get('features.logging')) {
        console.log(`OpenRouter API call successful: ${model} (attempt ${attempt + 1})`);
      }
      
      return response.data.choices[0].message.content;
    } catch (error) {
      lastError = error;
      
      // Log error if logging is enabled
      if (config.get('features.logging')) {
        console.warn(`OpenRouter API call failed: ${model} (attempt ${attempt + 1})`, error.message);
      }
      
      // Handle rate limiting
      if (error.response?.status === 429 && attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff
        await sleep(delay);
        continue;
      }
      
      // Other errors, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

module.exports = { callOpenRouter };