/**
 * Model Profiler - Builds and maintains performance profiles for each model
 *
 * Tracks model strengths, weaknesses, win rates by category, and performance metrics
 * to enable intelligent model selection and continuous improvement.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ModelProfiler {
  constructor() {
    this.profilesPath = path.join(__dirname, '../../data/model-profiles.json');
    this.dataDir = path.join(__dirname, '../../data');

    // Initialize default profiles for k1-k5 models
    this.defaultProfiles = {
      k1: {
        name: 'Claude Opus 4.1',
        role: 'Architecture',
        strengths: ['analysis', 'education', 'writing', 'system_design'],
        weaknesses: ['speed', 'cost'],
        winRate: {},
        categoryPerformance: {},
        totalDebates: 0,
        totalWins: 0,
        avgResponseTime: 0,
        costEfficiency: 0.3,
        lastUpdated: null,
        specializations: [],
        performanceTrends: []
      },
      k2: {
        name: 'GPT-5',
        role: 'Testing',
        strengths: ['testing', 'debugging', 'quality_assurance'],
        weaknesses: ['creativity', 'open_ended'],
        winRate: {},
        categoryPerformance: {},
        totalDebates: 0,
        totalWins: 0,
        avgResponseTime: 0,
        costEfficiency: 0.6,
        lastUpdated: null,
        specializations: [],
        performanceTrends: []
      },
      k3: {
        name: 'Qwen 3 Max',
        role: 'Algorithms',
        strengths: ['algorithms', 'math', 'optimization', 'data_structures'],
        weaknesses: ['language_nuance', 'creative_writing'],
        winRate: {},
        categoryPerformance: {},
        totalDebates: 0,
        totalWins: 0,
        avgResponseTime: 0,
        costEfficiency: 0.8,
        lastUpdated: null,
        specializations: [],
        performanceTrends: []
      },
      k4: {
        name: 'Gemini 2.5 Pro',
        role: 'Integration',
        strengths: ['integration', 'completeness', 'multimodal'],
        weaknesses: ['specialized_domains'],
        winRate: {},
        categoryPerformance: {},
        totalDebates: 0,
        totalWins: 0,
        avgResponseTime: 0,
        costEfficiency: 0.7,
        lastUpdated: null,
        specializations: [],
        performanceTrends: []
      },
      k5: {
        name: 'Grok 4 Fast',
        role: 'Fast Reasoning',
        strengths: ['speed', 'debugging', 'cost', 'rapid_reasoning'],
        weaknesses: ['complex_analysis', 'long_form_content'],
        winRate: {},
        categoryPerformance: {},
        totalDebates: 0,
        totalWins: 0,
        avgResponseTime: 0,
        costEfficiency: 0.9,
        lastUpdated: null,
        specializations: [],
        performanceTrends: []
      }
    };

    this.profiles = null;
  }

  async initialize() {
    // Ensure data directory exists
    await fs.mkdir(this.dataDir, { recursive: true });

    // Load existing profiles or create defaults
    await this.loadProfiles();
  }

  async loadProfiles() {
    try {
      const data = await fs.readFile(this.profilesPath, 'utf8');
      this.profiles = JSON.parse(data);

      // Merge with defaults to ensure all fields exist
      for (const modelId of Object.keys(this.defaultProfiles)) {
        if (!this.profiles[modelId]) {
          this.profiles[modelId] = { ...this.defaultProfiles[modelId] };
        } else {
          // Ensure all default fields exist
          this.profiles[modelId] = {
            ...this.defaultProfiles[modelId],
            ...this.profiles[modelId]
          };
        }
      }
    } catch (error) {
      console.log('📊 Creating new model profiles...');
      this.profiles = { ...this.defaultProfiles };
    }

    await this.saveProfiles();
  }

  async saveProfiles() {
    await fs.writeFile(
      this.profilesPath,
      JSON.stringify(this.profiles, null, 2),
      'utf8'
    );
  }

  /**
   * Update model profiles after a debate
   * @param {Object} debateResult - The completed debate result
   */
  async updateAfterDebate(debateResult) {
    const {
      question,
      category,
      participants,
      winner,
      scores,
      timings,
      selectedModels
    } = debateResult;

    console.log('📈 Updating model profiles after debate...');

    for (const modelId of selectedModels || Object.keys(this.profiles)) {
      if (!this.profiles[modelId]) continue;

      const profile = this.profiles[modelId];
      const wasWinner = winner === modelId;
      const score = scores?.[modelId] || 0;
      const responseTime = timings?.[modelId] || 0;

      // Update basic stats
      profile.totalDebates++;
      if (wasWinner) profile.totalWins++;

      // Update average response time
      if (responseTime > 0) {
        profile.avgResponseTime = profile.avgResponseTime === 0
          ? responseTime
          : (profile.avgResponseTime + responseTime) / 2;
      }

      // Update category-specific performance
      if (category) {
        if (!profile.categoryPerformance[category]) {
          profile.categoryPerformance[category] = {
            debates: 0,
            wins: 0,
            totalScore: 0,
            avgScore: 0
          };
        }

        const categoryData = profile.categoryPerformance[category];
        categoryData.debates++;
        if (wasWinner) categoryData.wins++;
        categoryData.totalScore += score;
        categoryData.avgScore = categoryData.totalScore / categoryData.debates;

        // Update win rate for this category
        profile.winRate[category] = categoryData.wins / categoryData.debates;
      }

      // Update performance trends (keep last 20 results)
      profile.performanceTrends.push({
        timestamp: Date.now(),
        category,
        score,
        won: wasWinner,
        responseTime
      });

      if (profile.performanceTrends.length > 20) {
        profile.performanceTrends.shift();
      }

      // Update specializations based on performance
      await this.updateSpecializations(modelId, profile);

      // Update strengths and weaknesses based on recent performance
      await this.updateStrengthsWeaknesses(modelId, profile);

      profile.lastUpdated = Date.now();
    }

    await this.saveProfiles();
    await this.generateInsights();
  }

  /**
   * Identify model specializations based on performance data
   */
  async updateSpecializations(modelId, profile) {
    const specializations = [];

    // Find categories where this model consistently performs well
    for (const [category, performance] of Object.entries(profile.categoryPerformance)) {
      if (performance.debates >= 3 && performance.avgScore > 0.7) {
        specializations.push({
          category,
          strength: performance.avgScore,
          confidence: Math.min(performance.debates / 10, 1.0)
        });
      }
    }

    // Sort by strength and keep top specializations
    specializations.sort((a, b) => b.strength - a.strength);
    profile.specializations = specializations.slice(0, 5);
  }

  /**
   * Update strengths and weaknesses based on recent performance
   */
  async updateStrengthsWeaknesses(modelId, profile) {
    const recentTrends = profile.performanceTrends.slice(-10);
    if (recentTrends.length < 5) return;

    // Analyze recent performance by category
    const categoryStats = {};
    recentTrends.forEach(trend => {
      if (!trend.category) return;

      if (!categoryStats[trend.category]) {
        categoryStats[trend.category] = { scores: [], wins: 0, total: 0 };
      }

      categoryStats[trend.category].scores.push(trend.score);
      categoryStats[trend.category].total++;
      if (trend.won) categoryStats[trend.category].wins++;
    });

    // Identify emerging strengths
    const emergingStrengths = [];
    const emergingWeaknesses = [];

    for (const [category, stats] of Object.entries(categoryStats)) {
      const avgScore = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
      const winRate = stats.wins / stats.total;

      if (avgScore > 0.75 && winRate > 0.6) {
        emergingStrengths.push(category);
      } else if (avgScore < 0.4 && winRate < 0.3) {
        emergingWeaknesses.push(category);
      }
    }

    // Update strengths (add new ones, keep existing)
    emergingStrengths.forEach(strength => {
      if (!profile.strengths.includes(strength)) {
        profile.strengths.push(strength);
      }
    });

    // Update weaknesses (add new ones, keep existing)
    emergingWeaknesses.forEach(weakness => {
      if (!profile.weaknesses.includes(weakness)) {
        profile.weaknesses.push(weakness);
      }
    });
  }

  /**
   * Generate insights about model performance
   */
  async generateInsights() {
    const insights = {
      timestamp: Date.now(),
      modelRankings: [],
      categorySpecialists: {},
      performanceAlerts: [],
      recommendations: []
    };

    // Rank models by overall performance
    const modelPerformance = Object.entries(this.profiles).map(([id, profile]) => ({
      id,
      name: profile.name,
      winRate: profile.totalDebates > 0 ? profile.totalWins / profile.totalDebates : 0,
      totalDebates: profile.totalDebates,
      avgScore: this.calculateOverallScore(profile),
      costEfficiency: profile.costEfficiency,
      avgResponseTime: profile.avgResponseTime
    }));

    modelPerformance.sort((a, b) => b.avgScore - a.avgScore);
    insights.modelRankings = modelPerformance;

    // Find category specialists
    const allCategories = new Set();
    Object.values(this.profiles).forEach(profile => {
      Object.keys(profile.categoryPerformance).forEach(cat => allCategories.add(cat));
    });

    for (const category of allCategories) {
      const categoryPerformers = Object.entries(this.profiles)
        .map(([id, profile]) => ({
          id,
          name: profile.name,
          performance: profile.categoryPerformance[category] || { avgScore: 0, debates: 0 }
        }))
        .filter(p => p.performance.debates >= 2)
        .sort((a, b) => b.performance.avgScore - a.performance.avgScore);

      if (categoryPerformers.length > 0) {
        insights.categorySpecialists[category] = categoryPerformers[0];
      }
    }

    // Generate performance alerts
    Object.entries(this.profiles).forEach(([id, profile]) => {
      if (profile.totalDebates >= 5) {
        const winRate = profile.totalWins / profile.totalDebates;

        if (winRate < 0.2) {
          insights.performanceAlerts.push({
            type: 'low_performance',
            modelId: id,
            message: `${profile.name} has low win rate: ${(winRate * 100).toFixed(1)}%`
          });
        }

        if (profile.avgResponseTime > 120000) { // 2 minutes
          insights.performanceAlerts.push({
            type: 'slow_response',
            modelId: id,
            message: `${profile.name} has slow response time: ${(profile.avgResponseTime / 1000).toFixed(1)}s`
          });
        }
      }
    });

    // Generate recommendations
    if (insights.modelRankings.length >= 3) {
      const topPerformer = insights.modelRankings[0];
      const bottomPerformer = insights.modelRankings[insights.modelRankings.length - 1];

      insights.recommendations.push({
        type: 'model_selection',
        message: `Consider using ${topPerformer.name} more frequently (current win rate: ${(topPerformer.winRate * 100).toFixed(1)}%)`
      });

      if (bottomPerformer.totalDebates >= 10 && bottomPerformer.winRate < 0.2) {
        insights.recommendations.push({
          type: 'model_review',
          message: `Review usage of ${bottomPerformer.name} - consistently underperforming`
        });
      }
    }

    // Save insights
    const insightsPath = path.join(this.dataDir, 'performance-insights.json');
    await fs.writeFile(insightsPath, JSON.stringify(insights, null, 2), 'utf8');

    console.log('💡 Generated performance insights:', insights.recommendations.length, 'recommendations');
  }

  /**
   * Calculate overall performance score for a model
   */
  calculateOverallScore(profile) {
    if (profile.totalDebates === 0) return 0;

    const winRate = profile.totalWins / profile.totalDebates;
    const categoryScores = Object.values(profile.categoryPerformance)
      .map(perf => perf.avgScore)
      .filter(score => score > 0);

    const avgCategoryScore = categoryScores.length > 0
      ? categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length
      : 0;

    // Weighted score: 60% win rate, 40% average category score
    return (winRate * 0.6) + (avgCategoryScore * 0.4);
  }

  /**
   * Get model profile by ID
   */
  getProfile(modelId) {
    return this.profiles?.[modelId] || null;
  }

  /**
   * Get all profiles
   */
  getAllProfiles() {
    return this.profiles || {};
  }

  /**
   * Get best performers for a specific category
   */
  getCategoryBestPerformers(category, limit = 3) {
    const performers = Object.entries(this.profiles)
      .map(([id, profile]) => ({
        id,
        name: profile.name,
        performance: profile.categoryPerformance[category] || { avgScore: 0, debates: 0, wins: 0 }
      }))
      .filter(p => p.performance.debates >= 2)
      .sort((a, b) => b.performance.avgScore - a.performance.avgScore);

    return performers.slice(0, limit);
  }

  /**
   * Get model recommendations for a specific category
   */
  getRecommendedModels(category, maxModels = 3) {
    const bestPerformers = this.getCategoryBestPerformers(category, maxModels);

    if (bestPerformers.length >= maxModels) {
      return bestPerformers.map(p => p.id);
    }

    // If not enough data, fall back to model strengths
    const strengthBasedRecommendations = Object.entries(this.profiles)
      .filter(([id, profile]) =>
        profile.strengths.some(strength =>
          category.toLowerCase().includes(strength.toLowerCase()) ||
          strength.toLowerCase().includes(category.toLowerCase())
        )
      )
      .map(([id]) => id);

    // Combine performance-based and strength-based recommendations
    const recommended = new Set([
      ...bestPerformers.map(p => p.id),
      ...strengthBasedRecommendations
    ]);

    return Array.from(recommended).slice(0, maxModels);
  }
}