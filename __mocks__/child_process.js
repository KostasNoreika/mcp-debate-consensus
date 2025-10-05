/**
 * Manual mock for child_process module
 * This is required for ES6 module mocking in Jest
 */

import { jest } from '@jest/globals';

export const spawn = jest.fn();

export default {
  spawn
};
