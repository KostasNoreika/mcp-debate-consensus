/**
 * Iterative Debate Orchestrator
 * 
 * Implements true multi-agent debate with iterative consensus building.
 * Models see all responses and iterate until consensus or max rounds.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { LLMSemanticEvaluator } = require('./llm-semantic-evaluator');
const { ProgressReporter } = require('./progress-reporter');

/**
 * Tracks debate history and positions across iterations
 */
class DebateMemory {
  constructor() {
    this.iterations = [];
    this.currentIteration = 0;
    this.modelPositions = {};
    this.consensusHistory = [];
  }

  addIteration(responses, consensusScore, disagreements) {
    this.iterations.push({
      round: this.currentIteration++,
      timestamp: Date.now(),
      responses,
      consensusScore,
      disagreements,
      convergence: this.calculateConvergence()
    });
  }

  calculateConvergence() {
    if (this.consensusHistory.length < 2) return 0;
    const recent = this.consensusHistory.slice(-2);
    return recent[1] - recent[0]; // Positive means improving consensus
  }

  getDebateState() {
    return {
      currentRound: this.currentIteration,
      history: this.iterations,
      positions: this.modelPositions,
      consensusTrend: this.consensusHistory
    };
  }

  updateModelPosition(model, position, reasoning) {
    if (!this.modelPositions[model]) {
      this.modelPositions[model] = [];
    }
    this.modelPositions[model].push({
      iteration: this.currentIteration,
      position,
      reasoning,
      timestamp: Date.now()
    });
  }
}

/**
 * Analyzes consensus between model responses
 */
class ConsensusAnalyzer {
  constructor() {
    this.coordinatorModel = {
      alias: 'k1',
      name: 'Claude Opus 4.1 (Coordinator)',
      wrapper: path.join(__dirname, '..', 'k1-wrapper.sh')
    };
    this.timeout = 3 * 60 * 1000; // 3 minutes for consensus evaluation
  }

  /**
   * Evaluate consensus level between responses
   */
  async evaluateConsensus(question, responses, debateHistory = null) {
    const prompt = this.buildConsensusPrompt(question, responses, debateHistory);
    
    try {
      const result = await this.callCoordinator(prompt);
      return this.parseConsensusResult(result);
    } catch (error) {
      console.error('Consensus evaluation failed:', error);
      return this.fallbackConsensusEvaluation(responses);
    }
  }

  buildConsensusPrompt(question, responses, debateHistory) {
    const formattedResponses = Object.entries(responses)
      .map(([model, response]) => `### ${model}:\n${response}`)
      .join('\n\n---\n\n');

    const historyContext = debateHistory ? 
      `\n## Debate History:\nThis is iteration ${debateHistory.currentRound + 1}. Previous consensus scores: ${debateHistory.consensusTrend.join(', ')}\n` : '';

    return `You are the debate coordinator. Evaluate the consensus level between these model responses.

## Original Question:
${question}
${historyContext}
## Model Responses:
${formattedResponses}

## Your Task:
1. Identify if there is fundamental agreement on the core answer
2. List any significant disagreements or contradictions
3. Calculate a consensus score (0-100) where:
   - 90-100: Strong consensus, ready for synthesis
   - 70-89: Moderate consensus, minor disagreements
   - 50-69: Weak consensus, significant disagreements
   - 0-49: No consensus, fundamental disagreements

4. For factual questions (like "What is Lithuania's capital?"), if all models agree on the fact, score should be 95+

Return your evaluation as JSON:
\`\`\`json
{
  "consensus_score": 85,
  "consensus_level": "moderate",
  "core_agreement": "All models agree that...",
  "key_disagreements": [
    "Model A says X while Model B says Y"
  ],
  "continue_debate": true,
  "synthesis_ready": false,
  "reasoning": "Explanation of consensus evaluation",
  "convergence_trend": "improving|stable|diverging"
}
\`\`\``;
  }

  async callCoordinator(prompt) {
    return new Promise((resolve, reject) => {
      let output = '';
      
      const child = spawn(this.coordinatorModel.wrapper, ['--print'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout
      });
      
      child.stdin.write(prompt);
      child.stdin.end();
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && output) {
          resolve(output);
        } else {
          reject(new Error(`Coordinator failed with code ${code}`));
        }
      });
    });
  }

  parseConsensusResult(text) {
    try {
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error('No JSON found in consensus result');
    } catch (error) {
      console.error('Failed to parse consensus JSON:', error);
      throw error;
    }
  }

  fallbackConsensusEvaluation(responses) {
    // Simple keyword overlap as fallback
    const responseTexts = Object.values(responses);
    const allWords = responseTexts.flatMap(r => 
      r.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    
    const wordFreq = {};
    allWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    const commonWords = Object.values(wordFreq).filter(f => f >= responseTexts.length * 0.7);
    const consensusScore = Math.min(100, (commonWords.length / Object.keys(wordFreq).length) * 100);
    
    return {
      consensus_score: consensusScore,
      consensus_level: consensusScore > 70 ? 'moderate' : 'weak',
      continue_debate: consensusScore < 90,
      synthesis_ready: consensusScore > 80,
      key_disagreements: ['Unable to determine specific disagreements'],
      reasoning: 'Fallback consensus evaluation based on keyword overlap'
    };
  }
}

/**
 * Main orchestrator for iterative debate
 */
class IterativeDebateOrchestrator {
  constructor() {
    // Initialize progress reporter for iterative debates
    this.progressReporter = new ProgressReporter({
      interval: parseInt(process.env.DEBATE_PROGRESS_INTERVAL) || 30000,
      enabled: process.env.DEBATE_PROGRESS_ENABLED !== 'false',
      verbose: process.env.DEBATE_PROGRESS_VERBOSE === 'true'
    });

    this.models = [
      {
        alias: 'k1',
        name: 'Claude Opus 4.1',
        role: 'Architecture',
        wrapper: path.join(__dirname, '..', 'k1-wrapper.sh')
      },
      {
        alias: 'k2',
        name: 'GPT-5',
        role: 'Testing',
        wrapper: path.join(__dirname, '..', 'k2-wrapper.sh')
      },
      {
        alias: 'k3',
        name: 'Qwen 3 Max',
        role: 'Algorithms',
        wrapper: path.join(__dirname, '..', 'k3-wrapper.sh')
      },
      {
        alias: 'k4',
        name: 'Gemini 2.5 Pro',
        role: 'Integration',
        wrapper: path.join(__dirname, '..', 'k4-wrapper.sh')
      }
    ];

    this.consensusAnalyzer = new ConsensusAnalyzer();
    this.semanticEvaluator = new LLMSemanticEvaluator();
    this.debateMemory = new DebateMemory();

    this.maxIterations = parseInt(process.env.MAX_DEBATE_ITERATIONS) || 5;
    this.consensusThreshold = parseInt(process.env.CONSENSUS_THRESHOLD) || 90;
    this.timeout = 60 * 60 * 1000; // 60 minutes

    this.logsDir = path.join(__dirname, '..', 'logs');
  }

  async initialize() {
    await fs.mkdir(this.logsDir, { recursive: true });
  }

  /**
   * Run iterative debate process
   */
  async runIterativeDebate(question, projectPath = process.cwd()) {
    await this.initialize();

    // Start progress reporting
    this.progressReporter.startHeartbeat();
    this.progressReporter.setPhase('Initializing iterative debate');

    console.log('🎯 Iterative Multi-Model Debate System\n');
    console.log('📍 Project:', projectPath);
    console.log('❓ Question:', question);
    console.log(`🔄 Max iterations: ${this.maxIterations}`);
    console.log(`🎯 Consensus threshold: ${this.consensusThreshold}%`);
    console.log('\n' + '='.repeat(70) + '\n');

    try {
      // Round 1: Initial proposals
      this.progressReporter.setPhase('Round 1: Initial Independent Analysis');
      console.log('🔄 ROUND 1: Initial Independent Analysis\n');
      const initialResponses = await this.getInitialProposals(question, projectPath);
    
      if (Object.keys(initialResponses).length < 2) {
        throw new Error('Not enough models responded for debate');
      }

      // Check initial consensus
      this.progressReporter.setPhase('Evaluating initial consensus');
      const initialConsensus = await this.consensusAnalyzer.evaluateConsensus(
        question,
        initialResponses
      );

      console.log(`\n📊 Initial consensus: ${initialConsensus.consensus_score}%`);
      this.progressReporter.progress(`Initial consensus: ${initialConsensus.consensus_score}%`, {
        percentage: Math.min(20, initialConsensus.consensus_score / 5),
        details: `${Object.keys(initialResponses).length} models responded`
      });

      this.debateMemory.addIteration(initialResponses, initialConsensus.consensus_score, initialConsensus.key_disagreements);

      // Save initial responses log
      await this.saveIntermediateLog(question, projectPath, this.debateMemory.getDebateState(), 0);

      // Early exit if high initial consensus
      if (initialConsensus.consensus_score >= this.consensusThreshold) {
        console.log('✅ High initial consensus achieved! Proceeding to synthesis.');
        this.progressReporter.progress('High consensus achieved early', {
          percentage: 100,
          details: `Consensus: ${initialConsensus.consensus_score}%`
        });
        const result = await this.synthesizeFinal(question, initialResponses, this.debateMemory.getDebateState());
        this.progressReporter.complete('Iterative debate completed with early consensus');
        return result;
      }

      // Round 2: Iterative debate
      this.progressReporter.setPhase('Round 2: Iterative Consensus Building');
      console.log('\n🔄 ROUND 2: Iterative Consensus Building\n');
      const finalResponses = await this.runIterativeRounds(
        question,
        initialResponses,
        projectPath
      );

      // Final synthesis
      this.progressReporter.setPhase('Final Synthesis');
      console.log('\n🔧 FINAL SYNTHESIS\n');
      const result = await this.synthesizeFinal(question, finalResponses, this.debateMemory.getDebateState());

      this.progressReporter.complete('Iterative debate completed successfully');
      return result;

    } catch (error) {
      this.progressReporter.error(`Iterative debate failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get initial proposals from all models
   */
  async getInitialProposals(question, projectPath) {
    const proposals = {};
    
    const proposalPromises = this.models.map(async (model) => {
      const prompt = `Analyze and answer this question using your expertise in ${model.role}:

${question}

Provide a comprehensive response based on your specialization.`;
      
      const result = await this.callModel(model, prompt, projectPath);
      return { model: model.name, result };
    });
    
    const results = await Promise.allSettled(proposalPromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.result) {
        proposals[result.value.model] = result.value.result;
        console.log(`  ✅ ${result.value.model} provided initial response`);
      }
    });
    
    return proposals;
  }

  /**
   * Run iterative debate rounds
   */
  async runIterativeRounds(question, initialResponses, projectPath) {
    let currentResponses = { ...initialResponses };
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`\n🔄 Iteration ${iteration}/${this.maxIterations}`);

      this.progressReporter.progress(`Starting iteration ${iteration}/${this.maxIterations}`, {
        percentage: 20 + (iteration * 60 / this.maxIterations),
        details: `Previous consensus: ${this.debateMemory.consensusHistory[this.debateMemory.consensusHistory.length - 1] || 0}%`
      });

      // Each model sees all other responses and updates position
      const updatedResponses = await this.getUpdatedPositions(
        question,
        currentResponses,
        this.debateMemory.getDebateState(),
        projectPath
      );

      // Evaluate new consensus
      this.progressReporter.progress('Evaluating consensus for iteration', {
        model: 'Consensus Analyzer'
      });
      const consensus = await this.consensusAnalyzer.evaluateConsensus(
        question,
        updatedResponses,
        this.debateMemory.getDebateState()
      );
      
      console.log(`  📊 Consensus score: ${consensus.consensus_score}%`);
      console.log(`  📈 Trend: ${consensus.convergence_trend || 'stable'}`);

      this.progressReporter.progress(`Iteration ${iteration} consensus: ${consensus.consensus_score}%`, {
        percentage: 20 + (iteration * 60 / this.maxIterations),
        details: `Trend: ${consensus.convergence_trend || 'stable'}`
      });

      this.debateMemory.addIteration(
        updatedResponses,
        consensus.consensus_score,
        consensus.key_disagreements
      );
      this.debateMemory.consensusHistory.push(consensus.consensus_score);

      // Save intermediate log after each iteration
      await this.saveIntermediateLog(question, projectPath, this.debateMemory.getDebateState(), iteration);

      // Check if consensus reached
      if (consensus.consensus_score >= this.consensusThreshold) {
        console.log(`\n✅ Consensus threshold reached after ${iteration} iterations!`);
        this.progressReporter.progress('Consensus threshold reached!', {
          percentage: 90,
          details: `${consensus.consensus_score}% consensus after ${iteration} iterations`
        });
        return updatedResponses;
      }

      // Check if debate is stuck
      if (iteration > 2 && this.isDebateStuck()) {
        console.log('\n⚠️ Debate appears stuck. Moving to synthesis.');
        this.progressReporter.warning('Debate appears stuck, moving to synthesis');
        return updatedResponses;
      }

      currentResponses = updatedResponses;
    }

    console.log(`\n⚠️ Max iterations (${this.maxIterations}) reached without full consensus.`);
    this.progressReporter.warning(`Max iterations reached (${this.maxIterations}) without full consensus`);
    return currentResponses;
  }

  /**
   * Get updated positions from all models
   */
  async getUpdatedPositions(question, currentResponses, debateState, projectPath) {
    const updatedResponses = {};
    
    const updatePromises = this.models.map(async (model) => {
      // Don't send model its own response
      const otherResponses = Object.entries(currentResponses)
        .filter(([name, _]) => name !== model.name)
        .map(([name, response]) => `### ${name}:\n${response}`)
        .join('\n\n');
      
      const prompt = `You are ${model.name}. This is iteration ${debateState.currentRound + 1} of our debate.

## Original Question:
${question}

## Your Previous Response:
${currentResponses[model.name] || 'You have not responded yet'}

## Other Models' Current Positions:
${otherResponses}

## Consensus Status:
${debateState.consensusTrend.length > 0 ? 
  `Previous consensus scores: ${debateState.consensusTrend.join(', ')}` : 
  'This is the first iteration'}

## Your Task:
1. Review all other models' positions carefully
2. Consider if you should update your position based on their arguments
3. You may:
   - Maintain your position with additional justification
   - Partially agree and modify your stance
   - Fully adopt a different position if convinced
4. Focus on reaching consensus while maintaining intellectual integrity
5. Be specific about what you agree/disagree with

Provide your updated response:`;
      
      const result = await this.callModel(model, prompt, projectPath);
      return { model: model.name, result };
    });
    
    const results = await Promise.allSettled(updatePromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.result) {
        updatedResponses[result.value.model] = result.value.result;
        console.log(`  ✅ ${result.value.model} updated position`);
        
        // Track position change
        this.debateMemory.updateModelPosition(
          result.value.model,
          result.value.result,
          'Iteration update'
        );
      } else {
        // Keep previous response if update failed
        const modelName = this.models.find(m => 
          result.value && m.name === result.value.model
        )?.name;
        if (modelName && currentResponses[modelName]) {
          updatedResponses[modelName] = currentResponses[modelName];
        }
      }
    });
    
    return updatedResponses;
  }

  /**
   * Check if debate is stuck (no progress)
   */
  isDebateStuck() {
    const history = this.debateMemory.consensusHistory;
    if (history.length < 3) return false;
    
    // Check if last 3 scores are within 5% of each other
    const recent = history.slice(-3);
    const variance = Math.max(...recent) - Math.min(...recent);
    return variance < 5;
  }

  /**
   * Synthesize final answer
   */
  async synthesizeFinal(question, finalResponses, debateState) {
    // Use semantic evaluator to find best elements
    const evaluation = await this.semanticEvaluator.evaluateResponses(
      question, 
      finalResponses
    );
    
    let synthesis = `# Iterative Consensus Solution\n\n`;
    synthesis += `**Question:** ${question}\n\n`;
    synthesis += `**Debate Statistics:**\n`;
    synthesis += `- Total iterations: ${debateState.currentRound}\n`;
    synthesis += `- Final consensus: ${debateState.consensusTrend[debateState.consensusTrend.length - 1]}%\n`;
    synthesis += `- Models participated: ${Object.keys(finalResponses).join(', ')}\n\n`;
    
    // Show consensus evolution
    if (debateState.consensusTrend.length > 1) {
      synthesis += `**Consensus Evolution:** ${debateState.consensusTrend.map(s => `${s}%`).join(' → ')}\n\n`;
    }
    
    // Best response as base
    const bestModel = evaluation.best_response.model;
    synthesis += `## Core Solution (Base: ${bestModel})\n\n`;
    synthesis += finalResponses[bestModel] + '\n\n';
    
    // Key agreements and disagreements
    const lastIteration = debateState.history[debateState.history.length - 1];
    if (lastIteration && lastIteration.disagreements && lastIteration.disagreements.length > 0) {
      synthesis += `## Remaining Points of Discussion\n\n`;
      lastIteration.disagreements.forEach(disagreement => {
        synthesis += `- ${disagreement}\n`;
      });
      synthesis += '\n';
    }
    
    // Synthesis suggestions from evaluator
    if (evaluation.synthesis_suggestions && evaluation.synthesis_suggestions.length > 0) {
      synthesis += `## Synthesis Recommendations\n\n`;
      evaluation.synthesis_suggestions.forEach(suggestion => {
        synthesis += `- ${suggestion}\n`;
      });
    }
    
    // Save debate log
    await this.saveDebateLog(question, projectPath, debateState, synthesis);
    
    return {
      solution: synthesis,
      iterations: debateState.currentRound,
      finalConsensus: debateState.consensusTrend[debateState.consensusTrend.length - 1],
      debateHistory: debateState
    };
  }

  /**
   * Call model with prompt
   */
  async callModel(model, prompt, projectPath) {
    return new Promise((resolve, reject) => {
      let output = '';
      
      const child = spawn(model.wrapper, ['--print'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout
      });
      
      child.stdin.write(prompt);
      child.stdin.end();
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && output) {
          resolve(output);
        } else {
          resolve(null);
        }
      });
      
      child.on('error', (error) => {
        console.error(`Model ${model.name} error:`, error);
        resolve(null);
      });
    });
  }

  /**
   * Save intermediate log during iterations
   */
  async saveIntermediateLog(question, projectPath, debateState, iterationNum) {
    const logData = {
      timestamp: Date.now(),
      type: 'iterative-debate-intermediate',
      question,
      projectPath,
      currentIteration: iterationNum,
      iterations: debateState.currentRound,
      consensusEvolution: debateState.consensusTrend,
      debateHistory: debateState.history,
      status: 'in_progress'
    };
    
    const logFile = path.join(this.logsDir, `iterative_debate_intermediate_${Date.now()}.json`);
    await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
    console.log(`  💾 Intermediate log saved: ${logFile}`);
  }

  /**
   * Save debate log
   */
  async saveDebateLog(question, projectPath, debateState, synthesis) {
    const logData = {
      timestamp: Date.now(),
      type: 'iterative-debate',
      question,
      projectPath,
      iterations: debateState.currentRound,
      consensusEvolution: debateState.consensusTrend,
      debateHistory: debateState.history,
      finalSynthesis: synthesis
    };
    
    const logFile = path.join(this.logsDir, `iterative_debate_${Date.now()}.json`);
    await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
    console.log(`\n💾 Debate log saved: ${logFile}`);
  }
}

module.exports = { 
  IterativeDebateOrchestrator,
  ConsensusAnalyzer,
  DebateMemory
};