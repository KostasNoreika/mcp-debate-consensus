/**
 * Jest Global Teardown
 * Clean up any remaining processes and resources after all tests complete
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalTeardown() {
  const execAsync = promisify(exec);

  console.log('🧹 Starting test environment cleanup...');

  // Kill any remaining node processes from tests
  try {
    await execAsync('pkill -f "node.*test"');
  } catch (error) {
    // Ignore errors - process might not exist
    if (error.code !== 1) {
      console.log('Note: Some test processes might still be running');
    }
  }

  // Kill any proxy servers that might be running on test ports
  const testPorts = ['3457', '3458', '3459', '3460', '3461', '3462', '3463', '3464'];
  for (const port of testPorts) {
    try {
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      if (stdout) {
        await execAsync(`kill -9 ${stdout.trim()}`);
        console.log(`✅ Killed process on port ${port}`);
      }
    } catch (error) {
      // Port not in use, which is fine
    }
  }

  // Clear temp files and cache
  const dirsToClean = [
    path.join(__dirname, '../temp'),
    path.join(__dirname, '../coverage'),
    path.join(__dirname, '../node_modules/.cache'),
    path.join(__dirname, '../cache')
  ];

  for (const dir of dirsToClean) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`✅ Cleaned ${path.basename(dir)} directory`);
    } catch (error) {
      // Directory might not exist, which is fine
    }
  }

  // Clear any test database files
  const testDbFiles = [
    path.join(__dirname, '../test.db'),
    path.join(__dirname, '../test.sqlite'),
    path.join(__dirname, '../data/test-performance.db')
  ];

  for (const dbFile of testDbFiles) {
    try {
      await fs.unlink(dbFile);
      console.log(`✅ Removed test database: ${path.basename(dbFile)}`);
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  // Wait a moment for all cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('✅ Test environment cleaned up successfully');
}