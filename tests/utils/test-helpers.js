/**
 * Test Utilities and Helpers
 * Common utilities for testing the debate-consensus system
 */

import { jest } from '@jest/globals';

/**
 * Mock model response generator
 */
export class MockModelResponseGenerator {
  constructor() {
    this.responsePatterns = {
      technical: [
        'Implement using microservices architecture with API gateway',
        'Use containerization with Docker and Kubernetes orchestration',
        'Apply SOLID principles and clean architecture patterns',
        'Implement comprehensive testing including unit, integration, and e2e tests'
      ],
      business: [
        'Focus on ROI and cost-benefit analysis',
        'Consider market positioning and competitive advantage',
        'Implement agile methodologies for faster iteration',
        'Prioritize user experience and customer satisfaction'
      ],
      creative: [
        'Think outside the box with innovative approaches',
        'Consider user-centered design principles',
        'Explore emerging technologies and trends',
        'Balance creativity with practical constraints'
      ]
    };
  }

  generateResponse(category = 'technical', confidence = 0.8) {
    const patterns = this.responsePatterns[category] || this.responsePatterns.technical;
    const response = patterns[Math.floor(Math.random() * patterns.length)];

    return {
      response,
      confidence: Math.max(0.1, Math.min(1.0, confidence + (Math.random() - 0.5) * 0.2)),
      timestamp: Date.now(),
      responseTime: Math.floor(Math.random() * 5000) + 2000 // 2-7 seconds
    };
  }

  generateModelSet(models, category = 'technical') {
    return models.map(model => ({
      model,
      ...this.generateResponse(category),
      modelSpecific: this.getModelSpecificResponse(model, category)
    }));
  }

  getModelSpecificResponse(model, category) {
    const modelResponses = {
      k1: {
        technical: 'Architectural perspective: Focus on system design and scalability',
        business: 'Strategic analysis: Long-term vision and enterprise considerations',
        creative: 'Innovative framework: Systematic approach to creative problem-solving'
      },
      k2: {
        technical: 'Testing perspective: Comprehensive QA and debugging strategies',
        business: 'Operational excellence: Process optimization and quality control',
        creative: 'Iterative refinement: Test-driven creative development'
      },
      k3: {
        technical: 'Algorithmic optimization: Performance and efficiency focus',
        business: 'Data-driven decisions: Analytics and metrics optimization',
        creative: 'Mathematical elegance: Structured approach to creative solutions'
      },
      k4: {
        technical: 'Integration perspective: Holistic system coordination',
        business: 'Comprehensive coordination: Multi-stakeholder alignment',
        creative: 'Synthesis approach: Combining diverse creative elements'
      },
      k5: {
        technical: 'Rapid prototyping: Quick implementation and validation',
        business: 'Agile execution: Fast iteration and market feedback',
        creative: 'Rapid ideation: Quick exploration of creative possibilities'
      }
    };

    return modelResponses[model]?.[category] || `Standard ${model} response for ${category}`;
  }
}

/**
 * Mock network conditions simulator
 */
export class NetworkConditionSimulator {
  constructor() {
    this.conditions = {
      normal: { latency: 50, jitter: 10, packetLoss: 0 },
      slow: { latency: 500, jitter: 100, packetLoss: 0.01 },
      unstable: { latency: 200, jitter: 300, packetLoss: 0.05 },
      offline: { latency: 0, jitter: 0, packetLoss: 1.0 }
    };
    this.currentCondition = 'normal';
  }

  setCondition(condition) {
    if (this.conditions[condition]) {
      this.currentCondition = condition;
    }
  }

  simulateRequest(baseDelay = 1000) {
    const condition = this.conditions[this.currentCondition];

    if (Math.random() < condition.packetLoss) {
      throw new Error('Network timeout - packet loss');
    }

    const totalDelay = baseDelay + condition.latency + (Math.random() * condition.jitter);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < condition.packetLoss / 2) {
          reject(new Error('Connection interrupted'));
        } else {
          resolve({ success: true, delay: totalDelay });
        }
      }, totalDelay);
    });
  }
}

/**
 * Time manipulation utilities for testing
 */
export class TimeController {
  constructor() {
    this.originalSetTimeout = global.setTimeout;
    this.originalClearTimeout = global.clearTimeout;
    this.originalDate = global.Date;
    this.mockTime = Date.now();
    this.timeouts = new Map();
    this.timeoutId = 1;
  }

  useFakeTimers() {
    global.setTimeout = jest.fn((callback, delay) => {
      const id = this.timeoutId++;
      this.timeouts.set(id, {
        callback,
        executeAt: this.mockTime + (delay || 0)
      });
      return id;
    });

    global.clearTimeout = jest.fn((id) => {
      this.timeouts.delete(id);
    });

    global.Date = jest.fn(() => new Date(this.mockTime));
    global.Date.now = jest.fn(() => this.mockTime);
  }

  restoreTimers() {
    global.setTimeout = this.originalSetTimeout;
    global.clearTimeout = this.originalClearTimeout;
    global.Date = this.originalDate;
  }

  advanceTime(ms) {
    this.mockTime += ms;

    // Execute any timeouts that should have fired
    for (const [id, timeout] of this.timeouts.entries()) {
      if (timeout.executeAt <= this.mockTime) {
        timeout.callback();
        this.timeouts.delete(id);
      }
    }
  }

  advanceToNextTimeout() {
    if (this.timeouts.size === 0) return;

    const nextTimeout = Math.min(...Array.from(this.timeouts.values()).map(t => t.executeAt));
    this.advanceTime(nextTimeout - this.mockTime);
  }
}

/**
 * Memory usage tracker for testing
 */
export class MemoryTracker {
  constructor() {
    this.snapshots = [];
    this.baseline = this.getMemoryUsage();
  }

  getMemoryUsage() {
    if (process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        rss: usage.rss,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        timestamp: Date.now()
      };
    }
    return { rss: 0, heapUsed: 0, heapTotal: 0, external: 0, timestamp: Date.now() };
  }

  takeSnapshot(label = '') {
    const snapshot = {
      label,
      usage: this.getMemoryUsage(),
      deltaFromBaseline: {}
    };

    Object.keys(this.baseline).forEach(key => {
      if (key !== 'timestamp') {
        snapshot.deltaFromBaseline[key] = snapshot.usage[key] - this.baseline[key];
      }
    });

    this.snapshots.push(snapshot);
    return snapshot;
  }

  getReport() {
    return {
      baseline: this.baseline,
      snapshots: this.snapshots,
      peakUsage: this.snapshots.reduce((peak, snapshot) => {
        const current = snapshot.usage;
        return {
          rss: Math.max(peak.rss, current.rss),
          heapUsed: Math.max(peak.heapUsed, current.heapUsed),
          heapTotal: Math.max(peak.heapTotal, current.heapTotal)
        };
      }, { rss: 0, heapUsed: 0, heapTotal: 0 })
    };
  }

  detectMemoryLeaks(threshold = 50 * 1024 * 1024) { // 50MB threshold
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest) return false;

    return latest.deltaFromBaseline.heapUsed > threshold;
  }
}

/**
 * Mock file system operations
 */
export class MockFileSystem {
  constructor() {
    this.files = new Map();
    this.directories = new Set();
  }

  writeFile(path, content) {
    this.files.set(path, {
      content,
      mtime: new Date(),
      size: content.length
    });
    return Promise.resolve();
  }

  readFile(path) {
    const file = this.files.get(path);
    if (!file) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return Promise.resolve(file.content);
  }

  stat(path) {
    const file = this.files.get(path);
    if (!file) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    return Promise.resolve({
      mtime: file.mtime,
      size: file.size,
      isFile: () => true,
      isDirectory: () => false
    });
  }

  mkdir(path) {
    this.directories.add(path);
    return Promise.resolve();
  }

  access(path) {
    if (this.files.has(path) || this.directories.has(path)) {
      return Promise.resolve();
    }
    throw new Error(`ENOENT: no such file or directory, access '${path}'`);
  }

  exists(path) {
    return this.files.has(path) || this.directories.has(path);
  }

  clear() {
    this.files.clear();
    this.directories.clear();
  }

  getFileCount() {
    return this.files.size;
  }

  getTotalSize() {
    return Array.from(this.files.values()).reduce((total, file) => total + file.size, 0);
  }
}

/**
 * Performance measurement utilities
 */
export class PerformanceMeasurer {
  constructor() {
    this.measurements = new Map();
  }

  start(label) {
    this.measurements.set(label, {
      startTime: performance.now(),
      endTime: null,
      duration: null
    });
  }

  end(label) {
    const measurement = this.measurements.get(label);
    if (!measurement) {
      throw new Error(`No measurement started for label: ${label}`);
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    return measurement.duration;
  }

  getDuration(label) {
    const measurement = this.measurements.get(label);
    return measurement?.duration || null;
  }

  getAllMeasurements() {
    return Object.fromEntries(
      Array.from(this.measurements.entries()).map(([label, measurement]) => [
        label,
        {
          duration: measurement.duration,
          completed: measurement.endTime !== null
        }
      ])
    );
  }

  clear() {
    this.measurements.clear();
  }

  assertDurationBelow(label, threshold) {
    const duration = this.getDuration(label);
    if (duration === null) {
      throw new Error(`No completed measurement found for label: ${label}`);
    }
    if (duration > threshold) {
      throw new Error(`Performance assertion failed: ${label} took ${duration}ms, expected < ${threshold}ms`);
    }
  }
}

/**
 * Chaos testing utilities
 */
export class ChaosSimulator {
  constructor() {
    this.failures = {
      network: false,
      disk: false,
      memory: false,
      cpu: false
    };
    this.failureRates = {
      network: 0,
      disk: 0,
      memory: 0,
      cpu: 0
    };
  }

  enableFailure(type, rate = 0.1) {
    if (this.failures.hasOwnProperty(type)) {
      this.failures[type] = true;
      this.failureRates[type] = rate;
    }
  }

  disableFailure(type) {
    if (this.failures.hasOwnProperty(type)) {
      this.failures[type] = false;
      this.failureRates[type] = 0;
    }
  }

  shouldFail(type) {
    return this.failures[type] && Math.random() < this.failureRates[type];
  }

  simulateNetworkFailure() {
    if (this.shouldFail('network')) {
      throw new Error('Simulated network failure');
    }
  }

  simulateDiskFailure() {
    if (this.shouldFail('disk')) {
      throw new Error('Simulated disk I/O failure');
    }
  }

  simulateMemoryPressure() {
    if (this.shouldFail('memory')) {
      throw new Error('Simulated out of memory');
    }
  }

  simulateCpuOverload() {
    if (this.shouldFail('cpu')) {
      // Simulate CPU overload with busy wait
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait to simulate CPU load
      }
    }
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  generateQuestion(category = 'technical', complexity = 'medium') {
    const questionTemplates = {
      technical: {
        simple: [
          'How do I fix this JavaScript error?',
          'What is the difference between var and let?',
          'How to create a REST API endpoint?'
        ],
        medium: [
          'How should I architect a scalable microservices system?',
          'What are the best practices for database optimization?',
          'How to implement secure authentication in a web application?'
        ],
        complex: [
          'Design a distributed system that can handle 1 million concurrent users with 99.99% uptime',
          'How to implement a real-time collaborative editing system like Google Docs?',
          'Design a fault-tolerant distributed database with ACID guarantees'
        ]
      },
      business: {
        simple: [
          'How to improve team productivity?',
          'What metrics should we track?',
          'How to prioritize feature development?'
        ],
        medium: [
          'How should we approach digital transformation in our organization?',
          'What is the best strategy for entering a new market?',
          'How to balance technical debt with feature development?'
        ],
        complex: [
          'Design a comprehensive digital transformation strategy for a traditional enterprise',
          'How to build a sustainable competitive advantage in a rapidly changing market?',
          'Create a framework for evaluating and prioritizing strategic initiatives'
        ]
      }
    };

    const templates = questionTemplates[category]?.[complexity] || questionTemplates.technical.medium;
    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateDebateScenario(options = {}) {
    const {
      questionCategory = 'technical',
      complexity = 'medium',
      modelCount = 3,
      expectedDuration = 30000,
      consensusExpected = true
    } = options;

    return {
      question: this.generateQuestion(questionCategory, complexity),
      models: this.selectRandomModels(modelCount),
      expectedOutcome: {
        success: true,
        consensusReached: consensusExpected,
        confidence: consensusExpected ? 0.8 + Math.random() * 0.2 : 0.5 + Math.random() * 0.3,
        duration: expectedDuration + (Math.random() - 0.5) * expectedDuration * 0.3
      },
      category: questionCategory,
      complexity
    };
  }

  selectRandomModels(count = 3) {
    const allModels = ['k1', 'k2', 'k3', 'k4', 'k5'];
    const shuffled = allModels.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, allModels.length));
  }

  generateLargeDataset(size = 100) {
    return Array.from({ length: size }, (_, index) => ({
      id: index,
      scenario: this.generateDebateScenario({
        questionCategory: ['technical', 'business', 'creative'][index % 3],
        complexity: ['simple', 'medium', 'complex'][Math.floor(index / 33) % 3],
        modelCount: 2 + (index % 4)
      })
    }));
  }
}

// Export all utilities
export const testHelpers = {
  MockModelResponseGenerator,
  NetworkConditionSimulator,
  TimeController,
  MemoryTracker,
  MockFileSystem,
  PerformanceMeasurer,
  ChaosSimulator,
  TestDataGenerator
};