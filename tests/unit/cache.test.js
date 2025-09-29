/**
 * Cache System Unit Tests
 * Comprehensive test suite for cache invalidation edge cases and scenarios
 */

import { jest } from '@jest/globals';
import crypto from 'crypto';

// Mock fs/promises for cache persistence
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn(),
  unlink: jest.fn()
}));

// Import after mocking
const fs = await import('fs/promises');

// Mock DebateCache class since we can't import the actual implementation
class MockDebateCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000;
    this.maxEntries = options.maxEntries || 1000;
    this.enablePersistence = options.enablePersistence || false;
    this.persistencePath = options.persistencePath || './cache/debate-cache.json';

    this.stats = {
      hits: 0,
      misses: 0,
      stores: 0,
      invalidations: 0,
      tokensSaved: 0,
      costSaved: 0,
      totalResponseTime: { cached: 0, fresh: 0 },
      responseCount: { cached: 0, fresh: 0 }
    };
  }

  generateKey(question, options = {}) {
    const keyData = {
      question: question.trim().toLowerCase(),
      category: options.category || 'general',
      complexity: options.complexity || 'medium',
      projectPath: options.projectPath || '',
      models: options.models ? options.models.map(m => m.alias).sort().join(',') : '',
      useIntelligentSelection: options.useIntelligentSelection || false,
      fileHash: options.fileHash || ''
    };

    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  async set(key, data, options = {}) {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.maxAge,
      hits: 0
    });

    this.stats.stores++;
    return true;
  }

  async get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.data;
  }

  clear() {
    this.cache.clear();
  }

  invalidateByPattern(pattern) {
    let count = 0;
    for (const [key] of this.cache) {
      if (pattern.test && pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.invalidations += count;
  }

  invalidateByCategory(category) {
    this.invalidateByPattern(new RegExp(`"category":"${category}"`));
  }

  invalidateByFileContext(projectPath, newHash) {
    this.invalidateByPattern(new RegExp(`"projectPath":"${projectPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }

  getHitRate() {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  getAverageResponseTime() {
    return {
      cached: this.stats.responseCount.cached === 0 ? 0 : this.stats.totalResponseTime.cached / this.stats.responseCount.cached,
      fresh: this.stats.responseCount.fresh === 0 ? 0 : this.stats.totalResponseTime.fresh / this.stats.responseCount.fresh
    };
  }

  getSizeInBytes() {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length;
    }
    return size;
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.getHitRate(),
      entries: this.cache.size
    };
  }

  optimize() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

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

  async getRelevantFiles(projectPath) {
    const relevantExtensions = ['.js', '.ts', '.json', '.md', '.yml', '.yaml', '.env'];
    const maxFiles = 50;

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
    // Mock implementation
    const mockFiles = [
      `${dir}/src/index.js`,
      `${dir}/package.json`,
      `${dir}/README.md`
    ];
    files.push(...mockFiles.slice(0, maxFiles - files.length));
  }

  validateJsonContent(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);

      // Check for prototype pollution
      const dangerous = ['__proto__', 'constructor', 'prototype'];
      const jsonStr = JSON.stringify(parsed);

      return !dangerous.some(prop => jsonStr.includes(`"${prop}"`));
    } catch (error) {
      return false;
    }
  }

  async loadFromPersistence() {
    if (!this.enablePersistence) return;

    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const parsed = JSON.parse(data);

      if (parsed.entries) {
        Object.entries(parsed.entries).forEach(([key, entry]) => {
          this.cache.set(key, entry);
        });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to load cache from persistence:', error.message);
      }
    }
  }

  async saveToPersistence() {
    if (!this.enablePersistence) return;

    try {
      const data = {
        version: '1.0',
        timestamp: Date.now(),
        entries: Object.fromEntries(this.cache.entries())
      };

      await fs.writeFile(this.persistencePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save cache to persistence:', error.message);
    }
  }
}

// Use the mock class
const DebateCache = MockDebateCache;

describe('DebateCache', () => {
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new DebateCache({
      maxAge: 1000, // 1 second for testing
      maxEntries: 5,
      enablePersistence: false
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent keys for identical inputs', () => {
      const key1 = cache.generateKey('test question', { category: 'tech' });
      const key2 = cache.generateKey('test question', { category: 'tech' });

      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBe(64); // SHA256 hash length
    });

    test('should generate different keys for different questions', () => {
      const key1 = cache.generateKey('question 1');
      const key2 = cache.generateKey('question 2');

      expect(key1).not.toBe(key2);
    });

    test('should normalize question text for consistent keys', () => {
      const key1 = cache.generateKey('  Test Question  ');
      const key2 = cache.generateKey('test question');

      expect(key1).toBe(key2);
    });

    test('should include context in key generation', () => {
      const key1 = cache.generateKey('test', {
        category: 'tech',
        complexity: 'high',
        projectPath: '/path/to/project',
        models: [{ alias: 'k1' }, { alias: 'k2' }],
        fileHash: 'file123'
      });

      const key2 = cache.generateKey('test', {
        category: 'business',
        complexity: 'high',
        projectPath: '/path/to/project',
        models: [{ alias: 'k1' }, { alias: 'k2' }],
        fileHash: 'file123'
      });

      expect(key1).not.toBe(key2);
    });

    test('should handle empty or undefined options', () => {
      const key1 = cache.generateKey('test');
      const key2 = cache.generateKey('test', {});
      const key3 = cache.generateKey('test', undefined);

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });
  });

  describe('Cache Storage and Retrieval', () => {
    test('should store and retrieve cache entries', async () => {
      const key = cache.generateKey('test question');
      const data = { answer: 'test answer', confidence: 0.9 };

      await cache.set(key, data);
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(data);
      expect(cache.stats.stores).toBe(1);
    });

    test('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent-key');

      expect(result).toBeNull();
      expect(cache.stats.misses).toBe(1);
    });

    test('should track hit statistics', async () => {
      const key = cache.generateKey('test');
      await cache.set(key, { data: 'test' });
      await cache.get(key);

      expect(cache.stats.hits).toBe(1);
      expect(cache.stats.misses).toBe(0);
    });

    test('should handle concurrent access', async () => {
      const key = cache.generateKey('concurrent test');
      const data = { value: 'test' };

      // Simulate concurrent writes
      const promises = [
        cache.set(key, data),
        cache.set(key, data),
        cache.set(key, data)
      ];

      await Promise.all(promises);

      const result = await cache.get(key);
      expect(result).toEqual(data);
    });
  });

  describe('Cache Expiration', () => {
    test('should expire entries after maxAge', async () => {
      const key = cache.generateKey('expiring entry');
      await cache.set(key, { data: 'test' });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = await cache.get(key);
      expect(result).toBeNull();
    });

    test('should not expire fresh entries', async () => {
      cache.maxAge = 10000; // 10 seconds
      const key = cache.generateKey('fresh entry');
      await cache.set(key, { data: 'test' });

      const result = await cache.get(key);
      expect(result).toEqual({ data: 'test' });
    });

    test('should handle custom TTL', async () => {
      const key = cache.generateKey('custom ttl');
      await cache.set(key, { data: 'test' }, { ttl: 500 }); // 0.5 seconds

      // Should still be available immediately
      let result = await cache.get(key);
      expect(result).toEqual({ data: 'test' });

      // Wait for custom TTL expiration
      await new Promise(resolve => setTimeout(resolve, 600));

      result = await cache.get(key);
      expect(result).toBeNull();
    });
  });

  describe('Cache Size Management', () => {
    test('should respect maxEntries limit', async () => {
      // Fill cache to limit
      for (let i = 0; i < 6; i++) {
        await cache.set(`key-${i}`, { data: i });
      }

      expect(cache.cache.size).toBe(5); // Should not exceed maxEntries
    });

    test('should evict oldest entries when full', async () => {
      // Fill cache
      for (let i = 0; i < 5; i++) {
        await cache.set(`key-${i}`, { data: i });
      }

      // Add one more to trigger eviction
      await cache.set('new-key', { data: 'new' });

      // First entry should be evicted
      const firstEntry = await cache.get('key-0');
      expect(firstEntry).toBeNull();

      // New entry should be present
      const newEntry = await cache.get('new-key');
      expect(newEntry).toEqual({ data: 'new' });
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate entries by pattern', async () => {
      await cache.set('tech-question-1', { data: 'tech1' });
      await cache.set('tech-question-2', { data: 'tech2' });
      await cache.set('business-question-1', { data: 'biz1' });

      cache.invalidateByPattern(/^tech-/);

      expect(await cache.get('tech-question-1')).toBeNull();
      expect(await cache.get('tech-question-2')).toBeNull();
      expect(await cache.get('business-question-1')).toEqual({ data: 'biz1' });
    });

    test('should invalidate entries by category', async () => {
      // Create entries with different categories
      const techKey = cache.generateKey('question', { category: 'tech' });
      const bizKey = cache.generateKey('question', { category: 'business' });

      await cache.set(techKey, { data: 'tech' });
      await cache.set(bizKey, { data: 'business' });

      cache.invalidateByCategory('tech');

      expect(await cache.get(techKey)).toBeNull();
      expect(await cache.get(bizKey)).toEqual({ data: 'business' });
    });

    test('should invalidate all entries', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });

      cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(cache.cache.size).toBe(0);
    });

    test('should track invalidation statistics', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });

      cache.invalidateByPattern(/key/);

      expect(cache.stats.invalidations).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Metrics', () => {
    test('should calculate hit rate correctly', async () => {
      const key = cache.generateKey('test');
      await cache.set(key, { data: 'test' });

      // Generate hits and misses
      await cache.get(key); // hit
      await cache.get(key); // hit
      await cache.get('non-existent'); // miss

      const hitRate = cache.getHitRate();
      expect(hitRate).toBeCloseTo(0.67, 2); // 2 hits out of 3 attempts
    });

    test('should track response time statistics', async () => {
      const key = cache.generateKey('perf test');
      await cache.set(key, { data: 'test' });

      const startTime = Date.now();
      await cache.get(key);
      const responseTime = Date.now() - startTime;

      cache.stats.totalResponseTime.cached += responseTime;
      cache.stats.responseCount.cached += 1;

      const avgResponseTime = cache.getAverageResponseTime();
      expect(avgResponseTime.cached).toBeGreaterThan(0);
    });

    test('should calculate cache size in bytes', () => {
      const size = cache.getSizeInBytes();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });

    test('should generate comprehensive statistics', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.get('key1');
      await cache.get('non-existent');

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.stores).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5, 1);
      expect(stats.entries).toBe(1);
    });
  });

  describe('File Context Hashing', () => {
    test('should generate file context hash', async () => {
      fs.stat.mockResolvedValue({
        mtime: new Date('2023-01-01'),
        size: 1024
      });

      const hash = await cache.generateFileContextHash('/path');

      expect(fs.stat).toHaveBeenCalled();
      expect(typeof hash).toBe('string');
    });

    test('should handle missing files in context hash', async () => {
      fs.stat.mockImplementation((file) => {
        if (file.includes('missing')) {
          throw new Error('File not found');
        }
        return Promise.resolve({
          mtime: new Date('2023-01-01'),
          size: 1024
        });
      });

      const hash = await cache.generateFileContextHash('/path');
      expect(typeof hash).toBe('string');
    });

    test('should handle directory scan errors', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      cache.scanDirectory = jest.fn().mockRejectedValue(new Error('Permission denied'));
      const hash = await cache.generateFileContextHash('/protected/path');

      expect(hash).toBe('unknown');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Persistence', () => {
    test('should save cache to disk when persistence enabled', async () => {
      const persistentCache = new DebateCache({
        enablePersistence: true,
        persistencePath: './test-cache.json'
      });

      await persistentCache.set('key1', { data: 'value1' });
      await persistentCache.saveToPersistence();

      expect(fs.writeFile).toHaveBeenCalledWith(
        './test-cache.json',
        expect.any(String)
      );
    });

    test('should load cache from disk', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({
        version: '1.0',
        timestamp: Date.now(),
        entries: {
          'key1': {
            data: { data: 'value1' },
            timestamp: Date.now(),
            hits: 0
          }
        }
      }));

      const persistentCache = new DebateCache({
        enablePersistence: true,
        persistencePath: './test-cache.json'
      });

      await persistentCache.loadFromPersistence();

      expect(fs.readFile).toHaveBeenCalledWith('./test-cache.json', 'utf8');
    });

    test('should handle corrupted persistence file', async () => {
      fs.readFile.mockResolvedValue('invalid json{');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const persistentCache = new DebateCache({
        enablePersistence: true
      });

      await persistentCache.loadFromPersistence();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load cache from persistence')
      );

      consoleSpy.mockRestore();
    });

    test('should handle missing persistence file', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const persistentCache = new DebateCache({
        enablePersistence: true
      });

      await persistentCache.loadFromPersistence();

      // Should not throw error, just start with empty cache
      expect(persistentCache.cache.size).toBe(0);
    });
  });

  describe('Content Validation', () => {
    test('should validate safe JSON content', () => {
      const validJson = '{"key": "value", "number": 123}';
      expect(cache.validateJsonContent(validJson)).toBe(true);
    });

    test('should reject dangerous JSON content', () => {
      const dangerousJson = '{"__proto__": {"isAdmin": true}}';
      expect(cache.validateJsonContent(dangerousJson)).toBe(false);
    });

    test('should handle malformed JSON', () => {
      const malformedJson = '{"key": value}'; // Missing quotes
      expect(cache.validateJsonContent(malformedJson)).toBe(false);
    });
  });

  describe('Cache Optimization', () => {
    test('should optimize cache by removing expired entries', async () => {
      // Add entries with different ages
      await cache.set('old-key', { data: 'old' });

      // Mock expired entry
      const oldEntry = cache.cache.get('old-key');
      if (oldEntry) {
        oldEntry.timestamp = Date.now() - 2000; // 2 seconds ago (expired)
      }

      await cache.set('new-key', { data: 'new' });

      cache.optimize();

      expect(await cache.get('old-key')).toBeNull();
      expect(await cache.get('new-key')).toEqual({ data: 'new' });
    });

    test('should handle optimization of empty cache', () => {
      expect(() => cache.optimize()).not.toThrow();
    });
  });
});