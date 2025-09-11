/**
 * Improved Multi-Model Debate with Turn-based Mechanism and Semantic Scoring
 * Uses k1-k4 aliases with fixed proxy wrapper
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { ImprovedSemanticScoring } = require('./improved-semantic-scoring');

class SimpleDebate {
  constructor() {
    // Define models using k1-k4 aliases (now fixed)
    this.models = [
      { 
        name: 'Claude Opus 4.1', 
        alias: 'k1',
        role: 'Architecture', 
        expertise: 'System architecture and design patterns' 
      },
      { 
        name: 'GPT-5', 
        alias: 'k2',
        role: 'Testing', 
        expertise: 'Testing strategies and quality assurance' 
      },
      { 
        name: 'Qwen 3 Max', 
        alias: 'k3',
        role: 'Algorithms', 
        expertise: 'Algorithm optimization and performance' 
      },
      { 
        name: 'Gemini 2.5 Pro', 
        alias: 'k4',
        role: 'Integration', 
        expertise: 'System integration and completeness' 
      }
    ];
    
    this.scorer = new ImprovedSemanticScoring();
    this.logsDir = '/opt/mcp/servers/debate-consensus/logs';
    this.maxRetries = 2;
    this.timeout = 600000; // 10 minutes per model call
  }

  /**
   * Main debate orchestration with turn-based mechanism
   */
  async runDebate(question, projectPath = process.cwd()) {
    console.log('🎯 Improved Multi-Model Debate with Turn-based Discussion\n');
    console.log('📍 Project:', projectPath);
    console.log('❓ Question:', question);
    console.log('🤖 Models:', this.models.map(m => m.name).join(', '));
    console.log('\n' + '='.repeat(80) + '\n');
    
    try {
      // Round 1: Initial proposals
      console.log('🔄 ROUND 1: Initial Analysis & Proposals\n');
      const proposals = await this.getInitialProposals(question, projectPath);
      
      if (Object.keys(proposals).length < 2) {
        throw new Error(`Not enough models responded. Got ${Object.keys(proposals).length}, need at least 2`);
      }
      
      // Select best with improved semantic scoring
      const best = this.selectBestWithImprovedScoring(proposals, question);
      console.log(`\n🏆 Best initial proposal: ${best.model}`);
      console.log(`   Semantic score: ${best.totalScore}/100`);
      console.log(`   Breakdown: R:${Math.round(best.components.relevance*100)}% N:${Math.round(best.components.novelty*100)}% Q:${Math.round(best.components.quality*100)}% C:${Math.round(best.components.coherence*100)}%`);
      console.log(`   Preview: ${best.proposal.substring(0, 150)}...\n`);
      
      // Round 2: Turn-based improvements
      console.log('🔄 ROUND 2: Turn-based Collaborative Review\n');
      const turnBasedImprovements = await this.runTurnBasedImprovement(best, question, proposals);
      
      // Round 3: Final synthesis
      console.log('🔄 ROUND 3: Final Consensus Building\n');
      const finalSolution = await this.buildFinalConsensus(best, turnBasedImprovements, question);
      
      // Save comprehensive log
      await this.saveComprehensiveLog(question, projectPath, {
        proposals,
        best,
        turnBasedImprovements,
        finalSolution
      });
      
      return {
        solution: finalSolution,
        winner: best.model,
        semanticScore: best.totalScore,
        scoreBreakdown: best.components,
        contributors: Object.keys(turnBasedImprovements),
        rounds: 3
      };
      
    } catch (error) {
      console.error('❌ Debate failed:', error.message);
      throw error;
    }
  }

  /**
   * Get initial proposals from all models
   */
  async getInitialProposals(question, projectPath) {
    const proposals = {};
    
    for (const model of this.models) {
      console.log(`  📤 ${model.name} analyzing...`);
      
      const prompt = `Task: ${question}

Your Role: ${model.role} Expert
Your Expertise: ${model.expertise}

Project Context: Working in ${projectPath}

Please provide a comprehensive solution focusing on your area of expertise.
Include:
- Specific implementation details
- Code examples where relevant
- Best practices
- Potential challenges and solutions

Format your response with clear sections and actionable recommendations.`;
      
      try {
        const response = await this.callModel(model, prompt);
        if (response) {
          proposals[model.name] = response;
          console.log(`  ✅ ${model.name} completed (${response.length} chars)`);
        }
      } catch (error) {
        console.log(`  ❌ ${model.name} failed: ${error.message}`);
      }
    }
    
    return proposals;
  }

  /**
   * Turn-based improvement where each model responds to previous responses
   */
  async runTurnBasedImprovement(best, question, allProposals) {
    const improvements = {};
    const participatingModels = this.models.filter(m => m.name !== best.model);
    
    for (let i = 0; i < participatingModels.length; i++) {
      const model = participatingModels[i];
      console.log(`  🔄 Turn ${i + 1}: ${model.name} reviewing and improving...`);
      
      // Build context from previous responses
      let context = `Original Question: ${question}\n\n`;
      context += `Best Initial Solution (from ${best.model}):\n${best.proposal}\n\n`;
      
      // Add previous improvements in this turn-based round
      if (Object.keys(improvements).length > 0) {
        context += `Previous Improvements in this Round:\n`;
        for (const [prevModel, prevImprovement] of Object.entries(improvements)) {
          context += `\n${prevModel}:\n${prevImprovement.substring(0, 800)}...\n`;
        }
        context += '\n';
      }
      
      const prompt = `${context}As a ${model.role} expert, you can see the above solutions and improvements.

Your task:
1. Analyze what has been proposed so far
2. Identify gaps or areas for improvement in your expertise area (${model.expertise})
3. Build upon the previous suggestions rather than contradicting them
4. Provide specific, actionable improvements

Focus on:
- What's missing from the current solutions?
- How can your expertise enhance the proposed approach?
- What potential issues do you foresee?
- Specific code or implementation suggestions

Please reference the previous responses when building your improvements.`;
      
      try {
        const response = await this.callModel(model, prompt);
        if (response) {
          improvements[model.name] = response;
          console.log(`  ✅ Turn ${i + 1} completed: ${model.name}`);
        }
      } catch (error) {
        console.log(`  ❌ Turn ${i + 1} failed: ${model.name} - ${error.message}`);
      }
    }
    
    return improvements;
  }

  /**
   * Build final consensus by synthesizing all inputs
   */
  async buildFinalConsensus(best, improvements, question) {
    console.log('  🔧 Building final consensus...');
    
    // Use the highest-scoring model (not necessarily the initial best) to synthesize
    const synthesizer = this.models[0]; // Claude Opus for synthesis
    
    let context = `You are creating the final consensus solution for: ${question}\n\n`;
    context += `INITIAL BEST SOLUTION (${best.model}):\n${best.proposal}\n\n`;
    context += `TURN-BASED IMPROVEMENTS:\n`;
    
    for (const [model, improvement] of Object.entries(improvements)) {
      context += `\n=== ${model} ===\n${improvement}\n`;
    }
    
    const synthesisPrompt = `${context}

Create a final, comprehensive consensus solution that:
1. Takes the best aspects from all the above responses
2. Resolves any conflicts between different approaches
3. Creates a coherent, actionable solution
4. Maintains technical accuracy and completeness
5. Addresses all aspects of the original question

Structure your response with:
- Executive Summary
- Detailed Implementation Plan  
- Code Examples (if applicable)
- Testing Strategy
- Potential Challenges and Mitigation
- Next Steps

This is the final authoritative answer that combines everyone's expertise.`;
    
    try {
      const consensus = await this.callModel(synthesizer, synthesisPrompt);
      console.log('  ✅ Final consensus built');
      return consensus;
    } catch (error) {
      console.log('  ⚠️ Synthesis failed, using fallback approach');
      return this.createFallbackConsensus(best, improvements);
    }
  }

  /**
   * Fallback consensus creation if synthesis fails
   */
  createFallbackConsensus(best, improvements) {
    let consensus = `# Consensus Solution\n\n`;
    consensus += `**Primary Solution**: ${best.model} (Score: ${best.score})\n\n`;
    consensus += `## Core Implementation\n\n${best.proposal}\n\n`;
    
    if (Object.keys(improvements).length > 0) {
      consensus += `## Enhanced with Turn-based Improvements\n\n`;
      for (const [model, improvement] of Object.entries(improvements)) {
        const keyPoints = this.extractKeyPoints(improvement);
        consensus += `### ${model} Contributions:\n${keyPoints}\n\n`;
      }
    }
    
    consensus += `---\n*This solution combines insights from ${1 + Object.keys(improvements).length} expert models*`;
    return consensus;
  }

  /**
   * Select best proposal using improved semantic scoring
   */
  selectBestWithImprovedScoring(proposals, question) {
    let best = null;
    let maxScore = 0;
    const allProposals = Object.values(proposals);
    
    for (const [model, proposal] of Object.entries(proposals)) {
      const otherProposals = allProposals.filter(p => p !== proposal);
      const scoring = this.scorer.calculateScore(proposal, question, otherProposals);
      
      console.log(`  📊 ${model}: ${scoring.total}/100 (R:${Math.round(scoring.components.relevance*100)}% N:${Math.round(scoring.components.novelty*100)}% Q:${Math.round(scoring.components.quality*100)}% C:${Math.round(scoring.components.coherence*100)}%)`);
      
      if (scoring.total > maxScore) {
        maxScore = scoring.total;
        best = { 
          model, 
          proposal, 
          totalScore: scoring.total,
          components: scoring.components,
          breakdown: scoring.breakdown
        };
      }
    }
    
    return best;
  }

  // Note: Old calculateSemanticScore method removed - now using ImprovedSemanticScoring class

  /**
   * Extract key actionable points from improvement text
   */
  extractKeyPoints(text) {
    const lines = text.split('\n');
    const keyPoints = [];
    let inCodeBlock = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.includes('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      if (inCodeBlock) continue;
      
      // Extract important lines
      if (
        trimmed.match(/^[-*]\s+/) ||           // Bullet points
        trimmed.match(/^\d+\.\s+/) ||          // Numbered items
        trimmed.toLowerCase().includes('should') ||
        trimmed.toLowerCase().includes('recommend') ||
        trimmed.toLowerCase().includes('important') ||
        trimmed.toLowerCase().includes('consider') ||
        trimmed.toLowerCase().includes('ensure') ||
        trimmed.match(/^#{1,4}\s+/)            // Headers
      ) {
        if (trimmed.length > 20) {
          keyPoints.push(trimmed);
        }
      }
    }
    
    return keyPoints.slice(0, 10).join('\n');
  }

  /**
   * Call model using k1-k4 aliases with retries
   */
  async callModel(model, prompt, retryCount = 0) {
    try {
      // Use exec instead of spawn for simpler handling
      const command = `node /opt/mcp/servers/debate-consensus/claude-proxy-wrapper.js ${model.alias} "${prompt.replace(/"/g, '\\"')}"`;
      
      const { stdout, stderr } = await exec(command, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: this.timeout
        });
        
        let output = '';
        let errorOutput = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        process.on('close', (code) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            reject(new Error(`Model ${model.name} failed: ${errorOutput || 'No output'}`));
          }
        });
        
        process.on('error', (error) => {
          reject(new Error(`Process error for ${model.name}: ${error.message}`));
        });
        
        // Set timeout
        setTimeout(() => {
          process.kill();
          reject(new Error(`Timeout after ${this.timeout}ms for ${model.name}`));
        }, this.timeout);
      });
      
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(`  🔄 Retrying ${model.name} (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
        await this.sleep(2000 * (retryCount + 1)); // Progressive delay
        return this.callModel(model, prompt, retryCount + 1);
      }
      
      throw new Error(`Model call failed: ${error.message}`);
    }
  }

  /**
   * Save comprehensive debate log
   */
  async saveComprehensiveLog(question, projectPath, debateData) {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(this.logsDir, `improved-debate-${timestamp}.json`);
      
      const log = {
        timestamp: new Date().toISOString(),
        question,
        projectPath,
        models: this.models.map(m => ({ name: m.name, role: m.role })),
        results: {
          winner: debateData.best.model,
          semanticScore: debateData.best.totalScore,
          scoreBreakdown: debateData.best.components,
          proposalCount: Object.keys(debateData.proposals).length,
          improvementCount: Object.keys(debateData.turnBasedImprovements).length,
          finalSolutionLength: debateData.finalSolution.length
        },
        scoringBreakdown: this.getImprovedScoringSummary(debateData.proposals, debateData.question),
        fullData: debateData
      };
      
      await fs.writeFile(logFile, JSON.stringify(log, null, 2));
      console.log(`📝 Comprehensive log saved: ${logFile}`);
      
      return logFile;
      
    } catch (error) {
      console.warn('⚠️ Could not save log:', error.message);
      return null;
    }
  }

  /**
   * Get improved scoring summary for all proposals
   */
  getImprovedScoringSummary(proposals, question) {
    const summary = {};
    const allProposals = Object.values(proposals);
    
    for (const [model, proposal] of Object.entries(proposals)) {
      const otherProposals = allProposals.filter(p => p !== proposal);
      const scoring = this.scorer.calculateScore(proposal, question, otherProposals);
      summary[model] = {
        totalScore: scoring.total,
        components: scoring.components,
        breakdown: scoring.breakdown
      };
    }
    return summary;
  }

  /**
   * Utility: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { SimpleDebate };