/**
 * Pattern Detector - Identifies performance patterns and unexpected behaviors
 *
 * Analyzes historical debate data to find surprising wins, consistent failures,
 * category specialists, and other patterns that inform model selection.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PatternDetector {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.patternsPath = path.join(this.dataDir, 'detected-patterns.json');
    this.historyPath = path.join(__dirname, '../../logs');

    this.patterns = {
      underdogWins: [],
      consistentFailures: [],
      specialists: {},
      emergingTrends: [],
      performanceShifts: [],
      categoryInsights: {},
      modelSynergies: [],
      timeBasedPatterns: [],
      lastAnalyzed: null
    };
  }

  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.loadPatterns();
  }

  async loadPatterns() {
    try {
      const data = await fs.readFile(this.patternsPath, 'utf8');
      this.patterns = { ...this.patterns, ...JSON.parse(data) };
    } catch (error) {
      console.log('🔍 Creating new pattern detection database...');
    }
  }

  async savePatterns() {
    await fs.writeFile(
      this.patternsPath,
      JSON.stringify(this.patterns, null, 2),
      'utf8'
    );
  }

  /**
   * Main pattern detection method - analyzes all available debate history
   */
  async detectPatterns() {
    console.log('🔍 Analyzing patterns in debate history...');

    const debates = await this.loadDebateHistory();
    if (debates.length < 10) {
      console.log('📊 Insufficient data for pattern analysis (need 10+ debates)');
      return this.patterns;
    }

    // Run all pattern detection algorithms
    await this.findUnderdogWins(debates);
    await this.findConsistentFailures(debates);
    await this.detectSpecialists(debates);
    await this.findEmergingTrends(debates);
    await this.detectPerformanceShifts(debates);
    await this.analyzeCategoryInsights(debates);
    await this.findModelSynergies(debates);
    await this.detectTimeBasedPatterns(debates);

    this.patterns.lastAnalyzed = Date.now();
    await this.savePatterns();

    console.log('✅ Pattern analysis complete');
    return this.patterns;
  }

  /**
   * Load debate history from log files
   */
  async loadDebateHistory() {
    try {
      const files = await fs.readdir(this.historyPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const debates = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.historyPath, file);
          const data = await fs.readFile(filePath, 'utf8');
          const debate = JSON.parse(data);

          // Normalize debate data structure
          if (debate.timestamp && debate.question) {
            debates.push({
              id: debate.id || file.replace('.json', ''),
              timestamp: debate.timestamp,
              question: debate.question,
              category: debate.category || this.inferCategory(debate.question),
              participants: debate.participants || debate.selectedModels || [],
              winner: debate.winner || debate.initialWinner,
              scores: debate.scores || {},
              timings: debate.timings || {},
              selectionAnalysis: debate.selectionAnalysis
            });
          }
        } catch (error) {
          console.warn(`Failed to parse debate file ${file}:`, error.message);
        }
      }

      // Sort by timestamp
      debates.sort((a, b) => a.timestamp - b.timestamp);
      return debates;
    } catch (error) {
      console.error('Failed to load debate history:', error.message);
      return [];
    }
  }

  /**
   * Infer category from question text if not provided
   */
  inferCategory(question) {
    const questionLower = question.toLowerCase();

    const categoryKeywords = {
      'tech/debug': ['debug', 'error', 'bug', 'fix', 'issue', 'problem'],
      'tech/code': ['code', 'function', 'algorithm', 'implement', 'programming'],
      'tech/architecture': ['design', 'architecture', 'system', 'structure', 'pattern'],
      'education/explain': ['explain', 'how', 'what', 'why', 'teach', 'understand'],
      'business/strategy': ['business', 'strategy', 'market', 'company', 'revenue'],
      'creative/writing': ['write', 'story', 'creative', 'article', 'content'],
      'math/calculation': ['calculate', 'math', 'formula', 'equation', 'solve'],
      'analysis/data': ['analyze', 'data', 'statistics', 'research', 'study']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => questionLower.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Find cases where unexpected models won (underdogs)
   */
  async findUnderdogWins(debates) {
    this.patterns.underdogWins = [];

    const modelStrengths = {
      k1: ['analysis', 'education', 'writing', 'system_design'],
      k2: ['testing', 'debugging', 'quality_assurance'],
      k3: ['algorithms', 'math', 'optimization'],
      k4: ['integration', 'completeness', 'multimodal'],
      k5: ['speed', 'debugging', 'rapid_reasoning']
    };

    for (const debate of debates) {
      if (!debate.winner || !debate.category) continue;

      const winnerStrengths = modelStrengths[debate.winner] || [];
      const categoryLower = debate.category.toLowerCase();

      // Check if winner's strengths don't obviously match the category
      const isExpectedWin = winnerStrengths.some(strength =>
        categoryLower.includes(strength.toLowerCase()) ||
        strength.toLowerCase().includes(categoryLower.split('/')[1] || categoryLower)
      );

      if (!isExpectedWin) {
        this.patterns.underdogWins.push({
          debateId: debate.id,
          timestamp: debate.timestamp,
          winner: debate.winner,
          category: debate.category,
          question: debate.question.substring(0, 100) + '...',
          expectedStrengths: winnerStrengths,
          actualCategory: debate.category,
          score: debate.scores?.[debate.winner] || 0
        });
      }
    }

    // Keep only recent underdog wins (last 50 debates)
    this.patterns.underdogWins = this.patterns.underdogWins.slice(-50);
  }

  /**
   * Find models that consistently fail in certain categories
   */
  async findConsistentFailures(debates) {
    this.patterns.consistentFailures = [];

    const modelCategoryPerformance = {};

    for (const debate of debates) {
      if (!debate.participants || !debate.category) continue;

      for (const modelId of debate.participants) {
        if (!modelCategoryPerformance[modelId]) {
          modelCategoryPerformance[modelId] = {};
        }

        if (!modelCategoryPerformance[modelId][debate.category]) {
          modelCategoryPerformance[modelId][debate.category] = {
            total: 0,
            wins: 0,
            losses: 0
          };
        }

        const performance = modelCategoryPerformance[modelId][debate.category];
        performance.total++;

        if (debate.winner === modelId) {
          performance.wins++;
        } else {
          performance.losses++;
        }
      }
    }

    // Find consistent failures (< 20% win rate with 5+ attempts)
    for (const [modelId, categories] of Object.entries(modelCategoryPerformance)) {
      for (const [category, performance] of Object.entries(categories)) {
        if (performance.total >= 5) {
          const winRate = performance.wins / performance.total;

          if (winRate < 0.2) {
            this.patterns.consistentFailures.push({
              modelId,
              category,
              winRate,
              totalAttempts: performance.total,
              wins: performance.wins,
              severity: winRate < 0.1 ? 'critical' : 'moderate'
            });
          }
        }
      }
    }
  }

  /**
   * Detect category specialists
   */
  async detectSpecialists(debates) {
    this.patterns.specialists = {};

    const categoryPerformance = {};

    for (const debate of debates) {
      if (!debate.category || !debate.participants) continue;

      if (!categoryPerformance[debate.category]) {
        categoryPerformance[debate.category] = {};
      }

      for (const modelId of debate.participants) {
        if (!categoryPerformance[debate.category][modelId]) {
          categoryPerformance[debate.category][modelId] = {
            total: 0,
            wins: 0,
            totalScore: 0
          };
        }

        const performance = categoryPerformance[debate.category][modelId];
        performance.total++;

        if (debate.winner === modelId) {
          performance.wins++;
        }

        performance.totalScore += debate.scores?.[modelId] || 0;
      }
    }

    // Find specialists (> 60% win rate with 5+ attempts)
    for (const [category, models] of Object.entries(categoryPerformance)) {
      const specialists = [];

      for (const [modelId, performance] of Object.entries(models)) {
        if (performance.total >= 5) {
          const winRate = performance.wins / performance.total;
          const avgScore = performance.totalScore / performance.total;

          if (winRate > 0.6) {
            specialists.push({
              modelId,
              winRate,
              avgScore,
              totalDebates: performance.total,
              confidence: Math.min(performance.total / 10, 1.0)
            });
          }
        }
      }

      if (specialists.length > 0) {
        specialists.sort((a, b) => b.winRate - a.winRate);
        this.patterns.specialists[category] = specialists;
      }
    }
  }

  /**
   * Find emerging trends in model performance
   */
  async findEmergingTrends(debates) {
    this.patterns.emergingTrends = [];

    if (debates.length < 20) return;

    // Analyze recent vs historical performance
    const recentDebates = debates.slice(-20);
    const historicalDebates = debates.slice(0, -20);

    const recentPerformance = this.calculateModelPerformance(recentDebates);
    const historicalPerformance = this.calculateModelPerformance(historicalDebates);

    for (const modelId of Object.keys(recentPerformance)) {
      if (historicalPerformance[modelId]) {
        const recentWinRate = recentPerformance[modelId].winRate;
        const historicalWinRate = historicalPerformance[modelId].winRate;
        const improvement = recentWinRate - historicalWinRate;

        if (Math.abs(improvement) > 0.2) { // Significant change
          this.patterns.emergingTrends.push({
            modelId,
            type: improvement > 0 ? 'improving' : 'declining',
            recentWinRate,
            historicalWinRate,
            improvement,
            recentDebates: recentPerformance[modelId].total,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * Detect significant performance shifts
   */
  async detectPerformanceShifts(debates) {
    this.patterns.performanceShifts = [];

    if (debates.length < 30) return;

    // Look for performance changes in sliding windows
    const windowSize = 10;
    const modelWindows = {};

    for (let i = windowSize; i < debates.length; i++) {
      const window = debates.slice(i - windowSize, i);
      const windowPerformance = this.calculateModelPerformance(window);

      for (const [modelId, performance] of Object.entries(windowPerformance)) {
        if (!modelWindows[modelId]) {
          modelWindows[modelId] = [];
        }

        modelWindows[modelId].push({
          startIndex: i - windowSize,
          endIndex: i,
          winRate: performance.winRate,
          avgScore: performance.avgScore,
          timestamp: window[window.length - 1].timestamp
        });
      }
    }

    // Find significant shifts
    for (const [modelId, windows] of Object.entries(modelWindows)) {
      if (windows.length < 3) continue;

      for (let i = 1; i < windows.length; i++) {
        const prev = windows[i - 1];
        const current = windows[i];

        const winRateShift = current.winRate - prev.winRate;
        const scoreShift = current.avgScore - prev.avgScore;

        if (Math.abs(winRateShift) > 0.3 || Math.abs(scoreShift) > 0.2) {
          this.patterns.performanceShifts.push({
            modelId,
            shiftType: winRateShift > 0 ? 'improvement' : 'decline',
            winRateShift,
            scoreShift,
            beforePeriod: prev,
            afterPeriod: current,
            significance: Math.abs(winRateShift) + Math.abs(scoreShift)
          });
        }
      }
    }

    // Keep only the most significant shifts
    this.patterns.performanceShifts.sort((a, b) => b.significance - a.significance);
    this.patterns.performanceShifts = this.patterns.performanceShifts.slice(0, 20);
  }

  /**
   * Analyze category-specific insights
   */
  async analyzeCategoryInsights(debates) {
    this.patterns.categoryInsights = {};

    const categoryData = {};

    for (const debate of debates) {
      if (!debate.category) continue;

      if (!categoryData[debate.category]) {
        categoryData[debate.category] = {
          debates: [],
          modelPerformance: {},
          avgDebateTime: 0,
          commonPatterns: []
        };
      }

      categoryData[debate.category].debates.push(debate);

      // Track model performance per category
      for (const modelId of debate.participants || []) {
        if (!categoryData[debate.category].modelPerformance[modelId]) {
          categoryData[debate.category].modelPerformance[modelId] = {
            total: 0,
            wins: 0,
            totalScore: 0
          };
        }

        const perf = categoryData[debate.category].modelPerformance[modelId];
        perf.total++;
        if (debate.winner === modelId) perf.wins++;
        perf.totalScore += debate.scores?.[modelId] || 0;
      }
    }

    // Generate insights for each category
    for (const [category, data] of Object.entries(categoryData)) {
      if (data.debates.length < 5) continue;

      const insights = {
        totalDebates: data.debates.length,
        avgParticipants: data.debates.reduce((sum, d) => sum + (d.participants?.length || 0), 0) / data.debates.length,
        topPerformers: [],
        consistentWinners: [],
        recommendations: []
      };

      // Find top performers
      const performers = Object.entries(data.modelPerformance)
        .map(([modelId, perf]) => ({
          modelId,
          winRate: perf.wins / perf.total,
          avgScore: perf.totalScore / perf.total,
          totalDebates: perf.total
        }))
        .filter(p => p.totalDebates >= 3)
        .sort((a, b) => b.winRate - a.winRate);

      insights.topPerformers = performers.slice(0, 3);

      // Find consistent winners (>70% win rate)
      insights.consistentWinners = performers.filter(p => p.winRate > 0.7);

      // Generate recommendations
      if (insights.consistentWinners.length > 0) {
        insights.recommendations.push({
          type: 'prefer_models',
          models: insights.consistentWinners.map(w => w.modelId),
          reason: 'Consistently high performance in this category'
        });
      }

      if (performers.length > 0 && performers[0].winRate > 0.8) {
        insights.recommendations.push({
          type: 'single_model_optimization',
          model: performers[0].modelId,
          reason: `Dominant performer with ${(performers[0].winRate * 100).toFixed(1)}% win rate`
        });
      }

      this.patterns.categoryInsights[category] = insights;
    }
  }

  /**
   * Find model synergies (combinations that work well together)
   */
  async findModelSynergies(debates) {
    this.patterns.modelSynergies = [];

    if (debates.length < 20) return;

    const combinationPerformance = {};

    for (const debate of debates) {
      if (!debate.participants || debate.participants.length < 2) continue;

      // Generate all combinations of participating models
      const participants = debate.participants.sort();
      const key = participants.join('+');

      if (!combinationPerformance[key]) {
        combinationPerformance[key] = {
          models: participants,
          total: 0,
          qualityScores: [],
          categories: new Set()
        };
      }

      const combo = combinationPerformance[key];
      combo.total++;

      if (debate.category) {
        combo.categories.add(debate.category);
      }

      // Calculate quality score based on average participant scores
      const scores = Object.values(debate.scores || {});
      if (scores.length > 0) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        combo.qualityScores.push(avgScore);
      }
    }

    // Find high-performing combinations
    for (const [key, combo] of Object.entries(combinationPerformance)) {
      if (combo.total >= 5 && combo.qualityScores.length >= 3) {
        const avgQuality = combo.qualityScores.reduce((a, b) => a + b, 0) / combo.qualityScores.length;

        if (avgQuality > 0.7) {
          this.patterns.modelSynergies.push({
            models: combo.models,
            totalDebates: combo.total,
            avgQuality,
            categories: Array.from(combo.categories),
            synergy: 'high'
          });
        }
      }
    }

    this.patterns.modelSynergies.sort((a, b) => b.avgQuality - a.avgQuality);
  }

  /**
   * Detect time-based patterns
   */
  async detectTimeBasedPatterns(debates) {
    this.patterns.timeBasedPatterns = [];

    if (debates.length < 30) return;

    // Analyze performance by time of day, day of week, etc.
    const timeAnalysis = {
      hourly: {},
      daily: {},
      weekly: {}
    };

    for (const debate of debates) {
      const date = new Date(debate.timestamp);
      const hour = date.getHours();
      const day = date.getDay(); // 0 = Sunday
      const dayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];

      // Hourly analysis
      if (!timeAnalysis.hourly[hour]) {
        timeAnalysis.hourly[hour] = { debates: 0, avgQuality: 0, totalQuality: 0 };
      }
      const hourData = timeAnalysis.hourly[hour];
      hourData.debates++;

      // Daily analysis
      if (!timeAnalysis.daily[dayKey]) {
        timeAnalysis.daily[dayKey] = { debates: 0, avgQuality: 0, totalQuality: 0 };
      }
      const dayData = timeAnalysis.daily[dayKey];
      dayData.debates++;

      // Calculate quality score
      const scores = Object.values(debate.scores || {});
      if (scores.length > 0) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        hourData.totalQuality += avgScore;
        dayData.totalQuality += avgScore;
      }
    }

    // Calculate averages and find patterns
    for (const period of ['hourly', 'daily']) {
      for (const [timeKey, data] of Object.entries(timeAnalysis[period])) {
        if (data.debates >= 3) {
          data.avgQuality = data.totalQuality / data.debates;

          if (data.avgQuality > 0.8 || data.avgQuality < 0.4) {
            this.patterns.timeBasedPatterns.push({
              period,
              time: timeKey,
              debates: data.debates,
              avgQuality: data.avgQuality,
              pattern: data.avgQuality > 0.8 ? 'high_performance' : 'low_performance'
            });
          }
        }
      }
    }
  }

  /**
   * Calculate model performance metrics for a set of debates
   */
  calculateModelPerformance(debates) {
    const performance = {};

    for (const debate of debates) {
      if (!debate.participants) continue;

      for (const modelId of debate.participants) {
        if (!performance[modelId]) {
          performance[modelId] = {
            total: 0,
            wins: 0,
            totalScore: 0
          };
        }

        performance[modelId].total++;
        if (debate.winner === modelId) {
          performance[modelId].wins++;
        }
        performance[modelId].totalScore += debate.scores?.[modelId] || 0;
      }
    }

    // Calculate derived metrics
    for (const [modelId, data] of Object.entries(performance)) {
      data.winRate = data.total > 0 ? data.wins / data.total : 0;
      data.avgScore = data.total > 0 ? data.totalScore / data.total : 0;
    }

    return performance;
  }

  /**
   * Get patterns summary for reporting
   */
  getPatternsSummary() {
    return {
      lastAnalyzed: this.patterns.lastAnalyzed,
      underdogWins: this.patterns.underdogWins.length,
      consistentFailures: this.patterns.consistentFailures.length,
      specialists: Object.keys(this.patterns.specialists).length,
      emergingTrends: this.patterns.emergingTrends.length,
      performanceShifts: this.patterns.performanceShifts.length,
      categoryInsights: Object.keys(this.patterns.categoryInsights).length,
      modelSynergies: this.patterns.modelSynergies.length,
      timeBasedPatterns: this.patterns.timeBasedPatterns.length
    };
  }

  /**
   * Get specific pattern data
   */
  getPatterns() {
    return this.patterns;
  }
}