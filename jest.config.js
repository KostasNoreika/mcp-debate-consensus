/**
 * Jest Configuration - Optimized for ESM and Test Stability
 * Version 2.1 - Enhanced for reliable test execution
 */

export default {
  // Core ESM Configuration - removed preset
  testEnvironment: 'node',

  // ESM Support - Modern approach
  transform: {},

  // Module Resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Test Discovery
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js'
  ],

  // Test Environment Setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  globalTeardown: '<rootDir>/tests/teardown.js',

  // Performance and Stability
  maxWorkers: 1, // Single worker for stability
  testTimeout: 45000, // Increased timeout for complex operations

  // Force proper cleanup
  forceExit: false, // Let tests complete naturally
  detectOpenHandles: true, // Enable for debugging

  // Mock Configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Coverage Configuration
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
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Coverage Thresholds - Adjusted for stability
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },

  // Test Environment Variables
  testEnvironmentOptions: {
    // Disable experimental warnings
    NODE_OPTIONS: '--no-warnings'
  },

  // Global Variables
  globals: {
    __DEV__: false,
    __TEST__: true
  },

  // Reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'jest-junit.xml',
      suiteNameTemplate: '{filename}',
      titleTemplate: '{title}',
      classNameTemplate: '{classname}'
    }]
  ],

  // Error Handling
  errorOnDeprecated: false, // Disable for stability during migration

  // Test Patterns to Ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/',
    '/logs/',
    '/cache/',
    '/data/',
    '/coverage/'
  ],

  // Module Resolution - using default resolver

  // Verbose output control
  verbose: process.env.VERBOSE === 'true'
};