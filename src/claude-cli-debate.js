/**
 * Claude CLI Multi-Model Debate using actual Claude CLI instances with full MCP tool access
 * 
 * This replaces the HTTP-based debate system with actual Claude CLI spawning,
 * giving each model full access to tools like reading files, running bash commands, etc.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Import the improved semantic scoring
const { ImprovedSemanticScoring } = require('./improved-semantic-scoring');

class ClaudeCliDebate {
  constructor() {
    // Define models with k1-k4 wrapper scripts
    this.models = [
      { 
        alias: 'k1', 
        name: 'Claude Opus 4.1', 
        role: 'Architecture', 
        expertise: 'System architecture and design patterns',
        wrapper: path.join(__dirname, '..', 'k1-wrapper.sh')
      },
      { 
        alias: 'k2', 
        name: 'GPT-5', 
        role: 'Testing', 
        expertise: 'Testing strategies, debugging, and quality assurance',
        wrapper: path.join(__dirname, '..', 'k2-wrapper.sh')
      },
      { 
        alias: 'k3', 
        name: 'Qwen 3 Max', 
        role: 'Algorithms', 
        expertise: 'Algorithm optimization and data structures',
        wrapper: path.join(__dirname, '..', 'k3-wrapper.sh')
      },
      { 
        alias: 'k4', 
        name: 'Gemini 2.5 Pro', 
        role: 'Integration', 
        expertise: 'System integration and completeness verification',
        wrapper: path.join(__dirname, '..', 'k4-wrapper.sh')
      }
    ];
    
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.semanticScorer = new ImprovedSemanticScoring();
    
    // Configurable timeout (default: 60 minutes)
    const DEBATE_TIMEOUT_MINUTES = parseInt(process.env.DEBATE_TIMEOUT_MINUTES) || 60;
    this.timeout = DEBATE_TIMEOUT_MINUTES * 60 * 1000; // Convert to milliseconds
    
    console.log(`⏱️  Claude CLI timeout: ${DEBATE_TIMEOUT_MINUTES} minutes (${this.timeout}ms)`);
  }

  async initialize() {
    await fs.mkdir(this.logsDir, { recursive: true });
    
    // Verify all wrapper scripts exist
    for (const model of this.models) {
      try {
        await fs.access(model.wrapper, fs.constants.X_OK);
      } catch (error) {
        throw new Error(`Wrapper script not found or not executable: ${model.wrapper}`);
      }
    }
  }

  /**
   * Run multi-model debate using Claude CLI spawning
   */
  async runDebate(question, projectPath = process.cwd()) {
    await this.initialize();
    
    console.log('🎯 Multi-Model Debate Consensus (Claude CLI Edition)\n');
    console.log('📍 Project:', projectPath);
    console.log('❓ Question:', question);
    console.log('🤖 Models:', this.models.map(m => `${m.alias}=${m.name}`).join(', '));
    console.log('🔧 Tool Access: Full MCP integration enabled');
    console.log('\n' + '='.repeat(70) + '\n');
    
    // Round 1: Get proposals
    console.log('🔄 ROUND 1: Independent Analysis with Tool Access\n');
    const proposals = await this.getProposals(question, projectPath);
    
    if (Object.keys(proposals).length < 2) {
      const failedModels = this.models.filter(m => !proposals[m.name]).map(m => m.name);
      throw new Error(`Not enough models responded. Got ${Object.keys(proposals).length}, need at least 2.\nFailed models: ${failedModels.join(', ')}\n\nCheck that:\n1. k-proxy-server.js is running\n2. Claude CLI is installed\n3. All wrapper scripts are executable`);
    }
    
    // Select best using semantic scoring
    const best = await this.selectBestSemantic(proposals, question);
    console.log(`\n🏆 Best proposal: ${best.model}`);
    console.log(`   Score: ${best.score.total.toFixed(2)} (R:${(best.score.components.relevance*100).toFixed(0)}% Q:${(best.score.components.quality*100).toFixed(0)}%)`);
    
    // Round 2: Improvements
    console.log('\n🔄 ROUND 2: Collaborative Improvements with Tools\n');
    const improvements = await this.getImprovements(best, question, projectPath);
    
    // Round 3: Final synthesis
    console.log('\n🔧 ROUND 3: Final Synthesis\n');
    const final = await this.synthesize(best, improvements, question);
    
    // Save log
    await this.saveLog(question, projectPath, proposals, best, improvements, final);
    
    return {
      solution: final,
      winner: best.model,
      score: best.score.total,
      contributors: Object.keys(improvements),
      toolsUsed: true
    };
  }

  /**
   * Call model using Claude CLI with full tool access
   */
  async callModel(model, prompt, projectPath = process.cwd()) {
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.error(`  🔄 ${model.name} (attempt ${attempt}/${maxRetries}) - Starting Claude CLI...`);
        
        const startTime = Date.now();
        
        // Create a comprehensive prompt that includes project context
        const fullPrompt = `You are ${model.name}, an expert in ${model.expertise}.

TASK: ${prompt}

PROJECT CONTEXT:
- Working Directory: ${projectPath}
- You have full access to MCP tools including:
  * Read/Write files
  * Run bash commands  
  * Search code with grep/glob
  * Git operations
  * Docker management
  * Web search
  * GitHub integration
  * And more...

INSTRUCTIONS:
1. Use your tools extensively to understand the project structure
2. Read relevant files to understand the codebase
3. Run commands to gather information as needed
4. Provide a comprehensive solution with code examples
5. Focus on your area of expertise: ${model.expertise}

Please provide a detailed analysis and solution.`;

        const result = await this.spawnClaude(model, fullPrompt, projectPath);
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        if (!result) {
          throw new Error('Empty response from Claude CLI');
        }
        
        console.error(`  ✅ ${model.name} completed (${duration}s, ${result.length} chars)`);
        return result;
        
      } catch (error) {
        console.error(`  ❌ ${model.name} attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          console.error(`  🚫 ${model.name} failed after ${maxRetries} attempts`);
          return null;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
    
    return null;
  }

  /**
   * Spawn Claude CLI process and capture output
   */
  async spawnClaude(model, prompt, projectPath) {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      
      // Spawn Claude CLI using the wrapper script
      const child = spawn(model.wrapper, ['--print'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout
      });
      
      // Send prompt to stdin
      child.stdin.write(prompt);
      child.stdin.end();
      
      // Capture stdout
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // Capture stderr  
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // Handle process completion
      child.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${errorOutput}`));
        }
      });
      
      // Handle process errors
      child.on('error', (error) => {
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
      });
      
      // Handle timeout
      child.on('timeout', () => {
        child.kill();
        const timeoutMinutes = Math.round(this.timeout / 60000);
        reject(new Error(`Claude CLI timed out after ${timeoutMinutes} minutes`));
      });
    });
  }

  /**
   * Get proposals from each model
   */
  async getProposals(question, projectPath) {
    const proposals = {};
    const startTime = Date.now();
    
    console.log(`Requesting proposals from ${this.models.length} models with tool access...`);
    
    // Run models in parallel for better performance
    const modelPromises = this.models.map(async (model) => {
      const modelStart = Date.now();
      
      const prompt = `${question}

Focus on your area of expertise: ${model.expertise}

Use all available tools to:
1. Understand the project structure
2. Read relevant files 
3. Analyze the codebase
4. Provide a complete solution with examples

Your role: ${model.role}
Your expertise: ${model.expertise}`;
      
      const result = await this.callModel(model, prompt, projectPath);
      const modelTime = Math.round((Date.now() - modelStart) / 1000);
      
      return { model, result, modelTime };
    });
    
    const results = await Promise.allSettled(modelPromises);
    
    // Process results
    results.forEach((result, index) => {
      const model = this.models[index];
      if (result.status === 'fulfilled' && result.value.result) {
        proposals[model.name] = result.value.result;
        console.log(`  ✅ ${model.name} completed (${result.value.modelTime}s, ${result.value.result.length} chars)`);
      } else {
        console.log(`  ❌ ${model.name} failed: ${result.reason?.message || 'Unknown error'}`);
      }
    });
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n📊 Proposal round completed: ${Object.keys(proposals).length}/${this.models.length} models responded (${totalTime}s total)`);
    
    return proposals;
  }

  /**
   * Select best using semantic scoring
   */
  async selectBestSemantic(proposals, question) {
    let best = null;
    let maxScore = 0;
    
    for (const [model, proposal] of Object.entries(proposals)) {
      const score = this.semanticScorer.calculateScore(proposal, question, []);
      
      if (score.total > maxScore) {
        maxScore = score.total;
        best = { model, proposal, score };
      }
    }
    
    return best;
  }

  /**
   * Get improvements from other models
   */
  async getImprovements(best, question, projectPath) {
    const improvements = {};
    
    const improvementPromises = this.models
      .filter(model => model.name !== best.model)
      .map(async (model) => {
        console.log(`  ${model.name} reviewing with tools...`);
        
        const prompt = `Review and improve this solution using your tools and expertise.

ORIGINAL TASK: ${question}

CURRENT BEST SOLUTION from ${best.model}:
${best.proposal.substring(0, 3000)}...

Your expertise: ${model.expertise}

Instructions:
1. Use your tools to analyze the solution
2. Read relevant files if needed
3. Test approaches where applicable
4. Provide specific improvements based on your expertise
5. Include code examples and implementation details

Provide specific improvements and enhancements.`;
        
        const result = await this.callModel(model, prompt, projectPath);
        return { model: model.name, result };
      });
    
    const results = await Promise.allSettled(improvementPromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.result) {
        improvements[result.value.model] = result.value.result;
        console.log(`  ✅ ${result.value.model} provided improvements`);
      }
    });
    
    return improvements;
  }

  /**
   * Synthesize final solution
   */
  async synthesize(best, improvements, question) {
    let synthesis = `# Consensus Solution (Claude CLI with Tools)\n\n`;
    synthesis += `Base: ${best.model} (score: ${best.score.total.toFixed(2)})\n`;
    synthesis += `Contributors: ${Object.keys(improvements).join(', ')}\n`;
    synthesis += `Tools Used: Full MCP integration enabled\n\n`;
    synthesis += `## Core Solution\n\n${best.proposal}\n\n`;
    
    if (Object.keys(improvements).length > 0) {
      synthesis += `## Enhancements from Other Models\n\n`;
      for (const [model, improvement] of Object.entries(improvements)) {
        synthesis += `### ${model}:\n${improvement.substring(0, 2000)}...\n\n`;
      }
    }
    
    return synthesis;
  }

  /**
   * Save debate log
   */
  async saveLog(question, projectPath, proposals, best, improvements, final) {
    const logData = {
      timestamp: Date.now(),
      type: 'claude-cli-debate',
      question,
      projectPath,
      proposals,
      winner: best.model,
      score: best.score,
      improvements,
      solution: final,
      toolsEnabled: true
    };
    
    const logFile = path.join(this.logsDir, `claude_cli_debate_${Date.now()}.json`);
    await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
    console.log(`\n💾 Log saved: ${logFile}`);
  }
}

module.exports = { ClaudeCliDebate };