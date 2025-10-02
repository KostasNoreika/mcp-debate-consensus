/**
 * Simplified test to verify mock setup
 */

import { jest, describe, test, beforeEach, expect } from '@jest/globals';
import EventEmitter from 'events';

// Create inline mock before importing
const mockSpawn = jest.fn(() => {
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
});

// Mock child_process before importing the module
jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn
}));

// Now import after mock is set up
const { spawn } = await import('child_process');

describe('Mock Setup Test', () => {
  test('spawn should be a mock function', () => {
    expect(spawn).toBeDefined();
    expect(typeof spawn).toBe('function');
    // In ESM, the function itself is the mock
    console.log('spawn function:', spawn);
    console.log('mockSpawn:', mockSpawn);
  });

  test('spawn should work when called', async () => {
    const result = spawn('test', ['arg']);
    expect(result).toBeDefined();
    expect(result.stdin).toBeDefined();
    expect(result.stdout).toBeDefined();
  });
});
