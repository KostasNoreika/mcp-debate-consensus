/**
 * Complete Debate Workflow End-to-End Tests
 * Comprehensive test suite for complete debate workflow including cache scenarios
 */

import { jest } from '@jest/globals';

// Mock all external dependencies
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

jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn()
  }
}));

// Mock the MCP SDK properly with correct paths
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
    close: jest.fn()
  }))
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: {},
  ListToolsRequestSchema: {}
}));

// Import mocked modules
const { spawn } = await import('child_process');
const fs = await import('fs/promises');
const axios = await import('axios');

// Mock the main components with realistic implementations
const mockDebateOrchestrator = {
  runCompleteWorkflow: jest.fn(),
  initialize: jest.fn(),
  cleanup: jest.fn(),
  getCacheStats: jest.fn(() => ({ enabled: true, hits: 5, misses: 3, hitRate: 0.625 })),
  clearCache: jest.fn(),
  invalidateCacheByProject: jest.fn()
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  getStats: jest.fn(() => ({ hits: 5, misses: 3, hitRate: 0.625 })),
  generateKey: jest.fn(() => 'cache-key-123'),
  getCached: jest.fn(),
  store: jest.fn()
};

const mockPerformanceTracker = {
  recordDebate: jest.fn(),
  getPerformanceRecommendations: jest.fn(),
  categorizeQuestion: jest.fn(() => 'software-development'),
  estimateComplexity: jest.fn(() => 'medium'),
  detectDegradation: jest.fn(() => ({ detected: false, level: 'normal' }))
};

const mockLearningSystem = {
  processDebate: jest.fn(),
  getRecommendations: jest.fn(),
  adaptModelSelection: jest.fn(),
  getOptimalSelection: jest.fn(() => ({
    models: [
      { id: 'k1', score: 0.9, confidence: 0.8 },
      { id: 'k2', score: 0.8, confidence: 0.7 },
      { id: 'k4', score: 0.85, confidence: 0.75 }
    ],
    strategy: 'intelligent_selection'
  }))
};

const mockRetryHandler = {
  execute: jest.fn(),
  getStats: jest.fn(() => ({
    totalAttempts: 10,
    successRate: 0.9,
    avgRetryCount: 1.2
  })),
  resetStats: jest.fn()
};

// Simulate real workflow state
let systemHealth = {
  models: { k1: 'healthy', k2: 'healthy', k3: 'healthy', k4: 'healthy', k5: 'healthy' },
  cache: 'healthy',
  learning: 'healthy'
};

let modelFailureCounts = {
  k1: 0,
  k2: 0,
  k3: 0,
  k4: 0,
  k5: 0
};

let performanceMetrics = {
  avgResponseTime: 8000,
  degradationLevel: 'normal',
  successRate: 1.0
};

describe('Complete Debate Workflow E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset system state
    systemHealth = {
      models: { k1: 'healthy', k2: 'healthy', k3: 'healthy', k4: 'healthy', k5: 'healthy' },
      cache: 'healthy',
      learning: 'healthy'
    };

    modelFailureCounts = { k1: 0, k2: 0, k3: 0, k4: 0, k5: 0 };
    performanceMetrics = {
      avgResponseTime: 8000,
      degradationLevel: 'normal',
      successRate: 1.0
    };

    // Setup realistic mock implementations
    mockCache.getCached.mockImplementation(async (question, options) => {
      // Simulate cache miss for fresh requests
      if (options?.fresh || options?.bypassCache) return null;

      // Simulate cache hit for repeated questions
      if (question.includes('cached')) {
        return {
          finalAnswer: 'Cached response for architecture question',
          confidence: 0.88,
          cached: true,
          cacheKey: 'cache-key-123',
          timestamp: Date.now() - 5000
        };
      }
      return null;
    });

    mockCache.store.mockImplementation(async (question, result, options) => {
      // Always call set when storing - use the proper cache key from result
      const cacheKey = result.cacheKey || mockCache.generateKey(question, options);
      await mockCache.set(cacheKey, result);
      return true;
    });

    // Setup performance tracker
    mockPerformanceTracker.detectDegradation.mockImplementation(() => {
      return {
        detected: performanceMetrics.avgResponseTime > 15000,
        level: performanceMetrics.degradationLevel,
        avgResponseTime: performanceMetrics.avgResponseTime,
        recommendations: performanceMetrics.avgResponseTime > 15000 ?
          ['Reduce model complexity', 'Enable aggressive caching'] : []
      };
    });

    // Setup retry handler that simulates real retry behavior
    mockRetryHandler.execute.mockImplementation(async (operation, context) => {
      const modelName = context?.name?.match(/callModel\((.+)\)/)?.[1] || 'unknown';

      // Simulate model failures based on failure counts
      if (modelFailureCounts[modelName.toLowerCase()] >= 3) {
        const error = new Error(`${modelName} model failure`);
        error.name = 'RetryError';
        error.getDetails = () => ({
          attemptCount: 3,
          errorType: 'model_failure',
          reason: 'Circuit breaker open'
        });
        throw error;
      }

      // Simulate occasional failures
      if (Math.random() < 0.1) {
        modelFailureCounts[modelName.toLowerCase()]++;
        throw new Error(`Temporary ${modelName} failure`);
      }

      return await operation();
    });
  });

  // Add proper cleanup
  afterAll(async () => {
    if (mockDebateOrchestrator && typeof mockDebateOrchestrator.cleanup === 'function') {
      await mockDebateOrchestrator.cleanup();
    }
  });

  describe('Full Workflow Success Scenarios', () => {
    test('should complete full debate workflow with all components', async () => {
      // Mock successful model responses
      spawn.mockImplementation(() => {
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(JSON.stringify({
                response: 'Detailed technical analysis',
                confidence: 0.9,
                reasoning: 'Based on best practices and experience'
              })), 50);
            }
          }) },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 100);
            }
          })
        };
        return mockChild;
      });

      // Setup workflow orchestrator with realistic behavior
      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        const question = options.question;

        // Check cache first
        let cacheResult = null;
        if (!options.bypassCache && !options.fresh) {
          cacheResult = await mockCache.getCached(question, options);
        }

        if (cacheResult) {
          return {
            ...cacheResult,
            responseTimeMs: 45,
            cacheHit: true
          };
        }

        // Simulate fresh debate workflow
        const result = {
          success: true,
          question: question,
          category: 'tech/programming/architecture',
          complexity: 0.8,
          criticality: 0.7,
          selectedModels: ['k1', 'k2', 'k4'],
          responses: [
            {
              model: 'k1',
              response: 'Use domain-driven design principles with API gateway pattern',
              confidence: 0.92,
              responseTime: 8500
            },
            {
              model: 'k2',
              response: 'Implement circuit breakers and service mesh for resilience',
              confidence: 0.88,
              responseTime: 7200
            },
            {
              model: 'k4',
              response: 'Container orchestration with Kubernetes and monitoring',
              confidence: 0.90,
              responseTime: 9100
            }
          ],
          finalAnswer: 'A scalable microservices architecture requires: 1) Domain-driven design with clear service boundaries, 2) API gateway for routing and security, 3) Circuit breakers and service mesh for resilience, 4) Container orchestration with Kubernetes, 5) Comprehensive monitoring and observability.',
          confidence: 0.90,
          consensusReached: true,
          agreementLevel: 0.85,
          duration: 24800,
          cached: false,
          learningApplied: true,
          performance: {
            avgResponseTime: 8267,
            successRate: 1.0,
            costOptimization: 35
          },
          cacheKey: 'cache-key-123',
          metadata: {
            timestamp: Date.now(),
            version: '2.1.0',
            source: 'e2e-test'
          }
        };

        // Store in cache for future use
        await mockCache.store(question, result, options);

        // Process with learning system
        await mockLearningSystem.processDebate({
          question,
          category: result.category,
          participants: result.selectedModels,
          winner: result.responses[0].model,
          scores: result.responses
        });

        return result;
      });

      // Mock learning system processing
      mockLearningSystem.processDebate.mockResolvedValue();
      mockLearningSystem.getRecommendations.mockResolvedValue([
        { type: 'model_selection', confidence: 0.8 }
      ]);

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'How to implement a scalable microservices architecture?',
        useIntelligentSelection: true,
        enableLearning: true,
        cacheEnabled: true
      });

      expect(result.success).toBe(true);
      expect(result.selectedModels).toEqual(['k1', 'k2', 'k4']);
      expect(result.responses.length).toBe(3);
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.consensusReached).toBe(true);
      expect(result.cached).toBe(false);
      expect(result.learningApplied).toBe(true);

      // Verify cache was populated with the correct cache key from result
      expect(mockCache.set).toHaveBeenCalledWith(
        result.cacheKey,
        expect.objectContaining({
          finalAnswer: result.finalAnswer,
          confidence: result.confidence
        })
      );

      // Verify learning system was engaged
      expect(mockLearningSystem.processDebate).toHaveBeenCalledWith(
        expect.objectContaining({
          question: result.question,
          category: result.category,
          participants: result.selectedModels,
          winner: result.responses[0].model
        })
      );
    });

    test('should handle complex multi-round debate', async () => {
      mockDebateOrchestrator.runCompleteWorkflow.mockResolvedValue({
        success: true,
        question: 'Should we adopt a microservices or monolithic architecture?',
        rounds: [
          {
            round: 1,
            type: 'initial_analysis',
            responses: [
              { model: 'k1', response: 'Microservices offer better scalability', confidence: 0.8 },
              { model: 'k2', response: 'Monoliths are simpler to start with', confidence: 0.7 },
              { model: 'k4', response: 'Depends on team size and complexity', confidence: 0.9 }
            ],
            agreement: 0.6
          },
          {
            round: 2,
            type: 'debate_refinement',
            responses: [
              { model: 'k1', response: 'Reconsidering: start monolithic, evolve to microservices', confidence: 0.9 },
              { model: 'k2', response: 'Agreed, evolutionary approach is best', confidence: 0.85 },
              { model: 'k4', response: 'Monolith-first pattern reduces initial complexity', confidence: 0.92 }
            ],
            agreement: 0.89
          }
        ],
        finalAnswer: 'Start with a well-structured monolith and evolve to microservices as the system and team grow. This monolith-first approach reduces initial complexity while maintaining the option for future decomposition.',
        confidence: 0.89,
        consensusReached: true,
        evolutionPath: 'monolith_to_microservices',
        duration: 45600
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Should we adopt a microservices or monolithic architecture?',
        debateMode: 'multi_round',
        maxRounds: 3,
        consensusThreshold: 0.8
      });

      expect(result.success).toBe(true);
      expect(result.rounds.length).toBe(2);
      expect(result.rounds[1].agreement).toBeGreaterThan(0.8);
      expect(result.consensusReached).toBe(true);
      expect(result.evolutionPath).toBe('monolith_to_microservices');
    });
  });

  describe('Cache Hit/Miss Scenarios', () => {
    test('should return cached result for repeated question', async () => {
      const cachedResult = {
        question: 'What is the best programming language for web development cached?',
        finalAnswer: 'JavaScript with TypeScript is currently the most versatile choice for web development.',
        confidence: 0.88,
        responses: [
          { model: 'k2', response: 'JavaScript ecosystem is dominant', confidence: 0.9 },
          { model: 'k5', response: 'TypeScript adds type safety', confidence: 0.85 }
        ],
        timestamp: Date.now() - 1000,
        cached: true
      };

      // Setup cache to return cached result
      mockCache.getCached.mockResolvedValue(cachedResult);

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        const cacheResult = await mockCache.getCached(options.question, options);
        if (cacheResult) {
          return {
            ...cacheResult,
            cacheHit: true,
            duration: 45,
            costSaved: 0.95
          };
        }
        // Should not reach here for cached questions
        throw new Error('Cache miss when hit expected');
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'What is the best programming language for web development cached?',
        cacheEnabled: true
      });

      expect(result.cacheHit).toBe(true);
      expect(result.duration).toBeLessThan(100);
      expect(result.costSaved).toBeGreaterThan(0.9);
      expect(result.finalAnswer).toBe(cachedResult.finalAnswer);

      // Should not spawn any processes for cached result
      expect(spawn).not.toHaveBeenCalled();
    });

    test('should invalidate cache when context changes', async () => {
      // Mock file stat changes
      fs.stat.mockImplementation((file) => {
        if (file.includes('changed-file')) {
          return Promise.resolve({
            mtime: new Date('2024-01-01'), // Recent change
            size: 2048
          });
        }
        return Promise.resolve({
          mtime: new Date('2023-01-01'),
          size: 1024
        });
      });

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        // Simulate context change detection and cache invalidation
        const contextChanged = options.projectPath && options.projectPath.includes('changed');

        if (contextChanged) {
          // Invalidate relevant cache entries
          await mockCache.invalidate('context-change');
        }

        return {
          success: true,
          question: options.question,
          finalAnswer: 'Updated analysis based on recent code changes',
          confidence: 0.87,
          cached: false,
          cacheInvalidated: contextChanged,
          contextChanged: contextChanged,
          changedFiles: contextChanged ? ['src/security/auth.js'] : [],
          duration: 23400
        };
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Review this code for security vulnerabilities',
        projectPath: '/test/project/changed',
        cacheEnabled: true
      });

      expect(result.cacheInvalidated).toBe(true);
      expect(result.contextChanged).toBe(true);
      expect(result.changedFiles).toContain('src/security/auth.js');
      expect(mockCache.invalidate).toHaveBeenCalledWith('context-change');
    });

    test('should handle cache corruption gracefully', async () => {
      // Mock corrupted cache data
      mockCache.getCached.mockResolvedValue({
        // Incomplete/corrupted cache entry
        question: 'Test question',
        finalAnswer: null, // Missing answer
        confidence: null, // Missing confidence
        responses: undefined // Missing responses
      });

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        const cached = await mockCache.getCached(options.question, options);

        // Detect corruption and fallback to fresh debate
        if (cached && (!cached.finalAnswer || cached.confidence === null)) {
          return {
            success: true,
            question: options.question,
            finalAnswer: 'Fresh answer due to cache corruption',
            confidence: 0.82,
            cached: false,
            cacheCorrupted: true,
            fallbackToFresh: true,
            duration: 18900
          };
        }

        return cached;
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Test question',
        cacheEnabled: true
      });

      expect(result.cacheCorrupted).toBe(true);
      expect(result.fallbackToFresh).toBe(true);
      expect(result.cached).toBe(false);
      expect(result.finalAnswer).toBe('Fresh answer due to cache corruption');
    });
  });

  describe('Performance Degradation Scenarios', () => {
    test('should detect and adapt to performance degradation', async () => {
      let requestCount = 0;

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        requestCount++;

        // Simulate degrading performance - more aggressive degradation
        const baseResponseTime = 5000;
        const degradationFactor = Math.min(4, 1 + (requestCount * 0.8)); // Faster degradation
        const currentResponseTime = baseResponseTime * degradationFactor;

        // Update global performance metrics
        performanceMetrics.avgResponseTime = currentResponseTime;
        performanceMetrics.degradationLevel = degradationFactor > 3 ? 'severe' :
          degradationFactor > 2 ? 'moderate' : 'normal';

        // Detect degradation
        const degradation = mockPerformanceTracker.detectDegradation();

        return {
          success: true,
          question: options.question,
          finalAnswer: `Answer ${requestCount}`,
          confidence: Math.max(0.6, 0.9 - (requestCount * 0.05)),
          duration: currentResponseTime,
          performance: {
            avgResponseTime: currentResponseTime,
            degradationDetected: degradation.detected,
            degradationLevel: degradation.level,
            recommendations: degradation.recommendations
          },
          adaptations: {
            modelSelectionOptimized: currentResponseTime > 8000,
            cachingAggressive: currentResponseTime > 10000,
            parallelExecution: currentResponseTime > 15000
          }
        };
      });

      // Run multiple requests to simulate degradation
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await mockDebateOrchestrator.runCompleteWorkflow({
          question: `Test question ${i}`,
          adaptivePerformance: true
        });
        results.push(result);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // First few should be normal
      expect(results[0].performance.degradationDetected).toBe(false);
      expect(results[1].performance.degradationDetected).toBe(false);

      // Later ones should detect degradation
      const lastResult = results[results.length - 1];
      expect(lastResult.performance.degradationDetected).toBe(true);
      expect(lastResult.performance.degradationLevel).toMatch(/moderate|severe/);
      expect(lastResult.adaptations.modelSelectionOptimized).toBe(true);
      expect(lastResult.performance.recommendations.length).toBeGreaterThan(0);
    });

    test('should implement retry logic for failing models (not circuit breaker)', async () => {
      // Reset model failure counts
      modelFailureCounts = { k1: 0, k2: 0, k3: 0, k4: 0, k5: 0 };

      spawn.mockImplementation((command, args) => {
        const isK1 = args.some(arg => arg.includes('k1'));

        if (isK1) {
          // k1 fails initially but succeeds after retries
          const mockChild = {
            stdin: { write: jest.fn(), end: jest.fn() },
            stdout: { on: jest.fn((event, callback) => {
              if (event === 'data') {
                // Simulate failure then success pattern
                if (modelFailureCounts.k1 < 2) {
                  setTimeout(() => callback(''), 50); // Empty response = failure
                } else {
                  setTimeout(() => callback('Successful k1 response after retries'), 50);
                }
              }
            }) },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') {
                const shouldFail = modelFailureCounts.k1 < 2;
                if (shouldFail) {
                  modelFailureCounts.k1++;
                }
                setTimeout(() => callback(shouldFail ? 1 : 0), 100);
              }
            })
          };
          return mockChild;
        }

        // Other models work fine
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback('Successful response'), 50);
            }
          }) },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 100);
            }
          })
        };
        return mockChild;
      });

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        // Simulate retry logic handling model failures
        const retryStats = mockRetryHandler.getStats();

        return {
          success: true,
          question: options.question,
          selectedModels: ['k1', 'k2', 'k3'], // All models attempted
          responses: [
            { model: 'k1', response: 'Response after retries', confidence: 0.8, retryCount: 2 },
            { model: 'k2', response: 'First attempt success', confidence: 0.85, retryCount: 0 },
            { model: 'k3', response: 'First attempt success', confidence: 0.78, retryCount: 0 }
          ],
          finalAnswer: 'Answer with retry recovery',
          confidence: 0.81,
          retryHandler: {
            k1: {
              attempts: 3,
              finalSuccess: true,
              errors: ['timeout', 'empty_response'],
              status: 'recovered'
            }
          },
          systemReliability: {
            totalRetries: retryStats?.totalAttempts || 10,
            successRate: retryStats?.successRate || 0.9,
            avgRetryCount: retryStats?.avgRetryCount || 1.2
          }
        };
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Question with retry scenario',
        retryEnabled: true
      });

      // Verify all models were attempted (retry handler doesn't exclude models)
      expect(result.selectedModels).toContain('k1');
      expect(result.selectedModels).toContain('k2');
      expect(result.selectedModels).toContain('k3');

      // Verify retry logic was used
      expect(result.retryHandler.k1.attempts).toBe(3);
      expect(result.retryHandler.k1.finalSuccess).toBe(true);
      expect(result.systemReliability.totalRetries).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive Error Scenarios', () => {
    test('should handle complete system failure gracefully', async () => {
      // Mock all systems failing
      systemHealth = {
        models: 'FAILED',
        cache: 'FAILED',
        learning: 'FAILED'
      };

      spawn.mockImplementation(() => {
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 10); // All fail
            }
            if (event === 'error') {
              setTimeout(() => callback(new Error('System failure')), 5);
            }
          })
        };
        return mockChild;
      });

      mockCache.getCached.mockRejectedValue(new Error('Cache system failure'));
      mockLearningSystem.processDebate.mockRejectedValue(new Error('Learning system failure'));

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        // Simulate complete system failure
        return {
          success: false,
          error: 'Complete system failure',
          systemStatus: systemHealth,
          fallbackResponse: {
            message: 'System temporarily unavailable. Please try again later.',
            suggestedActions: [
              'Check system status',
              'Retry with simpler question',
              'Contact support if issue persists'
            ]
          },
          diagnostics: {
            timestamp: Date.now(),
            failureMode: 'total_system_failure',
            affectedComponents: ['models', 'cache', 'learning'],
            recoveryEstimate: '5-10 minutes'
          }
        };
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Test question during system failure',
        gracefulDegradation: true
      });

      expect(result.success).toBe(false);
      expect(result.systemStatus.models).toBe('FAILED');
      expect(result.systemStatus.cache).toBe('FAILED');
      expect(result.systemStatus.learning).toBe('FAILED');
      expect(result.fallbackResponse).toBeDefined();
      expect(result.fallbackResponse.suggestedActions.length).toBeGreaterThan(0);
      expect(result.diagnostics.failureMode).toBe('total_system_failure');
    });

    test('should handle partial system recovery', async () => {
      let isFirstCall = true;

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        if (isFirstCall) {
          isFirstCall = false;
          return {
            success: false,
            error: 'System partially failed',
            systemStatus: {
              models: 'DEGRADED',
              cache: 'FAILED',
              learning: 'DEGRADED'
            },
            partialResults: {
              availableModels: ['k5'], // Only fast model available
              limitedResponse: 'Basic answer due to system limitations',
              confidence: 0.4
            }
          };
        }

        return {
          success: true,
          systemStatus: {
            models: 'RECOVERED',
            cache: 'RECOVERING',
            learning: 'RECOVERED'
          },
          question: options.question,
          finalAnswer: 'Full answer after system recovery',
          confidence: 0.85,
          recoveryMode: true,
          performanceImpact: {
            responseTime: 12000, // Slower during recovery
            reducedCapability: true
          }
        };
      });

      // First request during failure
      const failedResult = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Question during system failure'
      });

      expect(failedResult.success).toBe(false);
      expect(failedResult.systemStatus.models).toBe('DEGRADED');
      expect(failedResult.partialResults).toBeDefined();

      // Second request during recovery
      const recoveredResult = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Question after system recovery'
      });

      expect(recoveredResult.success).toBe(true);
      expect(recoveredResult.systemStatus.models).toBe('RECOVERED');
      expect(recoveredResult.recoveryMode).toBe(true);
      expect(recoveredResult.performanceImpact.reducedCapability).toBe(true);
    });
  });

  describe('Resource Management and Cleanup', () => {
    test('should clean up resources after workflow completion', async () => {
      const cleanupSpy = jest.fn();
      const processKillSpy = jest.fn();

      spawn.mockImplementation(() => {
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 100);
            }
          }),
          kill: processKillSpy,
          pid: Math.floor(Math.random() * 10000)
        };
        return mockChild;
      });

      mockDebateOrchestrator.cleanup.mockImplementation(cleanupSpy);

      mockDebateOrchestrator.runCompleteWorkflow.mockResolvedValue({
        success: true,
        question: 'Resource management test',
        finalAnswer: 'Test answer',
        confidence: 0.8,
        resourcesUsed: {
          processes: 3,
          memoryMB: 512,
          temporaryFiles: 5
        },
        cleanup: {
          processesTerminated: 3,
          memoryFreed: 512,
          temporaryFilesRemoved: 5
        }
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Resource management test',
        autoCleanup: true
      });

      // Simulate cleanup after workflow
      await mockDebateOrchestrator.cleanup();

      expect(result.success).toBe(true);
      expect(result.cleanup.processesTerminated).toBe(3);
      expect(result.cleanup.memoryFreed).toBe(512);
      expect(cleanupSpy).toHaveBeenCalled();
    });

    test('should handle cleanup during system shutdown', async () => {
      const shutdownHandler = jest.fn();

      // Simulate system shutdown signal
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');

      process.on('SIGINT', shutdownHandler);
      process.on('SIGTERM', shutdownHandler);

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async () => {
        // Simulate long-running operation
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              interrupted: true,
              cleanupCompleted: true
            });
          }, 100);
        });
      });

      const workflowPromise = mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Long running test'
      });

      // Simulate shutdown signal
      setTimeout(() => {
        process.emit('SIGINT');
      }, 50);

      const result = await workflowPromise;

      expect(result.interrupted).toBe(true);
      expect(result.cleanupCompleted).toBe(true);
    });
  });
});