/**
 * Jest Configuration
 * For testing the debate-consensus MCP server
 */

export default {
  // Use Node environment
  testEnvironment: 'node',

  // Transform ES modules
  transform: {},

  // Module name mapper for ES modules
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Use experimental VM modules for ESM support
  extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
  testEnvironmentOptions: {
    experimentalVMModules: true
  },

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    'k-proxy-server.js',
    'index.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**'
  ],

  coverageDirectory: 'coverage',

  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json',
    'json-summary'
  ],

  // Coverage thresholds - updated for 80%+ target
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Per-file thresholds for critical components
    'src/gemini-coordinator.js': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    },
    'src/cache/debate-cache.js': {
      branches: 80,
      functions: 85,
      lines: 80,
      statements: 80
    },
    'src/security.js': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/',
    '/logs/',
    '/cache/',
    '/data/'
  ],

  // Verbose output (can be controlled by environment)
  verbose: process.env.VERBOSE === 'true',

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Test timeout
  testTimeout: 30000,

  // Use only half of CPU cores to prevent resource exhaustion
  maxWorkers: '50%',

  // Force exit after tests complete to prevent hanging
  forceExit: true,

  // Detect open handles (set to true only for debugging)
  detectOpenHandles: false,

  // Reset mocks between tests
  resetMocks: true,

  // Global teardown
  globalTeardown: '<rootDir>/tests/teardown.js',


  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'jest-junit.xml'
    }]
  ],

  // Error handling
  errorOnDeprecated: true,

  // Force coverage collection from untested files
  forceCoverageMatch: [
    '**/src/**/*.js'
  ],

  // Global test environment
  globals: {
    __DEV__: false,
    __TEST__: true
  }
};