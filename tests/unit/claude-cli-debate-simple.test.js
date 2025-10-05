/**
 * Simplified test to verify mock setup
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import EventEmitter from 'events';

// Mock child_process BEFORE importing (required for ES modules)
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}));

// Import AFTER mock is set up
const { spawn } = await import('child_process');

// Helper to create mock child process
const createMockChild = () => {
  const child = new EventEmitter();
  child.stdin = { write: jest.fn(), end: jest.fn() };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();

  setTimeout(() => {
    child.stdout.emit('data', Buffer.from('Mock response'));
    child.emit('close', 0);
  }, 10);

  return child;
};

describe('Mock Setup Test', () => {
  beforeEach(() => {
    // Add implementation to spawn mock
    spawn.mockClear();
    spawn.mockImplementation(createMockChild);
  });

  test('spawn should be a mock function', () => {
    expect(spawn).toBeDefined();
    expect(typeof spawn).toBe('function');
    expect(spawn._isMockFunction).toBe(true);
  });

  test('spawn should work when called', async () => {
    const result = spawn('test', ['arg']);

    expect(result).toBeDefined();
    expect(result.stdin).toBeDefined();
    expect(result.stdout).toBeDefined();
  });
});
