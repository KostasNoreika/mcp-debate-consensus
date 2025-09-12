#!/usr/bin/env node

/**
 * Health Check and Diagnostic Tool for MCP Debate Consensus Server
 * Verifies all components are properly configured and working
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
require('dotenv').config();

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

class HealthCheck {
  constructor() {
    this.results = {
      passed: [],
      warnings: [],
      failed: []
    };
  }

  log(message, type = 'info') {
    const prefix = type === 'success' ? `${COLORS.green}✅` :
                   type === 'warning' ? `${COLORS.yellow}⚠️` :
                   type === 'error' ? `${COLORS.red}❌` :
                   `${COLORS.cyan}🔍`;
    console.log(`${prefix} ${message}${COLORS.reset}`);
  }

  header(title) {
    console.log(`\n${COLORS.bright}${COLORS.cyan}${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(60)}${COLORS.reset}\n`);
  }

  async checkNodeVersion() {
    return new Promise((resolve) => {
      exec('node --version', (error, stdout) => {
        if (error) {
          this.results.failed.push('Node.js not found');
          this.log('Node.js not found', 'error');
          resolve(false);
        } else {
          const version = stdout.trim();
          const major = parseInt(version.split('.')[0].substring(1));
          if (major >= 18) {
            this.results.passed.push(`Node.js ${version}`);
            this.log(`Node.js ${version} ✓`, 'success');
            resolve(true);
          } else {
            this.results.warnings.push(`Node.js ${version} (18+ recommended)`);
            this.log(`Node.js ${version} (18+ recommended)`, 'warning');
            resolve(true);
          }
        }
      });
    });
  }

  async checkDependencies() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const dependencies = Object.keys(packageJson.dependencies || {});
      
      // Check if node_modules exists
      try {
        await fs.access('node_modules');
        this.results.passed.push('Dependencies installed');
        this.log('Dependencies installed ✓', 'success');
        
        // Check critical dependencies
        const critical = ['@modelcontextprotocol/sdk', 'dotenv'];
        for (const dep of critical) {
          try {
            await fs.access(path.join('node_modules', dep));
            this.log(`  - ${dep} ✓`, 'success');
          } catch {
            this.results.warnings.push(`Missing dependency: ${dep}`);
            this.log(`  - ${dep} missing`, 'warning');
          }
        }
        return true;
      } catch {
        this.results.failed.push('Dependencies not installed');
        this.log('Dependencies not installed. Run: npm install', 'error');
        return false;
      }
    } catch (error) {
      this.results.failed.push('package.json not found');
      this.log('package.json not found', 'error');
      return false;
    }
  }

  async checkEnvironment() {
    try {
      await fs.access('.env');
      
      // Check API key
      if (!process.env.OPENROUTER_API_KEY) {
        this.results.failed.push('OPENROUTER_API_KEY not set');
        this.log('OPENROUTER_API_KEY not set in .env', 'error');
        return false;
      }
      
      if (process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
        this.results.warnings.push('OPENROUTER_API_KEY not configured');
        this.log('OPENROUTER_API_KEY still has default value', 'warning');
        return false;
      }
      
      // Basic API key validation
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (apiKey.length < 20) {
        this.results.warnings.push('OPENROUTER_API_KEY seems invalid');
        this.log('OPENROUTER_API_KEY appears too short', 'warning');
        return false;
      }
      
      this.results.passed.push('Environment configured');
      this.log('Environment configured ✓', 'success');
      this.log(`  - API key: ${apiKey.substring(0, 10)}...`, 'success');
      return true;
    } catch {
      this.results.failed.push('.env file not found');
      this.log('.env file not found. Run: cp .env.example .env', 'error');
      return false;
    }
  }

  async checkProxyServer() {
    const ports = [3457, 3458, 3459, 3460];
    let anyRunning = false;
    
    for (const port of ports) {
      const isRunning = await this.checkPort(port);
      if (isRunning) {
        anyRunning = true;
        this.log(`  - k${ports.indexOf(port) + 1} proxy on port ${port} ✓`, 'success');
      } else {
        this.log(`  - k${ports.indexOf(port) + 1} proxy on port ${port} ✗`, 'warning');
      }
    }
    
    if (anyRunning) {
      this.results.passed.push('Proxy servers running');
      this.log('At least one proxy server is running ✓', 'success');
      return true;
    } else {
      this.results.warnings.push('No proxy servers running');
      this.log('No proxy servers running. Run: node k-proxy-server.js', 'warning');
      return false;
    }
  }

  async checkPort(port) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
  }

  async checkClaudeCLI() {
    return new Promise((resolve) => {
      exec('which claude 2>/dev/null || where claude 2>nul', async (error, stdout) => {
        if (!error && stdout.trim()) {
          this.results.passed.push('Claude CLI found');
          this.log(`Claude CLI found at: ${stdout.trim()} ✓`, 'success');
          resolve(true);
        } else {
          // Check local installation
          const homeDir = require('os').homedir();
          const localPath = path.join(homeDir, '.claude', 'local', 'claude');
          
          try {
            await fs.access(localPath, fs.constants.X_OK);
            this.results.passed.push('Claude CLI found (local)');
            this.log(`Claude CLI found at: ${localPath} ✓`, 'success');
            resolve(true);
          } catch {
            this.results.warnings.push('Claude CLI not found');
            this.log('Claude CLI not found (optional but recommended)', 'warning');
            this.log('  Install with: npm install -g @anthropic/claude-cli', 'info');
            resolve(false);
          }
        }
      });
    });
  }

  async checkWrapperScripts() {
    const wrappers = ['k1-wrapper.sh', 'k2-wrapper.sh', 'k3-wrapper.sh', 'k4-wrapper.sh'];
    let allFound = true;
    
    for (const wrapper of wrappers) {
      try {
        await fs.access(wrapper, fs.constants.R_OK);
        this.log(`  - ${wrapper} ✓`, 'success');
      } catch {
        allFound = false;
        this.log(`  - ${wrapper} ✗`, 'error');
      }
    }
    
    if (allFound) {
      this.results.passed.push('Wrapper scripts found');
      this.log('All wrapper scripts found ✓', 'success');
      return true;
    } else {
      this.results.failed.push('Missing wrapper scripts');
      this.log('Some wrapper scripts missing', 'error');
      return false;
    }
  }

  async checkConfigDirs() {
    const homeDir = require('os').homedir();
    const configs = ['.claude-k1', '.claude-k2', '.claude-k3', '.claude-k4'];
    let allFound = true;
    
    for (const config of configs) {
      const configPath = path.join(homeDir, config);
      try {
        await fs.access(configPath);
        this.log(`  - ${config} ✓`, 'success');
      } catch {
        allFound = false;
        this.log(`  - ${config} ✗`, 'warning');
      }
    }
    
    if (allFound) {
      this.results.passed.push('Config directories found');
      this.log('All config directories found ✓', 'success');
      return true;
    } else {
      this.results.warnings.push('Some config directories missing');
      this.log('Some config directories missing (will be created on first run)', 'warning');
      return true; // Not critical
    }
  }

  async testAPIConnection() {
    if (!process.env.OPENROUTER_API_KEY || 
        process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
      this.log('Skipping API test (no valid key)', 'warning');
      return false;
    }
    
    // Test basic API connection first
    const basicTest = await this.testBasicAPI();
    if (!basicTest) return false;
    
    // Test each model specified in the requirements
    const modelsToTest = [
      { name: 'k1', model: 'anthropic/claude-opus-4.1', description: 'Claude Opus 4.1' },
      { name: 'k2', model: 'openai/gpt-5', description: 'GPT-5' },
      { name: 'k3', model: 'qwen/qwen3-max', description: 'Qwen 3 Max' },
      { name: 'k4', model: 'google/gemini-2.5-pro', description: 'Gemini 2.5 Pro' }
    ];
    
    let allModelsAccessible = true;
    
    for (const modelInfo of modelsToTest) {
      const isAccessible = await this.testModelAccess(modelInfo);
      if (!isAccessible) {
        allModelsAccessible = false;
      }
    }
    
    if (allModelsAccessible) {
      this.results.passed.push('All required models accessible');
      this.log('All required models accessible ✓', 'success');
    } else {
      this.results.warnings.push('Some models not accessible');
      this.log('Some models may not be accessible', 'warning');
    }
    
    return basicTest;
  }
  
  async testBasicAPI() {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      
      const req = require('https').request({
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }, (res) => {
        if (res.statusCode === 200) {
          this.results.passed.push('OpenRouter API connection');
          this.log('OpenRouter API connection successful ✓', 'success');
          resolve(true);
        } else if (res.statusCode === 401) {
          this.results.failed.push('Invalid API key');
          this.log('Invalid OpenRouter API key', 'error');
          resolve(false);
        } else {
          this.results.warnings.push(`API returned ${res.statusCode}`);
          this.log(`OpenRouter API returned ${res.statusCode}`, 'warning');
          resolve(false);
        }
      });
      
      req.on('error', (error) => {
        this.results.failed.push('API connection failed');
        this.log(`API connection failed: ${error.message}`, 'error');
        resolve(false);
      });
      
      req.write(data);
      req.end();
    });
  }
  
  async testModelAccess(modelInfo) {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        model: modelInfo.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      
      const req = require('https').request({
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }, (res) => {
        if (res.statusCode === 200) {
          this.log(`  - ${modelInfo.name} (${modelInfo.description}) ✓`, 'success');
          resolve(true);
        } else if (res.statusCode === 404) {
          this.log(`  - ${modelInfo.name} (${modelInfo.description}) - Model not found`, 'warning');
          resolve(false);
        } else if (res.statusCode === 403) {
          this.log(`  - ${modelInfo.name} (${modelInfo.description}) - Access denied`, 'warning');
          resolve(false);
        } else {
          this.log(`  - ${modelInfo.name} (${modelInfo.description}) - HTTP ${res.statusCode}`, 'warning');
          resolve(false);
        }
      });
      
      req.on('error', (error) => {
        this.log(`  - ${modelInfo.name} (${modelInfo.description}) - Connection error`, 'warning');
        resolve(false);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        this.log(`  - ${modelInfo.name} (${modelInfo.description}) - Timeout`, 'warning');
        resolve(false);
      });
      
      req.write(data);
      req.end();
    });
  }

  generateReport() {
    this.header('Health Check Summary');
    
    const total = this.results.passed.length + 
                  this.results.warnings.length + 
                  this.results.failed.length;
    
    console.log(`${COLORS.green}✅ Passed: ${this.results.passed.length}/${total}${COLORS.reset}`);
    console.log(`${COLORS.yellow}⚠️  Warnings: ${this.results.warnings.length}/${total}${COLORS.reset}`);
    console.log(`${COLORS.red}❌ Failed: ${this.results.failed.length}/${total}${COLORS.reset}`);
    
    if (this.results.failed.length > 0) {
      console.log(`\n${COLORS.red}Critical Issues:${COLORS.reset}`);
      this.results.failed.forEach(item => console.log(`  - ${item}`));
    }
    
    if (this.results.warnings.length > 0) {
      console.log(`\n${COLORS.yellow}Warnings:${COLORS.reset}`);
      this.results.warnings.forEach(item => console.log(`  - ${item}`));
    }
    
    // Overall status
    console.log('\n' + '='.repeat(60));
    if (this.results.failed.length === 0) {
      console.log(`${COLORS.green}${COLORS.bright}✅ System is ready to use!${COLORS.reset}`);
      return 0;
    } else {
      console.log(`${COLORS.red}${COLORS.bright}❌ Please fix the issues above before proceeding${COLORS.reset}`);
      return 1;
    }
  }

  async run() {
    console.clear();
    this.header('MCP Debate Consensus - Health Check');
    
    const checks = [
      { name: 'Node.js Version', fn: () => this.checkNodeVersion() },
      { name: 'Dependencies', fn: () => this.checkDependencies() },
      { name: 'Environment', fn: () => this.checkEnvironment() },
      { name: 'Proxy Servers', fn: () => this.checkProxyServer() },
      { name: 'Claude CLI', fn: () => this.checkClaudeCLI() },
      { name: 'Wrapper Scripts', fn: () => this.checkWrapperScripts() },
      { name: 'Config Directories', fn: () => this.checkConfigDirs() },
      { name: 'API Connection', fn: () => this.testAPIConnection() }
    ];
    
    for (const check of checks) {
      this.header(check.name);
      await check.fn();
    }
    
    return this.generateReport();
  }
}

// Run health check
if (require.main === module) {
  const healthCheck = new HealthCheck();
  healthCheck.run().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error(`${COLORS.red}Health check failed: ${error.message}${COLORS.reset}`);
    process.exit(1);
  });
}

module.exports = { HealthCheck };