/**
 * Fixed Simple Multi-Model Debate using proxy wrapper
 */

const { promisify } = require('util');
const { exec: execCallback } = require('child_process');
const exec = promisify(execCallback);
const fs = require('fs').promises;
const path = require('path');

// Import the improved semantic scoring
const { ImprovedSemanticScoring } = require('./improved-semantic-scoring');

class SimpleDebate {
  constructor() {
    // Define models with k1-k4 aliases
    this.models = [
      { alias: 'k1', name: 'Claude Opus 4.1', role: 'Architecture', expertise: 'Architecture and system design' },
      { alias: 'k2', name: 'GPT-5', role: 'Testing', expertise: 'Testing strategies and debugging' },
      { alias: 'k3', name: 'Qwen 3 Max', role: 'Algorithms', expertise: 'Algorithm optimization' },
      { alias: 'k4', name: 'Gemini 2.5 Pro', role: 'Integration', expertise: 'Integration and completeness' }
    ];
    
    this.logsDir = '/opt/mcp/servers/debate-consensus/logs';
    this.semanticScorer = new ImprovedSemanticScoring();
    this.timeout = 1800000; // 30 minutes
  }

  async initialize() {
    await fs.mkdir(this.logsDir, { recursive: true });
  }

  /**
   * Run debate using proxy wrapper
   */
  async runDebate(question, projectPath = process.cwd()) {
    await this.initialize();
    
    console.log('🎯 Multi-Model Debate Consensus\n');
    console.log('📍 Project:', projectPath);
    console.log('❓ Question:', question);
    console.log('🤖 Models:', this.models.map(m => `${m.alias}=${m.name}`).join(', '));
    console.log('\n' + '='.repeat(70) + '\n');
    
    // Round 1: Get proposals
    console.log('🔄 ROUND 1: Independent Analysis\n');
    const proposals = await this.getProposals(question, projectPath);
    
    if (Object.keys(proposals).length < 2) {
      const failedModels = this.models.filter(m => !proposals[m.name]).map(m => m.name);
      throw new Error(`Not enough models responded. Got ${Object.keys(proposals).length}, need at least 2.\nFailed models: ${failedModels.join(', ')}\n\nCheck that:\n1. Proxy is running on port 3456\n2. API keys are configured\n3. Models are accessible`);
    }
    
    // Select best using semantic scoring
    const best = await this.selectBestSemantic(proposals, question);
    console.log(`\n🏆 Best proposal: ${best.model}`);
    console.log(`   Score: ${best.score.total.toFixed(2)} (R:${(best.score.components.relevance*100).toFixed(0)}% Q:${(best.score.components.quality*100).toFixed(0)}%)`);
    
    // Round 2: Improvements
    console.log('\n🔄 ROUND 2: Collaborative Improvements\n');
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
      contributors: Object.keys(improvements)
    };
  }

  /**
   * Call model using wrapper with improved error handling
   */
  async callModel(model, prompt) {
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Escape quotes in prompt for shell execution  
        const escapedPrompt = prompt
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/"/g, '\\"')    // Escape quotes
          .replace(/\$/g, '\\$')   // Escape dollar signs
          .replace(/`/g, '\\`');   // Escape backticks
        
        // Call wrapper directly
        const command = `node /opt/mcp/servers/debate-consensus/claude-proxy-wrapper.js ${model.alias} "${escapedPrompt}"`;
        
        console.error(`  🔄 ${model.name} (attempt ${attempt}/${maxRetries})...`);
        
        const { stdout, stderr } = await exec(command, {
          maxBuffer: 10 * 1024 * 1024,
          timeout: this.timeout,
          encoding: 'utf8'
        });
        
        // Check for stderr warnings (not errors)
        if (stderr && !stderr.includes('DeprecationWarning') && !stderr.includes('ExperimentalWarning')) {
          console.error(`  ⚠️ ${model.alias} stderr:`, stderr.substring(0, 200));
        }
        
        // Validate response
        const response = stdout.trim();
        if (!response) {
          throw new Error('Empty response from model');
        }
        
        // Check for actual error responses (not just the word "error" in content)
        if (response.toLowerCase().startsWith('error:') || 
            response.toLowerCase().includes('failed to') ||
            response.toLowerCase().includes('api error') ||
            response.toLowerCase().includes('request failed')) {
          throw new Error(`Model returned error: ${response.substring(0, 100)}`);
        }
        
        console.error(`  ✅ ${model.name} responded (${response.length} chars)`);
        return response;
        
      } catch (error) {
        console.error(`  ❌ ${model.name} attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          console.error(`  🚫 ${model.name} failed after ${maxRetries} attempts`);
          return null;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    return null;
  }

  /**
   * Get proposals from each model
   */
  async getProposals(question, projectPath) {
    const proposals = {};
    const startTime = Date.now();
    
    console.log(`Requesting proposals from ${this.models.length} models...`);
    
    for (const model of this.models) {
      const modelStart = Date.now();
      
      const prompt = `Task: ${question}

Your role: ${model.role}
Your expertise: ${model.expertise}

Provide a complete solution focusing on your area of expertise.
Include code examples and best practices.`;
      
      const result = await this.callModel(model, prompt);
      const modelTime = Math.round((Date.now() - modelStart) / 1000);
      
      if (result) {
        proposals[model.name] = result;
        console.log(`  ✅ ${model.name} completed (${modelTime}s, ${result.length} chars)`);
      } else {
        console.log(`  ❌ ${model.name} failed after ${modelTime}s`);
      }
    }
    
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
    
    for (const model of this.models) {
      if (model.name === best.model) continue;
      
      console.log(`  ${model.name} reviewing...`);
      
      const prompt = `The task was: ${question}

Current best solution from ${best.model}:
${best.proposal.substring(0, 2000)}...

Your expertise: ${model.role}
Provide specific improvements based on your expertise.`;
      
      const result = await this.callModel(model, prompt);
      if (result) {
        improvements[model.name] = result;
        console.log(`  ✅ ${model.name} provided improvements`);
      }
    }
    
    return improvements;
  }

  /**
   * Synthesize final solution
   */
  async synthesize(best, improvements, question) {
    let synthesis = `# Consensus Solution\n\n`;
    synthesis += `Base: ${best.model} (score: ${best.score.total.toFixed(2)})\n`;
    synthesis += `Contributors: ${Object.keys(improvements).join(', ')}\n\n`;
    synthesis += `## Core Solution\n\n${best.proposal}\n\n`;
    
    if (Object.keys(improvements).length > 0) {
      synthesis += `## Enhancements from Other Models\n\n`;
      for (const [model, improvement] of Object.entries(improvements)) {
        synthesis += `### ${model}:\n${improvement.substring(0, 1000)}...\n\n`;
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
      question,
      projectPath,
      proposals,
      winner: best.model,
      score: best.score,
      improvements,
      solution: final
    };
    
    const logFile = path.join(this.logsDir, `debate_${Date.now()}.json`);
    await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
    console.log(`\n💾 Log saved: ${logFile}`);
  }
}

module.exports = { SimpleDebate };