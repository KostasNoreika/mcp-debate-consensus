/**
 * Ollama Adapter for Local LLMs
 * Supports Qwen3-235B and other local models
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class OllamaAdapter {
  constructor() {
    this.baseCommand = 'ollama run';
    this.defaultTimeout = 300000; // 5 minutes for large models like Qwen3-235B
  }

  /**
   * Call Ollama model
   * @param {string} model - Model name (e.g., 'qwen3:235b')
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - Model response
   */
  async callModel(model, prompt, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    
    try {
      console.log(`Calling Ollama model: ${model}`);
      
      // Escape prompt for shell
      const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n');
      
      // Build command - ollama run doesn't support temperature flag
      const command = `echo "${escapedPrompt}" | ${this.baseCommand} ${model}`;
      
      // Execute with timeout
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large responses
      });
      
      if (stderr && !stderr.includes('Loading model')) {
        console.warn(`Ollama warning: ${stderr}`);
      }
      
      // Clean up Qwen3-235B thinking output
      let cleanOutput = stdout;
      
      // Remove "Thinking..." prefix and suffix
      cleanOutput = cleanOutput.replace(/^Thinking\.\.\.[\s\S]*?\.\.\.done thinking\.\s*/i, '');
      
      // Remove ANSI escape codes and control characters
      cleanOutput = cleanOutput.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      cleanOutput = cleanOutput.replace(/\[[\?0-9]*[hlGK]/g, '');
      
      return cleanOutput.trim();
      
    } catch (error) {
      if (error.killed) {
        throw new Error(`Ollama timeout after ${timeout}ms for model ${model}`);
      }
      if (error.code === 127) {
        throw new Error('Ollama not found. Please install: https://ollama.ai');
      }
      throw new Error(`Ollama error: ${error.message}`);
    }
  }

  /**
   * Check if a model is available
   * @param {string} model - Model name to check
   * @returns {Promise<boolean>} - True if model is available
   */
  async isModelAvailable(model) {
    try {
      const { stdout } = await execAsync('ollama list');
      return stdout.includes(model);
    } catch {
      return false;
    }
  }

  /**
   * List all available models
   * @returns {Promise<string[]>} - List of model names
   */
  async listModels() {
    try {
      const { stdout } = await execAsync('ollama list');
      const lines = stdout.split('\n').slice(1); // Skip header
      return lines
        .filter(line => line.trim())
        .map(line => line.split(/\s+/)[0]);
    } catch {
      return [];
    }
  }
}

// Singleton instance
const ollamaAdapter = new OllamaAdapter();

/**
 * Main export function for compatibility
 */
async function callOllama(model, prompt, options = {}) {
  return await ollamaAdapter.callModel(model, prompt, options);
}

module.exports = {
  callOllama,
  OllamaAdapter,
  ollamaAdapter
};