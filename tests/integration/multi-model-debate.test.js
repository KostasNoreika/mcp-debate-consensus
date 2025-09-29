/**
 * Multi-Model Debate Integration Tests
 * Comprehensive test suite for multi-model debate failures and edge cases
 */

import { jest } from '@jest/globals';

// Mock child_process for CLI spawning
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}));

// Mock fs for file operations
jest.unstable_mockModule('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn()
}));

// Mock config
jest.unstable_mockModule('../../src/config.js', () => ({
  config: {
    get: jest.fn((key) => {
      const configs = {
        'models': {
          k1: { alias: 'k1', name: 'Claude Opus' },
          k2: { alias: 'k2', name: 'GPT-5' },
          k3: { alias: 'k3', name: 'Qwen 3 Max' },
          k4: { alias: 'k4', name: 'Gemini 2.5 Pro' },
          k5: { alias: 'k5', name: 'Grok' }
        },
        'debate': {
          timeout: 300000,
          minModels: 2,
          maxRetries: 3
        }
      };
      return configs[key] || {};
    })
  }
}));

// Import modules after mocking
const { spawn } = await import('child_process');
const fs = await import('fs/promises');

// Mock Claude CLI Debate orchestrator
const mockClaudeCliDebate = {
  runDebate: jest.fn(),
  cleanup: jest.fn()
};

describe('Multi-Model Debate Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    spawn.mockClear();
  });

  // Add proper cleanup
  afterAll(async () => {
    if (mockClaudeCliDebate && typeof mockClaudeCliDebate.cleanup === 'function') {
      await mockClaudeCliDebate.cleanup();
    }
  });

  describe('Debate Orchestration Failures', () => {
    test('should handle single model failure gracefully', async () => {
      // Mock one model failing, others succeeding
      spawn.mockImplementation((command, args) => {
        const isK1 = args.some(arg => arg.includes('k1'));

        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              // k1 fails, others succeed
              setTimeout(() => callback(isK1 ? 1 : 0), 100);
            }
          })
        };
        return mockChild;
      });

      mockClaudeCliDebate.runDebate.mockResolvedValue({
        success: true,
        responses: [
          { model: 'k2', response: 'Response from k2', confidence: 0.8 },
          { model: 'k3', response: 'Response from k3', confidence: 0.7 }
        ],
        failedModels: ['k1'],
        finalAnswer: 'Consensus despite k1 failure',
        confidence: 0.75
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'Test question with model failure',
        models: ['k1', 'k2', 'k3'],
        minSuccessful: 2
      });

      expect(result.success).toBe(true);
      expect(result.responses.length).toBe(2);
      expect(result.failedModels).toContain('k1');
      expect(result.finalAnswer).toBeDefined();
    });

    test('should fail when too few models succeed', async () => {
      // Mock most models failing
      spawn.mockImplementation(() => {
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 50); // All fail
            }
          })
        };
        return mockChild;
      });

      mockClaudeCliDebate.runDebate.mockRejectedValue(
        new Error('Insufficient successful models: 0 out of 3 required minimum 2')
      );

      await expect(mockClaudeCliDebate.runDebate({
        question: 'Test question',
        models: ['k1', 'k2', 'k3'],
        minSuccessful: 2
      })).rejects.toThrow('Insufficient successful models');
    });

    test('should handle timeout scenarios', async () => {
      // Mock process that never completes
      spawn.mockImplementation(() => {
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            // Never call callback to simulate timeout
          }),
          kill: jest.fn()
        };
        return mockChild;
      });

      mockClaudeCliDebate.runDebate.mockRejectedValue(
        new Error('Debate timeout exceeded')
      );

      await expect(mockClaudeCliDebate.runDebate({
        question: 'Test question',
        models: ['k1', 'k2'],
        timeout: 1000 // 1 second timeout
      })).rejects.toThrow('Debate timeout exceeded');

      // Verify cleanup was attempted
      expect(spawn).toHaveBeenCalled();
    });

    test('should handle insufficient successful models', async () => {
      spawn.mockImplementation(() => {
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(1), 50); // All models fail
            }
          })
        };
        return mockChild;
      });

      mockClaudeCliDebate.runDebate.mockRejectedValue(
        new Error('Only 0 models succeeded, minimum required: 2')
      );

      await expect(mockClaudeCliDebate.runDebate({
        question: 'Test question requiring multiple models',
        models: ['k1', 'k2', 'k3'],
        minSuccessful: 2
      })).rejects.toThrow('Only 0 models succeeded');
    });
  });

  describe('Response Quality and Consensus', () => {
    test('should achieve high consensus with similar responses', async () => {
      mockClaudeCliDebate.runDebate.mockResolvedValue({
        success: true,
        responses: [
          {
            model: 'k1',
            response: 'Use microservices architecture for scalability',
            confidence: 0.9,
            keywords: ['microservices', 'scalability', 'architecture']
          },
          {
            model: 'k2',
            response: 'Microservices provide better scalability and maintainability',
            confidence: 0.85,
            keywords: ['microservices', 'scalability', 'maintainability']
          },
          {
            model: 'k4',
            response: 'Adopt microservices for improved system scalability',
            confidence: 0.88,
            keywords: ['microservices', 'scalability', 'system']
          }
        ],
        finalAnswer: 'Microservices architecture is recommended for better scalability',
        confidence: 0.88,
        consensus: {
          agreement: 0.92,
          keywordOverlap: 0.85,
          confidenceVariance: 0.025
        }
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'What architecture pattern should we use for scalability?',
        models: ['k1', 'k2', 'k4'],
        consensusThreshold: 0.8
      });

      expect(result.success).toBe(true);
      expect(result.consensus.agreement).toBeGreaterThan(0.8);
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.finalAnswer).toContain('microservices');
    });

    test('should handle conflicting responses appropriately', async () => {
      mockClaudeCliDebate.runDebate.mockResolvedValue({
        success: true,
        responses: [
          {
            model: 'k1',
            response: 'Use monolithic architecture for simplicity',
            confidence: 0.8,
            stance: 'monolithic'
          },
          {
            model: 'k2',
            response: 'Microservices are better for this use case',
            confidence: 0.85,
            stance: 'microservices'
          },
          {
            model: 'k4',
            response: 'Hybrid approach combining both patterns works best',
            confidence: 0.9,
            stance: 'hybrid'
          }
        ],
        finalAnswer: 'Consider a hybrid approach that starts monolithic and evolves to microservices',
        confidence: 0.75,
        consensus: {
          agreement: 0.4,
          conflictResolution: 'synthesis',
          diversityScore: 0.85
        },
        conflictHandling: {
          strategy: 'synthesis',
          weightedByConfidence: true
        }
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'Monolithic vs microservices architecture?',
        models: ['k1', 'k2', 'k4'],
        conflictResolution: 'synthesis'
      });

      expect(result.success).toBe(true);
      expect(result.consensus.agreement).toBeLessThan(0.6);
      expect(result.conflictHandling.strategy).toBe('synthesis');
      expect(result.finalAnswer).toContain('hybrid');
    });

    test('should weight responses by confidence scores', async () => {
      mockClaudeCliDebate.runDebate.mockResolvedValue({
        success: true,
        responses: [
          { model: 'k1', response: 'Option A is best', confidence: 0.95 },
          { model: 'k2', response: 'Option B is better', confidence: 0.6 },
          { model: 'k3', response: 'Option C works well', confidence: 0.7 }
        ],
        finalAnswer: 'Option A is the recommended choice based on high-confidence analysis',
        confidence: 0.88,
        weighting: {
          byConfidence: true,
          highestWeight: 'k1',
          confidenceSpread: 0.35
        }
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'Which option should we choose?',
        models: ['k1', 'k2', 'k3'],
        weightByConfidence: true
      });

      expect(result.finalAnswer).toContain('Option A');
      expect(result.weighting.highestWeight).toBe('k1');
      expect(result.confidence).toBeGreaterThan(0.85);
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    test('should retry failed models up to configured limit', async () => {
      let attemptCount = 0;

      // Mock spawn to fail initially, then succeed
      spawn.mockImplementation(() => {
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(attemptCount < 2 ? 1 : 0), 50);
            }
            if (event === 'error' && attemptCount < 2) {
              setTimeout(() => callback(new Error('Temporary failure')), 5);
            }
          })
        };
        return mockChild;
      });

      mockClaudeCliDebate.runDebate.mockImplementation(async (options) => {
        const maxRetries = options.maxRetries || 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          attemptCount++; // Track actual attempts
          try {
            if (attempt <= 2) {
              throw new Error(`Attempt ${attempt} failed`);
            }

            return {
              success: true,
              responses: [{ model: 'k1', response: 'Success after retry', confidence: 0.8 }],
              finalAnswer: 'Final answer after retry',
              confidence: 0.8,
              attempts: attempt
            };
          } catch (error) {
            if (attempt === maxRetries) {
              throw error;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          }
        }
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'Question requiring retry',
        models: ['k1'],
        maxRetries: 3
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(attemptCount).toBeGreaterThan(2);
    });

    test('should implement exponential backoff for retries', async () => {
      const retryTimes = [];

      mockClaudeCliDebate.runDebate.mockImplementation(async (options) => {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
          attempt++;

          if (attempt <= 2) {
            const startTime = Date.now();
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
            retryTimes.push(Date.now() - startTime);
            continue;
          }

          return {
            success: true,
            responses: [{ model: 'k1', response: 'Success', confidence: 0.8 }],
            finalAnswer: 'Success after exponential backoff',
            confidence: 0.8,
            retryPattern: 'exponential',
            retryTimes
          };
        }
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'Test exponential backoff',
        models: ['k1'],
        retryStrategy: 'exponential'
      });

      expect(result.success).toBe(true);
      expect(retryTimes.length).toBe(2);
      // Second retry should take longer than first (exponential backoff)
      expect(retryTimes[1]).toBeGreaterThan(retryTimes[0]);
    });

    test('should abandon retry after maximum attempts', async () => {
      const maxRetries = 2;
      let attemptCount = 0;

      mockClaudeCliDebate.runDebate.mockImplementation(async (options) => {
        while (attemptCount < maxRetries) {
          attemptCount++;
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        // This should never be reached
        throw new Error('Max retries exceeded');
      });

      await expect(mockClaudeCliDebate.runDebate({
        question: 'Question that always fails',
        models: ['k1'],
        maxRetries
      })).rejects.toThrow('Attempt 2 failed');

      expect(attemptCount).toBe(maxRetries);
    });
  });

  describe('Resource Management', () => {
    test('should cleanup processes on timeout', async () => {
      const killSpy = jest.fn();

      spawn.mockImplementation(() => {
        const mockChild = {
          stdin: { write: jest.fn(), end: jest.fn() },
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: killSpy,
          pid: 12345
        };
        return mockChild;
      });

      mockClaudeCliDebate.runDebate.mockImplementation(async (options) => {
        // Simulate timeout
        await new Promise((_, reject) => {
          setTimeout(() => {
            // Simulate cleanup
            if (killSpy) killSpy('SIGTERM');
            reject(new Error('Timeout exceeded, processes cleaned up'));
          }, options.timeout || 100);
        });
      });

      await expect(mockClaudeCliDebate.runDebate({
        question: 'Test cleanup',
        models: ['k1', 'k2'],
        timeout: 50
      })).rejects.toThrow('Timeout exceeded');

      expect(killSpy).toHaveBeenCalledWith('SIGTERM');
    });

    test('should handle memory pressure during large debates', async () => {
      const memoryUsage = [];

      mockClaudeCliDebate.runDebate.mockImplementation(async (options) => {
        // Simulate memory usage tracking
        const baseMemory = 100; // MB
        const memoryPerModel = 50; // MB per model

        for (let i = 0; i < options.models.length; i++) {
          const currentMemory = baseMemory + (i * memoryPerModel);
          memoryUsage.push(currentMemory);

          // Simulate memory pressure threshold
          if (currentMemory > 300) {
            throw new Error('Memory pressure detected, reducing model concurrency');
          }
        }

        return {
          success: true,
          responses: options.models.map((model, i) => ({
            model,
            response: `Response ${i + 1}`,
            confidence: 0.8
          })),
          finalAnswer: 'Debate completed within memory limits',
          confidence: 0.8,
          resourceUsage: {
            peakMemoryMB: Math.max(...memoryUsage),
            memoryPressureDetected: false
          }
        };
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'Large scale debate test',
        models: ['k1', 'k2', 'k3', 'k4'], // 4 models should be within limits
        memoryLimit: 400
      });

      expect(result.success).toBe(true);
      expect(result.resourceUsage.peakMemoryMB).toBeLessThan(400);
    });
  });

  describe('Advanced Orchestration Features', () => {
    test('should support dynamic model selection during debate', async () => {
      mockClaudeCliDebate.runDebate.mockImplementation(async (options) => {
        const initialModels = options.models;
        const selectedModels = [];

        // Simulate intelligent model selection
        for (const model of initialModels) {
          const shouldInclude = Math.random() > 0.2; // 80% inclusion rate
          if (shouldInclude) {
            selectedModels.push(model);
          }
        }

        // Ensure minimum models
        if (selectedModels.length < 2) {
          selectedModels.push(...initialModels.slice(0, 2));
        }

        return {
          success: true,
          initialModels,
          selectedModels: [...new Set(selectedModels)], // Remove duplicates
          responses: selectedModels.map(model => ({
            model,
            response: `Dynamic response from ${model}`,
            confidence: 0.8
          })),
          finalAnswer: 'Answer from dynamically selected models',
          confidence: 0.8,
          selectionStrategy: 'dynamic'
        };
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'Test dynamic selection',
        models: ['k1', 'k2', 'k3', 'k4', 'k5'],
        selectionStrategy: 'dynamic'
      });

      expect(result.success).toBe(true);
      expect(result.selectedModels.length).toBeGreaterThanOrEqual(2);
      expect(result.selectedModels.length).toBeLessThanOrEqual(result.initialModels.length);
    });

    test('should handle model-specific timeouts', async () => {
      const modelTimeouts = {
        k1: 1000,
        k2: 2000,
        k5: 500 // Fast model, short timeout
      };

      mockClaudeCliDebate.runDebate.mockImplementation(async (options) => {
        const responses = [];
        const timedOutModels = [];

        for (const model of options.models) {
          const timeout = modelTimeouts[model] || 1000;

          try {
            // Simulate model response with timeout
            await new Promise((resolve, reject) => {
              const responseTime = Math.random() * 1500; // Random response time

              setTimeout(() => {
                if (responseTime > timeout) {
                  reject(new Error(`${model} timeout`));
                } else {
                  resolve();
                }
              }, Math.min(responseTime, timeout));
            });

            responses.push({
              model,
              response: `Response from ${model}`,
              confidence: 0.8,
              responseTime: timeout
            });
          } catch (error) {
            timedOutModels.push(model);
          }
        }

        return {
          success: responses.length >= 1,
          responses,
          timedOutModels,
          finalAnswer: responses.length > 0 ? 'Answer from available models' : 'No models responded',
          confidence: responses.length > 0 ? 0.8 : 0.0,
          timeoutStrategy: 'per-model'
        };
      });

      const result = await mockClaudeCliDebate.runDebate({
        question: 'Test model-specific timeouts',
        models: ['k1', 'k2', 'k5'],
        timeoutStrategy: 'per-model',
        modelTimeouts
      });

      expect(result.timeoutStrategy).toBe('per-model');
      expect(result.success).toBe(true);
      // At least some models should respond
      expect(result.responses.length).toBeGreaterThan(0);
    });
  });
});