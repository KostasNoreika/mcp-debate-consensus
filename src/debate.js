const { callOpenRouter } = require('./openrouter-adapter');
const { callOllama } = require('./ollama-adapter');
const { FileContextProvider } = require('./file-context-provider');
const { promisify } = require('util');
const childProcess = require('child_process');
const exec = childProcess.exec ? promisify(childProcess.exec) : () => Promise.resolve({ stdout: '', stderr: '' });
const fs = require('fs').promises;
const crypto = require('crypto');

class SynthesisDebate {
  constructor() {
    this.agents = {
      claude: { 
        model: 'claude-opus-4-1-20250805', 
        role: 'architecture',
        command: '/Users/kostasnoreika/.claude/local/claude --headless',
        optional: true // Make Claude optional since CLI may not always be available
      },
      gpt5: { 
        model: 'openai/gpt-5-chat', 
        role: 'testing',
        adapter: 'openrouter'
      },
      qwen: { 
        model: 'qwen/qwen3-max', 
        role: 'algorithms',
        adapter: 'openrouter'
      },
      gemini: { 
        model: 'google/gemini-2.5-pro', 
        role: 'integration',
        adapter: 'openrouter'
      },
      // Optional: Large local model for additional perspective
      qwen235b: {
        model: 'qwen3:235b',
        role: 'deep-analysis',
        adapter: 'ollama',
        optional: true // Won't fail if not available
      }
    };
    
    // Configuration for resilience
    this.config = {
      minAgents: 2,
      timeout: 1800000, // 30 minutes per stage
      maxRetries: 3,
      cacheTimeout: 600000, // 10 minutes
      backoffBase: 1000, // 1 second
      tempFileCleanupDelay: 5000 // 5 seconds
    };
    
    // Response cache
    this.responseCache = new Map();
    
    // Temporary files tracking
    this.tempFiles = new Set();
    
    // File context provider for models without file access
    this.contextProvider = new FileContextProvider();
    
    // Setup cleanup handlers
    this.setupCleanupHandlers();
  }
  
  async runDebate(question, projectPath) {
    try {
      // Input validation
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        throw new Error('Invalid question: must be a non-empty string');
      }
      
      if (!projectPath || typeof projectPath !== 'string') {
        throw new Error('Invalid project path: must be a valid string');
      }
      
      // Sanitize input
      question = this.sanitizeInput(question);
      projectPath = this.sanitizeInput(projectPath);
      
      // Wrap the entire debate process with timeout
      return await this.withTimeout(this._runDebateInternal(question, projectPath), this.config.timeout * 3);
      
    } catch (error) {
      console.error('Debate failed:', error.message);
      return this.getFallbackSolution(error.message);
    }
  }
  
  async _runDebateInternal(question, projectPath) {
    try {
      // Round 1: Get independent proposals
      const proposals = await this.getInitialProposals(question, projectPath);
      
      // Check if we have enough working agents
      const workingAgents = Object.keys(proposals).filter(key => proposals[key]);
      if (workingAgents.length < this.config.minAgents) {
        throw new Error(`Insufficient agents available: got ${workingAgents.length}, need ${this.config.minAgents}`);
      }
      
      // Convert proposals to format expected by selectBest
      const proposalsWithMeta = {};
      for (const [agent, code] of Object.entries(proposals)) {
        if (code) { // Only include successful proposals
          proposalsWithMeta[agent] = { code, agent };
        }
      }
      
      // Test and select best
      const bestProposal = await this.selectBest(proposalsWithMeta);
      
      // Round 2: Everyone improves the best solution
      const improvements = await this.getImprovements(bestProposal, question);
      
      // Synthesize final solution
      const finalSolution = this.synthesize(bestProposal, improvements);
      
      // Test final solution
      const finalScore = await this.testSolution(finalSolution);
      
      return {
        solution: finalSolution,
        score: finalScore,
        initialWinner: bestProposal.agent,
        contributors: Object.keys(improvements).filter(key => improvements[key])
      };
    } catch (error) {
      throw error;
    }
  }
  
  async getInitialProposals(question, projectPath) {
    // Get project context for models without file access
    const context = await this.contextProvider.gatherProjectContext(projectPath);
    
    const prompt = `Working in project: ${projectPath}

Task: ${question}

PROJECT CONTEXT:
${context.summary}

Please:
1. Analyze the provided context
2. Consider the current project state
3. Propose your complete solution
4. Be specific and practical

Work independently - focus on your best approach.`;
    
    const proposals = {};
    
    // Parallel execution for all agents with individual error handling
    const agentPromises = Object.entries(this.agents).map(async ([name, agent]) => {
      try {
        const agentPrompt = prompt + `\n\nYou are ${name}, focus on ${agent.role}.`;
        const response = await this.callAgent(name, agent, agentPrompt);
        proposals[name] = response;
      } catch (error) {
        console.warn(`Agent ${name} failed:`, error.message);
        proposals[name] = null; // Mark as failed but continue
      }
    });
    
    await Promise.all(agentPromises);
    
    // Check if we have minimum required agents
    const workingAgents = Object.keys(proposals).filter(key => proposals[key]);
    if (workingAgents.length < this.config.minAgents) {
      throw new Error(`Insufficient agents available: got ${workingAgents.length}, need ${this.config.minAgents}`);
    }
    
    return proposals;
  }
  
  async selectBest(proposals) {
    let bestScore = -1;
    let bestProposal = null;
    
    for (const [agent, proposal] of Object.entries(proposals)) {
      const testResult = await this.testSolution(proposal);
      if (testResult.score > bestScore) {
        bestScore = testResult.score;
        bestProposal = { ...proposal, score: bestScore };
      }
    }
    
    return bestProposal;
  }
  
  
  async callAgent(name, agent, prompt) {
    // Create cache key
    const cacheKey = this.generateCacheKey(name, agent.model, prompt);
    
    // Check cache first
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Retry with exponential backoff
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.withTimeout(
          this._callAgentInternal(name, agent, prompt),
          this.config.timeout
        );
        
        // Cache successful response
        this.setCachedResponse(cacheKey, response);
        return response;
        
      } catch (error) {
        // Don't retry permanent errors (4xx HTTP codes)
        if (error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        // Last attempt - throw the error
        if (attempt === this.config.maxRetries) {
          throw error;
        }
        
        // Wait with exponential backoff
        const delay = this.config.backoffBase * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        console.warn(`Agent ${name} attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
      }
    }
  }
  
  async _callAgentInternal(name, agent, prompt) {
    if (agent.adapter === 'openrouter') {
      return await callOpenRouter(agent.model, prompt);
    } else if (agent.adapter === 'ollama') {
      // Check if Ollama model is available
      if (agent.optional) {
        try {
          return await callOllama(agent.model, prompt);
        } catch (error) {
          console.warn(`Optional Ollama model ${agent.model} not available: ${error.message}`);
          return null;
        }
      }
      return await callOllama(agent.model, prompt);
    } else {
      // Claude uses native CLI - sanitize the prompt for shell execution
      const sanitizedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      const result = await exec(`echo "${sanitizedPrompt}" | ${agent.command}`);
      return result.stdout;
    }
  }
  
  synthesize(bestProposal, improvements) {
    // Start with best solution
    let finalCode = bestProposal.code;
    
    // Apply non-conflicting improvements
    for (const [agent, improvement] of Object.entries(improvements)) {
      if (!improvement) continue; // Skip null improvements
      const additions = this.extractAdditions(improvement);
      if (additions) {
        finalCode += '\n' + additions;
      }
    }
    
    // Return just the code for MCP, but keep metadata for internal use
    return {
      code: finalCode,
      base: bestProposal.agent,
      improvements: Object.keys(improvements).filter(k => improvements[k])
    };
  }
  
  extractAdditions(improvement) {
    // Extract code blocks or additions from improvement text
    // This is a simplified version - in production, use proper parsing
    const codeBlockMatch = improvement.match(/```[\s\S]*?```/g);
    if (codeBlockMatch) {
      return codeBlockMatch
        .map(block => block.replace(/```\w*\n?/g, ''))
        .join('\n');
    }
    
    // If no code blocks, look for lines that look like code
    const lines = improvement.split('\n');
    const codeLines = lines.filter(line => 
      line.includes('function') || 
      line.includes('const') || 
      line.includes('let') ||
      line.includes('test(') ||
      line.includes('expect(')
    );
    
    return codeLines.length > 0 ? codeLines.join('\n') : null;
  }
  
  summarizeChanges(improvement) {
    // Extract first meaningful line as summary
    const lines = improvement.split('\n').filter(l => l.trim());
    return lines[0] || 'Added improvements';
  }
  
  async testSolution(solution) {
    let tempFile = null;
    try {
      // Write solution to temp file
      tempFile = `/tmp/solution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.js`;
      this.tempFiles.add(tempFile);
      
      // Handle different solution formats
      const code = typeof solution === 'string' ? solution : solution.code;
      if (!code) {
        return { score: 0, error: 'No code provided' };
      }
      
      await fs.writeFile(tempFile, code);
      
      // Run tests with timeout
      const { stdout } = await this.withTimeout(
        exec(`npm test ${tempFile}`),
        this.config.timeout
      );
      
      // Parse results
      return this.parseTestResults(stdout);
      
    } catch (error) {
      // Handle specific filesystem errors
      if (error.message.includes('ENOSPC')) {
        return { score: 0, error: 'Insufficient disk space available' };
      }
      if (error.message.includes('EACCES')) {
        return { score: 0, error: 'Permission denied writing test file' };
      }
      return { score: 0, error: error.message };
    } finally {
      // Schedule cleanup of temp file
      if (tempFile) {
        setTimeout(() => this.cleanupTempFile(tempFile), this.config.tempFileCleanupDelay);
      }
    }
  }
  
  parseTestResults(output) {
    // Parse test output to extract score
    // This is a simplified parser - adjust based on your test framework
    const passMatch = output.match(/(\d+) passed/);
    const totalMatch = output.match(/(\d+) total/);
    
    if (passMatch && totalMatch) {
      const passed = parseInt(passMatch[1]);
      const total = parseInt(totalMatch[1]);
      const score = Math.round((passed / total) * 100);
      
      return {
        score,
        passed,
        total
      };
    }
    
    // Default parsing for other formats
    if (output.includes('✓') || output.includes('PASS')) {
      return { score: 100 };
    }
    
    return { score: 50 }; // Partial success
  }
  
  // ===== RESILIENCE UTILITY METHODS =====
  
  setupCleanupHandlers() {
    // Avoid adding duplicate listeners
    if (this._handlersSetup) {
      return;
    }
    
    this._handlersSetup = true;
    
    // Setup process exit handlers
    const cleanup = () => {
      this.cleanup();
    };
    
    // Only setup handlers in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('SIGHUP', cleanup);
      process.on('exit', cleanup);
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        console.error('Uncaught exception:', error);
        cleanup();
        process.exit(1);
      });
      
      process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled rejection at:', promise, 'reason:', reason);
        cleanup();
      });
    }
  }
  
  cleanup() {
    try {
      // Clear cache
      this.responseCache.clear();
      
      // Clean up temporary files
      for (const tempFile of this.tempFiles) {
        this.cleanupTempFile(tempFile);
      }
      this.tempFiles.clear();
      
    } catch (error) {
      // Cleanup failures should not throw
      console.warn('Cleanup failed:', error.message);
    }
  }
  
  async cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
      this.tempFiles.delete(filePath);
    } catch (error) {
      // File might already be deleted or not exist
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
      }
    }
  }
  
  withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  generateCacheKey(name, model, prompt) {
    const hash = crypto.createHash('md5')
      .update(`${name}:${model}:${prompt}`)
      .digest('hex');
    return hash;
  }
  
  getCachedResponse(cacheKey) {
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.response;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.responseCache.delete(cacheKey);
    }
    
    return null;
  }
  
  setCachedResponse(cacheKey, response) {
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
    
    // Prevent cache from growing too large
    if (this.responseCache.size > 1000) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
  }
  
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    // Remove potentially dangerous shell metacharacters
    return input
      .replace(/[;&|`$(){}[\]<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000); // Limit length
  }
  
  getFallbackSolution(errorMessage) {
    return {
      solution: {
        code: `// Fallback solution due to system error: ${errorMessage}\n// This is a minimal placeholder response\nfunction fallbackSolution() {\n  console.log("System is currently unavailable. Please try again later.");\n  return null;\n}`,
        base: 'fallback',
        improvements: ['System fallback due to agent failures']
      },
      score: 0,
      initialWinner: 'fallback',
      contributors: [],
      error: errorMessage,
      fallback: true
    };
  }
  
  // Update getImprovements to handle partial failures
  async getImprovements(bestProposal, question) {
    const improvements = {};
    
    const rolePrompts = {
      architecture: "Review for clean code, suggest architectural improvements",
      testing: "Add comprehensive tests, identify edge cases",
      algorithms: "Optimize performance, improve complexity",
      integration: "Check completeness, identify missing features"
    };
    
    // Parallel execution with individual error handling
    const improvementPromises = Object.entries(this.agents).map(async ([name, agent]) => {
      try {
        const prompt = `Original task: ${question}

Current best solution (from ${bestProposal.agent}):
${bestProposal.code}

Your role: ${agent.role}
Task: ${rolePrompts[agent.role]}

Provide specific improvements only - don't rewrite the entire solution.
Focus on your area of expertise.`;
        
        const improvement = await this.callAgent(name, agent, prompt);
        improvements[name] = improvement;
      } catch (error) {
        console.warn(`Agent ${name} failed during improvements:`, error.message);
        improvements[name] = null; // Mark as failed but continue
      }
    });
    
    await Promise.all(improvementPromises);
    
    // Filter out failed improvements
    return Object.fromEntries(
      Object.entries(improvements).filter(([_, improvement]) => improvement !== null)
    );
  }
}

module.exports = { SynthesisDebate };