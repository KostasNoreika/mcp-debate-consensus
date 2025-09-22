/**
 * Debate Cache System for Cost Optimization
 *
 * Implements intelligent caching of debate results to reduce costs on repeated questions.
 * Features smart cache key generation, time-based and context-based invalidation,
 * and comprehensive cache statistics.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class DebateCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    this.maxEntries = options.maxEntries || 1000; // Prevent memory overflow
    this.enablePersistence = options.enablePersistence || false;
    this.persistencePath = options.persistencePath || './cache/debate-cache.json';

    // Statistics tracking
    this.stats = {
      hits: 0,
      misses: 0,
      stores: 0,
      invalidations: 0,
      tokensSaved: 0,
      costSaved: 0,
      totalResponseTime: {
        cached: 0,
        fresh: 0
      },
      responseCount: {
        cached: 0,
        fresh: 0
      }
    };

    // Load persisted cache if enabled
    if (this.enablePersistence) {
      this.loadFromPersistence();
    }
  }

  /**
   * Generate a unique cache key from question and context
   */
  generateKey(question, options = {}) {
    const keyData = {
      question: question.trim().toLowerCase(),
      category: options.category || 'general',
      complexity: options.complexity || 'medium',
      projectPath: options.projectPath || '',
      models: options.models ? options.models.map(m => m.alias).sort().join(',') : '',
      useIntelligentSelection: options.useIntelligentSelection || false,
      // Add file context hash if available
      fileHash: options.fileHash || ''
    };

    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * Generate file context hash for cache invalidation
   */
  async generateFileContextHash(projectPath) {
    try {
      const files = await this.getRelevantFiles(projectPath);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          try {
            const stat = await fs.stat(file);
            return `${file}:${stat.mtime.getTime()}:${stat.size}`;
          } catch (error) {
            return `${file}:missing`;
          }
        })
      );

      return crypto.createHash('md5').update(fileStats.join('|')).digest('hex');
    } catch (error) {
      console.warn('Failed to generate file context hash:', error.message);
      return 'unknown';
    }
  }

  /**
   * Get relevant files for cache invalidation context
   */
  async getRelevantFiles(projectPath) {
    const relevantExtensions = ['.js', '.ts', '.json', '.md', '.yml', '.yaml', '.env'];
    const maxFiles = 50; // Limit to prevent performance issues

    try {
      const files = [];
      await this.scanDirectory(projectPath, files, relevantExtensions, maxFiles);
      return files.slice(0, maxFiles);
    } catch (error) {
      console.warn('Failed to scan directory for relevant files:', error.message);
      return [];
    }
  }

  async scanDirectory(dir, files, extensions, maxFiles) {
    if (files.length >= maxFiles) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= maxFiles) break;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories that don't affect logic
          if (!['node_modules', '.git', 'coverage', 'dist', 'build'].includes(entry.name)) {
            await this.scanDirectory(fullPath, files, extensions, maxFiles);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  /**
   * Get cached result if available and valid
   */
  async getCached(question, options = {}) {
    const startTime = Date.now();

    // Generate file context hash for invalidation checking
    if (options.projectPath) {
      options.fileHash = await this.generateFileContextHash(options.projectPath);
    }

    const key = this.generateKey(question, options);
    const cached = this.cache.get(key);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    // Check if cache entry is still valid
    if (this.isCacheEntryValid(cached, options)) {
      this.stats.hits++;
      this.stats.tokensSaved += cached.tokenCount || 0;
      this.stats.costSaved += cached.estimatedCost || 0;

      const responseTime = Date.now() - startTime;
      this.stats.totalResponseTime.cached += responseTime;
      this.stats.responseCount.cached++;

      return {
        ...cached.result,
        fromCache: true,
        cachedAt: cached.timestamp,
        cacheKey: key,
        responseTime: `${responseTime}ms`
      };
    } else {
      // Cache entry is invalid, remove it
      this.cache.delete(key);
      this.stats.invalidations++;
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Check if cache entry is still valid
   */
  isCacheEntryValid(cached, options = {}) {
    const now = Date.now();

    // Check time-based expiration
    if (now - cached.timestamp > this.maxAge) {
      return false;
    }

    // Check if user requested fresh result
    if (options.bypassCache || options.fresh) {
      return false;
    }

    // Check file context changes
    if (options.fileHash && cached.fileHash && options.fileHash !== cached.fileHash) {
      return false;
    }

    // Check confidence threshold
    if (cached.confidence !== undefined && cached.confidence < 0.7) {
      return false;
    }

    // Check if project context changed significantly
    if (options.projectPath && cached.projectPath && options.projectPath !== cached.projectPath) {
      return false;
    }

    return true;
  }

  /**
   * Store debate result in cache
   */
  async store(question, result, options = {}) {
    // Generate file context hash
    if (options.projectPath) {
      options.fileHash = await this.generateFileContextHash(options.projectPath);
    }

    const key = this.generateKey(question, options);
    const now = Date.now();

    // Estimate token count and cost
    const tokenCount = this.estimateTokenCount(result);
    const estimatedCost = this.estimateCost(tokenCount);

    const cacheEntry = {
      result,
      timestamp: now,
      question,
      options,
      fileHash: options.fileHash,
      projectPath: options.projectPath,
      tokenCount,
      estimatedCost,
      confidence: result.confidence || 0.8 // Default confidence
    };

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxEntries) {
      this.evictOldestEntry();
    }

    this.cache.set(key, cacheEntry);
    this.stats.stores++;

    // Persist to disk if enabled
    if (this.enablePersistence) {
      await this.saveToPersistence();
    }

    console.log(`💾 Cached debate result (key: ${key.substring(0, 8)}..., tokens: ${tokenCount}, cost: $${estimatedCost.toFixed(4)})`);
  }

  /**
   * Estimate token count from result
   */
  estimateTokenCount(result) {
    const text = JSON.stringify(result);
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost based on token count
   */
  estimateCost(tokenCount) {
    // Average cost per token across different models (rough estimate)
    const avgCostPerToken = 0.00002; // $0.02 per 1K tokens
    return tokenCount * avgCostPerToken;
  }

  /**
   * Evict oldest cache entry
   */
  evictOldestEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cleared ${entriesCleared} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    const avgResponseTime = {
      cached: this.stats.responseCount.cached > 0
        ? this.stats.totalResponseTime.cached / this.stats.responseCount.cached
        : 0,
      fresh: this.stats.responseCount.fresh > 0
        ? this.stats.totalResponseTime.fresh / this.stats.responseCount.fresh
        : 0
    };

    return {
      entries: this.cache.size,
      maxEntries: this.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      stores: this.stats.stores,
      invalidations: this.stats.invalidations,
      hitRate: Math.round(hitRate * 100) / 100,
      tokensSaved: this.stats.tokensSaved,
      costSaved: this.stats.costSaved,
      avgResponseTime: {
        cached: Math.round(avgResponseTime.cached) + 'ms',
        fresh: Math.round(avgResponseTime.fresh) + 'ms'
      },
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Get approximate memory usage
   */
  getMemoryUsage() {
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += JSON.stringify(entry).length;
    }
    return {
      bytes: totalSize,
      mb: Math.round((totalSize / (1024 * 1024)) * 100) / 100
    };
  }

  /**
   * Load cache from persistence file
   */
  async loadFromPersistence() {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const persistedData = JSON.parse(data);

      // Restore cache entries
      for (const [key, entry] of Object.entries(persistedData.cache || {})) {
        // Check if entry is still valid
        if (Date.now() - entry.timestamp < this.maxAge) {
          this.cache.set(key, entry);
        }
      }

      // Restore stats (but reset runtime counters)
      this.stats = {
        ...this.stats,
        ...persistedData.stats
      };

      console.log(`📂 Loaded ${this.cache.size} cache entries from persistence`);
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      console.log('🆕 Starting with fresh cache (no persistence file found)');
    }
  }

  /**
   * Save cache to persistence file
   */
  async saveToPersistence() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.persistencePath);
      await fs.mkdir(dir, { recursive: true });

      const persistData = {
        cache: Object.fromEntries(this.cache.entries()),
        stats: this.stats,
        timestamp: Date.now()
      };

      await fs.writeFile(this.persistencePath, JSON.stringify(persistData, null, 2));
    } catch (error) {
      console.warn('Failed to save cache to persistence:', error.message);
    }
  }

  /**
   * Invalidate cache entries based on context changes
   */
  async invalidateByContext(projectPath) {
    const currentHash = await this.generateFileContextHash(projectPath);
    let invalidatedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.projectPath === projectPath && entry.fileHash !== currentHash) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      this.stats.invalidations += invalidatedCount;
      console.log(`🔄 Invalidated ${invalidatedCount} cache entries due to context changes`);
    }

    return invalidatedCount;
  }

  /**
   * Warm cache with common questions
   */
  async warmCache(questions, options = {}) {
    console.log(`🔥 Warming cache with ${questions.length} questions...`);
    const results = [];

    for (const question of questions) {
      try {
        // This would be called from the main debate orchestrator
        // const result = await debateOrchestrator.runDebate(question, options);
        // results.push(result);
        console.log(`🔥 Cache warming for: ${question.substring(0, 50)}...`);
      } catch (error) {
        console.warn(`Failed to warm cache for question: ${error.message}`);
      }
    }

    return results;
  }
}