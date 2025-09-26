/**
 * Gemini CLI Adapter
 * Integrates with Gemini CLI for Google AI models
 */

import BaseAdapter from './base-adapter.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

class GeminiAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      name: 'GeminiAdapter',
      cliPath: config.cliPath || 'gemini',
      ...config
    });

    this.model = config.model || 'gemini-2.5-pro';
    this.apiKey = config.apiKey || (typeof process !== 'undefined' ? process.env?.GOOGLE_API_KEY : undefined);
    this.configPath = config.configPath || path.join(os.homedir(), '.gemini', 'config.json');
    this.sandboxMode = config.sandboxMode !== false; // Default to true for safety

    this.capabilities = {
      streaming: true,
      mcp: false, // Gemini doesn't have native MCP
      fileAccess: true,
      toolUse: true,
      contextWindow: 1000000, // 1M tokens for Gemini Pro
      multimodal: true
    };

    // Safety settings
    this.safetySettings = config.safetySettings || {
      'HARM_CATEGORY_HARASSMENT': 'BLOCK_MEDIUM_AND_ABOVE',
      'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_MEDIUM_AND_ABOVE',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_MEDIUM_AND_ABOVE',
      'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_MEDIUM_AND_ABOVE'
    };
  }

  /**
   * Detect Gemini CLI capabilities
   */
  async detectCapabilities() {
    try {
      // Guard against missing process in test environment
      if (typeof process === 'undefined') {
        return this.capabilities;
      }

      const result = await this.runCLI('', { args: ['--version'] });

      // Check for model variants
      if (result.stdout.includes('gemini-2.5-pro')) {
        this.capabilities.contextWindow = 2000000; // 2M for latest
      } else if (result.stdout.includes('gemini-pro')) {
        this.capabilities.contextWindow = 1000000;
      } else if (result.stdout.includes('gemini-flash')) {
        this.capabilities.contextWindow = 1000000;
      }

      // Check for code execution capability
      if (result.stdout.includes('code-execution') || result.stdout.includes('sandbox')) {
        this.capabilities.codeExecution = true;
      }

      // Check for grounding capability
      if (result.stdout.includes('grounding') || result.stdout.includes('search')) {
        this.capabilities.grounding = true;
      }

      return this.capabilities;
    } catch (error) {
      console.warn(`Failed to detect Gemini capabilities: ${error.message}`);
      return this.capabilities;
    }
  }

  /**
   * Build CLI arguments for Gemini
   */
  buildArgs(options = {}) {
    const args = [];

    // Model selection
    args.push('--model', options.model || this.model);

    // Temperature
    if (options.temperature !== undefined) {
      args.push('--temperature', String(options.temperature));
    }

    // Max output tokens
    if (options.maxTokens) {
      args.push('--max-output-tokens', String(options.maxTokens));
    }

    // System instruction
    if (options.systemPrompt) {
      args.push('--system-instruction', options.systemPrompt);
    }

    // Files to include (supports images, videos, etc.)
    if (options.files && this.capabilities.fileAccess) {
      options.files.forEach(file => {
        args.push('--file', file);
      });
    }

    // Tools/Functions
    if (options.tools && this.capabilities.toolUse) {
      args.push('--tools', JSON.stringify(options.tools));
    }

    // Code execution (sandbox mode)
    if (options.codeExecution && this.capabilities.codeExecution) {
      args.push('--enable-code-execution');
      if (this.sandboxMode) {
        args.push('--sandbox');
      }
    }

    // Grounding with Google Search
    if (options.grounding && this.capabilities.grounding) {
      args.push('--enable-grounding');
    }

    // Safety settings
    if (options.safetySettings || this.safetySettings) {
      args.push('--safety-settings', JSON.stringify(options.safetySettings || this.safetySettings));
    }

    // Top-K sampling
    if (options.topK !== undefined) {
      args.push('--top-k', String(options.topK));
    }

    // Top-P sampling
    if (options.topP !== undefined) {
      args.push('--top-p', String(options.topP));
    }

    // Response MIME type
    if (options.responseMimeType) {
      args.push('--response-mime-type', options.responseMimeType);
    }

    // Non-interactive mode
    args.push('--non-interactive');

    // JSON output for parsing
    args.push('--json');

    return args;
  }

  /**
   * Build environment variables for Gemini
   */
  buildEnv(options = {}) {
    const env = {};

    // Google API key
    if (this.apiKey) {
      env.GOOGLE_API_KEY = this.apiKey;
    }

    // Project ID for Vertex AI
    const projectId = options.projectId || (typeof process !== 'undefined' ? process.env?.GOOGLE_PROJECT_ID : undefined);
    if (projectId) {
      env.GOOGLE_PROJECT_ID = projectId;
    }

    // Location for Vertex AI
    const location = options.location || (typeof process !== 'undefined' ? process.env?.GOOGLE_LOCATION : undefined);
    if (location) {
      env.GOOGLE_LOCATION = location;
    }

    // Debug mode
    if (options.debug) {
      env.GEMINI_DEBUG = '1';
    }

    return env;
  }

  /**
   * Execute Gemini-specific prompt
   */
  async execute(prompt, options = {}) {
    // Enable code execution for programming tasks
    if (options.programmingTask) {
      options.codeExecution = true;
      options.systemPrompt = (options.systemPrompt || '') + '\nYou are an expert programmer. When writing code, ensure it is executable and well-tested.';
    }

    // Enable grounding for fact-checking
    if (options.factCheck) {
      options.grounding = true;
    }

    // Add multimodal context if available
    if (options.images || options.videos) {
      options.files = [
        ...(options.files || []),
        ...(options.images || []),
        ...(options.videos || [])
      ];
    }

    // Use Gemini's large context window for big projects
    if (options.largeContext) {
      options.maxTokens = Math.min(options.maxTokens || 8192, 100000);
    }

    return super.execute(prompt, options);
  }

  /**
   * Format Gemini response
   */
  formatResponse(result) {
    const response = super.formatResponse(result);

    try {
      // Parse JSON response
      const jsonResponse = JSON.parse(result.stdout);

      response.response = jsonResponse.text || jsonResponse.content || result.stdout;
      response.metadata.model = jsonResponse.model;
      response.metadata.usage = {
        promptTokens: jsonResponse.usageMetadata?.promptTokenCount,
        completionTokens: jsonResponse.usageMetadata?.candidatesTokenCount,
        totalTokens: jsonResponse.usageMetadata?.totalTokenCount
      };

      // Extract function calls
      if (jsonResponse.functionCalls) {
        response.functionCalls = jsonResponse.functionCalls;
      }

      // Extract code execution results
      if (jsonResponse.codeExecutionResult) {
        response.codeExecution = {
          output: jsonResponse.codeExecutionResult.output,
          exitCode: jsonResponse.codeExecutionResult.exitCode
        };
      }

      // Extract grounding metadata
      if (jsonResponse.groundingMetadata) {
        response.grounding = {
          sources: jsonResponse.groundingMetadata.webSearchQueries,
          confidence: jsonResponse.groundingMetadata.groundingSupport
        };
      }

      // Extract code blocks
      if (response.response.includes('```')) {
        response.code = this.extractCodeBlocks(response.response);
      }

      // Safety ratings
      if (jsonResponse.safetyRatings) {
        response.metadata.safetyRatings = jsonResponse.safetyRatings;
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
   * Check if Gemini CLI is available
   */
  async isAvailable() {
    if (!this.apiKey) {
      return false;
    }

    try {
      const result = await this.runCLI('', { args: ['--help'] });
      return result.stdout.includes('gemini') || result.stdout.includes('Google');
    } catch {
      return false;
    }
  }

  /**
   * Get Gemini adapter info
   */
  getInfo() {
    const info = super.getInfo();
    info.model = this.model;
    info.contextWindow = this.capabilities.contextWindow;
    info.features = {
      multimodal: this.capabilities.multimodal,
      codeExecution: this.capabilities.codeExecution,
      grounding: this.capabilities.grounding,
      sandboxMode: this.sandboxMode
    };
    return info;
  }
}

export default GeminiAdapter;