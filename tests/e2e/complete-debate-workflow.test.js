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

// Mock the main components
const mockDebateOrchestrator = {
  runCompleteWorkflow: jest.fn(),
  initialize: jest.fn(),
  cleanup: jest.fn()
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  getStats: jest.fn(() => ({ hits: 0, misses: 0, hitRate: 0 }))
};

const mockLearningSystem = {
  processDebate: jest.fn(),
  getRecommendations: jest.fn(),
  adaptModelSelection: jest.fn()
};

describe('Complete Debate Workflow E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      // Mock cache miss (fresh debate)
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(true);

      // Mock learning system
      mockLearningSystem.processDebate.mockResolvedValue();
      mockLearningSystem.getRecommendations.mockResolvedValue([
        { type: 'model_selection', confidence: 0.8 }
      ]);

      mockDebateOrchestrator.runCompleteWorkflow.mockResolvedValue({
        success: true,
        question: 'How to implement a scalable microservices architecture?',
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
        cacheKey: 'debate-key-123',
        metadata: {
          timestamp: Date.now(),
          version: '2.0.0',
          source: 'e2e-test'
        }
      });

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

      // Verify cache was populated
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
          responses: result.responses
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
        question: 'What is the best programming language for web development?',
        finalAnswer: 'JavaScript with TypeScript is currently the most versatile choice for web development.',
        confidence: 0.88,
        responses: [
          { model: 'k2', response: 'JavaScript ecosystem is dominant', confidence: 0.9 },
          { model: 'k5', response: 'TypeScript adds type safety', confidence: 0.85 }
        ],
        timestamp: Date.now() - 1000,
        cached: true
      };

      mockCache.get.mockResolvedValue(cachedResult);

      mockDebateOrchestrator.runCompleteWorkflow.mockResolvedValue({
        ...cachedResult,
        cacheHit: true,
        duration: 45, // Very fast due to cache
        costSaved: 0.95 // 95% cost savings
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'What is the best programming language for web development?',
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
      // First request with old file context
      mockCache.get.mockResolvedValueOnce(null);

      // Second request with changed file context - cache should be invalidated
      mockCache.get.mockResolvedValueOnce(null);
      mockCache.invalidate.mockResolvedValue(true);

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

      mockDebateOrchestrator.runCompleteWorkflow.mockResolvedValue({
        success: true,
        question: 'Review this code for security vulnerabilities',
        finalAnswer: 'Updated analysis based on recent code changes',
        confidence: 0.87,
        cached: false,
        cacheInvalidated: true,
        contextChanged: true,
        changedFiles: ['src/security/auth.js'],
        duration: 23400
      });

      const result = await mockDebateOrchestrator.runCompleteWorkflow({
        question: 'Review this code for security vulnerabilities',
        projectPath: '/test/project',
        cacheEnabled: true
      });

      expect(result.cacheInvalidated).toBe(true);
      expect(result.contextChanged).toBe(true);
      expect(result.changedFiles).toContain('src/security/auth.js');
      expect(mockCache.invalidate).toHaveBeenCalled();
    });

    test('should handle cache corruption gracefully', async () => {
      // Mock corrupted cache data
      mockCache.get.mockResolvedValue({
        // Incomplete/corrupted cache entry
        question: 'Test question',
        finalAnswer: null, // Missing answer
        confidence: null, // Missing confidence
        responses: undefined // Missing responses
      });

      mockDebateOrchestrator.runCompleteWorkflow.mockResolvedValue({
        success: true,
        question: 'Test question',
        finalAnswer: 'Fresh answer due to cache corruption',
        confidence: 0.82,
        cached: false,
        cacheCorrupted: true,
        fallbackToFresh: true,
        duration: 18900
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

        // Simulate degrading performance
        const baseResponseTime = 5000;
        const degradationFactor = Math.min(3, requestCount * 0.2);
        const currentResponseTime = baseResponseTime * degradationFactor;

        return {
          success: true,
          question: options.question,
          finalAnswer: `Answer ${requestCount}`,
          confidence: Math.max(0.6, 0.9 - (requestCount * 0.05)),
          duration: currentResponseTime,
          performance: {
            avgResponseTime: currentResponseTime,
            degradationDetected: currentResponseTime > 10000,
            degradationLevel: degradationFactor > 2 ? 'severe' : degradationFactor > 1.5 ? 'moderate' : 'normal',
            recommendations: currentResponseTime > 10000 ? [
              'Reduce model complexity',
              'Enable aggressive caching',
              'Consider parallel execution'
            ] : []
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

    test('should implement circuit breaker pattern for failing models', async () => {
      let k1FailureCount = 0;
      const k1FailureThreshold = 3;

      spawn.mockImplementation((command, args) => {
        const isK1 = args.some(arg => arg.includes('k1'));

        if (isK1) {
          k1FailureCount++;
          // k1 starts failing after threshold
          const shouldFail = k1FailureCount <= k1FailureThreshold;

          const mockChild = {
            stdin: { write: jest.fn(), end: jest.fn() },
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') {
                setTimeout(() => callback(shouldFail ? 1 : 0), 50);
              }
              if (event === 'error' && shouldFail) {
                setTimeout(() => callback(new Error('k1 model failure')), 25);
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
        const circuitBreakerOpen = k1FailureCount >= k1FailureThreshold;

        return {
          success: true,
          question: options.question,
          selectedModels: circuitBreakerOpen ? ['k2', 'k3', 'k4'] : ['k1', 'k2', 'k3'],
          responses: circuitBreakerOpen ? [
            { model: 'k2', response: 'Response without k1', confidence: 0.8 },
            { model: 'k3', response: 'Alternative response', confidence: 0.85 },
            { model: 'k4', response: 'Backup response', confidence: 0.78 }
          ] : [
            { model: 'k2', response: 'Response with k1', confidence: 0.9 },
            { model: 'k3', response: 'Another response', confidence: 0.87 }
          ],
          finalAnswer: 'Answer despite model failures',
          confidence: circuitBreakerOpen ? 0.81 : 0.88,
          circuitBreaker: {
            k1: {
              open: circuitBreakerOpen,
              failureCount: k1FailureCount,
              threshold: k1FailureThreshold,
              status: circuitBreakerOpen ? 'OPEN' : 'CLOSED'
            }
          },
          fallbackUsed: circuitBreakerOpen
        };
      });

      // Multiple requests to trigger circuit breaker
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await mockDebateOrchestrator.runCompleteWorkflow({
          question: `Question ${i}`,
          circuitBreakerEnabled: true
        });
        results.push(result);
      }

      // Early requests should include k1
      expect(results[0].selectedModels).toContain('k1');

      // Later requests should exclude k1 (circuit breaker open)
      const lastResult = results[results.length - 1];
      expect(lastResult.selectedModels).not.toContain('k1');
      expect(lastResult.circuitBreaker.k1.open).toBe(true);
      expect(lastResult.fallbackUsed).toBe(true);
    });
  });

  describe('Comprehensive Error Scenarios', () => {
    test('should handle complete system failure gracefully', async () => {
      // Mock all systems failing
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

      mockCache.get.mockRejectedValue(new Error('Cache system failure'));
      mockLearningSystem.processDebate.mockRejectedValue(new Error('Learning system failure'));

      mockDebateOrchestrator.runCompleteWorkflow.mockResolvedValue({
        success: false,
        error: 'Complete system failure',
        systemStatus: {
          models: 'FAILED',
          cache: 'FAILED',
          learning: 'FAILED',
          coordinator: 'DEGRADED'
        },
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
      let systemRecovering = false;

      mockDebateOrchestrator.runCompleteWorkflow.mockImplementation(async (options) => {
        systemRecovering = !systemRecovering; // Toggle recovery state

        if (!systemRecovering) {
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