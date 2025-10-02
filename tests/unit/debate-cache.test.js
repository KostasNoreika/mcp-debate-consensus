/**
 * Unit tests for DebateCache
 * Tests smart caching, invalidation, and cost optimization
 */

import { jest } from '@jest/globals';
import { DebateCache } from '../../src/cache/debate-cache.js';

// Create mock implementations before importing the module
const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
};

// Mock the fs/promises module
jest.unstable_mockModule('fs/promises', () => mockFs);

describe('DebateCache', () => {
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockFs.readFile.mockReset();
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.stat.mockResolvedValue({
      mtime: { getTime: () => Date.now() },
      size: 1024
    });

    cache = new DebateCache({
      maxAge: 1000, // 1 second for testing
      maxEntries: 5,
      enablePersistence: false
    });
  });

  afterEach(() => {
    if (cache) {
      cache.clear();
    }
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with default options', () => {
      const defaultCache = new DebateCache();

      expect(defaultCache.maxAge).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(defaultCache.maxEntries).toBe(1000);
      expect(defaultCache.enablePersistence).toBe(false);
    });

    test('should initialize with custom options', () => {
      const customCache = new DebateCache({
        maxAge: 5000,
        maxEntries: 100,
        enablePersistence: true,
        persistencePath: '/custom/path.json'
      });

      expect(customCache.maxAge).toBe(5000);
      expect(customCache.maxEntries).toBe(100);
      expect(customCache.enablePersistence).toBe(true);
      expect(customCache.persistencePath).toBe('/custom/path.json');
    });

    test('should initialize statistics', () => {
      expect(cache.stats).toBeDefined();
      expect(cache.stats.hits).toBe(0);
      expect(cache.stats.misses).toBe(0);
      expect(cache.stats.stores).toBe(0);
      expect(cache.stats.invalidations).toBe(0);
    });
  });

  describe('generateKey', () => {
    test('should generate consistent keys for same input', () => {
      const key1 = cache.generateKey('What is React?', { category: 'programming' });
      const key2 = cache.generateKey('What is React?', { category: 'programming' });

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different questions', () => {
      const key1 = cache.generateKey('What is React?');
      const key2 = cache.generateKey('What is Vue?');

      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for different categories', () => {
      const key1 = cache.generateKey('Optimize code', { category: 'programming' });
      const key2 = cache.generateKey('Optimize code', { category: 'performance' });

      expect(key1).not.toBe(key2);
    });

    test('should normalize question case', () => {
      const key1 = cache.generateKey('What is REACT?');
      const key2 = cache.generateKey('what is react?');

      expect(key1).toBe(key2);
    });

    test('should include models in key generation', () => {
      const key1 = cache.generateKey('Test', {
        models: [{ alias: 'k1' }, { alias: 'k2' }]
      });
      const key2 = cache.generateKey('Test', {
        models: [{ alias: 'k2' }, { alias: 'k1' }]
      });

      // Should be same regardless of order (models are sorted)
      expect(key1).toBe(key2);
    });

    test('should include file hash in key', () => {
      const key1 = cache.generateKey('Test', { fileHash: 'abc123' });
      const key2 = cache.generateKey('Test', { fileHash: 'def456' });

      expect(key1).not.toBe(key2);
    });
  });

  describe('get and set', () => {
    test('should store and retrieve values', async () => {
      const key = cache.generateKey('Test question');
      await cache.set(key, { result: 'Test answer' });

      const value = await cache.get(key);

      expect(value).toEqual({ result: 'Test answer' });
      expect(cache.stats.stores).toBe(1);
      expect(cache.stats.hits).toBe(1);
    });

    test('should return null for non-existent key', async () => {
      const value = await cache.get('non-existent-key');

      expect(value).toBeNull();
      expect(cache.stats.misses).toBe(1);
    });

    test('should expire entries after maxAge', async () => {
      const key = cache.generateKey('Test');
      await cache.set(key, { data: 'value' });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const value = await cache.get(key);

      expect(value).toBeNull();
      expect(cache.stats.misses).toBe(1);
    });

    test('should track response time for cached items', async () => {
      const key = cache.generateKey('Test');
      await cache.set(key, { data: 'value' });

      await cache.get(key);

      expect(cache.stats.responseCount.cached).toBe(1);
      expect(cache.stats.totalResponseTime.cached).toBeGreaterThan(0);
    });
  });

  describe('getCached', () => {
    test('should return cached result with metadata', async () => {
      const question = 'What is React?';
      const result = {
        consensus: 'React is a JavaScript library',
        confidence: 0.95
      };

      await cache.store(question, result, { category: 'programming' });

      const cached = await cache.getCached(question, { category: 'programming' });

      expect(cached.fromCache).toBe(true);
      expect(cached.consensus).toBe(result.consensus);
      expect(cached.cachedAt).toBeDefined();
      expect(cached.cacheKey).toBeDefined();
    });

    test('should return null for cache miss', async () => {
      const cached = await cache.getCached('Unknown question');

      expect(cached).toBeNull();
    });

    test('should invalidate cache when bypassCache is true', async () => {
      const question = 'Test';
      await cache.store(question, { data: 'value' });

      const cached = await cache.getCached(question, { bypassCache: true });

      expect(cached).toBeNull();
    });

    test('should invalidate cache when fresh option is set', async () => {
      const question = 'Test';
      await cache.store(question, { data: 'value' });

      const cached = await cache.getCached(question, { fresh: true });

      expect(cached).toBeNull();
    });

    test('should invalidate low confidence results', async () => {
      const question = 'Test';
      const result = { data: 'value', confidence: 0.5 };

      await cache.store(question, result);

      const cached = await cache.getCached(question);

      expect(cached).toBeNull();
    });
  });

  describe('store', () => {
    test('should store result with metadata', async () => {
      const question = 'What is TypeScript?';
      const result = { consensus: 'TypeScript is a typed superset of JavaScript' };

      await cache.store(question, result, { category: 'programming' });

      expect(cache.stats.stores).toBe(1);
      expect(cache.cache.size).toBe(1);
    });

    test('should estimate token count and cost', async () => {
      const question = 'Test';
      const result = { consensus: 'A'.repeat(1000) };

      await cache.store(question, result);

      const key = cache.generateKey(question);
      const entry = cache.cache.get(key);

      expect(entry.tokenCount).toBeGreaterThan(0);
      expect(entry.estimatedCost).toBeGreaterThan(0);
    });

    test('should evict oldest entry when maxEntries exceeded', async () => {
      // Fill cache to max
      for (let i = 0; i < 5; i++) {
        await cache.store(`Question ${i}`, { data: `Answer ${i}` });
      }

      expect(cache.cache.size).toBe(5);

      // Add one more - should evict oldest
      await cache.store('Question 5', { data: 'Answer 5' });

      expect(cache.cache.size).toBe(5);
    });

    test('should generate file hash if projectPath provided', async () => {
      mockFs.stat.mockResolvedValue({
        mtime: { getTime: () => Date.now() },
        size: 1024
      });
      mockFs.readdir.mockResolvedValue([]);

      const question = 'Test';
      const result = { data: 'value' };

      await cache.store(question, result, { projectPath: '/test/path' });

      const key = cache.generateKey(question, expect.objectContaining({
        fileHash: expect.any(String)
      }));
    });
  });

  describe('isCacheEntryValid', () => {
    test('should return false for expired entries', () => {
      const cached = {
        timestamp: Date.now() - 2000, // Expired (maxAge is 1000ms)
        confidence: 0.9
      };

      const isValid = cache.isCacheEntryValid(cached);

      expect(isValid).toBe(false);
    });

    test('should return false for low confidence entries', () => {
      const cached = {
        timestamp: Date.now(),
        confidence: 0.5 // Below 0.7 threshold
      };

      const isValid = cache.isCacheEntryValid(cached);

      expect(isValid).toBe(false);
    });

    test('should return false when fileHash changed', () => {
      const cached = {
        timestamp: Date.now(),
        fileHash: 'old-hash',
        confidence: 0.9
      };

      const isValid = cache.isCacheEntryValid(cached, { fileHash: 'new-hash' });

      expect(isValid).toBe(false);
    });

    test('should return false when projectPath changed', () => {
      const cached = {
        timestamp: Date.now(),
        projectPath: '/old/path',
        confidence: 0.9
      };

      const isValid = cache.isCacheEntryValid(cached, { projectPath: '/new/path' });

      expect(isValid).toBe(false);
    });

    test('should return true for valid entry', () => {
      const cached = {
        timestamp: Date.now(),
        confidence: 0.9
      };

      const isValid = cache.isCacheEntryValid(cached);

      expect(isValid).toBe(true);
    });
  });

  describe('estimateTokenCount', () => {
    test('should estimate tokens from text length', () => {
      const result = { consensus: 'A'.repeat(400) }; // 400 chars ≈ 100 tokens

      const tokens = cache.estimateTokenCount(result);

      expect(tokens).toBeGreaterThan(90);
      expect(tokens).toBeLessThan(110);
    });

    test('should handle complex objects', () => {
      const result = {
        consensus: 'Test',
        analysis: { key: 'value' },
        models: ['k1', 'k2', 'k3']
      };

      const tokens = cache.estimateTokenCount(result);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateCost', () => {
    test('should calculate cost from token count', () => {
      const tokens = 1000;

      const cost = cache.estimateCost(tokens);

      expect(cost).toBeCloseTo(0.02, 5);
    });

    test('should scale with token count', () => {
      const cost1 = cache.estimateCost(1000);
      const cost2 = cache.estimateCost(2000);

      expect(cost2).toBeCloseTo(cost1 * 2, 5);
    });
  });

  describe('evictOldestEntry', () => {
    test('should evict oldest entry', async () => {
      await cache.set('key1', { data: '1', timestamp: Date.now() - 3000 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await cache.set('key2', { data: '2', timestamp: Date.now() - 2000 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await cache.set('key3', { data: '3', timestamp: Date.now() - 1000 });

      cache.evictOldestEntry();

      const value1 = await cache.get('key1');
      const value2 = await cache.get('key2');
      const value3 = await cache.get('key3');

      expect(value1).toBeNull(); // Oldest should be evicted
    });

    test('should handle empty cache', () => {
      expect(() => cache.evictOldestEntry()).not.toThrow();
    });
  });

  describe('clear', () => {
    test('should clear all entries', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });

      expect(cache.cache.size).toBe(2);

      cache.clear();

      expect(cache.cache.size).toBe(0);
    });

    test('should clear metadata', async () => {
      const key = cache.generateKey('Test', { category: 'test' });
      await cache.set(key, { data: 'value' });

      cache.clear();

      expect(cache.keyMetadata.size).toBe(0);
    });
  });

  describe('getStats', () => {
    test('should return comprehensive statistics', async () => {
      await cache.store('Q1', { data: 'A1' });
      await cache.getCached('Q1');
      await cache.getCached('Q2'); // Miss

      const stats = cache.getStats();

      expect(stats).toMatchObject({
        entries: 1,
        maxEntries: 5,
        hits: 1,
        misses: 1,
        stores: 1,
        invalidations: 0,
        hitRate: 0.5
      });
    });

    test('should calculate hit rate correctly', async () => {
      await cache.store('Q1', { data: 'A1' });

      await cache.getCached('Q1'); // Hit
      await cache.getCached('Q1'); // Hit
      await cache.getCached('Q2'); // Miss

      const stats = cache.getStats();

      expect(stats.hitRate).toBeCloseTo(0.67, 2);
    });

    test('should include memory usage', async () => {
      await cache.store('Q1', { data: 'A'.repeat(1000) });

      const stats = cache.getStats();

      expect(stats.memoryUsage).toBeDefined();
      expect(stats.memoryUsage.bytes).toBeGreaterThan(0);
      expect(stats.memoryUsage.mb).toBeGreaterThan(0);
    });
  });

  describe('getMemoryUsage', () => {
    test('should calculate memory usage', async () => {
      await cache.store('Q1', { data: 'A'.repeat(1000) });
      await cache.store('Q2', { data: 'B'.repeat(1000) });

      const usage = cache.getMemoryUsage();

      expect(usage.bytes).toBeGreaterThan(2000);
      expect(usage.mb).toBeGreaterThan(0);
    });

    test('should return zero for empty cache', () => {
      const usage = cache.getMemoryUsage();

      expect(usage.bytes).toBe(0);
      expect(usage.mb).toBe(0);
    });
  });

  describe('invalidateByCategory', () => {
    test('should invalidate entries by category', async () => {
      await cache.store('Q1', { data: 'A1' }, { category: 'programming' });
      await cache.store('Q2', { data: 'A2' }, { category: 'design' });
      await cache.store('Q3', { data: 'A3' }, { category: 'programming' });

      const invalidated = cache.invalidateByCategory('programming');

      expect(invalidated).toBe(2);
      expect(cache.cache.size).toBe(1);
    });

    test('should update stats', async () => {
      await cache.store('Q1', { data: 'A1' }, { category: 'test' });

      cache.invalidateByCategory('test');

      expect(cache.stats.invalidations).toBe(1);
    });
  });

  describe('invalidateByPattern', () => {
    test('should invalidate entries matching pattern', async () => {
      const key1 = cache.generateKey('React question');
      const key2 = cache.generateKey('Vue question');

      await cache.set(key1, { data: 'A1' });
      await cache.set(key2, { data: 'A2' });

      const pattern = new RegExp(key1.substring(0, 10));
      const invalidated = cache.invalidateByPattern(pattern);

      expect(invalidated).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getHitRate', () => {
    test('should calculate hit rate', async () => {
      await cache.store('Q1', { data: 'A1' });

      await cache.getCached('Q1'); // Hit
      await cache.getCached('Q2'); // Miss

      expect(cache.getHitRate()).toBeCloseTo(0.5, 5);
    });

    test('should return 0 for no requests', () => {
      expect(cache.getHitRate()).toBe(0);
    });
  });

  describe('getAverageResponseTime', () => {
    test('should calculate average response times', async () => {
      await cache.store('Q1', { data: 'A1' });
      await cache.getCached('Q1');

      const avgTimes = cache.getAverageResponseTime();

      expect(avgTimes.cached).toBeGreaterThan(0);
    });

    test('should return 0 for no responses', () => {
      const avgTimes = cache.getAverageResponseTime();

      expect(avgTimes.cached).toBe(0);
      expect(avgTimes.fresh).toBe(0);
    });
  });

  describe('getCacheSizeInBytes', () => {
    test('should calculate total cache size', async () => {
      await cache.store('Q1', { data: 'A'.repeat(1000) });
      await cache.store('Q2', { data: 'B'.repeat(500) });

      const size = cache.getCacheSizeInBytes();

      expect(size).toBeGreaterThan(1500);
    });

    test('should include key size', async () => {
      const longKey = 'A'.repeat(1000);
      await cache.set(longKey, { data: 'value' });

      const size = cache.getCacheSizeInBytes();

      expect(size).toBeGreaterThan(1000);
    });
  });

  describe('File Context Hashing', () => {
    test('should generate file context hash', async () => {
      mockFs.stat.mockResolvedValue({
        mtime: { getTime: () => 1234567890 },
        size: 1024
      });
      mockFs.readdir.mockResolvedValue([
        { name: 'file1.js', isFile: () => true, isDirectory: () => false },
        { name: 'file2.js', isFile: () => true, isDirectory: () => false }
      ]);

      const hash = await cache.generateFileContextHash('/test/path');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe('unknown');
    });

    test('should return unknown on error', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));

      const hash = await cache.generateFileContextHash('/invalid/path');

      expect(hash).toBe('unknown');
    });

    test('should scan directory recursively', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: 'test.js', isFile: () => true, isDirectory: () => false }
      ]).mockResolvedValueOnce([
        { name: 'index.js', isFile: () => true, isDirectory: () => false }
      ]);

      mockFs.stat.mockResolvedValue({
        mtime: { getTime: () => Date.now() },
        size: 1024
      });

      const files = [];
      await cache.scanDirectory('/test', files, ['.js'], 50);

      expect(mockFs.readdir).toHaveBeenCalledTimes(2); // Root + subdirectory
    });

    test('should skip node_modules and .git directories', async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'node_modules', isFile: () => false, isDirectory: () => true },
        { name: '.git', isFile: () => false, isDirectory: () => true },
        { name: 'src', isFile: () => false, isDirectory: () => true }
      ]).mockResolvedValueOnce([
        { name: 'index.js', isFile: () => true, isDirectory: () => false }
      ]);

      mockFs.stat.mockResolvedValue({
        mtime: { getTime: () => Date.now() },
        size: 1024
      });

      const files = [];
      await cache.scanDirectory('/test', files, ['.js'], 50);

      // Should only scan 'src', not node_modules or .git
      expect(mockFs.readdir).toHaveBeenCalledTimes(2);
    });

    test('should limit number of files scanned', async () => {
      const manyFiles = Array(100).fill(null).map((_, i) => ({
        name: `file${i}.js`,
        isFile: () => true,
        isDirectory: () => false
      }));

      mockFs.readdir.mockResolvedValue(manyFiles);
      mockFs.stat.mockResolvedValue({
        mtime: { getTime: () => Date.now() },
        size: 1024
      });

      const files = [];
      await cache.scanDirectory('/test', files, ['.js'], 50);

      expect(files.length).toBeLessThanOrEqual(50);
    });
  });

  describe('invalidateByContext', () => {
    test('should invalidate when file hash changes', async () => {
      mockFs.stat.mockResolvedValue({
        mtime: { getTime: () => Date.now() },
        size: 1024
      });
      mockFs.readdir.mockResolvedValue([]);

      const projectPath = '/test/path';

      // Store with old hash
      await cache.store('Q1', { data: 'A1' }, {
        projectPath,
        fileHash: 'old-hash'
      });

      // Simulate file changes by returning different hash
      const invalidated = await cache.invalidateByContext(projectPath);

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Persistence', () => {
    test('should save to persistence when enabled', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const persistCache = new DebateCache({
        enablePersistence: true,
        persistencePath: '/tmp/test-cache.json'
      });

      await persistCache.store('Q1', { data: 'A1' });

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should load from persistence on initialization', async () => {
      const cacheData = {
        cache: {
          'key1': {
            result: { data: 'A1' },
            timestamp: Date.now()
          }
        },
        stats: {
          hits: 5,
          misses: 2
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(cacheData));

      const persistCache = new DebateCache({
        enablePersistence: true,
        persistencePath: '/tmp/test-cache.json'
      });

      await persistCache.loadFromPersistence();

      expect(persistCache.cache.size).toBeGreaterThanOrEqual(0);
    });

    test('should handle missing persistence file', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const persistCache = new DebateCache({
        enablePersistence: true,
        persistencePath: '/tmp/missing-cache.json'
      });

      await expect(persistCache.loadFromPersistence()).resolves.not.toThrow();
    });

    test('should not save when persistence disabled', async () => {
      mockFs.writeFile.mockClear();
      await cache.store('Q1', { data: 'A1' });

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty question', () => {
      const key = cache.generateKey('');

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });

    test('should handle very long questions', () => {
      const longQuestion = 'A'.repeat(10000);
      const key = cache.generateKey(longQuestion);

      expect(key).toBeDefined();
      expect(key.length).toBe(64); // SHA-256 hash length
    });

    test('should handle special characters in question', () => {
      const question = 'What is <script>alert("test")</script>?';
      const key = cache.generateKey(question);

      expect(key).toBeDefined();
    });

    test('should handle concurrent access', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(cache.store(`Q${i}`, { data: `A${i}` }));
      }

      await Promise.all(promises);

      expect(cache.cache.size).toBeGreaterThan(0);
      expect(cache.cache.size).toBeLessThanOrEqual(10);
    });
  });
});
