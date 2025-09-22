/**
 * Stream Handler for Real-time Debate Progress
 *
 * Provides streaming responses for better user experience during long-running debates.
 * Uses async generators to emit progress updates as models think and respond.
 */

import { EventEmitter } from 'events';

export class StreamHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.bufferDelay = options.bufferDelay || 50; // ms between buffer flushes
    this.chunkSize = options.chunkSize || 500; // characters per chunk
    this.activeStreams = new Map();
    this.streamCounter = 0;
  }

  /**
   * Main streaming debate method using async generator
   */
  async *streamDebate(debate, question, projectPath) {
    const streamId = `stream_${++this.streamCounter}`;
    this.activeStreams.set(streamId, { started: Date.now(), status: 'active' });

    try {
      // Stage 1: Initialization
      yield {
        type: 'stage',
        stage: 'initialization',
        message: 'Selecting optimal models...',
        progress: 10,
        timestamp: Date.now(),
        streamId
      };

      // Initialize debate system
      await debate.initialize();

      // Intelligent model selection if enabled
      let selectedModels = debate.models;
      if (debate.useIntelligentSelection) {
        yield {
          type: 'stage',
          stage: 'model_selection',
          message: 'Analyzing question for optimal model selection...',
          progress: 20,
          timestamp: Date.now()
        };

        try {
          const selectionAnalysis = await debate.geminiCoordinator.analyzeQuestion(question, {
            projectPath,
            urgency: 0.5
          });
          selectedModels = debate.getSelectedModelsFromAnalysis(selectionAnalysis);

          yield {
            type: 'model_selection',
            analysis: {
              category: selectionAnalysis.category,
              complexity: selectionAnalysis.complexityLevel,
              criticality: selectionAnalysis.criticalityLevel,
              costReduction: selectionAnalysis.costReduction,
              speedGain: selectionAnalysis.estimatedSpeedGain,
              reasoning: selectionAnalysis.reasoning
            },
            selectedModels: selectedModels.map(m => ({
              name: m.name,
              alias: m.alias,
              expertise: m.expertise
            })),
            progress: 25,
            timestamp: Date.now()
          };
        } catch (error) {
          yield {
            type: 'warning',
            message: `Intelligent selection failed, using all models: ${error.message}`,
            timestamp: Date.now()
          };
        }
      }

      // Stage 2: Analysis Phase
      yield {
        type: 'stage',
        stage: 'analysis',
        message: 'Models analyzing question...',
        progress: 30,
        models: Object.fromEntries(
          selectedModels.map(m => [m.alias, 'thinking'])
        ),
        timestamp: Date.now()
      };

      // Stream model responses as they complete
      yield* this.streamModelAnalysis(debate, question, projectPath, selectedModels);

      // Stage 3: Evaluation
      yield {
        type: 'stage',
        stage: 'evaluation',
        message: 'Evaluating proposals...',
        progress: 60,
        timestamp: Date.now()
      };

      // Stage 4: Improvements
      yield {
        type: 'stage',
        stage: 'improvements',
        message: 'Collaborative improvements...',
        progress: 75,
        timestamp: Date.now()
      };

      // Stage 5: Synthesis
      yield {
        type: 'stage',
        stage: 'synthesis',
        message: 'Building consensus...',
        progress: 90,
        timestamp: Date.now()
      };

      // Stage 6: Complete
      yield {
        type: 'stage',
        stage: 'complete',
        message: 'Debate completed successfully!',
        progress: 100,
        timestamp: Date.now()
      };

    } catch (error) {
      yield {
        type: 'error',
        message: error.message,
        stage: 'failed',
        timestamp: Date.now(),
        streamId
      };
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Stream individual model analysis with real-time updates
   */
  async *streamModelAnalysis(debate, question, projectPath, models) {
    const modelPromises = new Map();
    const modelResults = new Map();
    const completedModels = new Set();

    // Start all models in parallel
    for (const model of models) {
      const promise = this.streamSingleModel(debate, model, question, projectPath);
      modelPromises.set(model.alias, promise);
    }

    // Stream updates as models complete
    while (completedModels.size < models.length) {
      for (const [alias, promise] of modelPromises) {
        if (!completedModels.has(alias)) {
          try {
            // Check if this model's promise has resolved
            const result = await Promise.race([
              promise,
              new Promise(resolve => setTimeout(() => resolve(null), 100))
            ]);

            if (result !== null) {
              completedModels.add(alias);
              modelResults.set(alias, result);

              const model = models.find(m => m.alias === alias);
              yield {
                type: 'model_complete',
                model: {
                  alias: model.alias,
                  name: model.name,
                  expertise: model.expertise
                },
                result: this.truncateForStreaming(result.response),
                duration: result.duration,
                progress: Math.round((completedModels.size / models.length) * 30) + 30, // 30-60%
                timestamp: Date.now()
              };
            }
          } catch (error) {
            completedModels.add(alias);
            const model = models.find(m => m.alias === alias);

            yield {
              type: 'model_error',
              model: {
                alias: model.alias,
                name: model.name
              },
              error: error.message,
              timestamp: Date.now()
            };
          }
        }
      }

      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return modelResults;
  }

  /**
   * Stream a single model's thinking process
   */
  async streamSingleModel(debate, model, question, projectPath) {
    const startTime = Date.now();

    // Emit model started
    this.emit('model_started', {
      model: model.alias,
      name: model.name,
      timestamp: startTime
    });

    try {
      const response = await debate.callModel(model, question, projectPath);
      const duration = Date.now() - startTime;

      this.emit('model_completed', {
        model: model.alias,
        name: model.name,
        duration,
        responseLength: response?.length || 0,
        timestamp: Date.now()
      });

      return { response, duration };
    } catch (error) {
      this.emit('model_failed', {
        model: model.alias,
        name: model.name,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Truncate response for streaming to prevent overwhelming the client
   */
  truncateForStreaming(response, maxLength = 1000) {
    if (!response || response.length <= maxLength) return response;

    return response.substring(0, maxLength) + '\n\n[Response truncated for streaming - full response available in final result]';
  }

  /**
   * Stream text content in chunks for progressive loading
   */
  async *streamText(text, options = {}) {
    const chunkSize = options.chunkSize || this.chunkSize;
    const delay = options.delay || this.bufferDelay;

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.substring(i, i + chunkSize);

      yield {
        type: 'text_chunk',
        content: chunk,
        position: i,
        total: text.length,
        isComplete: i + chunkSize >= text.length,
        timestamp: Date.now()
      };

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Create a stream merger for multiple async generators
   */
  async *mergeStreams(...streams) {
    const activeStreams = streams.map((stream, index) => ({
      stream: stream[Symbol.asyncIterator](),
      index,
      done: false
    }));

    while (activeStreams.some(s => !s.done)) {
      const promises = activeStreams
        .filter(s => !s.done)
        .map(async s => {
          try {
            const result = await s.stream.next();
            return { streamIndex: s.index, result };
          } catch (error) {
            return { streamIndex: s.index, error };
          }
        });

      if (promises.length === 0) break;

      const first = await Promise.race(promises);

      if (first.error) {
        yield {
          type: 'stream_error',
          streamIndex: first.streamIndex,
          error: first.error.message,
          timestamp: Date.now()
        };
        activeStreams[first.streamIndex].done = true;
      } else if (first.result.done) {
        activeStreams[first.streamIndex].done = true;
      } else {
        yield {
          ...first.result.value,
          streamIndex: first.streamIndex
        };
      }
    }
  }

  /**
   * Get status of active streams
   */
  getStreamStatus() {
    return {
      activeCount: this.activeStreams.size,
      streams: Array.from(this.activeStreams.entries()).map(([id, info]) => ({
        id,
        startTime: info.started,
        duration: Date.now() - info.started,
        status: info.status
      }))
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.activeStreams.clear();
    this.removeAllListeners();
  }
}