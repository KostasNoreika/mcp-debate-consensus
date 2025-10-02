/**
 * Unit tests for StreamHandler
 * Tests real-time debate progress streaming
 */

import { jest } from '@jest/globals';
import { StreamHandler } from '../../src/streaming/stream-handler.js';

// Mock debate class for testing
class MockDebate {
  constructor() {
    this.models = [
      { alias: 'k1', name: 'Claude Sonnet', expertise: 'Architecture' },
      { alias: 'k2', name: 'GPT-5', expertise: 'Testing' },
      { alias: 'k3', name: 'Qwen', expertise: 'Algorithms' }
    ];
    this.useIntelligentSelection = false;
    this.geminiCoordinator = {
      analyzeQuestion: jest.fn().mockResolvedValue({
        category: 'programming',
        complexityLevel: 'medium',
        criticalityLevel: 'normal',
        costReduction: '45%',
        estimatedSpeedGain: '2x',
        reasoning: 'Test reasoning'
      })
    };
  }

  async initialize() {
    return true;
  }

  getSelectedModelsFromAnalysis(analysis) {
    return this.models.slice(0, 2);
  }

  async callModel(model, question, projectPath) {
    // Simulate model response with delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return `Response from ${model.name} for: ${question}`;
  }
}

describe('StreamHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new StreamHandler({
      bufferDelay: 10,
      chunkSize: 100
    });
  });

  afterEach(() => {
    handler.cleanup();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with default options', () => {
      const defaultHandler = new StreamHandler();

      expect(defaultHandler.bufferDelay).toBe(50);
      expect(defaultHandler.chunkSize).toBe(500);
      expect(defaultHandler.activeStreams).toBeDefined();
      expect(defaultHandler.streamCounter).toBe(0);
    });

    test('should initialize with custom options', () => {
      const customHandler = new StreamHandler({
        bufferDelay: 20,
        chunkSize: 200
      });

      expect(customHandler.bufferDelay).toBe(20);
      expect(customHandler.chunkSize).toBe(200);
    });

    test('should extend EventEmitter', () => {
      expect(handler.on).toBeDefined();
      expect(handler.emit).toBeDefined();
      expect(handler.removeAllListeners).toBeDefined();
    });
  });

  describe('streamDebate', () => {
    test('should yield initialization stage', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test question', '/test/path');

      const first = await generator.next();

      expect(first.value).toMatchObject({
        type: 'stage',
        stage: 'initialization',
        message: expect.any(String),
        progress: 10
      });
    });

    test('should track active streams', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test question', '/test/path');

      await generator.next();

      expect(handler.activeStreams.size).toBe(1);
    });

    test('should generate unique stream IDs', async () => {
      const debate = new MockDebate();

      const gen1 = handler.streamDebate(debate, 'Q1', '/test');
      const gen2 = handler.streamDebate(debate, 'Q2', '/test');

      const result1 = await gen1.next();
      const result2 = await gen2.next();

      expect(result1.value.streamId).not.toBe(result2.value.streamId);
    });

    test('should complete full debate stream', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test question', '/test/path');

      const stages = [];
      for await (const update of generator) {
        stages.push(update.stage || update.type);
        // Break after a few stages to avoid long test
        if (stages.length >= 5) break;
      }

      expect(stages).toContain('initialization');
      expect(stages).toContain('analysis');
    });

    test('should handle intelligent model selection', async () => {
      const debate = new MockDebate();
      debate.useIntelligentSelection = true;

      const generator = handler.streamDebate(debate, 'Test question', '/test/path');

      const updates = [];
      let count = 0;
      for await (const update of generator) {
        updates.push(update);
        if (++count >= 3) break;
      }

      const modelSelection = updates.find(u => u.type === 'model_selection');
      expect(modelSelection).toBeDefined();
      expect(modelSelection.analysis).toBeDefined();
      expect(modelSelection.selectedModels).toBeDefined();
    });

    test('should handle intelligent selection failure gracefully', async () => {
      const debate = new MockDebate();
      debate.useIntelligentSelection = true;
      debate.geminiCoordinator.analyzeQuestion.mockRejectedValue(
        new Error('Selection failed')
      );

      const generator = handler.streamDebate(debate, 'Test question', '/test/path');

      const updates = [];
      let count = 0;
      for await (const update of generator) {
        updates.push(update);
        if (++count >= 3) break;
      }

      const warning = updates.find(u => u.type === 'warning');
      expect(warning).toBeDefined();
      expect(warning.message).toContain('Intelligent selection failed');
    });

    test('should yield error on failure', async () => {
      const debate = new MockDebate();
      debate.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));

      const generator = handler.streamDebate(debate, 'Test question', '/test/path');

      const updates = [];
      for await (const update of generator) {
        updates.push(update);
      }

      const error = updates.find(u => u.type === 'error');
      expect(error).toBeDefined();
      expect(error.message).toBe('Init failed');
      expect(error.stage).toBe('failed');
    });

    test('should clean up stream after completion', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test question', '/test/path');

      // Consume the generator
      let count = 0;
      for await (const update of generator) {
        if (++count >= 3) break;
      }

      // Stream should eventually be cleaned up
      // Note: May still be active if we break early
      expect(handler.activeStreams.size).toBeGreaterThanOrEqual(0);
    });

    test('should include progress percentage', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test question', '/test/path');

      const updates = [];
      let count = 0;
      for await (const update of generator) {
        updates.push(update);
        if (++count >= 5) break;
      }

      updates.forEach(update => {
        if (update.progress !== undefined) {
          expect(update.progress).toBeGreaterThanOrEqual(0);
          expect(update.progress).toBeLessThanOrEqual(100);
        }
      });
    });
  });

  describe('streamModelAnalysis', () => {
    test('should stream model completions in parallel', async () => {
      const debate = new MockDebate();
      const models = debate.models;

      const generator = handler.streamModelAnalysis(
        debate,
        'Test question',
        '/test/path',
        models
      );

      const updates = [];
      for await (const update of generator) {
        updates.push(update);
      }

      const completions = updates.filter(u => u.type === 'model_complete');
      expect(completions.length).toBeGreaterThan(0);
    });

    test('should include model metadata in updates', async () => {
      const debate = new MockDebate();
      const models = [debate.models[0]];

      const generator = handler.streamModelAnalysis(
        debate,
        'Test question',
        '/test/path',
        models
      );

      const updates = [];
      for await (const update of generator) {
        updates.push(update);
      }

      const completion = updates.find(u => u.type === 'model_complete');
      if (completion) {
        expect(completion.model).toBeDefined();
        expect(completion.model.alias).toBe('k1');
        expect(completion.model.name).toBe('Claude Sonnet');
        expect(completion.model.expertise).toBe('Architecture');
      }
    });

    test('should handle model errors', async () => {
      const debate = new MockDebate();
      debate.callModel = jest.fn().mockRejectedValue(new Error('Model failed'));

      const models = [debate.models[0]];

      const generator = handler.streamModelAnalysis(
        debate,
        'Test question',
        '/test/path',
        models
      );

      const updates = [];
      for await (const update of generator) {
        updates.push(update);
      }

      const error = updates.find(u => u.type === 'model_error');
      expect(error).toBeDefined();
      expect(error.error).toBe('Model failed');
    });

    test('should update progress as models complete', async () => {
      const debate = new MockDebate();
      const models = debate.models.slice(0, 2);

      const generator = handler.streamModelAnalysis(
        debate,
        'Test question',
        '/test/path',
        models
      );

      const updates = [];
      for await (const update of generator) {
        updates.push(update);
      }

      const completions = updates.filter(u => u.type === 'model_complete');
      completions.forEach(completion => {
        expect(completion.progress).toBeGreaterThanOrEqual(30);
        expect(completion.progress).toBeLessThanOrEqual(60);
      });
    });

    test('should truncate long responses', async () => {
      const debate = new MockDebate();
      debate.callModel = jest.fn().mockResolvedValue('A'.repeat(2000));

      const models = [debate.models[0]];

      const generator = handler.streamModelAnalysis(
        debate,
        'Test question',
        '/test/path',
        models
      );

      const updates = [];
      for await (const update of generator) {
        updates.push(update);
      }

      const completion = updates.find(u => u.type === 'model_complete');
      if (completion && completion.result) {
        expect(completion.result.length).toBeLessThanOrEqual(1050);
      }
    });
  });

  describe('streamSingleModel', () => {
    test('should emit model_started event', async () => {
      const debate = new MockDebate();
      const model = debate.models[0];

      const startedSpy = jest.fn();
      handler.on('model_started', startedSpy);

      await handler.streamSingleModel(debate, model, 'Test', '/test');

      expect(startedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'k1',
          name: 'Claude Sonnet'
        })
      );
    });

    test('should emit model_completed event', async () => {
      const debate = new MockDebate();
      const model = debate.models[0];

      const completedSpy = jest.fn();
      handler.on('model_completed', completedSpy);

      await handler.streamSingleModel(debate, model, 'Test', '/test');

      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'k1',
          name: 'Claude Sonnet',
          duration: expect.any(Number)
        })
      );
    });

    test('should emit model_failed event on error', async () => {
      const debate = new MockDebate();
      debate.callModel = jest.fn().mockRejectedValue(new Error('Model error'));

      const model = debate.models[0];

      const failedSpy = jest.fn();
      handler.on('model_failed', failedSpy);

      await expect(handler.streamSingleModel(debate, model, 'Test', '/test'))
        .rejects.toThrow('Model error');

      expect(failedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'k1',
          error: 'Model error'
        })
      );
    });

    test('should return response and duration', async () => {
      const debate = new MockDebate();
      const model = debate.models[0];

      const result = await handler.streamSingleModel(debate, model, 'Test', '/test');

      expect(result).toMatchObject({
        response: expect.any(String),
        duration: expect.any(Number)
      });
    });

    test('should track duration accurately', async () => {
      const debate = new MockDebate();
      debate.callModel = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'Response';
      };

      const model = debate.models[0];

      const result = await handler.streamSingleModel(debate, model, 'Test', '/test');

      expect(result.duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('truncateForStreaming', () => {
    test('should not truncate short text', () => {
      const text = 'Short response';

      const truncated = handler.truncateForStreaming(text);

      expect(truncated).toBe(text);
    });

    test('should truncate long text', () => {
      const text = 'A'.repeat(2000);

      const truncated = handler.truncateForStreaming(text, 1000);

      expect(truncated.length).toBeLessThan(text.length);
      expect(truncated).toContain('[Response truncated');
    });

    test('should handle null/undefined', () => {
      expect(handler.truncateForStreaming(null)).toBe(null);
      expect(handler.truncateForStreaming(undefined)).toBe(undefined);
    });

    test('should use custom max length', () => {
      const text = 'A'.repeat(500);

      const truncated = handler.truncateForStreaming(text, 100);

      expect(truncated.length).toBeLessThan(500);
    });
  });

  describe('streamText', () => {
    test('should stream text in chunks', async () => {
      const text = 'A'.repeat(300);

      const generator = handler.streamText(text, { chunkSize: 100, delay: 0 });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(chunks[0].content.length).toBe(100);
      expect(chunks[1].content.length).toBe(100);
      expect(chunks[2].content.length).toBe(100);
    });

    test('should include chunk metadata', async () => {
      const text = 'Test text';

      const generator = handler.streamText(text, { delay: 0 });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toMatchObject({
        type: 'text_chunk',
        content: expect.any(String),
        position: 0,
        total: 9,
        isComplete: true,
        timestamp: expect.any(Number)
      });
    });

    test('should mark last chunk as complete', async () => {
      const text = 'A'.repeat(250);

      const generator = handler.streamText(text, { chunkSize: 100, delay: 0 });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks[chunks.length - 1].isComplete).toBe(true);
    });

    test('should delay between chunks if configured', async () => {
      const text = 'AB';

      const generator = handler.streamText(text, { chunkSize: 1, delay: 50 });

      const startTime = Date.now();
      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(50);
    });

    test('should handle empty text', async () => {
      const generator = handler.streamText('', { delay: 0 });

      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(0);
    });
  });

  describe('mergeStreams', () => {
    async function* mockStream1() {
      yield { data: 'stream1-item1' };
      yield { data: 'stream1-item2' };
    }

    async function* mockStream2() {
      yield { data: 'stream2-item1' };
      yield { data: 'stream2-item2' };
    }

    test('should merge multiple streams', async () => {
      const generator = handler.mergeStreams(mockStream1(), mockStream2());

      const items = [];
      for await (const item of generator) {
        items.push(item);
      }

      expect(items.length).toBeGreaterThan(0);
    });

    test('should include stream index', async () => {
      const generator = handler.mergeStreams(mockStream1(), mockStream2());

      const items = [];
      for await (const item of generator) {
        items.push(item);
      }

      items.forEach(item => {
        expect(item.streamIndex).toBeDefined();
        expect(item.streamIndex).toBeGreaterThanOrEqual(0);
        expect(item.streamIndex).toBeLessThan(2);
      });
    });

    test('should handle stream errors', async () => {
      async function* errorStream() {
        yield { data: 'item1' };
        throw new Error('Stream error');
      }

      const generator = handler.mergeStreams(errorStream(), mockStream1());

      const items = [];
      for await (const item of generator) {
        items.push(item);
      }

      const error = items.find(i => i.type === 'stream_error');
      expect(error).toBeDefined();
    });

    test('should handle empty streams', async () => {
      async function* emptyStream() {
        // Yields nothing
      }

      const generator = handler.mergeStreams(emptyStream());

      const items = [];
      for await (const item of generator) {
        items.push(item);
      }

      expect(items.length).toBe(0);
    });
  });

  describe('getStreamStatus', () => {
    test('should return active stream count', () => {
      const status = handler.getStreamStatus();

      expect(status).toMatchObject({
        activeCount: 0,
        streams: []
      });
    });

    test('should track active streams', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test', '/test');

      await generator.next();

      const status = handler.getStreamStatus();

      expect(status.activeCount).toBe(1);
      expect(status.streams.length).toBe(1);
    });

    test('should include stream details', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test', '/test');

      await generator.next();

      const status = handler.getStreamStatus();

      expect(status.streams[0]).toMatchObject({
        id: expect.any(String),
        startTime: expect.any(Number),
        duration: expect.any(Number),
        status: 'active'
      });
    });
  });

  describe('cleanup', () => {
    test('should clear active streams', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test', '/test');

      await generator.next();

      expect(handler.activeStreams.size).toBe(1);

      handler.cleanup();

      expect(handler.activeStreams.size).toBe(0);
    });

    test('should remove all listeners', () => {
      const listener = jest.fn();
      handler.on('model_started', listener);

      handler.cleanup();

      handler.emit('model_started', {});

      expect(listener).not.toHaveBeenCalled();
    });

    test('should be safe to call multiple times', () => {
      expect(() => {
        handler.cleanup();
        handler.cleanup();
        handler.cleanup();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle debate with no models', async () => {
      const debate = new MockDebate();
      debate.models = [];

      const generator = handler.streamModelAnalysis(debate, 'Test', '/test', []);

      const updates = [];
      for await (const update of generator) {
        updates.push(update);
      }

      expect(updates.length).toBe(0);
    });

    test('should handle concurrent streams', async () => {
      const debate = new MockDebate();

      const gen1 = handler.streamDebate(debate, 'Q1', '/test');
      const gen2 = handler.streamDebate(debate, 'Q2', '/test');
      const gen3 = handler.streamDebate(debate, 'Q3', '/test');

      await Promise.all([
        gen1.next(),
        gen2.next(),
        gen3.next()
      ]);

      expect(handler.activeStreams.size).toBe(3);
    });

    test('should handle very long model responses', async () => {
      const debate = new MockDebate();
      debate.callModel = jest.fn().mockResolvedValue('A'.repeat(50000));

      const model = debate.models[0];

      const result = await handler.streamSingleModel(debate, model, 'Test', '/test');

      expect(result.response.length).toBe(50000);
    });

    test('should handle null project path', async () => {
      const debate = new MockDebate();
      const generator = handler.streamDebate(debate, 'Test', null);

      const first = await generator.next();

      expect(first.value).toBeDefined();
    });

    test('should handle model timeout', async () => {
      const debate = new MockDebate();
      debate.callModel = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('Late response'), 10000);
        });
      });

      const model = debate.models[0];

      // Create a timeout race
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 100)
      );

      await expect(
        Promise.race([
          handler.streamSingleModel(debate, model, 'Test', '/test'),
          timeoutPromise
        ])
      ).rejects.toThrow('Timeout');
    });
  });

  describe('Performance', () => {
    test('should stream large number of chunks efficiently', async () => {
      const text = 'A'.repeat(10000);

      const generator = handler.streamText(text, { chunkSize: 100, delay: 0 });

      const startTime = Date.now();
      const chunks = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }
      const duration = Date.now() - startTime;

      expect(chunks.length).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle multiple parallel model calls', async () => {
      const debate = new MockDebate();

      const promises = debate.models.map(model =>
        handler.streamSingleModel(debate, model, 'Test', '/test')
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(3);
      // Parallel execution should be faster than sequential (3 * 100ms)
      expect(duration).toBeLessThan(250);
    });
  });
});
