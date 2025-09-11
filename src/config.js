const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Configuration management system
 * Loads configuration from JSON files and environment variables
 */
class ConfigManager {
  constructor() {
    this.config = {};
    this.environment = process.env.NODE_ENV || 'development';
    this.loadConfiguration();
  }

  /**
   * Load configuration from files and environment variables
   */
  loadConfiguration() {
    try {
      // Load default configuration
      const defaultConfigPath = path.join(__dirname, '..', 'config', 'default.json');
      if (fs.existsSync(defaultConfigPath)) {
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
        this.config = { ...defaultConfig };
      } else {
        console.warn('Default configuration file not found');
        this.config = this.getDefaultConfig();
      }

      // Load environment-specific configuration
      const envConfigPath = path.join(__dirname, '..', 'config', `${this.environment}.json`);
      if (fs.existsSync(envConfigPath)) {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf8'));
        this.config = this.deepMerge(this.config, envConfig);
      }

      // Override with environment variables
      this.applyEnvironmentOverrides();
      
      console.log(`Configuration loaded for environment: ${this.environment}`);
    } catch (error) {
      console.error('Error loading configuration:', error.message);
      throw error;
    }
  }

  /**
   * Apply environment variable overrides
   */
  applyEnvironmentOverrides() {
    // API Keys
    if (process.env.OPENROUTER_API_KEY) {
      this.config.apiKeys = this.config.apiKeys || {};
      this.config.apiKeys.openrouter = process.env.OPENROUTER_API_KEY;
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      this.config.apiKeys = this.config.apiKeys || {};
      this.config.apiKeys.anthropic = process.env.ANTHROPIC_API_KEY;
    }

    // Server configuration
    if (process.env.PORT) {
      this.config.server.port = parseInt(process.env.PORT, 10);
    }

    // Logging configuration
    if (process.env.LOG_LEVEL) {
      this.config.logging.level = process.env.LOG_LEVEL;
    }

    // API configuration overrides
    if (process.env.MAX_RETRIES) {
      this.config.api.openrouter.maxRetries = parseInt(process.env.MAX_RETRIES, 10);
      this.config.api.anthropic.maxRetries = parseInt(process.env.MAX_RETRIES, 10);
    }
    
    if (process.env.RETRY_DELAY) {
      this.config.api.openrouter.retryDelay = parseInt(process.env.RETRY_DELAY, 10);
      this.config.api.anthropic.retryDelay = parseInt(process.env.RETRY_DELAY, 10);
    }
    
    if (process.env.DEFAULT_TEMPERATURE) {
      const temp = parseFloat(process.env.DEFAULT_TEMPERATURE);
      this.config.api.openrouter.defaultTemperature = temp;
      this.config.api.anthropic.defaultTemperature = temp;
    }
    
    if (process.env.DEFAULT_MAX_TOKENS) {
      const tokens = parseInt(process.env.DEFAULT_MAX_TOKENS, 10);
      this.config.api.openrouter.defaultMaxTokens = tokens;
      this.config.api.anthropic.defaultMaxTokens = tokens;
    }

    // Model overrides
    if (process.env.KIMI_MODEL) {
      this.config.models.kimi.id = process.env.KIMI_MODEL;
    }
    
    if (process.env.QWEN_MODEL) {
      this.config.models.qwen.id = process.env.QWEN_MODEL;
    }
    
    if (process.env.GEMINI_MODEL) {
      this.config.models.gemini.id = process.env.GEMINI_MODEL;
    }

    // Feature flags
    if (process.env.ENABLE_HISTORY !== undefined) {
      this.config.features.history = process.env.ENABLE_HISTORY === 'true';
    }
    
    if (process.env.ENABLE_LOGGING !== undefined) {
      this.config.features.logging = process.env.ENABLE_LOGGING === 'true';
    }
    
    if (process.env.ENABLE_VALIDATION !== undefined) {
      this.config.features.validation = process.env.ENABLE_VALIDATION === 'true';
    }
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Get default configuration if files are not available
   */
  getDefaultConfig() {
    return {
      server: {
        name: 'debate-consensus-mcp',
        version: '1.0.0',
        port: 3000,
        host: 'localhost'
      },
      api: {
        openrouter: {
          baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
          maxRetries: 3,
          retryDelay: 1000,
          defaultTemperature: 0.7,
          defaultMaxTokens: 4096,
          timeout: 30000
        }
      },
      models: {
        kimi: { id: 'moonshot/kimi-k2-latest', provider: 'openrouter' },
        qwen: { id: 'qwen/qwen-2.5-coder-32b-instruct', provider: 'openrouter' },
        gemini: { id: 'google/gemini-2.0-flash-thinking-exp-1219:free', provider: 'openrouter' }
      },
      logging: { level: 'info' },
      features: { history: true, logging: true, validation: true }
    };
  }

  /**
   * Get a configuration value by key path (dot notation)
   */
  get(keyPath) {
    const keys = keyPath.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set a configuration value by key path (dot notation)
   */
  set(keyPath, value) {
    const keys = keyPath.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];

    // Check required API keys
    if (!this.get('apiKeys.openrouter') && !process.env.OPENROUTER_API_KEY) {
      errors.push('OPENROUTER_API_KEY is required but not configured');
    }

    // Check server configuration
    const port = this.get('server.port');
    if (!port || port < 1 || port > 65535) {
      errors.push('Invalid server port configuration');
    }

    // Check models configuration
    const models = this.get('models');
    if (!models || Object.keys(models).length === 0) {
      errors.push('No models configured');
    }

    // Check API configuration
    const apiConfig = this.get('api.openrouter');
    if (!apiConfig || !apiConfig.baseUrl) {
      errors.push('OpenRouter API configuration is incomplete');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    console.log('Configuration validation passed');
    return true;
  }

  /**
   * Reload configuration from files
   */
  reload() {
    console.log('Reloading configuration...');
    this.loadConfiguration();
  }
}

// Create singleton instance
const configManager = new ConfigManager();

module.exports = {
  ConfigManager,
  config: configManager
};