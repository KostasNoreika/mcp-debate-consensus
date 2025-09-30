/**
 * Jest Test Setup - Enhanced for Stability
 * Comprehensive resource management and environment setup
 */

import { jest } from '@jest/globals';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Enhanced timer tracking with cleanup
class TimerTracker {
  constructor() {
    this.timers = new Set();
    this.intervals = new Set();
    this.timeouts = new Set();
    this.immediates = new Set();
    this.original = {
      setTimeout: global.setTimeout,
      setInterval: global.setInterval,
      setImmediate: global.setImmediate,
      clearTimeout: global.clearTimeout,
      clearInterval: global.clearInterval,
      clearImmediate: global.clearImmediate
    };
    this.setupTracking();
  }

  setupTracking() {
    // Override setTimeout
    global.setTimeout = (...args) => {
      const timer = this.original.setTimeout.apply(global, args);
      this.timers.add(timer);
      this.timeouts.add(timer);
      return timer;
    };

    // Override setInterval
    global.setInterval = (...args) => {
      const timer = this.original.setInterval.apply(global, args);
      this.timers.add(timer);
      this.intervals.add(timer);
      return timer;
    };

    // Override setImmediate
    global.setImmediate = (...args) => {
      const timer = this.original.setImmediate.apply(global, args);
      this.timers.add(timer);
      this.immediates.add(timer);
      return timer;
    };

    // Override clear functions
    global.clearTimeout = (timer) => {
      this.timers.delete(timer);
      this.timeouts.delete(timer);
      return this.original.clearTimeout(timer);
    };

    global.clearInterval = (timer) => {
      this.timers.delete(timer);
      this.intervals.delete(timer);
      return this.original.clearInterval(timer);
    };

    global.clearImmediate = (timer) => {
      this.timers.delete(timer);
      this.immediates.delete(timer);
      return this.original.clearImmediate(timer);
    };
  }

  cleanup() {
    // Clear all tracked timers
    for (const timer of this.timeouts) {
      this.original.clearTimeout(timer);
    }
    for (const timer of this.intervals) {
      this.original.clearInterval(timer);
    }
    for (const timer of this.immediates) {
      this.original.clearImmediate(timer);
    }

    this.timers.clear();
    this.intervals.clear();
    this.timeouts.clear();
    this.immediates.clear();
  }

  restore() {
    global.setTimeout = this.original.setTimeout;
    global.setInterval = this.original.setInterval;
    global.setImmediate = this.original.setImmediate;
    global.clearTimeout = this.original.clearTimeout;
    global.clearInterval = this.original.clearInterval;
    global.clearImmediate = this.original.clearImmediate;
  }
}

// Enhanced resource tracking
class ResourceTracker {
  constructor() {
    this.servers = new Set();
    this.processes = new Set();
    this.connections = new Set();
    this.streams = new Set();
  }

  addServer(server) {
    this.servers.add(server);
  }

  addProcess(process) {
    this.processes.add(process);
  }

  addConnection(connection) {
    this.connections.add(connection);
  }

  addStream(stream) {
    this.streams.add(stream);
  }

  async cleanup() {
    // Close all servers
    const serverPromises = Array.from(this.servers).map(server => {
      return new Promise((resolve) => {
        if (server && typeof server.close === 'function') {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    // Kill all processes
    for (const proc of this.processes) {
      if (proc && typeof proc.kill === 'function') {
        try {
          proc.kill('SIGTERM');
        } catch (error) {
          // Process might already be dead
        }
      }
    }

    // Close all connections
    for (const conn of this.connections) {
      if (conn && typeof conn.close === 'function') {
        try {
          conn.close();
        } catch (error) {
          // Connection might already be closed
        }
      }
    }

    // Close all streams
    for (const stream of this.streams) {
      if (stream && typeof stream.destroy === 'function') {
        try {
          stream.destroy();
        } catch (error) {
          // Stream might already be destroyed
        }
      }
    }

    await Promise.allSettled(serverPromises);

    this.servers.clear();
    this.processes.clear();
    this.connections.clear();
    this.streams.clear();
  }
}

// Initialize tracking systems
const timerTracker = new TimerTracker();
const resourceTracker = new ResourceTracker();

// Make trackers globally available
global.timerTracker = timerTracker;
global.resourceTracker = resourceTracker;

// Enhanced test cleanup function
global.cleanupTests = async function() {
  try {
    // Clear all timers
    timerTracker.cleanup();

    // Clean up all resources
    await resourceTracker.cleanup();

    // Clear Jest timers and mocks
    jest.clearAllTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Wait for event loop to clear
    await new Promise(resolve => setImmediate(resolve));
  } catch (error) {
    console.warn('Error during test cleanup:', error.message);
  }
};

// Test configuration
global.testConfig = {
  timeout: 45000,
  retries: 2,
  verbose: process.env.VERBOSE === 'true',
  silent: process.env.SILENT_TESTS === 'true'
};

// Enhanced test helpers
global.testHelpers = {
  async waitFor(condition, timeout = 10000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        if (await condition()) {
          return true;
        }
      } catch (error) {
        // Ignore errors in condition check
      }
      await new Promise(resolve => timerTracker.original.setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  async expectEventually(condition, timeout = 10000) {
    return this.waitFor(condition, timeout);
  },

  createMockResponse(overrides = {}) {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      ...overrides
    };
  },

  createMockRequest(overrides = {}) {
    return {
      method: 'GET',
      url: '/test',
      headers: {},
      body: {},
      ip: '127.0.0.1',
      params: {},
      query: {},
      ...overrides
    };
  },

  async flushPromises() {
    return new Promise(resolve => timerTracker.original.setTimeout(resolve, 0));
  },

  createTestDatabase() {
    const dbPath = join(__dirname, '../data/test-performance.db');
    return dbPath;
  },

  cleanupTestFiles() {
    // This will be called by teardown.js
    return true;
  }
};

// Setup test environment variables with better defaults
process.env.NODE_ENV = 'test';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-api-key';
process.env.DEBATE_LEARNING_ENABLED = 'false';
process.env.TELEMETRY_DISABLED = 'true';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.CACHE_ENABLED = 'false';
process.env.LOG_LEVEL = 'error'; // Minimize logging noise in tests

// Console management for cleaner test output
const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  info: console.info,
  debug: console.debug
};

if (global.testConfig.silent) {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
}

// Global error handlers
const unhandledRejections = new Set();
const originalUnhandledRejection = process.listeners('unhandledRejection');

process.removeAllListeners('unhandledRejection');
process.on('unhandledRejection', (reason, promise) => {
  unhandledRejections.add({ reason, promise });
  if (process.env.CI || process.env.VERBOSE) {
    originalConsole.error('Unhandled Rejection:', reason);
  }
});

process.on('uncaughtException', (error) => {
  if (process.env.CI || process.env.VERBOSE) {
    originalConsole.error('Uncaught Exception:', error);
  }
});

// Setup Jest hooks
beforeAll(async () => {
  jest.setTimeout(45000);

  // Ensure clean state
  await global.cleanupTests();
});

beforeEach(async () => {
  // Reset environment for each test
  jest.clearAllMocks();

  // Clear any accumulated unhandled rejections
  unhandledRejections.clear();
});

afterEach(async () => {
  await global.cleanupTests();

  // Check for unhandled rejections
  if (unhandledRejections.size > 0 && (process.env.CI || process.env.VERBOSE)) {
    originalConsole.warn(`Test left ${unhandledRejections.size} unhandled rejection(s)`);
    unhandledRejections.clear();
  }
});

afterAll(async () => {
  await global.cleanupTests();

  // Restore console
  if (global.testConfig.silent) {
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  }

  // Restore timers
  timerTracker.restore();

  // Restore original unhandled rejection listeners
  process.removeAllListeners('unhandledRejection');
  for (const listener of originalUnhandledRejection) {
    process.on('unhandledRejection', listener);
  }
});

// Export tracking utilities
export { timerTracker, resourceTracker };