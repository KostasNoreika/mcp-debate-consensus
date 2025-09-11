/**
 * Improved Multi-Model Debate with Turn-based Mechanism and Semantic Scoring
 * Uses direct OpenRouter API calls (proven to work)
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class ImprovedDebate {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not found in environment');
    }
    
    // Define models with their OpenRouter IDs
    this.models = [
      { 
        name: 'Claude Opus 4.1', 
        id: 'anthropic/claude-opus-4.1', 
        role: 'Architecture', 
        expertise: 'System architecture and design patterns' 
      },
      { 
        name: 'GPT-5', 
        id: 'openai/gpt-5-chat', 
        role: 'Testing', 
        expertise: 'Testing strategies and quality assurance' 
      },
      { 
        name: 'Qwen 3 Max', 
        id: 'qwen/qwen3-max', 
        role: 'Algorithms', 
        expertise: 'Algorithm optimization and performance' 
      },
      { 
        name: 'Gemini 2.5 Pro', 
        id: 'google/gemini-2.5-pro', 
        role: 'Integration', 
        expertise: 'System integration and completeness' 
      }
    ];
    
    this.logsDir = '/opt/mcp/servers/debate-consensus/logs';
    this.maxRetries = 2;
    this.timeout = 600000; // 10 minutes per API call
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
      
      // Select best with semantic scoring
      const best = this.selectBestWithSemanticScoring(proposals);
      console.log(`\n🏆 Best initial proposal: ${best.model}`);
      console.log(`   Semantic score: ${best.score}`);
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
        semanticScore: best.score,
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
   * Advanced semantic scoring algorithm
   */
  selectBestWithSemanticScoring(proposals) {
    let best = null;
    let maxScore = 0;
    
    for (const [model, proposal] of Object.entries(proposals)) {
      const score = this.calculateSemanticScore(proposal);
      
      console.log(`  📊 ${model}: ${score} points`);
      
      if (score > maxScore) {
        maxScore = score;
        best = { model, proposal, score };
      }
    }
    
    return best;
  }

  /**
   * Calculate semantic score based on content quality indicators
   */
  calculateSemanticScore(text) {
    let score = 0;
    
    // Code blocks (high value)
    const codeBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
    score += codeBlocks * 500;
    
    // Technical keywords (medium value)
    const technicalKeywords = [
      'implement', 'algorithm', 'architecture', 'design', 'pattern',
      'function', 'class', 'method', 'api', 'interface', 'protocol',
      'testing', 'validation', 'error', 'exception', 'performance',
      'optimization', 'scalability', 'security', 'authentication',
      'database', 'cache', 'async', 'promise', 'callback'
    ];
    
    for (const keyword of technicalKeywords) {
      const matches = (text.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
      score += matches * 50;
    }
    
    // File/technology references (medium value)
    const techReferences = text.match(/\.(js|ts|py|java|cpp|rs|go|json|yaml|md|html|css)/g) || [];
    score += techReferences.length * 100;
    
    // Structured content indicators (medium value)
    const structuredElements = [
      /^\s*#{1,4}\s+/gm,        // Headers
      /^\s*[-*]\s+/gm,          // Bullet points
      /^\s*\d+\.\s+/gm,         // Numbered lists
      /\*\*[^*]+\*\*/g,         // Bold text
      /`[^`]+`/g                // Inline code
    ];
    
    for (const regex of structuredElements) {
      const matches = (text.match(regex) || []).length;
      score += matches * 25;
    }
    
    // Quality indicators (high value)
    const qualityPhrases = [
      'best practice', 'recommended', 'should consider', 'important to',
      'example:', 'for instance', 'specifically', 'implementation',
      'consider using', 'make sure', 'ensure that', 'note that'
    ];
    
    for (const phrase of qualityPhrases) {
      const matches = (text.toLowerCase().match(new RegExp(phrase, 'g')) || []).length;
      score += matches * 75;
    }
    
    // Length factor (diminishing returns)
    const lengthScore = Math.min(text.length / 10, 1000); // Max 1000 points for length
    score += lengthScore;
    
    // Completeness bonus (sections, explanations)
    if (text.length > 2000) score += 200;
    if (text.includes('Example:') || text.includes('example:')) score += 150;
    if (text.includes('Conclusion') || text.includes('Summary')) score += 100;
    
    return Math.round(score);
  }

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
   * Call OpenRouter API with retries
   */
  async callModel(model, prompt, retryCount = 0) {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model.id,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3456',
            'X-Title': 'Improved Debate Consensus'
          },
          timeout: this.timeout
        }
      );
      
      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content;
      }
      
      throw new Error('Invalid response format');
      
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(`  🔄 Retrying ${model.name} (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
        await this.sleep(2000 * (retryCount + 1)); // Progressive delay
        return this.callModel(model, prompt, retryCount + 1);
      }
      
      throw new Error(`API call failed: ${error.message}`);
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
          semanticScore: debateData.best.score,
          proposalCount: Object.keys(debateData.proposals).length,
          improvementCount: Object.keys(debateData.turnBasedImprovements).length,
          finalSolutionLength: debateData.finalSolution.length
        },
        scoringBreakdown: this.getScoringSummary(debateData.proposals),
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
   * Get scoring summary for all proposals
   */
  getScoringSummary(proposals) {
    const summary = {};
    for (const [model, proposal] of Object.entries(proposals)) {
      summary[model] = this.calculateSemanticScore(proposal);
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

module.exports = { ImprovedDebate };