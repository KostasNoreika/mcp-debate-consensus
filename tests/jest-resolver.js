/**
 * Jest ESM Resolver
 * Handles ES module resolution for Jest testing
 */

import { resolve as resolveModule } from 'import-meta-resolve';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function resolver(path, options) {
  try {
    // Handle relative imports
    if (path.startsWith('./') || path.startsWith('../')) {
      if (!path.endsWith('.js')) {
        path += '.js';
      }
    }

    // Handle src aliases
    if (path.startsWith('@/')) {
      path = path.replace('@/', join(__dirname, '../src/'));
    }

    // Use default resolver for node_modules
    if (!path.startsWith('.') && !path.startsWith('/')) {
      return options.defaultResolver(path, options);
    }

    // Try to resolve with import-meta-resolve
    const resolved = resolveModule(path, `file://${options.basedir}/`);
    return fileURLToPath(resolved);
  } catch (error) {
    // Fallback to default resolver
    return options.defaultResolver(path, options);
  }
}