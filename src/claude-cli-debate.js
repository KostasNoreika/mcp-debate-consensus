/**
 * Claude CLI Multi-Model Debate using actual Claude CLI instances with full MCP tool access
 * 
 * This replaces the HTTP-based debate system with actual Claude CLI spawning,
 * giving each model full access to tools like reading files, running bash commands, etc.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the LLM-based semantic evaluator
import { LLMSemanticEvaluator } from './llm-semantic-evaluator.js';

// Import progress reporter
import { ProgressReporter } from './progress-reporter.js';

// Import Gemini Coordinator for intelligent model selection
import { GeminiCoordinator } from './gemini-coordinator.js';

// Import Confidence Scorer for confidence analysis
import { ConfidenceScorer } from './confidence-scorer.js';

// Import caching system
import { DebateCache } from './cache/debate-cache.js';
import { CacheInvalidator } from './cache/invalidator.js';

// Import performance tracking system
import { PerformanceTracker } from './performance-tracker.js';

// Import Cross-Verification System
import { CrossVerifier } from './cross-verifier.js';

// Import Learning System
import { LearningSystem } from './learning/learning-system.js';

// Import Telemetry Client
import { sendTelemetry } from './telemetry-client.js';

// Import Retry Handler for robust error handling
import { RetryHandler, ErrorClassifier } from './utils/retry-handler.js';

// Import structured logger
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ClaudeCliDebate {
  constructor() {
    // Initialize progress reporter
    this.progressReporter = new ProgressReporter({
      interval: parseInt(process.env.DEBATE_PROGRESS_INTERVAL) || 30000,
      enabled: process.env.DEBATE_PROGRESS_ENABLED !== 'false',
      verbose: process.env.DEBATE_PROGRESS_VERBOSE === 'true'
    });

    // Define models with k1-k8 wrapper scripts
    this.models = [
      {
        alias: 'k1',
        name: 'Claude Sonnet 4.5 Thinking',
        role: 'Architecture',
        expertise: 'System architecture and design patterns with extended reasoning (64K tokens, thinking mode)',
        wrapper: path.join(__dirname, '..', 'k1-wrapper.sh')
      },
      {
        alias: 'k2',
        name: 'GPT-5',
        role: 'Testing',
        expertise: 'Testing strategies, debugging, and quality assurance (128K tokens)',
        wrapper: path.join(__dirname, '..', 'k2-wrapper.sh')
      },
      {
        alias: 'k3',
        name: 'Qwen 3 Max',
        role: 'Algorithms',
        expertise: 'Algorithm optimization and data structures (32K tokens)',
        wrapper: path.join(__dirname, '..', 'k3-wrapper.sh')
      },
      {
        alias: 'k4',
        name: 'Gemini 2.5 Pro',
        role: 'Integration',
        expertise: 'System integration and completeness verification (65K tokens)',
        wrapper: path.join(__dirname, '..', 'k4-wrapper.sh')
      },
      {
        alias: 'k5',
        name: 'Grok 4 Fast',
        role: 'Fast Reasoning',
        expertise: 'Rapid reasoning, coding optimization, and cost-efficient analysis (30K tokens)',
        wrapper: path.join(__dirname, '..', 'k5-wrapper.sh')
      },
      {
        alias: 'k6',
        name: 'GPT-5 Max Thinking',
        role: 'Maximum Reasoning',
        expertise: 'Maximum thinking capability with extended reasoning (128K tokens)',
        wrapper: path.join(__dirname, '..', 'k6-wrapper.sh')
      },
      {
        alias: 'k7',
        name: 'Kimi K2 Thinking',
        role: 'Autonomous Tool Master',
        expertise: 'Deep reasoning with autonomous tool orchestration (200-300 sequential tool calls, 256K tokens, MoE architecture)',
        wrapper: path.join(__dirname, '..', 'k7-wrapper.sh')
      },
      {
        alias: 'k8',
        name: 'GLM-4.6 Exacto',
        role: 'Massive Context',
        expertise: 'Massive context window with high tool-use accuracy (200K tokens, exacto provider, MIT licensed)',
        wrapper: path.join(__dirname, '..', 'k8-wrapper.sh')
      },
      {
        alias: 'k9',
        name: 'Polaris Alpha',
        role: 'Ultra-Fast Reasoning',
        expertise: 'Ultra-fast reasoning with suspected GPT-5.1 capabilities (128K tokens, very high performance)',
        wrapper: path.join(__dirname, '..', 'k9-wrapper.sh')
      }
    ];
    
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.semanticEvaluator = new LLMSemanticEvaluator();

    // Initialize Gemini Coordinator for intelligent model selection
    this.geminiCoordinator = new GeminiCoordinator();
    this.useIntelligentSelection = process.env.DISABLE_INTELLIGENT_SELECTION !== 'true';

    // Initialize Confidence Scorer for confidence analysis
    this.confidenceScorer = new ConfidenceScorer();

    // Initialize caching system
    this.debateCache = new DebateCache({
      maxAge: parseInt(process.env.CACHE_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
      maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES) || 1000,
      enablePersistence: process.env.CACHE_PERSISTENCE !== 'false',
      persistencePath: path.join(__dirname, '..', 'cache', 'debate-cache.json')
    });

    this.cacheInvalidator = new CacheInvalidator({
      maxAge: this.debateCache.maxAge,
      minConfidence: parseFloat(process.env.CACHE_MIN_CONFIDENCE) || 0.7,
      checkInterval: parseInt(process.env.CACHE_CHECK_INTERVAL) || 5 * 60 * 1000,
      projectStateTracking: process.env.CACHE_PROJECT_TRACKING !== 'false'
    });

    // Enable/disable caching based on environment
    this.cachingEnabled = process.env.DISABLE_CACHE !== 'true';

    // Initialize performance tracking system
    this.performanceTracker = new PerformanceTracker({
      dbPath: path.join(__dirname, '..', 'data', 'performance.db')
    });
    this.trackingEnabled = process.env.DISABLE_PERFORMANCE_TRACKING !== 'true';

    // Initialize Cross-Verification System
    this.crossVerifier = new CrossVerifier(this.models);
    this.verificationEnabled = process.env.ENABLE_VERIFICATION === 'true' ||
                               process.env.DISABLE_VERIFICATION !== 'true';

    // Initialize Learning System
    this.learningSystem = new LearningSystem();
    this.learningEnabled = process.env.DISABLE_LEARNING !== 'true';

    // Configurable timeout (default: 60 minutes)
    const DEBATE_TIMEOUT_MINUTES = parseInt(process.env.DEBATE_TIMEOUT_MINUTES) || 60;
    this.timeout = DEBATE_TIMEOUT_MINUTES * 60 * 1000; // Convert to milliseconds

    logger.info('Claude CLI timeout configured', {
      minutes: DEBATE_TIMEOUT_MINUTES,
      milliseconds: this.timeout
    });

    // Store selected models for current debate
    this.selectedModels = null;
    this.selectionAnalysis = null;

    // Track model timing and performance during debate
    this.debateMetrics = {
      startTime: null,
      modelTimes: {},
      failedModels: []
    };

    // Initialize retry handler for robust error handling
    this.retryHandler = new RetryHandler({
      maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
      initialDelay: parseInt(process.env.INITIAL_RETRY_DELAY) || 1000,
      maxDelay: parseInt(process.env.MAX_RETRY_DELAY) || 30000,
      backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER) || 2,
      timeoutMs: this.timeout, // Use debate timeout
      enableLogging: process.env.NODE_ENV !== 'test' && process.env.RETRY_LOGGING !== 'false'
    });

    logger.info('Retry handler initialized', {
      maxRetries: this.retryHandler.config.maxRetries,
      initialDelay: this.retryHandler.config.initialDelay
    });
  }

  async initialize() {
    await fs.mkdir(this.logsDir, { recursive: true });

    // Initialize caching system
    if (this.cachingEnabled) {
      logger.info('Cache system enabled', {
        maxAgeHours: Math.round(this.debateCache.maxAge / (60 * 60 * 1000)),
        maxEntries: this.debateCache.maxEntries,
        persistence: this.debateCache.enablePersistence
      });

      // Start periodic cleanup
      this.cacheInvalidator.startPeriodicCleanup(this.debateCache.cache);
    } else {
      logger.info('Cache system disabled');
    }

    // Initialize Gemini Coordinator for intelligent model selection
    if (this.useIntelligentSelection) {
      await this.geminiCoordinator.initialize();
    }

    // Initialize performance tracking system
    if (this.trackingEnabled) {
      try {
        await this.performanceTracker.initialize();
        logger.info('Performance tracking enabled');
      } catch (error) {
        logger.warn('Performance tracking initialization failed', { error: error.message });
        this.trackingEnabled = false;
      }
    } else {
      logger.info('Performance tracking disabled');
    }

    // Initialize Learning System
    if (this.learningEnabled) {
      try {
        await this.learningSystem.initialize();
        logger.info('Learning system initialized');
      } catch (error) {
        logger.warn('Learning system initialization failed', { error: error.message });
        this.learningEnabled = false;
      }
    }

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
   * Parse direct model configuration (e.g., "k1:2,k2,k3:3") into selected models
   */
  parseDirectModelConfig(modelConfig) {
    const modelSpecs = this.parseModelConfig(modelConfig);
    const selectedModels = [];

    for (const spec of modelSpecs) {
      const modelConfig = this.models.find(m => m.alias === spec.model);
      if (modelConfig) {
        const instanceConfigs = this.generateInstanceConfigs(modelConfig, spec.count);

        for (const instanceConfig of instanceConfigs) {
          selectedModels.push({
            ...modelConfig,
            name: spec.count > 1 ?
              `${modelConfig.name} (Instance ${instanceConfig.instanceId})` :
              modelConfig.name,
            instanceId: instanceConfig.instanceId,
            totalInstances: instanceConfig.totalInstances,
            instanceConfig
          });
        }
      } else {
        logger.warn('Unknown model alias', { modelAlias: spec.model });
      }
    }

    return selectedModels;
  }

  /**
   * Run multi-model debate using Claude CLI spawning with intelligent caching
   * Supports both intelligent selection and direct model configuration
   */
  async runDebate(question, projectPath = process.cwd(), modelConfig = null, options = {}) {
    await this.initialize();

    const startTime = Date.now();

    // Start progress reporting
    this.progressReporter.startHeartbeat();
    this.progressReporter.setPhase('Initializing debate');

    logger.info('Multi-Model Debate Consensus v2.0 starting', {
      project: projectPath,
      question: question.substring(0, 100),
      mcpEnabled: true
    });

    // Automatiškai aktyvuoju ultrathink, jei užklausa sudėtinga
    const complexPatterns = [
      'architect', 'design', 'optimiz', 'scale', 'distributed',
      'performance', 'security', 'algorithm', 'structure'
    ];

    const isComplex = complexPatterns.some(p => question.toLowerCase().includes(p));

    if (options.ultrathink || question.toLowerCase().includes('ultrathink') || isComplex) {
      logger.info('ULTRATHINK mode activated - maximum thinking depth enabled');
      options.ultrathink = true;
    }

    // Automatiškai naudoju budget mode rutininėms užklausoms
    const simplePatterns = ['what is', 'how to', 'explain', 'list', 'show'];
    const isSimple = simplePatterns.some(p => question.toLowerCase().includes(p));

    // DISABLED: Always use full mode with all 7 models
    // if (!options.mode && (isSimple || question.length < 50)) {
    //   options.mode = 'budget';
    //   console.log('💰 Automatiškai pasirinktas ekonomiškas režimas');
    // }

    // Force full mode if no mode specified
    if (!options.mode) {
      options.mode = 'full';
      logger.info('Using FULL mode with all 7 models (default)');
    }

    // Store original mode in options
    this.currentMode = options.mode;

    // Check cache first if caching is enabled and not bypassed
    if (this.cachingEnabled && !options.bypassCache && !options.fresh) {
      this.progressReporter.setPhase('Checking cache');
      logger.debug('Checking cache for matching result');

      const cacheOptions = {
        projectPath,
        modelConfig,
        useIntelligentSelection: this.useIntelligentSelection,
        bypassCache: options.bypassCache,
        fresh: options.fresh
      };

      try {
        const cachedResult = await this.debateCache.getCached(question, cacheOptions);

        if (cachedResult) {
          const responseTime = Date.now() - startTime;
          logger.info('Cache HIT - using cached result', { cachedAt: cachedResult.cachedAt, responseTimeMs: responseTime, tokensSaved: this.debateCache.stats.tokensSaved, costSaved: this.debateCache.stats.costSaved.toFixed(4) });

          this.progressReporter.complete('Used cached result');

          return {
            ...cachedResult,
            responseTimeMs: responseTime,
            cacheStats: this.debateCache.getStats()
          };
        }

        logger.debug('Cache MISS - proceeding with fresh debate');
      } catch (error) {
        logger.warn('Cache check failed', { error: error.message });
      }
    } else if (options.bypassCache || options.fresh) {
      logger.debug('Cache BYPASS - fresh debate requested');
    } else if (!this.cachingEnabled) {
      logger.debug('Cache DISABLED - proceeding with fresh debate');
    }

    // Phase 0: Model Selection (Intelligent, Direct, or All)
    if (modelConfig) {
      // Direct model configuration provided (e.g., "k1:2,k2,k3:3")
      this.progressReporter.setPhase('Parsing direct model configuration');
      logger.info('PHASE 0: Direct Model Configuration');

      this.selectedModels = this.parseDirectModelConfig(modelConfig);
      this.selectionAnalysis = {
        category: 'Direct Configuration',
        complexityLevel: 'user-defined',
        criticalityLevel: 'user-defined',
        reasoning: `User specified model configuration: ${modelConfig}`,
        analysisSource: 'direct-user-config'
      };

      logger.info('Model configuration', { config: modelConfig });
      logger.info('Models selected', { models: this.selectedModels.map(m => m.name), count: this.selectedModels.length });

      // Count parallel instances
      const totalInstances = this.selectedModels.length;
      const uniqueModels = new Set(this.selectedModels.map(m => m.alias)).size;
      const parallelInstances = totalInstances - uniqueModels;

      if (parallelInstances > 0) {
        logger.info('Parallel instances configured', { instances: parallelInstances });
        logger.debug('Instance variety: Different seeds and temperatures for diverse perspectives');
      }

    } else if (this.currentMode === 'budget') {
      // Budget mode: NOW USES ALL 7 MODELS (k1-k5, k7-k8)
      logger.info('BUDGET MODE (UPGRADED): Using ALL 7 models');
      this.selectedModels = this.models
        .filter(m => ['k1', 'k2', 'k3', 'k4', 'k5', 'k7', 'k8'].includes(m.alias))
        .map(m => ({
          ...m,
          instanceId: 1,
          totalInstances: 1,
          instanceConfig: null
        }));
      logger.info('All models selected', { models: this.selectedModels.map(m => `${m.alias}=${m.name}`) });

    } else if (this.useIntelligentSelection) {
      // Intelligent model selection using Gemini Coordinator
      this.progressReporter.setPhase('Analyzing question for optimal model selection');
      logger.info('PHASE 0: Intelligent Model Selection');

      try {
        this.selectionAnalysis = await this.geminiCoordinator.analyzeQuestion(question, {
          projectPath,
          urgency: 0.5 // Default urgency, could be parameter
        });

        this.selectedModels = this.getSelectedModelsFromAnalysis(this.selectionAnalysis);

        logger.info('Model selection analysis', { category: this.selectionAnalysis.category, complexity: this.selectionAnalysis.complexityLevel, criticality: this.selectionAnalysis.criticalityLevel });
        logger.info('Models selected', { models: this.selectedModels.map(m => m.name), count: this.selectedModels.length });
        logger.info('Cost optimization', { reduction: this.selectionAnalysis.costReduction });
        logger.info('Speed optimization', { gain: this.selectionAnalysis.estimatedSpeedGain });
        logger.debug('Analysis source', { source: this.selectionAnalysis.analysisSource });
        logger.debug('Selection reasoning', { reasoning: this.selectionAnalysis.reasoning });

      } catch (error) {
        logger.warn('Intelligent selection failed, using all models', { error: error.message });
        this.selectedModels = this.models.map(m => ({
          ...m,
          instanceId: 1,
          totalInstances: 1,
          instanceConfig: null
        }));
        this.selectionAnalysis = null;
      }
    } else {
      // Use all available models (fallback)
      logger.info('Using all available models (intelligent selection disabled)');
      this.selectedModels = this.models.map(m => ({
        ...m,
        instanceId: 1,
        totalInstances: 1,
        instanceConfig: null
      }));
      logger.info('Models configured', { models: this.models.map(m => `${m.alias}=${m.name}`) });
    }

    logger.debug('='.repeat(70));

    try {
      // Round 1: Get proposals
      this.progressReporter.setPhase('Round 1: Independent Analysis with Tool Access');
      logger.info('ROUND 1: Independent Analysis with Tool Access');
      const proposals = await this.getProposals(question, projectPath, options);
    
      if (Object.keys(proposals).length < 2) {
        const failedModels = this.models.filter(m => !proposals[m.name]).map(m => m.name);
        throw new Error(`Not enough models responded. Got ${Object.keys(proposals).length}, need at least 2.\nFailed models: ${failedModels.join(', ')}\n\nCheck that:\n1. k-proxy-server.js is running\n2. Claude CLI is installed\n3. All wrapper scripts are executable`);
      }

      // Select best using semantic scoring
      this.progressReporter.setPhase('Evaluating proposals');
      const best = await this.selectBestSemantic(proposals, question);
      logger.info('Best proposal selected', { model: best.model, score: best.score.total.toFixed(2) });
      // Score details logged in previous statement

      this.progressReporter.progress(`Selected best proposal: ${best.model}`, {
        model: best.model,
        percentage: 40,
        details: `Score: ${best.score.total.toFixed(2)}`
      });

      // NEW: Cross-Verification Round (optional)
      let verificationResults = null;
      if (this.verificationEnabled) {
        this.progressReporter.setPhase('Cross-Verification: Multi-Model Validation');

        try {
          await this.crossVerifier.initialize();
          verificationResults = await this.crossVerifier.verifyProposals(
            proposals,
            question,
            projectPath,
            {
              category: this.selectionAnalysis?.category,
              forceVerification: options.forceVerification,
              skipVerification: options.skipVerification
            }
          );

          // Update best proposal with verification score
          if (verificationResults.enabled && verificationResults.results[best.model]) {
            const verification = verificationResults.results[best.model];
            best.verification = verification;

            // Adjust confidence based on verification
            if (best.score.components) {
              best.score.components.verification = verification.confidence;
              best.score.total = (best.score.total * 0.8) + (verification.confidence * 100 * 0.2);
            }
          }

          this.progressReporter.progress('Verification completed', {
            percentage: 55,
            details: verificationResults.enabled ?
              `${Object.keys(verificationResults.results).length} proposals verified` :
              'Verification skipped'
          });
        } catch (error) {
          logger.error('Cross-verification failed', { error: error.message });
          verificationResults = {
            enabled: false,
            error: error.message
          };
        }
      }

      // Round 2: Improvements
      this.progressReporter.setPhase('Round 2: Collaborative Improvements with Tools');
      logger.info('ROUND 2: Collaborative Improvements with Tools');
      const improvements = await this.getImprovements(best, question, projectPath, options);

      this.progressReporter.progress('Improvements collected', {
        percentage: 70,
        details: `${Object.keys(improvements).length} models contributed`
      });

      // Round 3: Final synthesis
      this.progressReporter.setPhase('Round 3: Final Synthesis');
      logger.info('ROUND 3: Final Synthesis');
      const final = await this.synthesize(best, improvements, question, verificationResults);

      // Calculate confidence score
      this.progressReporter.setPhase('Calculating Confidence Score');
      logger.info('PHASE 4: Confidence Analysis');

      const debateData = {
        question,
        proposals,
        responses: proposals, // For backward compatibility
        winner: best.model,
        score: best.score.total,
        improvements,
        solution: final,
        toolsUsed: true,
        verificationScore: best.evaluation ? best.evaluation.best_response.score / 100 : undefined
      };

      const confidence = await this.confidenceScorer.calculateConfidence(debateData);

      logger.info('Confidence analysis complete', { score: confidence.score, level: confidence.level });
      logger.debug('Confidence factors', confidence.factors);
      logger.info('Recommendation', { recommendation: confidence.recommendation });
      logger.debug('Analysis summary', { summary: confidence.analysis.summary });

      // Process debate for learning
      if (this.learningEnabled) {
        try {
          const debateResult = {
            question,
            category: this.selectionAnalysis?.category || 'general',
            participants: this.selectedModels?.map(m => m.alias) || Object.keys(proposals),
            selectedModels: this.selectedModels?.map(m => m.alias) || [],
            winner: best.model,
            scores: proposals,
            timings: this.debateMetrics.modelTimes,
            costReduction: this.selectionAnalysis?.costReduction || 0
          };

          await this.learningSystem.processDebate(debateResult);
        } catch (error) {
          logger.warn('Learning system processing failed', { error: error.message });
        }
      }

      // Record performance tracking data
      if (this.trackingEnabled) {
        try {
          const debateEndTime = Date.now();
          const totalTimeSeconds = Math.round((debateEndTime - startTime) / 1000);

          const debateResult = {
            solution: final,
            winner: best.model,
            score: best.score.total,
            contributors: Object.keys(improvements),
            toolsUsed: true
          };

          const metadata = {
            question,
            projectPath,
            modelsUsed: this.selectedModels?.map(m => m.name) || Object.keys(proposals),
            proposals,
            improvements,
            failedModels: this.debateMetrics.failedModels,
            modelTimes: this.debateMetrics.modelTimes,
            totalTimeSeconds,
            category: this.selectionAnalysis?.category,
            complexity: this.selectionAnalysis?.complexityLevel
          };

          await this.performanceTracker.recordDebate(debateResult, metadata);
          logger.debug('Performance data recorded successfully');
        } catch (error) {
          logger.warn('Performance tracking failed', { error: error.message });
        }
      }

      // Save log
      await this.saveLog(question, projectPath, proposals, best, improvements, final, confidence);

      // Prepare final result
      const responseTime = Date.now() - startTime;
      const result = {
        solution: final,
        winner: best.model,
        score: best.score.total,
        contributors: Object.keys(improvements),
        toolsUsed: true,
        parallelInstances: this.selectedModels.filter(m => m.totalInstances > 1).length > 0,
        selectionMethod: modelConfig ? 'direct' : (this.useIntelligentSelection ? 'intelligent' : 'all'),
        modelConfiguration: modelConfig || 'auto',
        confidence: confidence,
        verification: verificationResults,
        responseTimeMs: responseTime,
        fromCache: false
      };

      // Store in cache if caching is enabled
      if (this.cachingEnabled) {
        try {
          const cacheOptions = {
            projectPath,
            modelConfig,
            useIntelligentSelection: this.useIntelligentSelection,
            models: this.selectedModels
          };

          // Add confidence to result for cache storage
          result.confidence = confidence.score / 100; // Convert percentage to decimal

          await this.debateCache.store(question, result, cacheOptions);

          logger.info('Result cached for future use');
          const stats = this.debateCache.getStats();
          logger.info('Cache statistics', { hits: stats.hits, misses: stats.misses, hitRate: Math.round(stats.hitRate * 100) });
        } catch (error) {
          logger.warn('Failed to cache result', { error: error.message });
        }
      }

      // Report completion
      this.progressReporter.complete('Debate completed successfully');

      return result;
    } catch (error) {
      this.progressReporter.error(`Debate failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Call model using Claude CLI with full tool access and robust retry logic
   * Supports parallel instances with different seeds/temperatures
   */
  async callModel(model, prompt, projectPath = process.cwd(), instanceConfig = null, options = {}) {
    // Update model status to waiting initially
    this.progressReporter.updateModelStatus(model.name, 'waiting');

    try {
      const result = await this.retryHandler.execute(
        async () => {
          logger.debug('Starting Claude CLI for model', { model: model.name });

          // Update model status to starting
          this.progressReporter.updateModelStatus(model.name, 'starting');

          const startTime = Date.now();

          // Create a comprehensive prompt that includes project context
          let fullPrompt = `You are ${model.name}, an expert in ${model.expertise}.`;

          // Add ultrathink for Claude models if enabled
          if (options.ultrathink && model.alias === 'k1') {
            fullPrompt = `ultrathink\n\n${fullPrompt}`;
          }

          // Add instance-specific context if this is a parallel instance
          if (instanceConfig) {
            fullPrompt += `\n\nINSTANCE CONTEXT:
- Instance ${instanceConfig.instanceId} of ${instanceConfig.totalInstances}
- Seed: ${instanceConfig.seed}
- Temperature: ${instanceConfig.temperature}
- Focus: ${instanceConfig.focus || 'General analysis'}`;
          }

          fullPrompt += `\n\nTASK: ${prompt}

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
5. Focus on your area of expertise: ${model.expertise}`;

          if (instanceConfig) {
            fullPrompt += `\n6. ${instanceConfig.instructions || 'Provide a unique perspective based on your instance configuration'}`;
          }

          fullPrompt += `\n\nPlease provide a detailed analysis and solution.`;

          // Update status to running
          this.progressReporter.updateModelStatus(model.name, 'running');

          const result = await this.spawnClaude(model, fullPrompt, projectPath, instanceConfig);
          const duration = Math.round((Date.now() - startTime) / 1000);

          if (!result) {
            throw new Error('Empty response from Claude CLI');
          }

          // Update status to completed
          this.progressReporter.updateModelStatus(model.name, 'completed');
          logger.info('Model completed', { model: model.name, duration, responseLength: result.length });

          // Track model timing for performance analysis
          if (this.trackingEnabled && this.debateMetrics) {
            this.debateMetrics.modelTimes[model.name] = duration;
          }

          return result;
        },
        {
          name: `callModel(${model.name})`,
          context: { model, prompt, projectPath, instanceConfig, options }
        }
      );

      return result;

    } catch (error) {
      logger.error('Model failed after all retry attempts', { model: model.name, error: error.message });
      this.progressReporter.updateModelStatus(model.name, 'failed');

      // Track failed models for performance analysis
      if (this.trackingEnabled && this.debateMetrics) {
        this.debateMetrics.failedModels.push(model.name);
      }

      // If it's a RetryError, log additional details
      if (error.name === 'RetryError') {
        const details = error.getDetails();
        logger.debug('Retry details', { attempts: details.attemptCount, errorType: details.errorType });
        logger.debug('Failure reason', { reason: details.reason });

        // Log retry statistics
        const stats = this.retryHandler.getStats();
        if (stats.totalAttempts > 0) {
          logger.debug('Retry statistics', { successRate: Math.round(stats.successRate * 100), avgRetryCount: stats.avgRetryCount.toFixed(1) });
        }
      }

      return null;
    }
  }

  /**
   * Spawn Claude CLI process and capture output
   * Supports instance-specific environment variables for seeds/temperatures
   */
  async spawnClaude(model, prompt, projectPath, instanceConfig = null) {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      // Prepare environment variables for instance configuration
      const env = { ...process.env };

      if (instanceConfig) {
        // Set instance-specific environment variables that can be used by wrapper scripts
        env.CLAUDE_INSTANCE_SEED = instanceConfig.seed.toString();
        env.CLAUDE_INSTANCE_TEMPERATURE = instanceConfig.temperature.toString();
        env.CLAUDE_INSTANCE_ID = instanceConfig.instanceId.toString();
        env.CLAUDE_TOTAL_INSTANCES = instanceConfig.totalInstances.toString();
      }

      // Spawn Claude CLI using the wrapper script
      const child = spawn(model.wrapper, ['--print'], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout,
        env
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
   * Parse model configuration string (e.g., "k1:2,k2,k3:3")
   * Returns array of model specifications with instance counts
   */
  parseModelConfig(config) {
    if (!config) return [];

    return config.split(',').map(m => {
      const [model, count = "1"] = m.trim().split(':');
      return {
        model: model.trim(),
        count: parseInt(count) || 1
      };
    });
  }

  /**
   * Generate instance configurations for parallel execution
   */
  generateInstanceConfigs(baseModel, instanceCount) {
    const configs = [];

    for (let i = 1; i <= instanceCount; i++) {
      const config = {
        instanceId: i,
        totalInstances: instanceCount,
        seed: i * 1000, // Different seeds for variety
        temperature: Math.min(0.3 + (i - 1) * 0.15, 0.9), // Increasing temperature for diversity
      };

      // Add instance-specific focus areas
      if (instanceCount > 1) {
        switch (i) {
          case 1:
            config.focus = 'Conservative approach';
            config.instructions = 'Focus on reliability and proven patterns';
            break;
          case 2:
            config.focus = 'Innovative approach';
            config.instructions = 'Explore creative and novel solutions';
            break;
          case 3:
            config.focus = 'Optimization approach';
            config.instructions = 'Focus on performance and efficiency';
            break;
          default:
            config.focus = `Alternative approach ${i}`;
            config.instructions = 'Provide a unique perspective different from other instances';
        }
      }

      configs.push(config);
    }

    return configs;
  }

  /**
   * Convert analysis results to selected model configurations
   * Enhanced to support proper parallel instance configuration
   */
  getSelectedModelsFromAnalysis(analysis) {
    const selectedModels = [];

    for (const modelSpec of analysis.selectedModels) {
      const [alias, instances] = modelSpec.split(':');
      const instanceCount = parseInt(instances) || 1;

      const modelConfig = this.models.find(m => m.alias === alias);
      if (modelConfig) {
        // Generate instance configurations
        const instanceConfigs = this.generateInstanceConfigs(modelConfig, instanceCount);

        for (const instanceConfig of instanceConfigs) {
          selectedModels.push({
            ...modelConfig,
            name: instanceCount > 1 ?
              `${modelConfig.name} (Instance ${instanceConfig.instanceId})` :
              modelConfig.name,
            instanceId: instanceConfig.instanceId,
            totalInstances: instanceConfig.totalInstances,
            instanceConfig
          });
        }
      }
    }

    // Ensure minimum 3 models for consensus unless trivial task
    if (selectedModels.length < 3 && analysis.complexityLevel !== 'trivial') {
      const missingCount = 3 - selectedModels.length;
      const availableModels = this.models.filter(m =>
        !selectedModels.some(sm => sm.alias === m.alias)
      );

      for (let i = 0; i < Math.min(missingCount, availableModels.length); i++) {
        selectedModels.push({
          ...availableModels[i],
          instanceId: 1,
          totalInstances: 1,
          instanceConfig: null
        });
      }
    }

    return selectedModels;
  }

  /**
   * Run parallel instances of the same model and synthesize results
   */
  async runParallelInstances(baseModel, instanceConfigs, question, projectPath, options = {}) {
    logger.info('Running parallel instances', { instances: instanceConfigs.length, model: baseModel.name });

    const instancePromises = instanceConfigs.map(async (instanceConfig, index) => {
      const instanceModel = {
        ...baseModel,
        name: `${baseModel.name} (Instance ${instanceConfig.instanceId})`
      };

      const prompt = `${question}

Focus on your area of expertise: ${baseModel.expertise}

Use all available tools to:
1. Understand the project structure
2. Read relevant files
3. Analyze the codebase
4. Provide a complete solution with examples

Your role: ${baseModel.role}
Your expertise: ${baseModel.expertise}
Instance focus: ${instanceConfig.focus}`;

      const result = await this.callModel(instanceModel, prompt, projectPath, instanceConfig, options);
      return { instanceConfig, result, instanceModel };
    });

    const results = await Promise.allSettled(instancePromises);
    const successfulResults = results
      .filter(r => r.status === 'fulfilled' && r.value.result)
      .map(r => r.value);

    if (successfulResults.length === 0) {
      logger.error('All instances failed', { model: baseModel.name });
      return null;
    }

    if (successfulResults.length === 1) {
      logger.warn('Partial success', { model: baseModel.name, succeeded: 1, total: instanceConfigs.length });
      return successfulResults[0].result;
    }

    // Synthesize multiple instance results
    logger.debug('Synthesizing instances', { successful: successfulResults.length, total: instanceConfigs.length, model: baseModel.name });
    return await this.synthesizeInstanceResults(baseModel, successfulResults, question);
  }

  /**
   * Synthesize results from multiple instances of the same model
   */
  async synthesizeInstanceResults(baseModel, instanceResults, question) {
    // If only one result, return it directly
    if (instanceResults.length === 1) {
      return instanceResults[0].result;
    }

    // Create synthesis prompt
    const instanceSummaries = instanceResults.map((instance, index) => {
      const config = instance.instanceConfig;
      return `### Instance ${config.instanceId} (${config.focus}):
${instance.result.substring(0, 2000)}...`;
    }).join('\n\n---\n\n');

    const synthesisPrompt = `You are ${baseModel.name}, synthesizing multiple parallel analyses.

ORIGINAL QUESTION: ${question}

MULTIPLE INSTANCE RESULTS:
${instanceSummaries}

TASK: Create a unified, comprehensive solution that:
1. Combines the best insights from all instances
2. Resolves any contradictions between approaches
3. Provides a coherent, actionable solution
4. Maintains focus on your expertise: ${baseModel.expertise}

Synthesis Guidelines:
- Include the most innovative ideas from creative instances
- Preserve reliability insights from conservative instances
- Integrate optimization suggestions where applicable
- Provide clear reasoning for your synthesis decisions

Provide the final synthesized solution:`;

    try {
      // Use the first instance's model for synthesis (same underlying model)
      const synthesisResult = await this.callModel(
        instanceResults[0].instanceModel,
        synthesisPrompt,
        process.cwd(),
        {
          instanceId: 'synthesis',
          totalInstances: instanceResults.length,
          seed: 12345,
          temperature: 0.5,
          focus: 'Instance synthesis',
          instructions: 'Synthesize all instance results into a coherent solution'
        }
      );

      if (synthesisResult) {
        return `# Synthesized Solution from ${instanceResults.length} Parallel Instances

${synthesisResult}

---

## Instance Summary
This solution was synthesized from ${instanceResults.length} parallel instances of ${baseModel.name}, each with different perspectives:
${instanceResults.map(r => `- Instance ${r.instanceConfig.instanceId}: ${r.instanceConfig.focus}`).join('\n')}`;
      }
    } catch (error) {
      logger.warn('Synthesis failed, using best instance', { model: baseModel.name, error: error.message });
    }

    // Fallback: use the longest/most detailed response
    const bestInstance = instanceResults.reduce((best, current) =>
      current.result.length > best.result.length ? current : best
    );

    return `# Best Result from ${instanceResults.length} Parallel Instances

${bestInstance.result}

---

## Note
This is the best result from ${instanceResults.length} parallel instances of ${baseModel.name}. Synthesis was not possible, so the most comprehensive instance result was selected.`;
  }

  /**
   * Get proposals from selected models with parallel instance support
   */
  async getProposals(question, projectPath, options = {}) {
    const proposals = {};
    const startTime = Date.now();

    // Use selected models instead of all models
    const modelsToUse = this.selectedModels || this.models;

    // Group models by base model (same alias) to handle parallel instances
    const modelGroups = {};
    for (const model of modelsToUse) {
      if (!modelGroups[model.alias]) {
        modelGroups[model.alias] = {
          baseModel: {
            alias: model.alias,
            name: model.name.replace(/ \(Instance \d+\)$/, ''), // Remove instance suffix
            role: model.role,
            expertise: model.expertise,
            wrapper: model.wrapper
          },
          instances: []
        };
      }

      modelGroups[model.alias].instances.push(model);
    }

    const totalInstances = Object.values(modelGroups)
      .reduce((sum, group) => sum + group.instances.length, 0);

    logger.info('Requesting proposals', { baseModels: Object.keys(modelGroups).length, totalInstances, toolAccess: true });

    // Run model groups in parallel
    const modelGroupPromises = Object.entries(modelGroups).map(async ([alias, group]) => {
      const { baseModel, instances } = group;
      const modelStart = Date.now();

      let result;
      if (instances.length === 1 && !instances[0].instanceConfig) {
        // Single instance, call normally
        const prompt = `${question}

Focus on your area of expertise: ${baseModel.expertise}

Use all available tools to:
1. Understand the project structure
2. Read relevant files
3. Analyze the codebase
4. Provide a complete solution with examples

Your role: ${baseModel.role}
Your expertise: ${baseModel.expertise}`;

        result = await this.callModel(instances[0], prompt, projectPath, null, options);
      } else {
        // Multiple instances or configured instances, run in parallel
        const instanceConfigs = instances.map(inst =>
          inst.instanceConfig || {
            instanceId: 1,
            totalInstances: 1,
            seed: 1000,
            temperature: 0.5,
            focus: 'General analysis'
          }
        );

        result = await this.runParallelInstances(baseModel, instanceConfigs, question, projectPath, options);
      }

      const modelTime = Math.round((Date.now() - modelStart) / 1000);
      return { baseModel, result, modelTime, instanceCount: instances.length };
    });

    const results = await Promise.allSettled(modelGroupPromises);

    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.result) {
        const { baseModel, result: modelResult, modelTime, instanceCount } = result.value;
        proposals[baseModel.name] = modelResult;
        const instanceInfo = instanceCount > 1 ? ` (${instanceCount} instances)` : '';
        logger.info('Model/instance completed', { model: baseModel.name + instanceInfo, time: modelTime, responseLength: modelResult.length });
      } else {
        const error = result.reason?.value?.baseModel?.name || 'Unknown model';
        logger.error('Model/instance failed', { model: error, reason: result.reason?.message || 'Unknown error' });
      }
    });

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    logger.info('Proposal round completed', { responded: Object.keys(proposals).length, total: Object.keys(modelGroups).length, totalTime });

    return proposals;
  }

  /**
   * Select best using semantic scoring
   */
  async selectBestSemantic(proposals, question) {
    // Use LLM to evaluate all proposals semantically
    const evaluation = await this.semanticEvaluator.evaluateResponses(question, proposals);
    
    // Print evaluation summary
    logger.info('Evaluation summary', { summary: this.semanticEvaluator.formatEvaluationSummary(evaluation) });
    
    // Extract the best response
    const bestModel = evaluation.best_response.model;
    const bestProposal = proposals[bestModel];
    const bestScore = evaluation.best_response.score;
    
    // Format score in the expected structure for compatibility
    const formattedScore = {
      total: bestScore,
      components: {
        relevance: bestScore / 100,
        quality: bestScore / 100,
        novelty: 0.8,
        coherence: 0.9
      }
    };
    
    return { 
      model: bestModel, 
      proposal: bestProposal, 
      score: formattedScore,
      evaluation: evaluation // Keep full evaluation for reference
    };
  }

  /**
   * Get improvements from other models
   */
  async getImprovements(best, question, projectPath, options = {}) {
    const improvements = {};

    // Use selected models instead of all models
    const modelsToUse = this.selectedModels || this.models;

    const improvementPromises = modelsToUse
      .filter(model => model.name !== best.model)
      .map(async (model) => {
        logger.debug('Model reviewing with tools', { model: model.name });
        
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
        
        const result = await this.callModel(model, prompt, projectPath, null, options);
        return { model: model.name, result };
      });
    
    const results = await Promise.allSettled(improvementPromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.result) {
        improvements[result.value.model] = result.value.result;
        logger.info('Model provided improvements', { model: result.value.model });
      }
    });
    
    return improvements;
  }

  /**
   * Synthesize final solution including verification results
   */
  async synthesize(best, improvements, question, verificationResults = null) {
    let synthesis = `# Consensus Solution (LLM-Evaluated)\n\n`;
    synthesis += `Base: ${best.model} (score: ${best.score.total})\n`;
    synthesis += `Contributors: ${Object.keys(improvements).join(', ')}\n`;
    synthesis += `Evaluation Method: LLM Semantic Understanding\n\n`;

    // Include verification results if available
    if (verificationResults && verificationResults.enabled) {
      synthesis += `## Cross-Verification Results\n\n`;

      const verificationCount = Object.keys(verificationResults.results).length;
      synthesis += `**Verification Status:** ${verificationResults.enabled ? 'Enabled' : 'Disabled'}\n`;
      synthesis += `**Proposals Verified:** ${verificationCount}\n`;

      if (verificationResults.securityVerified !== undefined) {
        const securityStatus = verificationResults.securityVerified ? '✅ Passed' : '❌ Issues Found';
        synthesis += `**Security Verification:** ${securityStatus}\n`;
      }

      if (verificationResults.overallConfidence !== undefined) {
        const confidencePercent = Math.round(verificationResults.overallConfidence * 100);
        synthesis += `**Overall Confidence:** ${confidencePercent}%\n`;
      }

      // Display verification details for each model
      if (verificationResults.results && Object.keys(verificationResults.results).length > 0) {
        synthesis += `\n### Model-by-Model Verification:\n\n`;

        for (const [model, verification] of Object.entries(verificationResults.results)) {
          const confidencePercent = Math.round((verification.confidence || 0) * 100);
          synthesis += `**${model}:** ${confidencePercent}% confidence`;

          if (verification.factCheck) {
            const accuracyPercent = Math.round((verification.factCheck.accuracy || 0) * 100);
            synthesis += ` | Accuracy: ${accuracyPercent}%`;
          }

          if (verification.adversarialTest) {
            const challengesPassed = verification.adversarialTest.challengesPassed || 0;
            const totalChallenges = verification.adversarialTest.totalChallenges || 0;
            synthesis += ` | Challenges: ${challengesPassed}/${totalChallenges}`;
          }

          synthesis += `\n`;
        }
      }

      // Display key warnings if any
      if (verificationResults.warnings && verificationResults.warnings.length > 0) {
        synthesis += `\n### Key Verification Warnings:\n\n`;
        verificationResults.warnings.slice(0, 5).forEach(warning => {
          synthesis += `⚠️ ${warning}\n`;
        });

        if (verificationResults.warnings.length > 5) {
          synthesis += `\n... and ${verificationResults.warnings.length - 5} more warnings\n`;
        }
      }

      synthesis += `\n`;
    }

    // Include evaluation insights if available
    if (best.evaluation && best.evaluation.synthesis_suggestions) {
      synthesis += `## Synthesis Strategy\n\n`;
      best.evaluation.synthesis_suggestions.forEach(suggestion => {
        synthesis += `• ${suggestion}\n`;
      });
      synthesis += '\n';
    }

    synthesis += `## Core Solution\n\n${best.proposal}\n\n`;

    if (Object.keys(improvements).length > 0) {
      synthesis += `## Enhancements from Other Models\n\n`;
      for (const [model, improvement] of Object.entries(improvements)) {
        synthesis += `### ${model}:\n${improvement.substring(0, 2000)}...\n\n`;
      }
    }

    // Add evaluation details
    if (best.evaluation && best.evaluation.evaluations) {
      synthesis += `## Evaluation Details\n\n`;
      best.evaluation.evaluations.forEach(evalItem => {
        synthesis += `**${evalItem.model}** (${evalItem.score}/100)\n`;
        if (evalItem.strengths && evalItem.strengths.length > 0) {
          synthesis += `  Strengths: ${evalItem.strengths.join(', ')}\n`;
        }
        if (evalItem.weaknesses && evalItem.weaknesses.length > 0) {
          synthesis += `  Weaknesses: ${evalItem.weaknesses.join(', ')}\n`;
        }
        synthesis += '\n';
      });
    }

    return synthesis;
  }

  /**
   * Save debate log
   */
  async saveLog(question, projectPath, proposals, best, improvements, final, confidence = null) {
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
      toolsEnabled: true,
      confidence: confidence || null,
      modelSelection: {
        method: this.selectionAnalysis ? 'intelligent' : 'all',
        analysis: this.selectionAnalysis,
        selectedModels: this.selectedModels ? this.selectedModels.map(m => ({
          alias: m.alias,
          name: m.name,
          instanceId: m.instanceId,
          totalInstances: m.totalInstances
        })) : null
      }
    };

    const logFile = path.join(this.logsDir, `claude_cli_debate_${Date.now()}.json`);
    await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
    logger.debug('Log saved', { file: logFile });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    if (!this.cachingEnabled) {
      return { enabled: false, message: 'Caching is disabled' };
    }
    return {
      enabled: true,
      ...this.debateCache.getStats(),
      invalidationStats: this.cacheInvalidator.getInvalidationStats()
    };
  }

  /**
   * Clear all cache entries
   */
  clearCache() {
    if (!this.cachingEnabled) {
      throw new Error('Caching is disabled');
    }
    this.debateCache.clear();
    logger.info('Cache cleared successfully');
  }

  /**
   * Invalidate cache entries by project path
   */
  async invalidateCacheByProject(projectPath) {
    if (!this.cachingEnabled) {
      throw new Error('Caching is disabled');
    }
    const invalidatedCount = await this.debateCache.invalidateByContext(projectPath);
    logger.info('Cache entries invalidated', { count: invalidatedCount, project: projectPath });
    return invalidatedCount;
  }

  /**
   * Warm cache with common questions
   */
  async warmCache(questions, options = {}) {
    if (!this.cachingEnabled) {
      throw new Error('Caching is disabled');
    }

    logger.info('Starting cache warming', { questionCount: questions.length });
    const results = [];

    for (const question of questions) {
      try {
        logger.debug('Warming cache for question', { question: question.substring(0, 50) });
        const result = await this.runDebate(question, options.projectPath, options.modelConfig, {
          ...options,
          bypassCache: false // Ensure we don't bypass cache during warming
        });
        results.push({ question, success: true, result });
      } catch (error) {
        logger.warn('Failed to warm cache for question', { error: error.message });
        results.push({ question, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('Cache warming completed', { successful: successCount, total: questions.length });

    return {
      total: questions.length,
      successful: successCount,
      failed: questions.length - successCount,
      results
    };
  }

  /**
   * Configure cache settings
   */
  configureCache(options = {}) {
    if (!this.cachingEnabled) {
      throw new Error('Caching is disabled');
    }

    if (options.maxAge !== undefined) {
      this.debateCache.maxAge = options.maxAge;
      this.cacheInvalidator.maxAge = options.maxAge;
    }

    if (options.maxEntries !== undefined) {
      this.debateCache.maxEntries = options.maxEntries;
    }

    if (options.minConfidence !== undefined) {
      this.cacheInvalidator.minConfidence = options.minConfidence;
    }

    this.cacheInvalidator.configure(options);

    logger.info('Cache configuration updated', {
      maxAge: this.debateCache.maxAge,
      maxEntries: this.debateCache.maxEntries,
      minConfidence: this.cacheInvalidator.minConfidence
    });
  }

  /**
   * Get retry handler statistics
   * @returns {Object} Current retry statistics
   */
  getRetryStats() {
    return {
      handler: this.retryHandler.getStats(),
      config: {
        maxRetries: this.retryHandler.config.maxRetries,
        initialDelay: this.retryHandler.config.initialDelay,
        maxDelay: this.retryHandler.config.maxDelay,
        backoffMultiplier: this.retryHandler.config.backoffMultiplier,
        timeoutMs: this.retryHandler.config.timeoutMs
      }
    };
  }

  /**
   * Reset retry statistics
   */
  resetRetryStats() {
    this.retryHandler.resetStats();
    logger.info('Retry statistics reset');
  }

  /**
   * Update retry configuration
   * @param {Object} newConfig - New retry configuration options
   */
  configureRetry(newConfig = {}) {
    this.retryHandler.updateConfig(newConfig);
    logger.info('Retry configuration updated', newConfig);
  }
}

// Export the class
export { ClaudeCliDebate };

// Export static method for parsing model config
export function parseModelConfig(config) {
  const debate = new ClaudeCliDebate();
  return debate.parseModelConfig(config);
}