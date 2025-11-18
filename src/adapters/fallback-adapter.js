/**
 * Fallback Adapter
 * Uses OpenRouter proxy for models without native CLI support
 */

import BaseAdapter from './base-adapter.js';
import fetch from 'node-fetch';

class FallbackAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      name: 'FallbackAdapter',
      cliPath: 'none', // No CLI, uses API
      ...config
    });

    this.apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined);
    this.apiBase = config.apiBase || 'https://openrouter.ai/api/v1';
    this.model = config.model;
    this.provider = config.provider;

    this.capabilities = {
      streaming: true,
      mcp: false,
      fileAccess: false,
      toolUse: false,
      contextWindow: 32000 // Conservative default
    };

    // Model context windows
    this.modelContextWindows = {
      'anthropic/claude-opus-4.1': 200000,
      'openai/gpt-5': 128000,
      'qwen/qwen3-max': 32000,
      'google/gemini-3-pro-preview': 1048576,  // Gemini 3 Pro: 1M tokens
      'meta/llama-3-70b': 8192,
      'mistral/mistral-large': 32000
    };
  }

  /**
   * Detect capabilities based on model
   */
  async detectCapabilities() {
    if (this.modelId && this.modelContextWindows[this.modelId]) {
      this.capabilities.contextWindow = this.modelContextWindows[this.modelId];
    }

    // Some models support function calling
    if (this.modelId && (
      this.modelId.includes('gpt') ||
      this.modelId.includes('claude') ||
      this.modelId.includes('gemini')
    )) {
      this.capabilities.toolUse = true;
    }

    return this.capabilities;
  }

  /**
   * Validate configuration
   */
  async validateConfiguration() {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    if (!this.modelId) {
      throw new Error('Model ID not specified for fallback adapter');
    }

    return true;
  }

  /**
   * Execute prompt via OpenRouter API
   */
  async execute(prompt, options = {}) {
    await this.validateConfiguration();

    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      attempt++;

      try {
        const response = await this.callAPI(prompt, options);

        this.emit('execution:complete', {
          adapter: this.name,
          model: this.modelId,
          duration: Date.now() - startTime,
          attempt,
          success: true
        });

        return this.formatResponse(response);
      } catch (error) {
        lastError = error;

        this.emit('execution:error', {
          adapter: this.name,
          model: this.modelId,
          error: error.message,
          attempt
        });

        if (attempt < this.maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`Fallback adapter failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Call OpenRouter API
   */
  async callAPI(prompt, options = {}) {
    const messages = this.buildMessages(prompt, options);
    const body = {
      model: this.modelId,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 4096,
      stream: false
    };

    // Add tools if supported
    if (options.tools && this.capabilities.toolUse) {
      body.tools = options.tools;
    }

    // Add response format if specified
    if (options.responseFormat) {
      body.response_format = { type: options.responseFormat };
    }

    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/debate-consensus',
        'X-Title': 'Debate Consensus MCP'
      },
      body: JSON.stringify(body),
      timeout: this.timeout
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Build messages array for API
   */
  buildMessages(prompt, options = {}) {
    const messages = [];

    // System message
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }

    // Add context from files if provided
    if (options.files && options.files.length > 0) {
      const fileContext = options.files.map(file => {
        return `File: ${file}\n[File content would be loaded here]`;
      }).join('\n\n');

      messages.push({
        role: 'system',
        content: `Context files:\n${fileContext}`
      });
    }

    // User message
    messages.push({
      role: 'user',
      content: prompt
    });

    return messages;
  }

  /**
   * Format API response
   */
  formatResponse(apiResponse) {
    const choice = apiResponse.choices[0];

    const response = {
      adapter: this.name,
      model: this.modelId,
      response: choice.message.content,
      metadata: {
        model: apiResponse.model,
        usage: apiResponse.usage,
        finishReason: choice.finish_reason,
        timestamp: new Date().toISOString()
      }
    };

    // Extract function calls
    if (choice.message.tool_calls) {
      response.toolCalls = choice.message.tool_calls;
    }

    // Extract code blocks
    if (response.response && response.response.includes('```')) {
      response.code = this.extractCodeBlocks(response.response);
    }

    return response;
  }

  /**
   * Extract code blocks from response
   */
  extractCodeBlocks(text) {
    const codeBlocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        content: match[2].trim()
      });
    }

    return codeBlocks;
  }

  /**
   * Override runCLI to prevent execution
   */
  async runCLI(prompt, options = {}) {
    throw new Error('Fallback adapter does not use CLI');
  }

  /**
   * Check if fallback is available
   */
  async isAvailable() {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiBase}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get fallback adapter info
   */
  getInfo() {
    return {
      name: this.name,
      model: this.modelId,
      provider: this.provider || 'OpenRouter',
      capabilities: this.capabilities,
      available: this.isAvailable()
    };
  }
}

export default FallbackAdapter;