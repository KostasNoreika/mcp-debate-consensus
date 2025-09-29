/**
 * Learning System Unit Tests
 * Comprehensive test suite for learning system convergence and optimization
 */

import { jest } from '@jest/globals';

// Mock fs/promises - fix the import issue
jest.unstable_mockModule('fs/promises', () => ({
  default: {},
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
  access: jest.fn(),
  readdir: jest.fn()
}));

// Mock child modules
jest.unstable_mockModule('../../src/learning/model-profiler.js', () => ({
  ModelProfiler: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    updateAfterDebate: jest.fn(),
    getModelPerformance: jest.fn(() => ({ accuracy: 0.8, speed: 0.9 })),
    analyzeModelTrends: jest.fn(() => ({ improving: true, stability: 0.85 }))
  }))
}));

jest.unstable_mockModule('../../src/learning/pattern-detector.js', () => ({
  PatternDetector: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    detectPatterns: jest.fn(() => ({
      patterns: [
        { type: 'question_category', confidence: 0.9, frequency: 15 },
        { type: 'model_preference', confidence: 0.8, frequency: 10 }
      ]
    })),
    analyzeCategoryPatterns: jest.fn(() => ({ dominant: 'tech', confidence: 0.85 }))
  }))
}));

jest.unstable_mockModule('../../src/learning/optimizer.js', () => ({
  LearningOptimizer: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    generateOptimizations: jest.fn(() => ({
      suggestions: [
        { type: 'model_selection', confidence: 0.9, impact: 'high' },
        { type: 'cost_optimization', confidence: 0.8, impact: 'medium' }
      ]
    })),
    applyOptimization: jest.fn()
  }))
}));

// Import after mocking
const { LearningSystem } = await import('../../src/learning/learning-system.js');
const fs = await import('fs/promises');

describe('LearningSystem', () => {
  let learningSystem;

  beforeEach(() => {
    jest.clearAllMocks();
    learningSystem = new LearningSystem();
    process.env.DEBATE_LEARNING_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.DEBATE_LEARNING_ENABLED;
  });

  // Add proper cleanup
  afterAll(async () => {
    if (learningSystem && typeof learningSystem.cleanup === 'function') {
      await learningSystem.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      fs.mkdir.mockResolvedValue();

      await learningSystem.initialize();

      expect(learningSystem.isInitialized).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledTimes(2); // dataDir and reportsDir
      expect(learningSystem.modelProfiler.initialize).toHaveBeenCalled();
      expect(learningSystem.patternDetector.initialize).toHaveBeenCalled();
      expect(learningSystem.optimizer.initialize).toHaveBeenCalled();
    });

    test('should not reinitialize if already initialized', async () => {
      learningSystem.isInitialized = true;

      await learningSystem.initialize();

      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    test('should skip initialization when learning disabled', async () => {
      process.env.DEBATE_LEARNING_ENABLED = 'false';
      const newSystem = new LearningSystem();

      await newSystem.initialize();

      expect(newSystem.learningEnabled).toBe(false);
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    test('should handle directory creation errors', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(learningSystem.initialize()).rejects.toThrow('Permission denied');

      consoleSpy.mockRestore();
    });
  });

  describe('Debate Processing', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    test('should process debate results for learning', async () => {
      const debateResult = {
        question: 'Test question',
        models: ['k1', 'k2', 'k3'],
        responses: [
          { model: 'k1', response: 'Response 1', confidence: 0.9 },
          { model: 'k2', response: 'Response 2', confidence: 0.8 },
          { model: 'k3', response: 'Response 3', confidence: 0.7 }
        ],
        finalAnswer: 'Synthesized answer',
        confidence: 0.85,
        category: 'tech/programming',
        complexity: 0.6,
        duration: 45000
      };

      await learningSystem.processDebate(debateResult);

      expect(learningSystem.modelProfiler.updateAfterDebate).toHaveBeenCalledWith(debateResult);
      expect(learningSystem.stats.totalDebatesAnalyzed).toBe(1);
      expect(learningSystem.stats.lastAnalysis).toBeDefined();
    });

    test('should trigger pattern detection periodically', async () => {
      learningSystem.config.patternDetectionInterval = 2;

      const debateResult = { question: 'test', responses: [] };

      // Process debates to reach interval
      await learningSystem.processDebate(debateResult);
      await learningSystem.processDebate(debateResult);

      expect(learningSystem.patternDetector.detectPatterns).toHaveBeenCalled();
      expect(learningSystem.stats.patternsDetected).toBeGreaterThan(0);
    });

    test('should trigger optimization when threshold reached', async () => {
      learningSystem.config.autoOptimizationThreshold = 2;
      learningSystem.stats.totalDebatesAnalyzed = 1;

      const debateResult = { question: 'test', responses: [] };
      await learningSystem.processDebate(debateResult);

      expect(learningSystem.optimizer.generateOptimizations).toHaveBeenCalled();
    });

    test('should skip processing when learning disabled', async () => {
      learningSystem.learningEnabled = false;

      const debateResult = { question: 'test', responses: [] };
      await learningSystem.processDebate(debateResult);

      expect(learningSystem.modelProfiler.updateAfterDebate).not.toHaveBeenCalled();
      expect(learningSystem.stats.totalDebatesAnalyzed).toBe(0);
    });

    test('should handle processing errors gracefully', async () => {
      learningSystem.modelProfiler.updateAfterDebate.mockRejectedValue(new Error('Update failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const debateResult = { question: 'test', responses: [] };
      await learningSystem.processDebate(debateResult);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Pattern Detection and Analysis', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    test('should detect question category patterns', async () => {
      const patterns = await learningSystem.analyzeQuestionPatterns();

      expect(learningSystem.patternDetector.detectPatterns).toHaveBeenCalled();
      expect(patterns).toHaveProperty('patterns');
      expect(patterns.patterns).toBeInstanceOf(Array);
    });

    test('should analyze model performance patterns', async () => {
      const performance = await learningSystem.analyzeModelPerformance();

      expect(learningSystem.modelProfiler.getModelPerformance).toHaveBeenCalled();
      expect(performance).toHaveProperty('accuracy');
      expect(performance).toHaveProperty('speed');
    });

    test('should handle pattern detection failures', async () => {
      learningSystem.patternDetector.detectPatterns.mockRejectedValue(new Error('Detection failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const patterns = await learningSystem.analyzeQuestionPatterns();

      expect(patterns).toEqual({ patterns: [], error: 'Detection failed' });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Optimization System', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    test('should generate optimization suggestions', async () => {
      const optimizations = await learningSystem.generateOptimizations();

      expect(learningSystem.optimizer.generateOptimizations).toHaveBeenCalled();
      expect(optimizations).toHaveProperty('suggestions');
      expect(optimizations.suggestions).toBeInstanceOf(Array);
    });

    test('should apply optimization with confidence check', async () => {
      const optimization = {
        type: 'model_selection',
        confidence: 0.9,
        parameters: { preferredModel: 'k1' }
      };

      const result = await learningSystem.applyOptimization(optimization);

      expect(learningSystem.optimizer.applyOptimization).toHaveBeenCalledWith(optimization);
      expect(result.applied).toBe(true);
      expect(learningSystem.stats.optimizationsApplied).toBe(1);
    });

    test('should reject low-confidence optimizations', async () => {
      const lowConfidenceOptimization = {
        type: 'model_selection',
        confidence: 0.5, // Below threshold
        parameters: { preferredModel: 'k1' }
      };

      const result = await learningSystem.applyOptimization(lowConfidenceOptimization);

      expect(result.applied).toBe(false);
      expect(result.reason).toContain('confidence too low');
      expect(learningSystem.stats.optimizationsApplied).toBe(0);
    });

    test('should handle optimization application errors', async () => {
      learningSystem.optimizer.applyOptimization.mockRejectedValue(new Error('Apply failed'));

      const optimization = { type: 'test', confidence: 0.9 };
      const result = await learningSystem.applyOptimization(optimization);

      expect(result.applied).toBe(false);
      expect(result.error).toBe('Apply failed');
    });
  });

  describe('Learning Convergence', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    test('should detect learning convergence', async () => {
      // Simulate stable performance over time
      learningSystem.modelProfiler.analyzeModelTrends.mockReturnValue({
        improving: false,
        stability: 0.95,
        variance: 0.02
      });

      const convergence = await learningSystem.checkConvergence();

      expect(convergence.converged).toBe(true);
      expect(convergence.stability).toBeGreaterThan(0.9);
    });

    test('should detect ongoing learning', async () => {
      // Simulate improving performance
      learningSystem.modelProfiler.analyzeModelTrends.mockReturnValue({
        improving: true,
        stability: 0.7,
        variance: 0.15
      });

      const convergence = await learningSystem.checkConvergence();

      expect(convergence.converged).toBe(false);
      expect(convergence.stability).toBeLessThan(0.9);
    });

    test('should recommend actions based on convergence state', async () => {
      learningSystem.modelProfiler.analyzeModelTrends.mockReturnValue({
        improving: false,
        stability: 0.95,
        variance: 0.02
      });

      const recommendations = await learningSystem.getConvergenceRecommendations();

      expect(recommendations).toContain('System has converged');
      expect(recommendations.some(r => r.includes('reduce learning rate'))).toBe(true);
    });
  });

  describe('Report Generation', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
      fs.writeFile.mockResolvedValue();
    });

    test('should generate comprehensive performance report', async () => {
      const report = await learningSystem.generateComprehensiveReport();

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('modelPerformance');
      expect(report).toHaveProperty('patterns');
      expect(report).toHaveProperty('optimizations');
      expect(report).toHaveProperty('recommendations');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('should generate quick status report', () => {
      const status = learningSystem.getQuickStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('debatesAnalyzed');
      expect(status).toHaveProperty('patternsDetected');
      expect(status).toHaveProperty('optimizationsApplied');
    });

    test('should handle report generation errors', async () => {
      fs.writeFile.mockRejectedValue(new Error('Write failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const report = await learningSystem.generateComprehensiveReport();

      expect(report).toHaveProperty('error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Statistics Management', () => {
    test('should load existing statistics', async () => {
      const existingStats = {
        totalDebatesAnalyzed: 50,
        patternsDetected: 10,
        optimizationsApplied: 5,
        lastAnalysis: Date.now()
      };

      fs.readFile.mockResolvedValue(JSON.stringify(existingStats));

      await learningSystem.loadStats();

      expect(learningSystem.stats.totalDebatesAnalyzed).toBe(50);
      expect(learningSystem.stats.patternsDetected).toBe(10);
    });

    test('should save statistics to disk', async () => {
      learningSystem.stats.totalDebatesAnalyzed = 25;
      fs.writeFile.mockResolvedValue();

      await learningSystem.saveStats();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('learning-stats.json'),
        expect.stringContaining('"totalDebatesAnalyzed":25')
      );
    });

    test('should handle corrupted statistics file', async () => {
      fs.readFile.mockResolvedValue('invalid json{');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await learningSystem.loadStats();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load learning statistics')
      );
      consoleSpy.mockRestore();
    });

    test('should reset learning data', async () => {
      learningSystem.stats.totalDebatesAnalyzed = 100;
      fs.writeFile.mockResolvedValue();

      await learningSystem.resetLearningData();

      expect(learningSystem.stats.totalDebatesAnalyzed).toBe(0);
      expect(learningSystem.stats.patternsDetected).toBe(0);
      expect(learningSystem.stats.optimizationsApplied).toBe(0);
    });
  });

  describe('Advanced Learning Features', () => {
    beforeEach(async () => {
      await learningSystem.initialize();
    });

    test('should adapt model selection based on learning', async () => {
      const context = {
        category: 'tech/programming',
        complexity: 0.7,
        previousResults: [
          { model: 'k1', performance: 0.9 },
          { model: 'k2', performance: 0.7 }
        ]
      };

      const recommendations = await learningSystem.getModelRecommendations(context);

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations[0]).toHaveProperty('model');
      expect(recommendations[0]).toHaveProperty('confidence');
    });

    test('should learn from debate outcomes', async () => {
      const outcomes = [
        { question: 'Q1', models: ['k1', 'k2'], success: true, confidence: 0.9 },
        { question: 'Q2', models: ['k2', 'k3'], success: false, confidence: 0.6 }
      ];

      await learningSystem.learnFromOutcomes(outcomes);

      expect(learningSystem.modelProfiler.updateAfterDebate).toHaveBeenCalledTimes(2);
    });

    test('should predict debate quality', async () => {
      const prediction = await learningSystem.predictDebateQuality({
        question: 'Test technical question',
        selectedModels: ['k1', 'k2', 'k3'],
        category: 'tech/programming',
        complexity: 0.6
      });

      expect(prediction).toHaveProperty('expectedConfidence');
      expect(prediction).toHaveProperty('riskFactors');
      expect(prediction.expectedConfidence).toBeGreaterThan(0);
      expect(prediction.expectedConfidence).toBeLessThanOrEqual(1);
    });

    test('should identify performance regressions', async () => {
      learningSystem.modelProfiler.analyzeModelTrends.mockReturnValue({
        improving: false,
        stability: 0.6,
        variance: 0.3,
        regression: true
      });

      const regressions = await learningSystem.detectRegressions();

      expect(regressions).toHaveProperty('detected');
      expect(regressions.detected).toBe(true);
      expect(regressions).toHaveProperty('severity');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should continue functioning with component failures', async () => {
      learningSystem.modelProfiler.initialize.mockRejectedValue(new Error('Profiler failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await learningSystem.initialize();

      // Should still initialize other components
      expect(learningSystem.patternDetector.initialize).toHaveBeenCalled();
      expect(learningSystem.optimizer.initialize).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure
      const originalGC = global.gc;
      global.gc = jest.fn();

      learningSystem.handleMemoryPressure();

      if (global.gc) {
        expect(global.gc).toHaveBeenCalled();
      }

      global.gc = originalGC;
    });

    test('should validate learning data integrity', async () => {
      const validation = await learningSystem.validateDataIntegrity();

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('issues');
      expect(validation.valid).toBe(true);
    });
  });
});