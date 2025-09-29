/**
 * Jest Test Setup
 * Global configuration and comprehensive cleanup for all tests
 */

import { jest } from '@jest/globals';

// Store original timer functions
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalSetImmediate = global.setImmediate;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;
const originalClearImmediate = global.clearImmediate;

// Track all timers and handles
const activeTimers = new Set();
const activeServers = new Set();
const activeProcesses = new Set();

// Override timer functions to track them
global.setTimeout = function(...args) {
  const timer = originalSetTimeout.apply(this, args);
  activeTimers.add(timer);
  return timer;
};

global.clearTimeout = function(timer) {
  activeTimers.delete(timer);
  return originalClearTimeout(timer);
};

// Similar for setInterval and setImmediate
global.setInterval = function(...args) {
  const timer = originalSetInterval.apply(this, args);
  activeTimers.add(timer);
  return timer;
};

global.clearInterval = function(timer) {
  activeTimers.delete(timer);
  return originalClearInterval(timer);
};

global.setImmediate = function(...args) {
  const timer = originalSetImmediate.apply(this, args);
  activeTimers.add(timer);
  return timer;
};

global.clearImmediate = function(timer) {
  activeTimers.delete(timer);
  return originalClearImmediate(timer);
};

// Global cleanup function
global.cleanupTests = async function() {
  // Clear all active timers
  for (const timer of activeTimers) {
    originalClearTimeout(timer);
    originalClearInterval(timer);
    originalClearImmediate(timer);
  }
  activeTimers.clear();

  // Close all servers
  for (const server of activeServers) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
  activeServers.clear();

  // Kill all child processes
  for (const proc of activeProcesses) {
    proc.kill('SIGTERM');
  }
  activeProcesses.clear();

  // Clear all Jest timers
  jest.clearAllTimers();
  jest.clearAllMocks();
  jest.restoreAllMocks();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Wait for next tick
  await new Promise(resolve => originalSetTimeout(resolve, 0));
};

// Global test configuration
global.testConfig = {
  timeout: 30000,
  retries: 2,
  verbose: process.env.NODE_ENV === 'test'
};

// Global mocks that apply to all tests
jest.unstable_mockModule('dotenv', () => ({
  config: jest.fn()
}));

// Mock console methods in tests to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

if (process.env.SILENT_TESTS) {
  global.console = {
    ...console,
    error: jest.fn((...args) => {
      // Only show errors in CI
      if (process.env.CI) {
        originalConsoleError(...args);
      }
    }),
    warn: jest.fn((...args) => {
      // Only show warnings in CI
      if (process.env.CI) {
        originalConsoleWarn(...args);
      }
    }),
    log: jest.fn((...args) => {
      // Only show logs when VERBOSE=true
      if (process.env.VERBOSE) {
        originalConsoleLog(...args);
      }
    })
  };
}

// Global test helpers
global.testHelpers = {
  async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => originalSetTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  async expectEventually(condition, timeout = 5000) {
    return this.waitFor(condition, timeout);
  },

  createMockResponse(overrides = {}) {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
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
      ...overrides
    };
  },

  async flushPromises() {
    return new Promise(resolve => originalSetTimeout(resolve, 0));
  }
};

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.OPENROUTER_API_KEY = 'test-api-key';
process.env.DEBATE_LEARNING_ENABLED = 'false';
process.env.TELEMETRY_DISABLED = 'true';

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  if (process.env.CI || process.env.VERBOSE) {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});

// Setup test environment
beforeAll(() => {
  // Set test timeout
  jest.setTimeout(30000);
});

// Cleanup after each test
afterEach(async () => {
  await global.cleanupTests();
});

// Final cleanup
afterAll(async () => {
  await global.cleanupTests();

  // Restore original console methods
  if (process.env.SILENT_TESTS) {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  }
});

// Export helpers
export { activeTimers, activeServers, activeProcesses };