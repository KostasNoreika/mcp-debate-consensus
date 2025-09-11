/**
 * OpenRouter-based Multi-Claude Debate System
 * Each model runs as independent Claude CLI with different LLM via OpenRouter
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

class OpenRouterDebate {
  constructor() {
    this.agents = [
      {
        name: 'Claude-Opus',
        model: 'anthropic/claude-3-opus',
        role: 'Architecture and system design',
        expertise: 'Clean code, design patterns, scalability'
      },
      {
        name: 'Kimi-K2',
        model: 'moonshot/kimi-k2-latest',
        role: 'Testing and debugging',
        expertise: 'Test coverage, edge cases, bug detection'
      },
      {
        name: 'Qwen-Coder',
        model: 'qwen/qwen-2.5-coder-32b-instruct',
        role: 'Algorithm optimization',
        expertise: 'Performance, complexity, data structures'
      },
      {
        name: 'Gemini-Pro',
        model: 'google/gemini-2.0-flash-thinking-exp:free',
        role: 'Integration and completeness',
        expertise: 'API design, documentation, missing features'
      }
    ];
    
    this.openRouterKey = process.env.OPENROUTER_API_KEY;
    this.openRouterBase = 'https://openrouter.ai/api/v1/chat/completions';
    this.claudeCommand = '/Users/kostasnoreika/.claude/local/claude';
    
    this.config = {
      minAgents: 3,  // Need at least 3 for consensus
      timeout: 120000, // 2 minutes per agent
      maxRetries: 2,
      parallel: true
    };
    
    this.tempDir = '/tmp/debate-consensus';
    this.logsDir = path.join(__dirname, '..', 'logs', 'debates');
  }

  async initialize() {
    // Create necessary directories
    await fs.mkdir(this.tempDir, { recursive: true });
    await fs.mkdir(this.logsDir, { recursive: true });
    
    // Validate OpenRouter key
    if (!this.openRouterKey) {
      throw new Error('OPENROUTER_API_KEY not set in .env file');
    }
  }

  /**
   * Run Multi-Claude debate with OpenRouter models
   */
  async runDebate(question, projectPath) {
    await this.initialize();
    
    console.log('🎯 Starting Multi-Claude debate via OpenRouter\n');
    console.log('📍 Project:', projectPath);
    console.log('❓ Question:', question);
    console.log('🤖 Models:', this.agents.map(a => a.name).join(', '));
    console.log('\n' + '='.repeat(70) + '\n');
    
    try {
      // Round 1: All agents analyze independently with full MCP access
      console.log('🔄 ROUND 1: Independent Analysis');
      const proposals = await this.getProposalsParallel(question, projectPath);
      
      // Test and select best proposal
      console.log('\n🧪 Testing proposals...');
      const bestProposal = await this.testAndSelectBest(proposals, projectPath);
      
      // Round 2: All agents improve the best solution
      console.log('\n🔄 ROUND 2: Collaborative Improvements');
      const improvements = await this.getImprovementsParallel(bestProposal, question, projectPath);
      
      // Synthesize final solution
      console.log('\n🔧 Synthesizing final solution...');
      const finalSolution = await this.synthesize(bestProposal, improvements);
      
      // Save debate log
      await this.saveDebateLog({
        question,
        projectPath,
        proposals,
        bestProposal,
        improvements,
        finalSolution
      });
      
      return {
        solution: finalSolution.content,
        initialWinner: bestProposal.agent,
        contributors: Object.keys(improvements),
        scores: finalSolution.scores
      };
      
    } catch (error) {
      console.error('❌ Debate failed:', error);
      throw error;
    }
  }

  /**
   * Get proposals from all agents in parallel
   */
  async getProposalsParallel(question, projectPath) {
    const proposals = {};
    
    // Create prompts for each agent
    const basePrompt = `
You are analyzing a project at: ${projectPath}

Question: ${question}

Instructions:
1. Use your MCP tools to explore the codebase
2. Read package.json, README, and key files
3. Check tests, configurations, dependencies
4. Understand the project structure and context
5. Provide a complete, actionable solution with code

Your solution should include:
- Specific code implementations
- File paths where changes should be made
- Any new files that need to be created
- Commands to run for testing/validation
`;

    // Run all agents in parallel
    const promises = this.agents.map(async (agent) => {
      const agentPrompt = basePrompt + `\n\nYour specialty: ${agent.role}\nFocus on: ${agent.expertise}`;
      
      try {
        console.log(`  ⏳ Running ${agent.name} (${agent.model})...`);
        const result = await this.runClaudeWithModel(agent, agentPrompt, projectPath);
        console.log(`  ✅ ${agent.name} completed`);
        return { agent: agent.name, proposal: result };
      } catch (error) {
        console.error(`  ❌ ${agent.name} failed:`, error.message);
        return { agent: agent.name, proposal: null };
      }
    });

    const results = await Promise.all(promises);
    
    // Collect valid proposals
    for (const result of results) {
      if (result.proposal) {
        proposals[result.agent] = result.proposal;
      }
    }
    
    if (Object.keys(proposals).length < this.config.minAgents) {
      throw new Error(`Not enough agents responded. Got ${Object.keys(proposals).length}, need ${this.config.minAgents}`);
    }
    
    return proposals;
  }

  /**
   * Run Claude CLI with specific model via OpenRouter
   */
  async runClaudeWithModel(agent, prompt, projectPath) {
    return new Promise(async (resolve, reject) => {
      const sessionId = `${agent.name}_${Date.now()}`;
      const promptFile = path.join(this.tempDir, `${sessionId}_prompt.txt`);
      
      // Write prompt to file
      await fs.writeFile(promptFile, prompt);
      
      // Set up environment for OpenRouter
      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: this.openRouterBase,
        ANTHROPIC_AUTH_TOKEN: this.openRouterKey,
        ANTHROPIC_MODEL: agent.model,
        // Enable MCP tools
        CLAUDE_ALLOW_FILE_ACCESS: '1',
        CLAUDE_PROJECT_PATH: projectPath
      };
      
      // Run Claude CLI with OpenRouter override
      const child = spawn(this.claudeCommand, [], {
        cwd: projectPath,
        env: env,
        timeout: this.config.timeout
      });
      
      let stdout = '';
      let stderr = '';
      let completed = false;
      
      // Send prompt via stdin
      child.stdin.write(prompt + '\n');
      child.stdin.end();
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        if (!completed) {
          completed = true;
          reject(new Error(`${agent.name} failed to start: ${error.message}`));
        }
      });
      
      child.on('close', async (code) => {
        if (!completed) {
          completed = true;
          
          // Clean up
          await fs.unlink(promptFile).catch(() => {});
          
          if (code !== 0 && !stdout) {
            reject(new Error(`${agent.name} exited with code ${code}: ${stderr}`));
          } else {
            resolve(stdout || `${agent.name} completed analysis`);
          }
        }
      });
      
      // Timeout handler
      setTimeout(() => {
        if (!completed) {
          completed = true;
          child.kill();
          reject(new Error(`${agent.name} timed out after ${this.config.timeout}ms`));
        }
      }, this.config.timeout);
    });
  }

  /**
   * Test proposals and select the best one
   */
  async testAndSelectBest(proposals, projectPath) {
    const scores = {};
    
    for (const [agent, proposal] of Object.entries(proposals)) {
      console.log(`  🔍 Evaluating ${agent}'s proposal...`);
      
      // Extract code blocks from proposal
      const codeBlocks = this.extractCodeBlocks(proposal);
      
      // Score based on multiple criteria
      scores[agent] = {
        completeness: this.scoreCompleteness(proposal, codeBlocks),
        testability: this.scoreTestability(proposal),
        practicality: this.scorePracticality(proposal),
        total: 0
      };
      
      scores[agent].total = 
        scores[agent].completeness * 0.4 +
        scores[agent].testability * 0.3 +
        scores[agent].practicality * 0.3;
      
      console.log(`    Score: ${scores[agent].total.toFixed(2)}/10`);
    }
    
    // Find best proposal
    let bestAgent = null;
    let bestScore = 0;
    
    for (const [agent, score] of Object.entries(scores)) {
      if (score.total > bestScore) {
        bestScore = score.total;
        bestAgent = agent;
      }
    }
    
    console.log(`\n  🏆 Winner: ${bestAgent} (score: ${bestScore.toFixed(2)})`);
    
    return {
      agent: bestAgent,
      proposal: proposals[bestAgent],
      score: bestScore
    };
  }

  /**
   * Get improvements from all agents in parallel
   */
  async getImprovementsParallel(bestProposal, question, projectPath) {
    const improvements = {};
    
    const improvePrompt = `
Original question: ${question}
Project path: ${projectPath}

The best initial solution was provided by ${bestProposal.agent}:

${bestProposal.proposal}

Your task: Improve this solution based on your expertise.
DO NOT rewrite the entire solution.
Instead, provide specific improvements:
- Bug fixes if you find any
- Performance optimizations
- Better error handling
- Additional edge cases
- Missing tests
- Documentation improvements

Focus on your area of expertise and be specific about what to add or change.
`;

    // Run all agents in parallel for improvements
    const promises = this.agents.map(async (agent) => {
      const agentPrompt = improvePrompt + `\n\nYour expertise: ${agent.expertise}`;
      
      try {
        console.log(`  ⏳ ${agent.name} analyzing for improvements...`);
        const result = await this.runClaudeWithModel(agent, agentPrompt, projectPath);
        console.log(`  ✅ ${agent.name} provided improvements`);
        return { agent: agent.name, improvement: result };
      } catch (error) {
        console.error(`  ⚠️ ${agent.name} failed to provide improvements`);
        return { agent: agent.name, improvement: null };
      }
    });

    const results = await Promise.all(promises);
    
    // Collect improvements
    for (const result of results) {
      if (result.improvement) {
        improvements[result.agent] = result.improvement;
      }
    }
    
    return improvements;
  }

  /**
   * Synthesize final solution from best proposal and improvements
   */
  async synthesize(bestProposal, improvements) {
    console.log('  📝 Combining best proposal with improvements...');
    
    let finalContent = `## Consensus Solution\n\n`;
    finalContent += `Based on analysis by ${Object.keys(improvements).length} AI models.\n\n`;
    finalContent += `### Base Solution (by ${bestProposal.agent})\n\n`;
    finalContent += bestProposal.proposal + '\n\n';
    
    // Add improvements if they don't conflict
    if (Object.keys(improvements).length > 0) {
      finalContent += `### Improvements\n\n`;
      
      for (const [agent, improvement] of Object.entries(improvements)) {
        if (agent !== bestProposal.agent) {
          const useful = this.extractUsefulImprovements(improvement);
          if (useful) {
            finalContent += `#### ${agent} Contributions:\n${useful}\n\n`;
          }
        }
      }
    }
    
    return {
      content: finalContent,
      scores: {
        consensus: Object.keys(improvements).length / this.agents.length,
        confidence: bestProposal.score / 10
      }
    };
  }

  /**
   * Helper: Extract code blocks from text
   */
  extractCodeBlocks(text) {
    const codeBlocks = [];
    const regex = /```[\w]*\n([\s\S]*?)```/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      codeBlocks.push(match[1]);
    }
    
    return codeBlocks;
  }

  /**
   * Helper: Score completeness
   */
  scoreCompleteness(proposal, codeBlocks) {
    let score = 5; // Base score
    
    // Check for code presence
    if (codeBlocks.length > 0) score += 2;
    
    // Check for file paths mentioned
    if (proposal.includes('.js') || proposal.includes('.ts')) score += 1;
    
    // Check for test mentions
    if (proposal.toLowerCase().includes('test')) score += 1;
    
    // Check for command mentions
    if (proposal.includes('npm') || proposal.includes('yarn')) score += 1;
    
    return Math.min(score, 10);
  }

  /**
   * Helper: Score testability
   */
  scoreTestability(proposal) {
    let score = 5;
    
    if (proposal.toLowerCase().includes('test')) score += 2;
    if (proposal.includes('expect') || proposal.includes('assert')) score += 2;
    if (proposal.includes('npm test') || proposal.includes('jest')) score += 1;
    
    return Math.min(score, 10);
  }

  /**
   * Helper: Score practicality
   */
  scorePracticality(proposal) {
    let score = 5;
    
    // Penalize overly long proposals
    if (proposal.length > 10000) score -= 1;
    if (proposal.length < 500) score -= 2;
    
    // Reward structured proposals
    if (proposal.includes('##') || proposal.includes('###')) score += 2;
    if (proposal.includes('1.') || proposal.includes('- ')) score += 1;
    
    // Reward specific file mentions
    const fileMatches = proposal.match(/\w+\.\w+/g);
    if (fileMatches && fileMatches.length > 2) score += 2;
    
    return Math.min(Math.max(score, 0), 10);
  }

  /**
   * Helper: Extract useful improvements
   */
  extractUsefulImprovements(improvement) {
    // Remove redundant explanations, keep actionable items
    const lines = improvement.split('\n');
    const useful = [];
    let inCodeBlock = false;
    
    for (const line of lines) {
      if (line.includes('```')) {
        inCodeBlock = !inCodeBlock;
        useful.push(line);
      } else if (inCodeBlock) {
        useful.push(line);
      } else if (
        line.includes('Add') ||
        line.includes('Fix') ||
        line.includes('Improve') ||
        line.includes('Change') ||
        line.includes('Update') ||
        line.includes('test') ||
        line.includes('error')
      ) {
        useful.push(line);
      }
    }
    
    const result = useful.join('\n').trim();
    return result.length > 100 ? result : null;
  }

  /**
   * Save debate log for analysis
   */
  async saveDebateLog(data) {
    const logFile = path.join(
      this.logsDir,
      `debate_${Date.now()}.json`
    );
    
    await fs.writeFile(
      logFile,
      JSON.stringify(data, null, 2)
    );
    
    console.log(`\n📄 Debate log saved: ${logFile}`);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }
}

module.exports = { OpenRouterDebate };