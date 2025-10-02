/**
 * Comprehensive Unit Tests for ClaudeCliDebate
 * Core orchestration system - 1533 LOC
 * Target: 70%+ coverage
 */

import { jest } from '@jest/globals';
import { ClaudeCliDebate, parseModelConfig } from '../../src/claude-cli-debate.js';
import { spawn } from 'child_process';
import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

// Mock all external dependencies
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('../../src/llm-semantic-evaluator.js');
jest.mock('../../src/progress-reporter.js');
jest.mock('../../src/gemini-coordinator.js');
jest.mock('../../src/confidence-scorer.js');
jest.mock('../../src/cache/debate-cache.js');
jest.mock('../../src/cache/invalidator.js');
jest.mock('../../src/performance-tracker.js');
jest.mock('../../src/cross-verifier.js');
jest.mock('../../src/learning/learning-system.js');
jest.mock('../../src/telemetry-client.js');
jest.mock('../../src/utils/retry-handler.js');

describe('ClaudeCliDebate', () => {
  let debate;
  let mockSpawn;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock fs operations
    fs.mkdir = jest.fn().mockResolvedValue(undefined);
    fs.access = jest.fn().mockResolvedValue(undefined);
    fs.writeFile = jest.fn().mockResolvedValue(undefined);

    // Mock spawn
    mockSpawn = createMockSpawn();
    spawn.mockImplementation(mockSpawn);

    // Create debate instance
    debate = new ClaudeCliDebate();

    // Mock subsystems
    mockSubsystems(debate);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should create debate instance with default configuration', () => {
      expect(debate).toBeDefined();
      expect(debate.models).toHaveLength(7); // k1-k8 (k6 removed)
      expect(debate.timeout).toBe(60 * 60 * 1000); // 60 minutes default
      expect(debate.cachingEnabled).toBe(true);
      expect(debate.trackingEnabled).toBe(true);
    });

    test('should initialize all models with correct wrappers', () => {
      const expectedModels = ['k1', 'k2', 'k3', 'k4', 'k5', 'k7', 'k8'];
      const actualAliases = debate.models.map(m => m.alias);

      expect(actualAliases).toEqual(expectedModels);

      debate.models.forEach(model => {
        expect(model).toHaveProperty('alias');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('role');
        expect(model).toHaveProperty('expertise');
        expect(model).toHaveProperty('wrapper');
        expect(model.wrapper).toContain(`${model.alias}-wrapper.sh`);
      });
    });

    test('should respect environment variable configuration', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DEBATE_TIMEOUT_MINUTES: '30',
        DISABLE_CACHE: 'true',
        DISABLE_PERFORMANCE_TRACKING: 'true',
        MAX_RETRIES: '5'
      };

      const customDebate = new ClaudeCliDebate();

      expect(customDebate.timeout).toBe(30 * 60 * 1000);
      expect(customDebate.cachingEnabled).toBe(false);
      expect(customDebate.trackingEnabled).toBe(false);

      process.env = originalEnv;
    });

    test('should initialize retry handler with correct config', () => {
      expect(debate.retryHandler).toBeDefined();
      expect(debate.retryHandler.config.maxRetries).toBe(3);
      expect(debate.retryHandler.config.initialDelay).toBe(1000);
    });
  });

  describe('Initialize Method', () => {
    test('should create logs directory', async () => {
      await debate.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );
    });

    test('should verify all wrapper scripts exist', async () => {
      await debate.initialize();

      expect(fs.access).toHaveBeenCalledTimes(7); // All 7 models

      debate.models.forEach(model => {
        expect(fs.access).toHaveBeenCalledWith(
          model.wrapper,
          fs.constants.X_OK
        );
      });
    });

    test('should throw error if wrapper script missing', async () => {
      fs.access = jest.fn().mockRejectedValue(new Error('Not found'));

      await expect(debate.initialize()).rejects.toThrow('Wrapper script not found');
    });

    test('should initialize caching system when enabled', async () => {
      await debate.initialize();

      expect(debate.cacheInvalidator.startPeriodicCleanup).toHaveBeenCalled();
    });

    test('should skip cache initialization when disabled', async () => {
      debate.cachingEnabled = false;

      await debate.initialize();

      expect(debate.cacheInvalidator.startPeriodicCleanup).not.toHaveBeenCalled();
    });

    test('should initialize performance tracking when enabled', async () => {
      await debate.initialize();

      expect(debate.performanceTracker.initialize).toHaveBeenCalled();
    });

    test('should handle performance tracking init failure gracefully', async () => {
      debate.performanceTracker.initialize.mockRejectedValue(new Error('DB error'));

      await debate.initialize();

      expect(debate.trackingEnabled).toBe(false);
    });

    test('should initialize learning system', async () => {
      await debate.initialize();

      expect(debate.learningSystem.initialize).toHaveBeenCalled();
    });
  });

  describe('Model Configuration Parsing', () => {
    test('parseModelConfig should parse single model', () => {
      const result = debate.parseModelConfig('k1');

      expect(result).toEqual([{ model: 'k1', count: 1 }]);
    });

    test('parseModelConfig should parse multiple models', () => {
      const result = debate.parseModelConfig('k1,k2,k3');

      expect(result).toEqual([
        { model: 'k1', count: 1 },
        { model: 'k2', count: 1 },
        { model: 'k3', count: 1 }
      ]);
    });

    test('parseModelConfig should parse parallel instances', () => {
      const result = debate.parseModelConfig('k1:2,k2,k3:3');

      expect(result).toEqual([
        { model: 'k1', count: 2 },
        { model: 'k2', count: 1 },
        { model: 'k3', count: 3 }
      ]);
    });

    test('parseModelConfig should handle whitespace', () => {
      const result = debate.parseModelConfig(' k1 : 2 , k2 , k3 : 3 ');

      expect(result).toEqual([
        { model: 'k1', count: 2 },
        { model: 'k2', count: 1 },
        { model: 'k3', count: 3 }
      ]);
    });

    test('parseModelConfig should return empty array for null', () => {
      const result = debate.parseModelConfig(null);

      expect(result).toEqual([]);
    });

    test('parseDirectModelConfig should convert to model instances', () => {
      const result = debate.parseDirectModelConfig('k1:2,k2');

      expect(result).toHaveLength(3); // 2 k1 instances + 1 k2
      expect(result[0].alias).toBe('k1');
      expect(result[0].instanceId).toBe(1);
      expect(result[1].alias).toBe('k1');
      expect(result[1].instanceId).toBe(2);
      expect(result[2].alias).toBe('k2');
    });
  });

  describe('Instance Configuration Generation', () => {
    test('generateInstanceConfigs should create single instance', () => {
      const model = debate.models[0];
      const configs = debate.generateInstanceConfigs(model, 1);

      expect(configs).toHaveLength(1);
      expect(configs[0]).toMatchObject({
        instanceId: 1,
        totalInstances: 1,
        seed: 1000,
        temperature: 0.3
      });
    });

    test('generateInstanceConfigs should create multiple instances with diversity', () => {
      const model = debate.models[0];
      const configs = debate.generateInstanceConfigs(model, 3);

      expect(configs).toHaveLength(3);

      // Check diversity - different seeds
      expect(configs[0].seed).toBe(1000);
      expect(configs[1].seed).toBe(2000);
      expect(configs[2].seed).toBe(3000);

      // Check diversity - increasing temperature
      expect(configs[0].temperature).toBe(0.3);
      expect(configs[1].temperature).toBe(0.45);
      expect(configs[2].temperature).toBe(0.6);
    });

    test('generateInstanceConfigs should assign different focus areas', () => {
      const model = debate.models[0];
      const configs = debate.generateInstanceConfigs(model, 3);

      expect(configs[0].focus).toBe('Conservative approach');
      expect(configs[1].focus).toBe('Innovative approach');
      expect(configs[2].focus).toBe('Optimization approach');
    });

    test('generateInstanceConfigs should cap temperature at 0.9', () => {
      const model = debate.models[0];
      const configs = debate.generateInstanceConfigs(model, 10);

      configs.forEach(config => {
        expect(config.temperature).toBeLessThanOrEqual(0.9);
      });
    });
  });

  describe('Model Selection from Analysis', () => {
    test('getSelectedModelsFromAnalysis should select models', () => {
      const analysis = {
        selectedModels: ['k1', 'k2:2', 'k3'],
        complexityLevel: 'moderate'
      };

      const selected = debate.getSelectedModelsFromAnalysis(analysis);

      expect(selected).toHaveLength(4); // k1 + k2*2 + k3
      expect(selected.filter(m => m.alias === 'k2')).toHaveLength(2);
    });

    test('getSelectedModelsFromAnalysis should ensure minimum 3 models', () => {
      const analysis = {
        selectedModels: ['k1'],
        complexityLevel: 'moderate'
      };

      const selected = debate.getSelectedModelsFromAnalysis(analysis);

      expect(selected.length).toBeGreaterThanOrEqual(3);
    });

    test('getSelectedModelsFromAnalysis should not enforce minimum for trivial tasks', () => {
      const analysis = {
        selectedModels: ['k1'],
        complexityLevel: 'trivial'
      };

      const selected = debate.getSelectedModelsFromAnalysis(analysis);

      expect(selected).toHaveLength(1);
    });
  });

  describe('Claude CLI Spawning', () => {
    test('spawnClaude should spawn process with correct args', async () => {
      const model = debate.models[0];
      const prompt = 'Test prompt';
      const projectPath = '/test/path';

      const result = await debate.spawnClaude(model, prompt, projectPath);

      expect(spawn).toHaveBeenCalledWith(
        model.wrapper,
        ['--print'],
        expect.objectContaining({
          cwd: projectPath,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: debate.timeout
        })
      );
    });

    test('spawnClaude should pass instance config via environment', async () => {
      const model = debate.models[0];
      const instanceConfig = {
        instanceId: 2,
        totalInstances: 3,
        seed: 2000,
        temperature: 0.45
      };

      await debate.spawnClaude(model, 'prompt', '/path', instanceConfig);

      const envCall = spawn.mock.calls[0][2].env;
      expect(envCall.CLAUDE_INSTANCE_SEED).toBe('2000');
      expect(envCall.CLAUDE_INSTANCE_TEMPERATURE).toBe('0.45');
      expect(envCall.CLAUDE_INSTANCE_ID).toBe('2');
      expect(envCall.CLAUDE_TOTAL_INSTANCES).toBe('3');
    });

    test('spawnClaude should return stdout on success', async () => {
      const model = debate.models[0];

      const result = await debate.spawnClaude(model, 'prompt', '/path');

      expect(result).toBe('Mock Claude response');
    });

    test('spawnClaude should reject on non-zero exit code', async () => {
      spawn.mockImplementation(createMockSpawn({ exitCode: 1, stderr: 'Error output' }));

      const model = debate.models[0];

      await expect(debate.spawnClaude(model, 'prompt', '/path'))
        .rejects.toThrow('Claude CLI exited with code 1');
    });

    test('spawnClaude should reject on spawn error', async () => {
      spawn.mockImplementation(() => {
        const child = new EventEmitter();
        child.stdin = { write: jest.fn(), end: jest.fn() };
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();

        setTimeout(() => child.emit('error', new Error('Spawn failed')), 10);

        return child;
      });

      const model = debate.models[0];

      await expect(debate.spawnClaude(model, 'prompt', '/path'))
        .rejects.toThrow('Failed to spawn Claude CLI');
    });

    test('spawnClaude should reject on timeout', async () => {
      spawn.mockImplementation(() => {
        const child = new EventEmitter();
        child.stdin = { write: jest.fn(), end: jest.fn() };
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = jest.fn();

        setTimeout(() => child.emit('timeout'), 10);

        return child;
      });

      const model = debate.models[0];

      await expect(debate.spawnClaude(model, 'prompt', '/path'))
        .rejects.toThrow('timed out');
    });
  });

  describe('Call Model with Retry Logic', () => {
    beforeEach(() => {
      // Mock retry handler execute to just call the function
      debate.retryHandler.execute = jest.fn(async (fn) => await fn());
    });

    test('callModel should call model successfully', async () => {
      const model = debate.models[0];

      const result = await debate.callModel(model, 'Test prompt', '/path');

      expect(result).toBe('Mock Claude response');
      expect(debate.progressReporter.updateModelStatus).toHaveBeenCalledWith(
        model.name,
        'completed'
      );
    });

    test('callModel should update progress status', async () => {
      const model = debate.models[0];

      await debate.callModel(model, 'Test prompt', '/path');

      expect(debate.progressReporter.updateModelStatus).toHaveBeenCalledWith(
        model.name,
        'waiting'
      );
      expect(debate.progressReporter.updateModelStatus).toHaveBeenCalledWith(
        model.name,
        'starting'
      );
      expect(debate.progressReporter.updateModelStatus).toHaveBeenCalledWith(
        model.name,
        'running'
      );
      expect(debate.progressReporter.updateModelStatus).toHaveBeenCalledWith(
        model.name,
        'completed'
      );
    });

    test('callModel should add ultrathink for Claude models', async () => {
      const model = debate.models[0]; // k1 is Claude

      await debate.callModel(model, 'Test', '/path', null, { ultrathink: true });

      // Check that spawn was called and the prompt includes ultrathink
      const childProcess = spawn.mock.results[0].value;
      const writtenPrompt = childProcess.stdin.write.mock.calls[0][0];

      expect(writtenPrompt).toContain('ultrathink');
    });

    test('callModel should include instance config in prompt', async () => {
      const model = debate.models[0];
      const instanceConfig = {
        instanceId: 2,
        totalInstances: 3,
        seed: 2000,
        temperature: 0.45,
        focus: 'Innovative approach'
      };

      await debate.callModel(model, 'Test', '/path', instanceConfig);

      const childProcess = spawn.mock.results[0].value;
      const writtenPrompt = childProcess.stdin.write.mock.calls[0][0];

      expect(writtenPrompt).toContain('Instance 2 of 3');
      expect(writtenPrompt).toContain('Seed: 2000');
      expect(writtenPrompt).toContain('Innovative approach');
    });

    test('callModel should track model timing', async () => {
      debate.debateMetrics = { modelTimes: {}, failedModels: [] };
      const model = debate.models[0];

      await debate.callModel(model, 'Test', '/path');

      expect(debate.debateMetrics.modelTimes[model.name]).toBeDefined();
      expect(debate.debateMetrics.modelTimes[model.name]).toBeGreaterThan(0);
    });

    test('callModel should handle failure gracefully', async () => {
      spawn.mockImplementation(createMockSpawn({ exitCode: 1 }));
      debate.retryHandler.execute = jest.fn(async (fn) => {
        try {
          return await fn();
        } catch (error) {
          const retryError = new Error('Max retries exceeded');
          retryError.name = 'RetryError';
          retryError.getDetails = () => ({
            attemptCount: 4,
            errorType: 'RETRIABLE',
            reason: 'All attempts failed'
          });
          throw retryError;
        }
      });

      debate.debateMetrics = { modelTimes: {}, failedModels: [] };
      const model = debate.models[0];

      const result = await debate.callModel(model, 'Test', '/path');

      expect(result).toBeNull();
      expect(debate.progressReporter.updateModelStatus).toHaveBeenCalledWith(
        model.name,
        'failed'
      );
      expect(debate.debateMetrics.failedModels).toContain(model.name);
    });

    test('callModel should return null on empty response', async () => {
      spawn.mockImplementation(createMockSpawn({ stdout: '' }));
      debate.retryHandler.execute = jest.fn(async (fn) => {
        try {
          return await fn();
        } catch (error) {
          throw error;
        }
      });

      const model = debate.models[0];
      const result = await debate.callModel(model, 'Test', '/path');

      expect(result).toBeNull();
    });
  });

  describe('Get Proposals', () => {
    beforeEach(() => {
      debate.selectedModels = debate.models.slice(0, 3); // Use first 3 models
      debate.debateMetrics = { modelTimes: {}, failedModels: [] };
    });

    test('getProposals should collect responses from all models', async () => {
      debate.callModel = jest.fn().mockResolvedValue('Model response');

      const proposals = await debate.getProposals('Test question', '/path');

      expect(Object.keys(proposals)).toHaveLength(3);
      expect(debate.callModel).toHaveBeenCalledTimes(3);
    });

    test('getProposals should handle parallel instances', async () => {
      debate.selectedModels = [
        { ...debate.models[0], instanceConfig: { instanceId: 1, totalInstances: 2 } },
        { ...debate.models[0], instanceConfig: { instanceId: 2, totalInstances: 2 } }
      ];

      debate.runParallelInstances = jest.fn().mockResolvedValue('Synthesized response');

      const proposals = await debate.getProposals('Test question', '/path');

      expect(debate.runParallelInstances).toHaveBeenCalledTimes(1);
    });

    test('getProposals should filter failed models', async () => {
      debate.callModel = jest.fn()
        .mockResolvedValueOnce('Response 1')
        .mockResolvedValueOnce(null) // Failed
        .mockResolvedValueOnce('Response 3');

      const proposals = await debate.getProposals('Test question', '/path');

      expect(Object.keys(proposals)).toHaveLength(2);
    });
  });

  describe('Select Best Semantic', () => {
    test('selectBestSemantic should use LLM evaluator', async () => {
      const proposals = {
        'Model A': 'Proposal A',
        'Model B': 'Proposal B'
      };

      debate.semanticEvaluator.evaluateResponses.mockResolvedValue({
        best_response: { model: 'Model A', score: 95 },
        evaluations: []
      });

      const best = await debate.selectBestSemantic(proposals, 'Question');

      expect(best.model).toBe('Model A');
      expect(best.score.total).toBe(95);
      expect(debate.semanticEvaluator.evaluateResponses).toHaveBeenCalledWith(
        'Question',
        proposals
      );
    });
  });

  describe('Retry Handler Integration', () => {
    test('should expose retry statistics', () => {
      debate.retryHandler.getStats = jest.fn().mockReturnValue({
        totalAttempts: 10,
        successRate: 0.8,
        avgRetryCount: 1.5
      });

      const stats = debate.getRetryStats();

      expect(stats.handler.totalAttempts).toBe(10);
      expect(stats.config.maxRetries).toBe(3);
    });

    test('should reset retry statistics', () => {
      debate.retryHandler.resetStats = jest.fn();

      debate.resetRetryStats();

      expect(debate.retryHandler.resetStats).toHaveBeenCalled();
    });

    test('should configure retry settings', () => {
      debate.retryHandler.updateConfig = jest.fn();

      debate.configureRetry({ maxRetries: 5 });

      expect(debate.retryHandler.updateConfig).toHaveBeenCalledWith({ maxRetries: 5 });
    });
  });

  describe('Cache Integration', () => {
    test('getCacheStats should return stats when enabled', () => {
      debate.debateCache.getStats.mockReturnValue({
        hits: 10,
        misses: 5,
        hitRate: 0.67
      });

      const stats = debate.getCacheStats();

      expect(stats.enabled).toBe(true);
      expect(stats.hits).toBe(10);
    });

    test('getCacheStats should indicate when disabled', () => {
      debate.cachingEnabled = false;

      const stats = debate.getCacheStats();

      expect(stats.enabled).toBe(false);
      expect(stats.message).toContain('disabled');
    });

    test('clearCache should clear all entries', () => {
      debate.debateCache.clear = jest.fn();

      debate.clearCache();

      expect(debate.debateCache.clear).toHaveBeenCalled();
    });

    test('clearCache should throw when caching disabled', () => {
      debate.cachingEnabled = false;

      expect(() => debate.clearCache()).toThrow('disabled');
    });
  });

  describe('Export Functions', () => {
    test('parseModelConfig should work as standalone export', () => {
      const result = parseModelConfig('k1:2,k2');

      expect(result).toEqual([
        { model: 'k1', count: 2 },
        { model: 'k2', count: 1 }
      ]);
    });
  });
});

// Helper Functions

function createMockSpawn(options = {}) {
  const {
    exitCode = 0,
    stdout = 'Mock Claude response',
    stderr = '',
    delay = 10
  } = options;

  return () => {
    const child = new EventEmitter();

    child.stdin = {
      write: jest.fn(),
      end: jest.fn()
    };

    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = jest.fn();

    setTimeout(() => {
      if (stdout) {
        child.stdout.emit('data', Buffer.from(stdout));
      }
      if (stderr) {
        child.stderr.emit('data', Buffer.from(stderr));
      }
      child.emit('close', exitCode);
    }, delay);

    return child;
  };
}

function mockSubsystems(debate) {
  // Mock LLM Semantic Evaluator
  debate.semanticEvaluator = {
    evaluateResponses: jest.fn().mockResolvedValue({
      best_response: { model: 'Test Model', score: 90 },
      evaluations: [],
      synthesis_suggestions: []
    }),
    formatEvaluationSummary: jest.fn().mockReturnValue('Evaluation summary')
  };

  // Mock Progress Reporter
  debate.progressReporter = {
    startHeartbeat: jest.fn(),
    setPhase: jest.fn(),
    progress: jest.fn(),
    updateModelStatus: jest.fn(),
    complete: jest.fn(),
    error: jest.fn()
  };

  // Mock Gemini Coordinator
  debate.geminiCoordinator = {
    initialize: jest.fn().mockResolvedValue(undefined),
    analyzeQuestion: jest.fn().mockResolvedValue({
      category: 'code',
      complexityLevel: 'moderate',
      criticalityLevel: 'medium',
      selectedModels: ['k1', 'k2', 'k3'],
      reasoning: 'Test reasoning',
      costReduction: 30,
      estimatedSpeedGain: '2x',
      analysisSource: 'test'
    })
  };

  // Mock Confidence Scorer
  debate.confidenceScorer = {
    calculateConfidence: jest.fn().mockResolvedValue({
      score: 85,
      level: 'high',
      factors: {},
      recommendation: 'Use with confidence',
      analysis: { summary: 'Good consensus' }
    })
  };

  // Mock Debate Cache
  debate.debateCache = {
    maxAge: 24 * 60 * 60 * 1000,
    maxEntries: 1000,
    enablePersistence: true,
    getCached: jest.fn().mockResolvedValue(null),
    store: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockReturnValue({
      hits: 0,
      misses: 0,
      hitRate: 0,
      tokensSaved: 0,
      costSaved: 0
    }),
    clear: jest.fn(),
    invalidateByContext: jest.fn().mockResolvedValue(0)
  };

  // Mock Cache Invalidator
  debate.cacheInvalidator = {
    maxAge: 24 * 60 * 60 * 1000,
    minConfidence: 0.7,
    startPeriodicCleanup: jest.fn(),
    configure: jest.fn(),
    getInvalidationStats: jest.fn().mockReturnValue({})
  };

  // Mock Performance Tracker
  debate.performanceTracker = {
    initialize: jest.fn().mockResolvedValue(undefined),
    recordDebate: jest.fn().mockResolvedValue(undefined)
  };

  // Mock Cross Verifier
  debate.crossVerifier = {
    initialize: jest.fn().mockResolvedValue(undefined),
    verifyProposals: jest.fn().mockResolvedValue({
      enabled: false
    })
  };

  // Mock Learning System
  debate.learningSystem = {
    initialize: jest.fn().mockResolvedValue(undefined),
    processDebate: jest.fn().mockResolvedValue(undefined)
  };

  // Mock Retry Handler
  debate.retryHandler = {
    config: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      timeoutMs: 60 * 60 * 1000
    },
    execute: jest.fn(async (fn) => await fn()),
    getStats: jest.fn().mockReturnValue({
      totalAttempts: 0,
      successRate: 1,
      avgRetryCount: 0
    }),
    resetStats: jest.fn(),
    updateConfig: jest.fn()
  };
}
