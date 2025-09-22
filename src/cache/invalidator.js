/**
 * Cache Invalidation Rules and Logic
 *
 * Handles intelligent cache invalidation based on various triggers:
 * - Time-based expiration
 * - Context changes (file modifications)
 * - Confidence thresholds
 * - User preferences
 * - Project state changes
 */

import fs from 'fs/promises';
import path from 'path';

export class CacheInvalidator {
  constructor(options = {}) {
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours
    this.minConfidence = options.minConfidence || 0.7; // Minimum confidence to keep cached
    this.checkInterval = options.checkInterval || 5 * 60 * 1000; // Check every 5 minutes
    this.projectStateTracking = options.projectStateTracking || true;

    // Track project states for change detection
    this.projectStates = new Map();

    // Track invalidation reasons for analytics
    this.invalidationReasons = {
      timeExpired: 0,
      contextChanged: 0,
      lowConfidence: 0,
      userRequested: 0,
      projectChanged: 0,
      dependency: 0
    };
  }

  /**
   * Check if a cache entry should be invalidated
   */
  shouldInvalidate(cached, context = {}) {
    const reasons = [];

    // Time-based invalidation
    if (this.isTimeExpired(cached)) {
      reasons.push('time_expired');
      this.invalidationReasons.timeExpired++;
    }

    // Context-based invalidation
    if (this.hasContextChanged(cached, context)) {
      reasons.push('context_changed');
      this.invalidationReasons.contextChanged++;
    }

    // Confidence-based invalidation
    if (this.isLowConfidence(cached)) {
      reasons.push('low_confidence');
      this.invalidationReasons.lowConfidence++;
    }

    // User-requested fresh result
    if (context.fresh || context.bypassCache) {
      reasons.push('user_requested');
      this.invalidationReasons.userRequested++;
    }

    // Project state changes
    if (this.hasProjectChanged(cached, context)) {
      reasons.push('project_changed');
      this.invalidationReasons.projectChanged++;
    }

    // Dependency invalidation
    if (this.hasDependencyChanged(cached, context)) {
      reasons.push('dependency_changed');
      this.invalidationReasons.dependency++;
    }

    return {
      shouldInvalidate: reasons.length > 0,
      reasons,
      timestamp: Date.now()
    };
  }

  /**
   * Check if cache entry has expired based on time
   */
  isTimeExpired(cached) {
    const age = Date.now() - cached.timestamp;
    return age > this.maxAge;
  }

  /**
   * Check if project context has changed
   */
  hasContextChanged(cached, context) {
    // File hash comparison (most reliable)
    if (context.fileHash && cached.fileHash) {
      return context.fileHash !== cached.fileHash;
    }

    // Project path comparison
    if (context.projectPath && cached.projectPath) {
      return context.projectPath !== cached.projectPath;
    }

    // Model selection changes
    if (context.models && cached.options?.models) {
      const currentModels = context.models.map(m => m.alias).sort().join(',');
      const cachedModels = cached.options.models?.map(m => m.alias).sort().join(',') || '';
      return currentModels !== cachedModels;
    }

    return false;
  }

  /**
   * Check if cached result has low confidence
   */
  isLowConfidence(cached) {
    const confidence = cached.confidence || cached.result?.confidence || 0.8;
    return confidence < this.minConfidence;
  }

  /**
   * Check if project state has changed significantly
   */
  hasProjectChanged(cached, context) {
    if (!this.projectStateTracking || !context.projectPath) {
      return false;
    }

    const projectPath = context.projectPath;
    const lastKnownState = this.projectStates.get(projectPath);

    if (!lastKnownState) {
      // First time seeing this project, record state
      this.updateProjectState(projectPath);
      return false;
    }

    // Check if significant changes occurred
    return this.detectProjectChanges(projectPath, lastKnownState);
  }

  /**
   * Check if dependencies have changed
   */
  hasDependencyChanged(cached, context) {
    // Check package.json modifications
    if (context.projectPath) {
      return this.hasPackageJsonChanged(cached, context.projectPath);
    }
    return false;
  }

  /**
   * Update project state tracking
   */
  async updateProjectState(projectPath) {
    try {
      const state = await this.captureProjectState(projectPath);
      this.projectStates.set(projectPath, state);
    } catch (error) {
      console.warn(`Failed to update project state for ${projectPath}:`, error.message);
    }
  }

  /**
   * Capture current project state
   */
  async captureProjectState(projectPath) {
    const state = {
      timestamp: Date.now(),
      files: {},
      packageJson: null,
      gitCommit: null
    };

    try {
      // Capture key file modifications
      const keyFiles = ['package.json', 'package-lock.json', '.env', 'tsconfig.json', 'jest.config.js'];

      for (const file of keyFiles) {
        const filePath = path.join(projectPath, file);
        try {
          const stat = await fs.stat(filePath);
          state.files[file] = {
            mtime: stat.mtime.getTime(),
            size: stat.size
          };
        } catch {
          // File doesn't exist, skip
        }
      }

      // Capture package.json content hash
      try {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageContent = await fs.readFile(packageJsonPath, 'utf8');
        const packageData = JSON.parse(packageContent);
        state.packageJson = {
          dependencies: packageData.dependencies || {},
          devDependencies: packageData.devDependencies || {},
          scripts: packageData.scripts || {}
        };
      } catch {
        // No package.json or invalid JSON
      }

      // Capture git commit if available
      try {
        const gitHeadPath = path.join(projectPath, '.git', 'HEAD');
        state.gitCommit = await fs.readFile(gitHeadPath, 'utf8');
      } catch {
        // Not a git repo or no .git folder
      }

    } catch (error) {
      console.warn(`Error capturing project state: ${error.message}`);
    }

    return state;
  }

  /**
   * Detect significant project changes
   */
  async detectProjectChanges(projectPath, lastState) {
    const currentState = await this.captureProjectState(projectPath);

    // Check file modifications
    for (const [file, lastInfo] of Object.entries(lastState.files)) {
      const currentInfo = currentState.files[file];
      if (!currentInfo || currentInfo.mtime !== lastInfo.mtime) {
        return true;
      }
    }

    // Check new files
    for (const file of Object.keys(currentState.files)) {
      if (!lastState.files[file]) {
        return true;
      }
    }

    // Check package.json dependencies
    if (lastState.packageJson && currentState.packageJson) {
      const lastDeps = JSON.stringify(lastState.packageJson.dependencies);
      const currentDeps = JSON.stringify(currentState.packageJson.dependencies);
      if (lastDeps !== currentDeps) {
        return true;
      }
    }

    // Check git commit
    if (lastState.gitCommit !== currentState.gitCommit) {
      return true;
    }

    // Update the state since we've checked it
    this.projectStates.set(projectPath, currentState);

    return false;
  }

  /**
   * Check if package.json has changed
   */
  async hasPackageJsonChanged(cached, projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const stat = await fs.stat(packageJsonPath);

      // Compare with cached timestamp
      const cachedTimestamp = cached.packageJsonTimestamp;
      if (cachedTimestamp && stat.mtime.getTime() > cachedTimestamp) {
        return true;
      }

      return false;
    } catch (error) {
      // File doesn't exist or can't be read
      return false;
    }
  }

  /**
   * Invalidate cache entries matching criteria
   */
  async invalidateMatching(cache, criteria) {
    const invalidated = [];

    for (const [key, entry] of cache.entries()) {
      const context = {
        projectPath: criteria.projectPath,
        fileHash: criteria.fileHash,
        fresh: criteria.fresh
      };

      const result = this.shouldInvalidate(entry, context);

      if (result.shouldInvalidate) {
        cache.delete(key);
        invalidated.push({
          key,
          reasons: result.reasons,
          question: entry.question?.substring(0, 50) + '...'
        });
      }
    }

    if (invalidated.length > 0) {
      console.log(`🔄 Invalidated ${invalidated.length} cache entries:`,
        invalidated.map(i => `${i.question} (${i.reasons.join(', ')})`));
    }

    return invalidated;
  }

  /**
   * Get invalidation statistics
   */
  getInvalidationStats() {
    const total = Object.values(this.invalidationReasons).reduce((sum, count) => sum + count, 0);

    return {
      total,
      reasons: { ...this.invalidationReasons },
      percentages: total > 0 ? Object.fromEntries(
        Object.entries(this.invalidationReasons).map(([reason, count]) => [
          reason, Math.round((count / total) * 100)
        ])
      ) : {},
      projectsTracked: this.projectStates.size
    };
  }

  /**
   * Configure invalidation rules
   */
  configure(options) {
    if (options.maxAge !== undefined) {
      this.maxAge = options.maxAge;
    }
    if (options.minConfidence !== undefined) {
      this.minConfidence = options.minConfidence;
    }
    if (options.checkInterval !== undefined) {
      this.checkInterval = options.checkInterval;
    }
    if (options.projectStateTracking !== undefined) {
      this.projectStateTracking = options.projectStateTracking;
    }

    console.log('🔧 Cache invalidation rules updated:', {
      maxAge: this.maxAge,
      minConfidence: this.minConfidence,
      checkInterval: this.checkInterval,
      projectStateTracking: this.projectStateTracking
    });
  }

  /**
   * Schedule periodic cache cleanup
   */
  startPeriodicCleanup(cache) {
    setInterval(async () => {
      try {
        const beforeSize = cache.size;

        // Run cleanup
        await this.invalidateMatching(cache, {});

        const afterSize = cache.size;
        const cleaned = beforeSize - afterSize;

        if (cleaned > 0) {
          console.log(`🧹 Periodic cleanup: removed ${cleaned} expired cache entries`);
        }
      } catch (error) {
        console.warn('Error during periodic cache cleanup:', error.message);
      }
    }, this.checkInterval);

    console.log(`⏰ Started periodic cache cleanup (every ${this.checkInterval / 1000}s)`);
  }
}