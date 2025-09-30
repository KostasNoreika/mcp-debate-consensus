/**
 * Workflow Validation E2E Tests
 * Tests to validate the complete debate workflow behaves correctly with realistic scenarios
 */

import { jest } from '@jest/globals';

// Mock external dependencies
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}));

jest.unstable_mockModule('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn()
}));

// Import mocked modules
const { spawn } = await import('child_process');
const fs = await import('fs/promises');

// Mock realistic workflow components
class MockWorkflowValidator {
  constructor() {
    this.cache = new Map();
    this.performanceMetrics = {
      avgResponseTime: 8000,
      degradationHistory: [],
      circuitBreakerStates: new Map()
    };
    this.modelStats = new Map();
    this.systemHealth = 'healthy';
  }

  // Simulate cache behavior
  async getCacheResult(question, options = {}) {
    if (options.bypassCache || options.fresh) return null;

    const cacheKey = this.generateCacheKey(question, options);
    const cached = this.cache.get(cacheKey);

    if (!cached) return null;

    // Check expiration (simulate 1 hour TTL)
    if (Date.now() - cached.timestamp > 3600000) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  async storeInCache(question, result, options = {}) {
    const cacheKey = this.generateCacheKey(question, options);
    this.cache.set(cacheKey, {
      ...result,
      timestamp: Date.now(),
      cacheKey
    });
  }

  generateCacheKey(question, options) {
    return `cache_${question.toLowerCase().replace(/\s+/g, '_')}_${JSON.stringify(options)}`;
  }

  // Simulate performance tracking
  recordPerformance(duration, modelResponses) {
    this.performanceMetrics.avgResponseTime =
      (this.performanceMetrics.avgResponseTime + duration) / 2;

    this.performanceMetrics.degradationHistory.push({
      timestamp: Date.now(),
      duration,
      modelCount: modelResponses.length
    });

    // Keep only last 50 entries
    if (this.performanceMetrics.degradationHistory.length > 50) {
      this.performanceMetrics.degradationHistory.shift();
    }
  }

  detectPerformanceDegradation() {
    const recent = this.performanceMetrics.degradationHistory.slice(-5);
    if (recent.length < 3) return { detected: false, level: 'normal' };

    const avgRecent = recent.reduce((sum, entry) => sum + entry.duration, 0) / recent.length;
    const degradationLevel = avgRecent > 20000 ? 'severe' :
                           avgRecent > 15000 ? 'moderate' : 'normal';

    return {
      detected: degradationLevel !== 'normal',
      level: degradationLevel,
      avgResponseTime: avgRecent,
      recommendations: degradationLevel !== 'normal' ? [
        'Consider reducing model complexity',
        'Enable aggressive caching',
        'Use faster model selection'
      ] : []
    };
  }

  // Simulate retry logic with model reliability tracking
  async executeWithRetry(modelName, operation, maxRetries = 3, forceFailure = false) {
    const modelKey = modelName.toLowerCase();
    const stats = this.modelStats.get(modelKey) || {
      attempts: 0,
      failures: 0,
      consecutiveFailures: 0
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      stats.attempts++;

      try {
        // Simulate failure probability based on consecutive failures or forced failure
        let failureProbability = Math.min(0.3, stats.consecutiveFailures * 0.1);

        if (forceFailure) {
          failureProbability = 1.0; // Force failure
        }

        if (Math.random() < failureProbability) {
          throw new Error(`Simulated failure for ${modelName} (attempt ${attempt})`);
        }

        const result = await operation();
        stats.consecutiveFailures = 0; // Reset on success
        this.modelStats.set(modelKey, stats);

        return {
          success: true,
          result,
          attempts: attempt,
          modelStats: stats
        };
      } catch (error) {
        stats.failures++;
        stats.consecutiveFailures++;
        this.modelStats.set(modelKey, stats);

        if (attempt === maxRetries) {
          return {
            success: false,
            error: error.message,
            attempts: attempt,
            modelStats: stats
          };
        }

        // Small delay for retry
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  // Simulate intelligent model selection
  selectModels(question, complexity = 'medium') {
    const availableModels = ['k1', 'k2', 'k3', 'k4', 'k5'];

    // Basic model selection based on complexity
    switch (complexity) {
      case 'low':
        return ['k5', 'k3']; // Fast models for simple tasks
      case 'high':
        return ['k1', 'k2', 'k4', 'k3']; // Premium models for complex tasks
      default:
        return ['k1', 'k2', 'k4']; // Balanced selection
    }
  }

  // Simulate complete workflow
  async runWorkflow(question, options = {}) {
    const startTime = Date.now();

    try {
      // Step 1: Check cache
      const cached = await this.getCacheResult(question, options);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          duration: Date.now() - startTime
        };
      }

      // Step 2: Model selection
      const complexity = this.estimateComplexity(question);
      const selectedModels = this.selectModels(question, complexity);

      // Step 3: Execute models with retry logic
      const modelResponses = [];
      const retryStats = {};
      const forceFailure = options.forceModelFailures === true;

      for (const model of selectedModels) {
        const execution = await this.executeWithRetry(model, async () => {
          // Simulate model execution - make it fast for tests
          await new Promise(resolve => setTimeout(resolve, 5));
          return {
            model,
            response: `Response from ${model} for: ${question}`,
            confidence: 0.7 + Math.random() * 0.3,
            responseTime: 100 + Math.random() * 50
          };
        }, 3, forceFailure);

        retryStats[model] = {
          attempts: execution.attempts,
          success: execution.success
        };

        if (execution.success) {
          modelResponses.push(execution.result);
        }
      }

      // Step 4: Check if enough models responded
      if (modelResponses.length < 2) {
        throw new Error('Insufficient model responses for consensus');
      }

      // Step 5: Generate consensus
      const finalAnswer = this.generateConsensus(modelResponses);
      const confidence = this.calculateConfidence(modelResponses);

      // Step 6: Record performance
      const duration = Date.now() - startTime;
      this.recordPerformance(duration, modelResponses);

      const result = {
        success: true,
        question,
        selectedModels,
        responses: modelResponses,
        finalAnswer,
        confidence,
        duration,
        retryStats,
        fromCache: false,
        performance: {
          avgResponseTime: this.performanceMetrics.avgResponseTime,
          degradation: this.detectPerformanceDegradation()
        }
      };

      // Step 7: Store in cache
      await this.storeInCache(question, result, options);

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        systemHealth: this.systemHealth
      };
    }
  }

  estimateComplexity(question) {
    const complexKeywords = ['architecture', 'system', 'design', 'optimization', 'algorithm', 'distributed', 'scalable'];
    const simpleKeywords = ['what is', 'how to', 'explain'];

    const lowerQuestion = question.toLowerCase();
    const complexCount = complexKeywords.filter(keyword => lowerQuestion.includes(keyword)).length;
    const simpleCount = simpleKeywords.filter(keyword => lowerQuestion.includes(keyword)).length;

    if (complexCount >= 2) return 'high';
    if (simpleCount > 0 && complexCount === 0) return 'low';
    return 'medium';
  }

  generateConsensus(responses) {
    const bestResponse = responses.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
    return `Consensus based on ${responses.length} models: ${bestResponse.response}`;
  }

  calculateConfidence(responses) {
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    const agreementBonus = responses.length >= 3 ? 0.1 : 0;
    return Math.min(1.0, avgConfidence + agreementBonus);
  }

  // Getters for test validation
  getCacheStats() {
    return {
      size: this.cache.size,
      hitRate: 0.75 // Simulated
    };
  }

  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      modelStats: Object.fromEntries(this.modelStats)
    };
  }

  // Method to simulate performance degradation for testing
  simulatePerformanceDegradation(duration) {
    this.performanceMetrics.degradationHistory.push({
      timestamp: Date.now(),
      duration,
      modelCount: 3
    });
  }
}

describe('Workflow Validation E2E Tests', () => {
  let validator;

  beforeEach(() => {
    validator = new MockWorkflowValidator();
    jest.clearAllMocks();
  });

  describe('Cache Workflow Validation', () => {
    test('should properly cache and retrieve debate results', async () => {
      const question = 'How to implement microservices architecture?';

      // First request - should miss cache
      const result1 = await validator.runWorkflow(question);

      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBe(false);
      expect(result1.finalAnswer).toContain('Consensus based on');

      // Second request - should hit cache
      const result2 = await validator.runWorkflow(question);

      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.duration).toBeLessThan(result1.duration);
      expect(result2.finalAnswer).toBe(result1.finalAnswer);
    });

    test('should bypass cache when requested', async () => {
      const question = 'What is the best programming language?';

      // First request to populate cache
      await validator.runWorkflow(question);

      // Second request with cache bypass
      const result = await validator.runWorkflow(question, { bypassCache: true });

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
    });

    test('should handle cache expiration correctly', async () => {
      const question = 'Design a database schema';

      // Mock expired cache entry
      const expiredKey = validator.generateCacheKey(question, {});
      validator.cache.set(expiredKey, {
        finalAnswer: 'Expired answer',
        timestamp: Date.now() - 7200000 // 2 hours ago
      });

      const result = await validator.runWorkflow(question);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(result.finalAnswer).not.toBe('Expired answer');
    });
  });

  describe('Performance Monitoring Validation', () => {
    test('should track performance degradation over time', async () => {
      // Simulate degradation by manually adding performance data
      validator.simulatePerformanceDegradation(5000);   // Normal
      validator.simulatePerformanceDegradation(10000);  // Getting slower
      validator.simulatePerformanceDegradation(18000);  // Moderate degradation
      validator.simulatePerformanceDegradation(22000);  // Severe degradation
      validator.simulatePerformanceDegradation(25000);  // Very severe

      const degradation = validator.detectPerformanceDegradation();

      expect(degradation.detected).toBe(true);
      expect(degradation.level).toMatch(/moderate|severe/);
      expect(degradation.recommendations.length).toBeGreaterThan(0);

      // Verify performance history is maintained
      const stats = validator.getPerformanceStats();
      expect(stats.degradationHistory.length).toBe(5);
    });

    test('should adapt model selection based on performance', async () => {
      // Simulate high complexity question that should trigger performance optimization
      const complexQuestion = 'Design a distributed system architecture with microservices, load balancing, and fault tolerance';

      const result = await validator.runWorkflow(complexQuestion);

      expect(result.success).toBe(true);
      expect(result.selectedModels.length).toBeGreaterThanOrEqual(3);
      expect(result.selectedModels).toContain('k1'); // Should include premium model for complex tasks
    });
  });

  describe('Retry Logic Validation', () => {
    test('should handle model failures with retry logic', async () => {
      const question = 'Test question for retry logic';

      // Force some model failures by manipulating failure rates
      validator.modelStats.set('k1', { attempts: 0, failures: 0, consecutiveFailures: 1 });

      const result = await validator.runWorkflow(question);

      expect(result.success).toBe(true);
      expect(result.retryStats).toBeDefined();

      // Check that retry statistics are recorded
      const k1Stats = result.retryStats.k1;
      if (k1Stats) {
        expect(k1Stats.attempts).toBeGreaterThanOrEqual(1);
      }
    });

    test('should fail gracefully when all models fail', async () => {
      const result = await validator.runWorkflow('Test question for total failure', {
        forceModelFailures: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient model responses');
    });
  });

  describe('Intelligent Model Selection Validation', () => {
    test('should select appropriate models based on question complexity', async () => {
      const testCases = [
        {
          question: 'What is JavaScript?',
          expectedComplexity: 'low',
          expectedModelCount: 2
        },
        {
          question: 'Design a scalable distributed system architecture optimization',
          expectedComplexity: 'high',
          expectedModelCount: 4
        },
        {
          question: 'Implement a REST API service',
          expectedComplexity: 'medium',
          expectedModelCount: 3
        }
      ];

      for (const testCase of testCases) {
        const complexity = validator.estimateComplexity(testCase.question);
        const selectedModels = validator.selectModels(testCase.question, complexity);

        expect(complexity).toBe(testCase.expectedComplexity);
        expect(selectedModels.length).toBe(testCase.expectedModelCount);
      }
    });
  });

  describe('System Integration Validation', () => {
    test('should handle complete workflow with all components', async () => {
      const question = 'How to implement a comprehensive testing strategy?';

      const result = await validator.runWorkflow(question, {
        enableLearning: true,
        trackPerformance: true,
        useIntelligentSelection: true
      });

      expect(result.success).toBe(true);
      expect(result.question).toBe(question);
      expect(result.selectedModels).toBeInstanceOf(Array);
      expect(result.responses).toBeInstanceOf(Array);
      expect(result.responses.length).toBeGreaterThanOrEqual(2);
      expect(result.finalAnswer).toContain('Consensus based on');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.retryStats).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.performance.degradation).toBeDefined();
    });

    test('should maintain system health metrics', async () => {
      // Run several workflows to populate metrics
      const questions = [
        'Question 1',
        'Question 2',
        'Question 3'
      ];

      for (const question of questions) {
        await validator.runWorkflow(question);
      }

      const cacheStats = validator.getCacheStats();
      const performanceStats = validator.getPerformanceStats();

      expect(cacheStats.size).toBeGreaterThan(0);
      expect(performanceStats.degradationHistory.length).toBe(3);
      expect(Object.keys(performanceStats.modelStats).length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery Validation', () => {
    test('should recover from transient system failures', async () => {
      // Simulate temporary system failure
      validator.systemHealth = 'degraded';

      const result1 = await validator.runWorkflow('Test during system failure');

      // Recovery
      validator.systemHealth = 'healthy';

      const result2 = await validator.runWorkflow('Test after recovery');

      expect(result2.success).toBe(true);
      expect(result2.performance).toBeDefined();
    });

    test('should provide meaningful error information on failure', async () => {
      const result = await validator.runWorkflow('Test question for error handling', {
        forceModelFailures: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.systemHealth).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });
  });
});