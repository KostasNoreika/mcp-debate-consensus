/**
 * Adapter Factory
 * Creates and manages CLI adapters for different models
 */

import ClaudeAdapter from './claude-adapter.js';
import CodexAdapter from './codex-adapter.js';
import GeminiAdapter from './gemini-adapter.js';
import FallbackAdapter from './fallback-adapter.js';

class AdapterFactory {
  constructor(config = {}) {
    this.config = config;
    this.adapters = new Map();
    this.defaultAdapter = config.defaultAdapter || 'fallback';
  }

  /**
   * Create adapter based on type and configuration
   */
  async createAdapter(type, config = {}) {
    const adapterConfig = { ...this.config, ...config };

    let adapter;

    switch (type.toLowerCase()) {
      case 'claude':
        adapter = new ClaudeAdapter(adapterConfig);
        break;

      case 'codex':
        adapter = new CodexAdapter(adapterConfig);
        break;

      case 'gemini':
        adapter = new GeminiAdapter(adapterConfig);
        break;

      case 'fallback':
      case 'openrouter':
        adapter = new FallbackAdapter(adapterConfig);
        break;

      default:
        // Try to infer from model ID
        adapter = await this.inferAdapter(adapterConfig);
    }

    if (!adapter) {
      throw new Error(`Unknown adapter type: ${type}`);
    }

    await adapter.initialize();
    this.adapters.set(adapter.modelId || type, adapter);

    return adapter;
  }

  /**
   * Infer adapter from model ID
   */
  async inferAdapter(config) {
    const modelId = config.modelId || config.model || '';

    // Claude models
    if (modelId.includes('claude') || modelId.includes('anthropic')) {
      // Check if Claude CLI is available
      const claudeAdapter = new ClaudeAdapter(config);
      if (await claudeAdapter.isAvailable()) {
        return claudeAdapter;
      }
    }

    // OpenAI/GPT models
    if (modelId.includes('gpt') || modelId.includes('openai')) {
      // Check if Codex CLI is available
      const codexAdapter = new CodexAdapter(config);
      if (await codexAdapter.isAvailable()) {
        return codexAdapter;
      }
    }

    // Google/Gemini models
    if (modelId.includes('gemini') || modelId.includes('google')) {
      // Check if Gemini CLI is available
      const geminiAdapter = new GeminiAdapter(config);
      if (await geminiAdapter.isAvailable()) {
        return geminiAdapter;
      }
    }

    // Fall back to OpenRouter
    return new FallbackAdapter(config);
  }

  /**
   * Get or create adapter for model
   */
  async getAdapter(modelId) {
    if (this.adapters.has(modelId)) {
      return this.adapters.get(modelId);
    }

    // Try to create based on model ID
    const config = { modelId };
    const adapter = await this.inferAdapter(config);

    if (adapter) {
      await adapter.initialize();
      this.adapters.set(modelId, adapter);
      return adapter;
    }

    throw new Error(`No adapter available for model: ${modelId}`);
  }

  /**
   * Create adapter team for debate
   */
  async createTeam(teamConfig) {
    const team = [];

    for (const memberConfig of teamConfig) {
      const adapter = await this.createAdapter(
        memberConfig.type || 'auto',
        memberConfig
      );

      team.push({
        adapter,
        role: memberConfig.role,
        model: memberConfig.modelId,
        specialization: memberConfig.specialization
      });
    }

    return team;
  }

  /**
   * List all available adapters
   */
  async listAvailable() {
    const available = [];

    // Check Claude
    const claudeAdapter = new ClaudeAdapter(this.config);
    if (await claudeAdapter.isAvailable()) {
      available.push({
        type: 'claude',
        name: 'Claude CLI',
        models: ['claude-opus-4.1', 'claude-sonnet', 'claude-haiku']
      });
    }

    // Check Codex
    const codexAdapter = new CodexAdapter(this.config);
    if (await codexAdapter.isAvailable()) {
      available.push({
        type: 'codex',
        name: 'Codex CLI',
        models: ['gpt-5', 'gpt-4-turbo', 'gpt-4']
      });
    }

    // Check Gemini
    const geminiAdapter = new GeminiAdapter(this.config);
    if (await geminiAdapter.isAvailable()) {
      available.push({
        type: 'gemini',
        name: 'Gemini CLI',
        models: ['gemini-3-pro-preview', 'gemini-pro', 'gemini-flash']
      });
    }

    // Fallback is always available if API key exists
    const fallbackAdapter = new FallbackAdapter(this.config);
    if (await fallbackAdapter.isAvailable()) {
      available.push({
        type: 'fallback',
        name: 'OpenRouter (Fallback)',
        models: ['any model via OpenRouter']
      });
    }

    return available;
  }

  /**
   * Test adapter configuration
   */
  async testAdapter(type, config = {}) {
    try {
      const adapter = await this.createAdapter(type, config);
      const testPrompt = 'Say "Hello, I am ready!" if you can read this.';

      const result = await adapter.execute(testPrompt, {
        maxTokens: 50,
        temperature: 0
      });

      return {
        success: result.response.toLowerCase().includes('hello') &&
                result.response.toLowerCase().includes('ready'),
        adapter: adapter.getInfo(),
        response: result.response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up all adapters
   */
  async cleanup() {
    for (const adapter of this.adapters.values()) {
      await adapter.cleanup();
    }
    this.adapters.clear();
  }
}

// Export singleton instance
const factory = new AdapterFactory();

export { AdapterFactory, factory as default };