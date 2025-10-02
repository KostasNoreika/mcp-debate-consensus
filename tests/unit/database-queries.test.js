/**
 * Unit tests for DatabaseQueries
 * Tests SQLite query helpers for performance tracking
 */

import { jest } from '@jest/globals';
import { DatabaseQueries } from '../../src/database/queries.js';

// Mock schema class
class MockSchema {
  constructor() {
    this.db = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    };
  }

  getDatabase() {
    return this.db;
  }

  runAsync(sql, params) {
    return Promise.resolve({ changes: 1 });
  }

  getAsync(sql, params) {
    return Promise.resolve(null);
  }

  allAsync(sql, params) {
    return Promise.resolve([]);
  }
}

describe('DatabaseQueries', () => {
  let queries;
  let mockSchema;

  beforeEach(() => {
    mockSchema = new MockSchema();
    queries = new DatabaseQueries(mockSchema);
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with schema', () => {
      expect(queries.schema).toBe(mockSchema);
      expect(queries.db).toBeDefined();
    });

    test('should initialize prepared statements', () => {
      expect(queries.queries).toBeDefined();
      expect(queries.queries.insertDebate).toBeDefined();
      expect(queries.queries.insertModelPerformance).toBeDefined();
      expect(queries.queries.upsertCategoryProfile).toBeDefined();
    });

    test('should have all required query strings', () => {
      const requiredQueries = [
        'insertDebate',
        'insertModelPerformance',
        'upsertCategoryProfile',
        'insertPerformanceTrend',
        'getModelPerformanceByCategory',
        'getModelOverallPerformance',
        'getDebateHistory',
        'getRecentPerformance'
      ];

      requiredQueries.forEach(queryName => {
        expect(queries.queries[queryName]).toBeDefined();
        expect(typeof queries.queries[queryName]).toBe('string');
      });
    });
  });

  describe('Async Wrapper Methods', () => {
    test('runAsync should call schema.runAsync', async () => {
      const spy = jest.spyOn(mockSchema, 'runAsync');
      await queries.runAsync('SELECT * FROM test', [1, 2]);

      expect(spy).toHaveBeenCalledWith('SELECT * FROM test', [1, 2]);
    });

    test('getAsync should call schema.getAsync', async () => {
      const spy = jest.spyOn(mockSchema, 'getAsync');
      await queries.getAsync('SELECT * FROM test WHERE id = ?', [1]);

      expect(spy).toHaveBeenCalledWith('SELECT * FROM test WHERE id = ?', [1]);
    });

    test('allAsync should call schema.allAsync', async () => {
      const spy = jest.spyOn(mockSchema, 'allAsync');
      await queries.allAsync('SELECT * FROM test');

      expect(spy).toHaveBeenCalledWith('SELECT * FROM test', []);
    });
  });

  describe('recordDebate', () => {
    test('should record complete debate with model performances', async () => {
      const runSpy = jest.spyOn(queries, 'runAsync').mockResolvedValue({ changes: 1 });

      const debateData = {
        id: 'debate-123',
        timestamp: Date.now(),
        category: 'programming',
        question: 'How to optimize React performance?',
        complexity: 'medium',
        modelsUsed: ['k1', 'k2', 'k3'],
        winner: 'k1',
        consensusScore: 0.85,
        userFeedback: null,
        projectPath: '/opt/test',
        totalTimeSeconds: 45.2
      };

      const modelPerformances = [
        {
          model: 'k1',
          score: 0.9,
          responseTimeSeconds: 15.3,
          tokensUsed: 1500,
          cost: 0.03,
          errorOccurred: false,
          errorMessage: null,
          proposalLength: 2500,
          improvementsProvided: true
        },
        {
          model: 'k2',
          score: 0.8,
          responseTimeSeconds: 18.1,
          tokensUsed: 1200,
          cost: 0.024,
          errorOccurred: false,
          errorMessage: null,
          proposalLength: 2100,
          improvementsProvided: true
        }
      ];

      await queries.recordDebate(debateData, modelPerformances);

      // Should insert debate
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO debates'),
        expect.arrayContaining([debateData.id, debateData.timestamp])
      );

      // Should insert model performances
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO model_performance'),
        expect.arrayContaining(['k1'])
      );

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO model_performance'),
        expect.arrayContaining(['k2'])
      );
    });

    test('should handle debate with no model performances', async () => {
      const runSpy = jest.spyOn(queries, 'runAsync').mockResolvedValue({ changes: 1 });

      const debateData = {
        id: 'debate-456',
        timestamp: Date.now(),
        category: 'general',
        question: 'What is AI?',
        complexity: 'simple',
        modelsUsed: [],
        winner: null,
        consensusScore: 0,
        userFeedback: null,
        projectPath: null,
        totalTimeSeconds: 0
      };

      await queries.recordDebate(debateData, []);

      // Should still insert debate
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO debates'),
        expect.any(Array)
      );
    });

    test('should throw error on database failure', async () => {
      jest.spyOn(queries, 'runAsync').mockRejectedValue(new Error('Database error'));

      const debateData = {
        id: 'debate-error',
        timestamp: Date.now(),
        category: 'test',
        question: 'Test',
        complexity: 'medium',
        modelsUsed: [],
        winner: null,
        consensusScore: 0,
        userFeedback: null,
        projectPath: null,
        totalTimeSeconds: 0
      };

      await expect(queries.recordDebate(debateData, []))
        .rejects.toThrow('Database error');
    });
  });

  describe('updateCategoryProfiles', () => {
    test('should create new profile for first debate', async () => {
      jest.spyOn(queries, 'getAsync').mockResolvedValue(null);
      const runSpy = jest.spyOn(queries, 'runAsync').mockResolvedValue({ changes: 1 });

      const modelPerformances = [{
        model: 'k1',
        score: 0.85,
        responseTimeSeconds: 15.0,
        cost: 0.025,
        errorOccurred: false
      }];

      await queries.updateCategoryProfiles('programming', modelPerformances, 'k1');

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO category_profiles'),
        expect.arrayContaining([
          'programming',
          'k1',
          1.0, // win_rate (won this debate)
          0.85, // avg_score
          15.0, // avg_time_seconds
          0.025, // avg_cost
          1, // total_debates
          1, // total_wins
          0, // total_errors
          expect.any(Number) // last_updated
        ])
      );
    });

    test('should update existing profile', async () => {
      const existingProfile = {
        category: 'programming',
        model: 'k1',
        win_rate: 0.6,
        avg_score: 0.75,
        avg_time_seconds: 20.0,
        avg_cost: 0.03,
        total_debates: 5,
        total_wins: 3,
        total_errors: 0,
        last_updated: Date.now() - 10000
      };

      jest.spyOn(queries, 'getAsync').mockResolvedValue(existingProfile);
      const runSpy = jest.spyOn(queries, 'runAsync').mockResolvedValue({ changes: 1 });

      const modelPerformances = [{
        model: 'k1',
        score: 0.9,
        responseTimeSeconds: 18.0,
        cost: 0.028,
        errorOccurred: false
      }];

      await queries.updateCategoryProfiles('programming', modelPerformances, 'k1');

      // Calculate expected values
      const newTotalDebates = 6;
      const newTotalWins = 4;
      const expectedWinRate = 4 / 6;
      const expectedAvgScore = (0.75 * 5 + 0.9) / 6;
      const expectedAvgTime = (20.0 * 5 + 18.0) / 6;
      const expectedAvgCost = (0.03 * 5 + 0.028) / 6;

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO category_profiles'),
        expect.arrayContaining([
          'programming',
          'k1',
          expect.closeTo(expectedWinRate, 5),
          expect.closeTo(expectedAvgScore, 5),
          expect.closeTo(expectedAvgTime, 5),
          expect.closeTo(expectedAvgCost, 5),
          newTotalDebates,
          newTotalWins,
          0,
          expect.any(Number)
        ])
      );
    });

    test('should track errors correctly', async () => {
      jest.spyOn(queries, 'getAsync').mockResolvedValue(null);
      const runSpy = jest.spyOn(queries, 'runAsync').mockResolvedValue({ changes: 1 });

      const modelPerformances = [{
        model: 'k2',
        score: null,
        responseTimeSeconds: 0,
        cost: 0,
        errorOccurred: true
      }];

      await queries.updateCategoryProfiles('debugging', modelPerformances, 'k1');

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO category_profiles'),
        expect.arrayContaining([
          'debugging',
          'k2',
          0.0, // win_rate (didn't win)
          0.0, // avg_score
          0.0, // avg_time_seconds
          0.0, // avg_cost
          1, // total_debates
          0, // total_wins
          1, // total_errors
          expect.any(Number)
        ])
      );
    });
  });

  describe('updatePerformanceTrends', () => {
    test('should create new daily trend', async () => {
      jest.spyOn(queries, 'getAsync').mockResolvedValue(null);
      const runSpy = jest.spyOn(queries, 'runAsync').mockResolvedValue({ changes: 1 });

      const modelPerformances = [{
        model: 'k1',
        score: 0.85,
        responseTimeSeconds: 15.0,
        cost: 0.025
      }];

      const timestamp = Date.now();
      await queries.updatePerformanceTrends('programming', modelPerformances, timestamp);

      const expectedDate = new Date(timestamp).toISOString().split('T')[0];

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO performance_trends'),
        expect.arrayContaining([
          'k1',
          'programming',
          expectedDate,
          0.85,
          1,
          0,
          0.025,
          15.0
        ])
      );
    });

    test('should update existing daily trend', async () => {
      const existingTrend = {
        model: 'k1',
        category: 'programming',
        date: new Date().toISOString().split('T')[0],
        avg_score: 0.8,
        debates_count: 3,
        win_rate: 0.67,
        avg_cost: 0.03,
        avg_time_seconds: 20.0
      };

      jest.spyOn(queries, 'getAsync').mockResolvedValue(existingTrend);
      const runSpy = jest.spyOn(queries, 'runAsync').mockResolvedValue({ changes: 1 });

      const modelPerformances = [{
        model: 'k1',
        score: 0.9,
        responseTimeSeconds: 18.0,
        cost: 0.028
      }];

      await queries.updatePerformanceTrends('programming', modelPerformances, Date.now());

      const expectedAvgScore = (0.8 * 3 + 0.9) / 4;

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO performance_trends'),
        expect.arrayContaining([
          'k1',
          'programming',
          expect.any(String),
          expect.closeTo(expectedAvgScore, 5),
          4,
          0.67,
          0.03,
          20.0
        ])
      );
    });
  });

  describe('getBestModelsForCategory', () => {
    test('should return top models for category', async () => {
      const mockResults = [
        { model: 'k1', win_rate: 0.9, avg_score: 0.88 },
        { model: 'k3', win_rate: 0.85, avg_score: 0.82 },
        { model: 'k2', win_rate: 0.75, avg_score: 0.78 }
      ];

      jest.spyOn(queries, 'allAsync').mockResolvedValue(mockResults);

      const results = await queries.getBestModelsForCategory('programming', 5);

      expect(results).toEqual(mockResults);
      expect(results.length).toBe(3);
    });

    test('should limit results to requested count', async () => {
      const mockResults = [
        { model: 'k1', win_rate: 0.9 },
        { model: 'k2', win_rate: 0.85 },
        { model: 'k3', win_rate: 0.8 },
        { model: 'k4', win_rate: 0.75 },
        { model: 'k5', win_rate: 0.7 }
      ];

      jest.spyOn(queries, 'allAsync').mockResolvedValue(mockResults);

      const results = await queries.getBestModelsForCategory('programming', 2);

      expect(results.length).toBe(2);
      expect(results[0].model).toBe('k1');
      expect(results[1].model).toBe('k2');
    });

    test('should handle empty results', async () => {
      jest.spyOn(queries, 'allAsync').mockResolvedValue([]);

      const results = await queries.getBestModelsForCategory('unknown-category', 5);

      expect(results).toEqual([]);
    });
  });

  describe('getModelOverallPerformance', () => {
    test('should return overall performance statistics', async () => {
      const mockResult = {
        model: 'k1',
        overall_win_rate: 0.82,
        overall_avg_score: 0.85,
        overall_avg_time: 18.5,
        total_debates: 50,
        total_wins: 41,
        total_errors: 2
      };

      jest.spyOn(queries, 'getAsync').mockResolvedValue(mockResult);

      const result = await queries.getModelOverallPerformance('k1');

      expect(result).toEqual(mockResult);
    });

    test('should return null for non-existent model', async () => {
      jest.spyOn(queries, 'getAsync').mockResolvedValue(null);

      const result = await queries.getModelOverallPerformance('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getRecentPerformance', () => {
    test('should return performance from last 30 days', async () => {
      const mockResults = [
        { model: 'k1', avg_score: 0.88, debate_count: 15, wins: 13 },
        { model: 'k2', avg_score: 0.82, debate_count: 12, wins: 9 }
      ];

      jest.spyOn(queries, 'allAsync').mockResolvedValue(mockResults);

      const results = await queries.getRecentPerformance(30);

      expect(results).toEqual(mockResults);
    });

    test('should accept custom days parameter', async () => {
      const spy = jest.spyOn(queries, 'allAsync').mockResolvedValue([]);

      await queries.getRecentPerformance(7);

      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
      expect(spy).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(Number)])
      );
    });
  });

  describe('getDebateHistory', () => {
    test('should return recent debates for category', async () => {
      const mockDebates = [
        { id: 'debate-1', timestamp: Date.now() - 1000, category: 'programming' },
        { id: 'debate-2', timestamp: Date.now() - 2000, category: 'programming' }
      ];

      jest.spyOn(queries, 'allAsync').mockResolvedValue(mockDebates);

      const results = await queries.getDebateHistory('programming', 50);

      expect(results).toEqual(mockDebates);
    });
  });

  describe('getPerformanceTrends', () => {
    test('should return trends for model and category', async () => {
      const mockTrends = [
        { model: 'k1', category: 'programming', date: '2025-10-01', avg_score: 0.85 },
        { model: 'k1', category: 'programming', date: '2025-09-30', avg_score: 0.82 }
      ];

      jest.spyOn(queries, 'allAsync').mockResolvedValue(mockTrends);

      const results = await queries.getPerformanceTrends('k1', 'programming', 90);

      expect(results).toEqual(mockTrends);
    });

    test('should handle null category (all categories)', async () => {
      const spy = jest.spyOn(queries, 'allAsync').mockResolvedValue([]);

      await queries.getPerformanceTrends('k1', null, 90);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('getCategoryStatistics', () => {
    test('should return statistics for all categories', async () => {
      const mockStats = [
        {
          category: 'programming',
          category_name: 'Programming',
          domain: 'software',
          total_debates: 50,
          models_used: 5,
          avg_score: 0.85,
          avg_time_seconds: 45.2
        }
      ];

      jest.spyOn(queries, 'allAsync').mockResolvedValue(mockStats);

      const results = await queries.getCategoryStatistics();

      expect(results).toEqual(mockStats);
    });
  });

  describe('getModelComparison', () => {
    test('should compare multiple models', async () => {
      const mockComparison = [
        { model: 'k1', category: 'programming', avg_score: 0.88, avg_time: 18.5 },
        { model: 'k2', category: 'programming', avg_score: 0.82, avg_time: 20.1 }
      ];

      jest.spyOn(queries, 'allAsync').mockResolvedValue(mockComparison);

      const results = await queries.getModelComparison(['k1', 'k2'], 'programming');

      expect(results).toEqual(mockComparison);
    });

    test('should handle comparison without category filter', async () => {
      const spy = jest.spyOn(queries, 'allAsync').mockResolvedValue([]);

      await queries.getModelComparison(['k1', 'k2', 'k3'], null);

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('cleanupOldData', () => {
    test('should delete old debates and trends', async () => {
      const runSpy = jest.spyOn(queries, 'runAsync').mockResolvedValue({ changes: 10 });

      await queries.cleanupOldData(365);

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM debates'),
        expect.any(Array)
      );

      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM performance_trends'),
        expect.any(Array)
      );
    });

    test('should throw error on cleanup failure', async () => {
      jest.spyOn(queries, 'runAsync').mockRejectedValue(new Error('Cleanup failed'));

      await expect(queries.cleanupOldData(365))
        .rejects.toThrow('Cleanup failed');
    });
  });

  describe('getHealthMetrics', () => {
    test('should return comprehensive health metrics', async () => {
      const getSpy = jest.spyOn(queries, 'getAsync');

      getSpy.mockResolvedValueOnce({ count: 100 }); // totalDebates
      getSpy.mockResolvedValueOnce({ count: 500 }); // totalModelPerformances
      getSpy.mockResolvedValueOnce({ count: 7 });   // uniqueModels
      getSpy.mockResolvedValueOnce({ count: 15 });  // uniqueCategories
      getSpy.mockResolvedValueOnce({ count: 5 });   // recentDebates (24h)
      getSpy.mockResolvedValueOnce({ count: 30 });  // recentDebatesCount (30d)
      getSpy.mockResolvedValueOnce({ count: 10 });  // errorCount

      const metrics = await queries.getHealthMetrics();

      expect(metrics).toEqual({
        totalDebates: 100,
        totalModelPerformances: 500,
        uniqueModels: 7,
        uniqueCategories: 15,
        recentDebates: 5,
        avgDebatesPerDay: 1.0,
        errorRate: 2.0
      });
    });

    test('should handle database errors gracefully', async () => {
      jest.spyOn(queries, 'getAsync').mockRejectedValue(new Error('DB error'));

      const metrics = await queries.getHealthMetrics();

      expect(metrics).toBeNull();
    });

    test('should handle zero debates without division errors', async () => {
      const getSpy = jest.spyOn(queries, 'getAsync');

      getSpy.mockResolvedValue({ count: 0 });

      const metrics = await queries.getHealthMetrics();

      expect(metrics.errorRate).toBe(0);
      expect(metrics.avgDebatesPerDay).toBe(0);
    });
  });
});
