/**
 * Base Adapter for CLI Integration
 * Provides abstract interface for all model CLI adapters
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class BaseAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.name = config.name || 'BaseAdapter';
    this.modelId = config.modelId;
    this.cliPath = config.cliPath;
    this.capabilities = {
      streaming: false,
      mcp: false,
      fileAccess: false,
      toolUse: false,
      contextWindow: 8192
    };
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 120000; // 2 minutes default
    this.resourceMonitor = null;
  }

  /**
   * Initialize the adapter
   */
  async initialize() {
    await this.detectCapabilities();
    await this.validateConfiguration();
    this.startResourceMonitoring();
    return this;
  }

  /**
   * Detect CLI capabilities
   */
  async detectCapabilities() {
    // Override in subclasses
    throw new Error('detectCapabilities() must be implemented by subclass');
  }

  /**
   * Validate configuration
   */
  async validateConfiguration() {
    if (!this.cliPath) {
      throw new Error(`CLI path not configured for ${this.name}`);
    }

    if (!fs.existsSync(this.cliPath)) {
      throw new Error(`CLI not found at ${this.cliPath}`);
    }

    return true;
  }

  /**
   * Execute a prompt and get response
   */
  async execute(prompt, options = {}) {
    const startTime = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      attempt++;

      try {
        const result = await this.runCLI(prompt, options);

        // Emit metrics
        this.emit('execution:complete', {
          adapter: this.name,
          duration: Date.now() - startTime,
          attempt,
          success: true
        });

        return this.formatResponse(result);
      } catch (error) {
        lastError = error;

        this.emit('execution:error', {
          adapter: this.name,
          error: error.message,
          attempt
        });

        // Retry with exponential backoff
        if (attempt < this.maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Run the CLI command
   */
  async runCLI(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const args = this.buildArgs(options);
      const env = this.buildEnv(options);

      const childProcess = spawn(this.cliPath, args, {
        env: { ...(typeof process !== 'undefined' ? process.env : {}), ...env },
        timeout: this.timeout
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        if (this.capabilities.streaming) {
          this.emit('stream:data', data.toString());
        }
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });

      // Send prompt to stdin
      if (prompt) {
        childProcess.stdin.write(prompt);
        childProcess.stdin.end();
      }
    });
  }

  /**
   * Build CLI arguments
   */
  buildArgs(options = {}) {
    // Override in subclasses
    return [];
  }

  /**
   * Build environment variables
   */
  buildEnv(options = {}) {
    // Override in subclasses
    return {};
  }

  /**
   * Format the response
   */
  formatResponse(result) {
    return {
      adapter: this.name,
      model: this.modelId,
      response: result.stdout,
      metadata: {
        stderr: result.stderr,
        exitCode: result.code,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Start resource monitoring
   */
  startResourceMonitoring() {
    this.resourceMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      this.emit('resource:update', {
        adapter: this.name,
        memory: usage,
        timestamp: Date.now()
      });
    }, 5000);
  }

  /**
   * Stop resource monitoring
   */
  stopResourceMonitoring() {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }
  }

  /**
   * Cleanup adapter resources
   */
  async cleanup() {
    this.stopResourceMonitoring();
    this.removeAllListeners();
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if adapter is available
   */
  async isAvailable() {
    try {
      await this.validateConfiguration();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get adapter info
   */
  getInfo() {
    return {
      name: this.name,
      model: this.modelId,
      capabilities: this.capabilities,
      available: this.isAvailable()
    };
  }
}

export default BaseAdapter;