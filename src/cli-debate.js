/**
 * CLI-based Debate System with Full MCP Tools Access
 * Each model runs as independent CLI agent with file access
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CLIDebate {
  constructor() {
    this.agents = {
      claude: {
        name: 'Claude',
        command: '/Users/kostasnoreika/.claude/local/claude',
        args: [],  // No --headless, full interactive mode
        role: 'architecture',
        hasTools: true
      },
      // For other models, we'll need to create wrapper scripts
      // that give them MCP-like capabilities
    };
    
    this.config = {
      minAgents: 1,  // At least Claude must work
      timeout: 1800000, // 30 minutes per stage
      maxRetries: 2
    };
    
    this.tempDir = '/tmp/debate-consensus';
  }

  async initialize() {
    // Create temp directory for agent communications
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Run debate with full CLI agents
   */
  async runDebate(question, projectPath) {
    await this.initialize();
    
    console.log('🎯 Starting CLI-based debate with full tool access\n');
    
    try {
      // Round 1: Each agent independently analyzes with full access
      const proposals = await this.getProposalsWithCLI(question, projectPath);
      
      // Select best proposal
      const bestProposal = await this.selectBest(proposals);
      
      // Round 2: Improvements
      const improvements = await this.getImprovements(bestProposal, question, projectPath);
      
      // Final synthesis
      const finalSolution = await this.synthesizeWithArbitration(
        bestProposal, 
        improvements, 
        question,
        projectPath
      );
      
      return {
        solution: finalSolution,
        initialWinner: bestProposal.agent,
        contributors: Object.keys(improvements)
      };
      
    } catch (error) {
      console.error('Debate failed:', error);
      throw error;
    }
  }

  /**
   * Get proposals from CLI agents with full file access
   */
  async getProposalsWithCLI(question, projectPath) {
    const proposals = {};
    
    // Prepare prompts for each agent
    const claudePrompt = `
You are analyzing a project at: ${projectPath}

Use your MCP tools to:
1. Read package.json to understand the project
2. Check the file structure
3. Look for test coverage
4. Check for production configurations
5. Analyze any critical missing components

Question: ${question}

Provide a specific, actionable recommendation based on your analysis.
Focus on architecture and system design.
`;

    // Run Claude with full CLI access
    console.log('⏳ Running Claude with full MCP tools access...');
    proposals.claude = await this.runCLIAgent('claude', claudePrompt);
    
    // For other models, we'd need wrapper scripts or different approaches
    // For now, focusing on Claude as it has native MCP support
    
    return proposals;
  }

  /**
   * Run a CLI agent and capture its response
   */
  async runCLIAgent(agentName, prompt, projectPath = '/opt/dev') {
    const agent = this.agents[agentName];
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }
    
    return new Promise(async (resolve, reject) => {
      const promptFile = path.join(this.tempDir, `${agentName}_prompt_${Date.now()}.txt`);
      
      // Write prompt to file
      await fs.writeFile(promptFile, prompt);
      
      // Use wrapper script for Claude
      const wrapperPath = path.join(__dirname, '..', 'claude-mcp-wrapper.sh');
      
      // Spawn the CLI process through wrapper
      const child = spawn('/bin/bash', [
        wrapperPath,
        prompt,
        projectPath
      ], {
        env: {
          ...process.env,
          CLAUDE_ALLOW_FILE_ACCESS: '1',  // Enable file access
          CLAUDE_PROJECT_PATH: projectPath
        },
        timeout: this.config.timeout
      });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          console.log(`[${agentName}]`, data.toString());
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        child.on('error', (error) => {
          reject(new Error(`${agentName} failed to start: ${error.message}`));
        });
        
        child.on('close', async (code) => {
          if (code !== 0 && stderr) {
            console.error(`${agentName} exited with code ${code}`);
            console.error('stderr:', stderr);
          }
          
          // Clean up temp file
          await fs.unlink(promptFile).catch(() => {});
          
          // Return stdout as response
          resolve(stdout || `${agentName} completed analysis`);
        });
    });
  }

  /**
   * Select best proposal based on completeness
   */
  async selectBest(proposals) {
    // For now, if we only have Claude, return it
    const validProposals = Object.entries(proposals)
      .filter(([_, proposal]) => proposal && proposal.length > 0);
    
    if (validProposals.length === 0) {
      throw new Error('No valid proposals received');
    }
    
    // Return the most detailed proposal
    let best = validProposals[0];
    for (const [agent, proposal] of validProposals) {
      if (proposal.length > best[1].length) {
        best = [agent, proposal];
      }
    }
    
    return {
      agent: best[0],
      proposal: best[1]
    };
  }

  /**
   * Get improvements from other agents
   */
  async getImprovements(bestProposal, question, projectPath) {
    // In full implementation, other CLI agents would review
    // For now, return the best proposal as-is
    return {
      [bestProposal.agent]: bestProposal.proposal
    };
  }

  /**
   * Synthesize final solution with arbitration
   */
  async synthesizeWithArbitration(bestProposal, improvements, question, projectPath) {
    // Use Claude to arbitrate if available
    const arbitrationPrompt = `
Based on the analysis of ${projectPath}:

Original question: ${question}

Best proposal:
${bestProposal.proposal}

Provide the final, synthesized solution.
Focus only on answering the question directly.
Do not mention the consensus process or other models.
`;

    try {
      const finalSolution = await this.runCLIAgent('claude', arbitrationPrompt);
      return finalSolution;
    } catch {
      // Fallback to best proposal
      return bestProposal.proposal;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      // Remove temp directory
      await fs.rmdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }
}

module.exports = { CLIDebate };