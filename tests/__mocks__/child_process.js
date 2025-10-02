/**
 * Manual Mock for child_process (ESM)
 * Jest ESM requires manual mocks in __mocks__ directory
 */

import { jest } from '@jest/globals';
import EventEmitter from 'events';

// Create a mock spawn function
export const spawn = jest.fn(() => {
  const child = new EventEmitter();

  child.stdin = {
    write: jest.fn(),
    end: jest.fn()
  };

  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();

  // Default behavior: emit success after short delay
  setTimeout(() => {
    child.stdout.emit('data', Buffer.from('Mock Claude response'));
    child.emit('close', 0);
  }, 10);

  return child;
});

// Mock exec and other functions if needed
export const exec = jest.fn();
export const execSync = jest.fn();
export const fork = jest.fn();
export const spawnSync = jest.fn();

export default {
  spawn,
  exec,
  execSync,
  fork,
  spawnSync
};
