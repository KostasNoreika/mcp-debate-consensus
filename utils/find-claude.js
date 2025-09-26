#!/usr/bin/env node

/**
 * Utility to find Claude CLI installation across different systems
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export function findClaudeCLI() {
  const possiblePaths = [
    // Check if claude is in PATH
    (() => {
      try {
        const path = execSync('which claude', { encoding: 'utf-8' }).trim();
        if (path) return path;
      } catch {}
      return null;
    })(),

    // Common installation paths
    join(homedir(), '.claude', 'local', 'claude'),
    join(homedir(), '.npm-global', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/usr/bin/claude',
    '/opt/homebrew/bin/claude',

    // Windows paths
    process.platform === 'win32' ? join(process.env.APPDATA || '', 'npm', 'claude.cmd') : null,
    process.platform === 'win32' ? join(process.env.LOCALAPPDATA || '', 'Programs', 'claude', 'claude.exe') : null,
  ].filter(Boolean);

  for (const path of possiblePaths) {
    if (path && existsSync(path)) {
      return path;
    }
  }

  // If not found, return 'claude' and hope it's in PATH
  return 'claude';
}

// If run directly, print the path
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(findClaudeCLI());
}

export default findClaudeCLI;