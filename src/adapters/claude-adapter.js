/**
 * Claude CLI Adapter
 * Integrates with Claude CLI for Anthropic models
 */

import BaseAdapter from './base-adapter.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

class ClaudeAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      name: 'ClaudeAdapter',
      cliPath: config.cliPath || 'claude',
      ...config
    });

    this.configPath = config.configPath || path.join(os.homedir(), '.claude.json');
    this.mcpServers = config.mcpServers || [];
    this.model = config.model || 'claude-opus-4-1-20250805';

    this.capabilities = {
      streaming: true,
      mcp: true,
      fileAccess: true,
      toolUse: true,
      contextWindow: 200000
    };
  }

  /**
   * Detect Claude CLI capabilities
   */
  async detectCapabilities() {
    try {
      // Guard against missing process in test environment
      if (typeof process === 'undefined') {
        return this.capabilities;
      }

      const result = await this.runCLI('', { args: ['--version'] });

      // Check for MCP support
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        this.capabilities.mcp = !!config.mcpServers;
        this.mcpServers = config.mcpServers || {};
      }

      return this.capabilities;
    } catch (error) {
      console.warn(`Failed to detect Claude capabilities: ${error.message}`);
      return this.capabilities;
    }
  }

  /**
   * Build CLI arguments for Claude
   */
  buildArgs(options = {}) {
    const args = [];

    // Model selection
    if (options.model || this.model) {
      args.push('--model', options.model || this.model);
    }

    // Temperature
    if (options.temperature !== undefined) {
      args.push('--temperature', String(options.temperature));
    }

    // Max tokens
    if (options.maxTokens) {
      args.push('--max-tokens', String(options.maxTokens));
    }

    // System prompt
    if (options.systemPrompt) {
      args.push('--system', options.systemPrompt);
    }

    // File access
    if (options.files && this.capabilities.fileAccess) {
      options.files.forEach(file => {
        args.push('--file', file);
      });
    }

    // MCP servers
    if (options.mcpServers && this.capabilities.mcp) {
      args.push('--mcp-servers', JSON.stringify(options.mcpServers));
    }

    // Project directory
    if (options.projectDir) {
      args.push('--project-dir', options.projectDir);
    }

    // Non-interactive mode
    args.push('--non-interactive');

    return args;
  }

  /**
   * Build environment variables for Claude
   */
  buildEnv(options = {}) {
    const env = {};

    // Anthropic API key
    const anthropicKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined);
    if (anthropicKey) {
      env.ANTHROPIC_API_KEY = anthropicKey;
    }

    // MCP configuration
    if (this.configPath) {
      env.CLAUDE_CONFIG_PATH = this.configPath;
    }

    // Debug mode
    if (options.debug) {
      env.CLAUDE_DEBUG = '1';
    }

    return env;
  }

  /**
   * Execute Claude-specific prompt
   */
  async execute(prompt, options = {}) {
    // Add project context if available
    if (options.projectContext) {
      const context = await this.loadProjectContext(options.projectContext);
      options.files = [...(options.files || []), ...context.files];
    }

    // Enable MCP for complex tasks
    if (options.enableMCP && this.capabilities.mcp) {
      options.mcpServers = this.mcpServers;
    }

    return super.execute(prompt, options);
  }

  /**
   * Load project context for Claude
   */
  async loadProjectContext(projectPath) {
    const context = {
      files: [],
      config: {}
    };

    // Look for CLAUDE.md
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      context.files.push(claudeMdPath);
    }

    // Look for .claude directory
    const claudeDir = path.join(projectPath, '.claude');
    if (fs.existsSync(claudeDir)) {
      const files = fs.readdirSync(claudeDir);
      files.forEach(file => {
        if (file.endsWith('.md')) {
          context.files.push(path.join(claudeDir, file));
        }
      });
    }

    return context;
  }

  /**
   * Format Claude response
   */
  formatResponse(result) {
    const response = super.formatResponse(result);

    // Parse Claude-specific output
    if (result.stdout.includes('```')) {
      response.code = this.extractCodeBlocks(result.stdout);
    }

    if (result.stdout.includes('MCP:')) {
      response.mcpTools = this.extractMCPUsage(result.stdout);
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
   * Extract MCP tool usage from response
   */
  extractMCPUsage(text) {
    const tools = [];
    const regex = /MCP:\s*(\w+)\s*->\s*(.*)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      tools.push({
        tool: match[1],
        result: match[2]
      });
    }

    return tools;
  }

  /**
   * Check if Claude CLI is available
   */
  async isAvailable() {
    try {
      const result = await this.runCLI('', { args: ['--help'] });
      return result.stdout.includes('Claude');
    } catch {
      return false;
    }
  }

  /**
   * Get Claude adapter info
   */
  getInfo() {
    const info = super.getInfo();
    info.model = this.model;
    info.mcpEnabled = this.capabilities.mcp && Object.keys(this.mcpServers).length > 0;
    info.contextWindow = this.capabilities.contextWindow;
    return info;
  }
}

export default ClaudeAdapter;