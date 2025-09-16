/**
 * Codex CLI Adapter
 * Integrates with Codex CLI for OpenAI models
 */

import BaseAdapter from './base-adapter.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

class CodexAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      name: 'CodexAdapter',
      cliPath: config.cliPath || 'codex',
      ...config
    });

    this.model = config.model || 'gpt-5';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.configPath = config.configPath || path.join(os.homedir(), '.codex', 'config.json');

    this.capabilities = {
      streaming: true,
      mcp: false, // Codex doesn't have native MCP
      fileAccess: true,
      toolUse: true,
      contextWindow: 128000
    };

    // Rate limiting
    this.rateLimiter = {
      requestsPerMinute: 50,
      tokensPerMinute: 150000,
      currentRequests: 0,
      currentTokens: 0,
      resetTime: Date.now() + 60000
    };
  }

  /**
   * Detect Codex CLI capabilities
   */
  async detectCapabilities() {
    try {
      const result = await this.runCLI('', { args: ['--version'] });

      // Check for available models
      if (result.stdout.includes('gpt-5')) {
        this.capabilities.contextWindow = 128000;
      } else if (result.stdout.includes('gpt-4')) {
        this.capabilities.contextWindow = 32000;
      }

      // Check for function calling
      this.capabilities.toolUse = result.stdout.includes('functions') ||
                                 result.stdout.includes('tools');

      return this.capabilities;
    } catch (error) {
      console.warn(`Failed to detect Codex capabilities: ${error.message}`);
      return this.capabilities;
    }
  }

  /**
   * Build CLI arguments for Codex
   */
  buildArgs(options = {}) {
    const args = [];

    // Model selection
    args.push('--model', options.model || this.model);

    // Temperature
    if (options.temperature !== undefined) {
      args.push('--temperature', String(options.temperature));
    }

    // Max tokens
    if (options.maxTokens) {
      args.push('--max-tokens', String(options.maxTokens));
    }

    // System message
    if (options.systemPrompt) {
      args.push('--system', options.systemPrompt);
    }

    // Files to include
    if (options.files && this.capabilities.fileAccess) {
      options.files.forEach(file => {
        args.push('--file', file);
      });
    }

    // Function definitions
    if (options.functions && this.capabilities.toolUse) {
      args.push('--functions', JSON.stringify(options.functions));
    }

    // Response format
    if (options.responseFormat) {
      args.push('--response-format', options.responseFormat);
    }

    // Seed for deterministic output
    if (options.seed !== undefined) {
      args.push('--seed', String(options.seed));
    }

    // Non-interactive mode
    args.push('--non-interactive');

    // JSON output for parsing
    args.push('--json');

    return args;
  }

  /**
   * Build environment variables for Codex
   */
  buildEnv(options = {}) {
    const env = {};

    // OpenAI API key
    if (this.apiKey) {
      env.OPENAI_API_KEY = this.apiKey;
    }

    // API base URL (for proxies or custom endpoints)
    if (options.apiBase) {
      env.OPENAI_API_BASE = options.apiBase;
    }

    // Organization ID
    if (options.organization || process.env.OPENAI_ORGANIZATION) {
      env.OPENAI_ORGANIZATION = options.organization || process.env.OPENAI_ORGANIZATION;
    }

    // Debug mode
    if (options.debug) {
      env.CODEX_DEBUG = '1';
    }

    return env;
  }

  /**
   * Check and handle rate limiting
   */
  async checkRateLimit(estimatedTokens = 1000) {
    const now = Date.now();

    // Reset counters if minute has passed
    if (now > this.rateLimiter.resetTime) {
      this.rateLimiter.currentRequests = 0;
      this.rateLimiter.currentTokens = 0;
      this.rateLimiter.resetTime = now + 60000;
    }

    // Check if we're at the limit
    if (this.rateLimiter.currentRequests >= this.rateLimiter.requestsPerMinute ||
        this.rateLimiter.currentTokens + estimatedTokens > this.rateLimiter.tokensPerMinute) {

      const waitTime = this.rateLimiter.resetTime - now;
      this.emit('rate:limit', {
        adapter: this.name,
        waitTime,
        requests: this.rateLimiter.currentRequests,
        tokens: this.rateLimiter.currentTokens
      });

      await this.delay(waitTime);

      // Reset after waiting
      this.rateLimiter.currentRequests = 0;
      this.rateLimiter.currentTokens = 0;
      this.rateLimiter.resetTime = Date.now() + 60000;
    }

    // Update counters
    this.rateLimiter.currentRequests++;
    this.rateLimiter.currentTokens += estimatedTokens;
  }

  /**
   * Execute Codex-specific prompt
   */
  async execute(prompt, options = {}) {
    // Estimate tokens (rough approximation)
    const estimatedTokens = Math.ceil(prompt.length / 4) + (options.maxTokens || 1000);

    // Check rate limiting
    await this.checkRateLimit(estimatedTokens);

    // Add code-specific instructions if needed
    if (options.codeGeneration) {
      options.systemPrompt = (options.systemPrompt || '') + '\nYou are an expert programmer. Generate clean, efficient, and well-documented code.';
    }

    // Enable function calling for complex tasks
    if (options.enableFunctions && this.capabilities.toolUse) {
      options.functions = this.getDefaultFunctions();
    }

    try {
      const result = await super.execute(prompt, options);

      // Update token usage
      if (result.metadata.usage) {
        this.rateLimiter.currentTokens += result.metadata.usage.totalTokens || 0;
      }

      return result;
    } catch (error) {
      // Handle specific OpenAI errors
      if (error.message.includes('rate_limit')) {
        await this.delay(60000); // Wait a minute
        return this.execute(prompt, options); // Retry
      }

      throw error;
    }
  }

  /**
   * Get default function definitions
   */
  getDefaultFunctions() {
    return [
      {
        name: 'read_file',
        description: 'Read contents of a file',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write contents to a file',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file'
            },
            content: {
              type: 'string',
              description: 'Content to write'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'run_command',
        description: 'Execute a shell command',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to execute'
            }
          },
          required: ['command']
        }
      }
    ];
  }

  /**
   * Format Codex response
   */
  formatResponse(result) {
    const response = super.formatResponse(result);

    try {
      // Parse JSON response
      const jsonResponse = JSON.parse(result.stdout);

      response.response = jsonResponse.content || jsonResponse.message || result.stdout;
      response.metadata.usage = jsonResponse.usage;
      response.metadata.model = jsonResponse.model;

      // Extract function calls if present
      if (jsonResponse.function_call) {
        response.functionCall = jsonResponse.function_call;
      }

      // Extract code blocks
      if (response.response.includes('```')) {
        response.code = this.extractCodeBlocks(response.response);
      }
    } catch {
      // If not JSON, use raw output
      response.response = result.stdout;
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
   * Check if Codex CLI is available
   */
  async isAvailable() {
    if (!this.apiKey) {
      return false;
    }

    try {
      const result = await this.runCLI('', { args: ['--help'] });
      return result.stdout.includes('codex') || result.stdout.includes('OpenAI');
    } catch {
      return false;
    }
  }

  /**
   * Get Codex adapter info
   */
  getInfo() {
    const info = super.getInfo();
    info.model = this.model;
    info.rateLimit = {
      requests: `${this.rateLimiter.requestsPerMinute}/min`,
      tokens: `${this.rateLimiter.tokensPerMinute}/min`
    };
    info.contextWindow = this.capabilities.contextWindow;
    return info;
  }
}

export default CodexAdapter;