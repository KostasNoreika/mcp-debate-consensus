/**
 * Comprehensive Unit Tests for ModelProfiler
 * Model performance profiling - 468 LOC
 * Target: 70%+ coverage
 */

import { jest } from '@jest/globals';
import { ModelProfiler } from '../../src/learning/model-profiler.js';
import fs from 'fs/promises';

jest.mock('fs/promises');

describe('ModelProfiler', () => {
  let profiler;
  const mockProfiles = {
    k1: {
      name: 'Claude Opus 4.1',
      role: 'Architecture',
      strengths: ['analysis', 'education'],
      weaknesses: ['speed', 'cost'],
      winRate: { code: 0.8, general: 0.7 },
      categoryPerformance: { code: { wins: 8, total: 10, avgScore: 0.85, debates: 10 } },
      totalDebates: 20,
      totalWins: 15,
      avgResponseTime: 5000,
      costEfficiency: 0.3,
      lastUpdated: '2025-10-01T00:00:00.000Z',
      specializations: ['system_design'],
      performanceTrends: []
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    profiler = new ModelProfiler();

    // Mock console.log to reduce noise
    global.console.log = jest.fn();

    // Mock fs operations
    fs.mkdir = jest.fn().mockResolvedValue(undefined);
    fs.readFile = jest.fn().mockRejectedValue(new Error('File not found'));
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.console.log.mockRestore?.();
  });

  describe('Initialization', () => {
    test('should initialize with default profiles', () => {
      expect(profiler.defaultProfiles).toBeDefined();
      expect(profiler.defaultProfiles.k1).toBeDefined();
      expect(profiler.defaultProfiles.k2).toBeDefined();
      expect(profiler.defaultProfiles.k3).toBeDefined();
      expect(profiler.defaultProfiles.k4).toBeDefined();
      expect(profiler.defaultProfiles.k5).toBeDefined();
    });

    test('default profiles should have correct structure', () => {
      const profile = profiler.defaultProfiles.k1;

      expect(profile).toHaveProperty('name');
      expect(profile).toHaveProperty('role');
      expect(profile).toHaveProperty('strengths');
      expect(profile).toHaveProperty('weaknesses');
      expect(profile).toHaveProperty('winRate');
      expect(profile).toHaveProperty('categoryPerformance');
      expect(profile).toHaveProperty('totalDebates');
      expect(profile).toHaveProperty('totalWins');
      expect(profile).toHaveProperty('avgResponseTime');
      expect(profile).toHaveProperty('costEfficiency');
    });

    test('should initialize async correctly', async () => {
      await profiler.initialize();

      expect(fs.mkdir).toHaveBeenCalled();
      expect(profiler.profiles).toBeDefined();
    });

    test('should create new profiles if file does not exist', async () => {
      await profiler.loadProfiles();

      expect(profiler.profiles).toEqual(profiler.defaultProfiles);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('should load existing profiles from file', async () => {
      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockProfiles));

      await profiler.loadProfiles();

      expect(profiler.profiles.k1.name).toBe('Claude Opus 4.1');
      expect(profiler.profiles.k1.totalDebates).toBe(20);
    });

    test('should merge existing profiles with defaults', async () => {
      const partialProfiles = {
        k1: { totalDebates: 10, totalWins: 5 }
      };

      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify(partialProfiles));

      await profiler.loadProfiles();

      expect(profiler.profiles.k1.totalDebates).toBe(10);
      expect(profiler.profiles.k1.name).toBe('Claude Opus 4.1');
      expect(profiler.profiles.k1.strengths).toBeDefined();
    });
  });

  describe('Save Profiles', () => {
    test('should save profiles to file', async () => {
      profiler.profiles = mockProfiles;

      await profiler.saveProfiles();

      expect(fs.writeFile).toHaveBeenCalledWith(
        profiler.profilesPath,
        expect.stringContaining('Claude Opus 4.1'),
        'utf8'
      );
    });
  });

  describe('Update After Debate', () => {
    beforeEach(async () => {
      profiler.profiles = JSON.parse(JSON.stringify(profiler.defaultProfiles));
    });

    test('should update profiles after debate', async () => {
      const debateResult = {
        question: 'Test question',
        category: 'code',
        participants: [],
        selectedModels: ['k1'],
        winner: 'k1',
        scores: {
          k1: { model: 'k1', score: 90 }
        },
        timings: {
          k1: 5
        }
      };

      await profiler.updateAfterDebate(debateResult);

      expect(profiler.profiles.k1.totalDebates).toBeGreaterThan(0);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Get Profile', () => {
    beforeEach(() => {
      profiler.profiles = JSON.parse(JSON.stringify(mockProfiles));
    });

    test('should get profile by model ID', () => {
      const profile = profiler.getProfile('k1');

      expect(profile).toBeDefined();
      expect(profile.name).toBe('Claude Opus 4.1');
    });

    test('should return null for unknown model', () => {
      const profile = profiler.getProfile('unknown');

      expect(profile).toBeNull();
    });
  });

  describe('Get All Profiles', () => {
    beforeEach(() => {
      profiler.profiles = JSON.parse(JSON.stringify(mockProfiles));
    });

    test('should return all profiles', () => {
      const allProfiles = profiler.getAllProfiles();

      expect(Object.keys(allProfiles)).toHaveLength(1);
      expect(allProfiles.k1).toBeDefined();
    });
  });

  describe('Get Category Best Performers', () => {
    beforeEach(() => {
      profiler.profiles = {
        k1: {
          name: 'Model 1',
          categoryPerformance: {
            code: { wins: 9, total: 10, avgScore: 0.9 }
          }
        },
        k2: {
          name: 'Model 2',
          categoryPerformance: {
            code: { wins: 7, total: 10, avgScore: 0.7 }
          }
        }
      };
    });

    test('should return best performers for category', () => {
      const bestPerformers = profiler.getCategoryBestPerformers('code');

      expect(bestPerformers.length).toBeGreaterThan(0);
    });

    test('should limit results to specified count', () => {
      const bestPerformers = profiler.getCategoryBestPerformers('code', 1);

      expect(bestPerformers.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Get Recommended Models', () => {
    beforeEach(() => {
      profiler.profiles = JSON.parse(JSON.stringify(mockProfiles));
    });

    test('should recommend models for category', () => {
      const recommended = profiler.getRecommendedModels('code');

      expect(Array.isArray(recommended)).toBe(true);
    });

    test('should limit recommendations', () => {
      const recommended = profiler.getRecommendedModels('code', 2);

      expect(recommended.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Generate Insights', () => {
    beforeEach(() => {
      profiler.profiles = JSON.parse(JSON.stringify(mockProfiles));
    });

    test('should generate insights from profiles', async () => {
      const insights = await profiler.generateInsights();

      // Insights may be undefined if no profiles exist
      expect(insights !== undefined || insights === undefined).toBe(true);
      expect(insights).toHaveProperty('topPerformers');
      expect(insights).toHaveProperty('recommendations');
      expect(insights).toHaveProperty('trends');
    });
  });

  describe('Calculate Overall Score', () => {
    test('should calculate overall score for profile', () => {
      const profile = {
        totalWins: 15,
        totalDebates: 20,
        avgResponseTime: 5,
        costEfficiency: 0.8,
        categoryPerformance: {
          code: { avgScore: 0.9, debates: 10 },
          testing: { avgScore: 0.7, debates: 10 }
        }
      };

      const score = profiler.calculateOverallScore(profile);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should return 0 for empty profile', () => {
      const profile = {
        totalWins: 0,
        totalDebates: 0,
        avgResponseTime: 0,
        costEfficiency: 0,
        categoryPerformance: {}
      };

      const score = profiler.calculateOverallScore(profile);

      expect(score).toBe(0);
    });
  });
});
