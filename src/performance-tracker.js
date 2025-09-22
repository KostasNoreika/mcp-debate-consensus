/**
 * Performance Tracker
 * Main tracking module for recording and analyzing debate performance
 */

import { DatabaseSchema, PERFORMANCE_CATEGORIES } from './database/schema.js';
import { DatabaseQueries } from './database/queries.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Performance Tracker Class
 * Handles all performance tracking and analysis operations
 */
export class PerformanceTracker {
  constructor(options = {}) {
    this.dbPath = options.dbPath || path.join(__dirname, '..', 'data', 'performance.db');
    this.schema = new DatabaseSchema(this.dbPath);
    this.queries = null;
    this.initialized = false;

    // Cost estimation (rough estimates per 1K tokens)
    this.modelCosts = {
      'Claude Opus 4.1': { input: 0.015, output: 0.075 },
      'GPT-5': { input: 0.01, output: 0.03 },
      'Qwen 3 Max': { input: 0.002, output: 0.006 },
      'Gemini 2.5 Pro': { input: 0.001, output: 0.002 },
      'Grok 4 Fast': { input: 0.0005, output: 0.0015 }
    };

    // Performance analysis cache (5 minute TTL)
    this.analysisCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the performance tracking system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await this.schema.initialize();
      this.queries = new DatabaseQueries(this.schema);
      this.initialized = true;

      console.log('📊 Performance tracker initialized successfully');

      // Log current database stats
      const stats = await this.schema.getStats();
      if (stats) {
        console.log(`   - ${stats.totalDebates} debates tracked`);
        console.log(`   - ${stats.totalModels} models analyzed`);
        console.log(`   - ${stats.totalCategories} categories available`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize performance tracker:', error);
      throw error;
    }
  }

  /**
   * Automatically categorize a question using keyword analysis
   * @param {string} question - The debate question
   * @param {string} projectPath - Project path for additional context
   * @returns {string} Best matching category ID
   */
  categorizeQuestion(question, projectPath = '') {
    const questionLower = question.toLowerCase();
    const pathLower = projectPath.toLowerCase();
    const combinedText = `${questionLower} ${pathLower}`;

    // Category keyword mappings
    const categoryKeywords = {
      'software-development': ['code', 'programming', 'software', 'development', 'coding', 'implementation', 'function', 'class', 'method'],
      'system-architecture': ['architecture', 'design', 'system', 'structure', 'pattern', 'framework', 'infrastructure'],
      'database-design': ['database', 'sql', 'schema', 'table', 'query', 'data model', 'mongodb', 'postgres'],
      'api-development': ['api', 'rest', 'graphql', 'endpoint', 'service', 'integration', 'webhook'],
      'security-implementation': ['security', 'authentication', 'authorization', 'encryption', 'vulnerability', 'secure'],
      'performance-optimization': ['performance', 'optimization', 'speed', 'efficiency', 'latency', 'throughput'],
      'devops-automation': ['devops', 'deployment', 'ci/cd', 'docker', 'kubernetes', 'automation', 'pipeline'],
      'web-development': ['web', 'html', 'css', 'javascript', 'frontend', 'backend', 'react', 'vue', 'angular'],
      'mobile-development': ['mobile', 'ios', 'android', 'app', 'flutter', 'react native', 'swift', 'kotlin'],
      'machine-learning': ['machine learning', 'ai', 'model', 'training', 'neural', 'algorithm', 'prediction'],
      'data-analysis': ['data', 'analysis', 'statistics', 'analytics', 'visualization', 'insights', 'metrics'],
      'business-strategy': ['business', 'strategy', 'planning', 'market', 'competition', 'growth', 'revenue'],
      'project-management': ['project', 'management', 'planning', 'timeline', 'resources', 'milestone', 'agile'],
      'content-creation': ['content', 'writing', 'documentation', 'blog', 'article', 'copy', 'text'],
      'creative-writing': ['creative', 'story', 'narrative', 'fiction', 'creative writing', 'literature'],
      'technical-writing': ['technical', 'documentation', 'manual', 'guide', 'specification', 'readme'],
      'legal-research': ['legal', 'law', 'contract', 'compliance', 'regulation', 'policy', 'terms'],
      'scientific-research': ['research', 'experiment', 'hypothesis', 'study', 'analysis', 'methodology'],
      'healthcare-consulting': ['health', 'medical', 'healthcare', 'wellness', 'treatment', 'diagnosis'],
      'financial-analysis': ['financial', 'finance', 'budget', 'cost', 'investment', 'profit', 'economic'],
      'education-content': ['education', 'learning', 'teaching', 'course', 'training', 'curriculum'],
      'problem-solving': ['problem', 'solution', 'solve', 'issue', 'challenge', 'troubleshoot', 'debug'],
      'decision-making': ['decision', 'choice', 'option', 'evaluate', 'compare', 'select', 'recommend']
    };

    // Score each category based on keyword matches
    const categoryScores = {};
    let maxScore = 0;
    let bestCategory = 'problem-solving'; // Default fallback

    for (const [categoryId, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (combinedText.includes(keyword)) {
          score += keyword.split(' ').length; // Multi-word keywords get higher weight
        }
      }

      categoryScores[categoryId] = score;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = categoryId;
      }
    }

    // Additional context-based scoring
    if (projectPath.includes('node_modules') || projectPath.includes('package.json')) {
      categoryScores['software-development'] += 5;
    }
    if (projectPath.includes('.git')) {
      categoryScores['devops-automation'] += 3;
    }

    // Re-evaluate best category after context scoring
    maxScore = 0;
    for (const [categoryId, score] of Object.entries(categoryScores)) {
      if (score > maxScore) {
        maxScore = score;
        bestCategory = categoryId;
      }
    }

    return bestCategory;
  }

  /**
   * Estimate complexity based on question characteristics
   * @param {string} question - The debate question
   * @param {Array} modelsUsed - Models that will be used
   * @returns {string} Complexity level: 'low', 'medium', 'high'
   */
  estimateComplexity(question, modelsUsed = []) {
    const questionLength = question.length;
    const modelCount = modelsUsed.length;

    // Complexity indicators
    const complexityKeywords = [
      'architecture', 'system', 'scalability', 'performance', 'optimization',
      'integration', 'microservices', 'distributed', 'security', 'enterprise'
    ];

    const simpleKeywords = [
      'simple', 'basic', 'quick', 'small', 'trivial', 'straightforward'
    ];

    let complexityScore = 0;

    // Question length factor
    if (questionLength > 500) complexityScore += 2;
    else if (questionLength > 200) complexityScore += 1;

    // Model count factor
    if (modelCount > 4) complexityScore += 2;
    else if (modelCount > 2) complexityScore += 1;

    // Keyword analysis
    const questionLower = question.toLowerCase();
    complexityKeywords.forEach(keyword => {
      if (questionLower.includes(keyword)) complexityScore += 1;
    });

    simpleKeywords.forEach(keyword => {
      if (questionLower.includes(keyword)) complexityScore -= 1;
    });

    // Determine complexity level
    if (complexityScore <= 1) return 'low';
    if (complexityScore <= 4) return 'medium';
    return 'high';
  }

  /**
   * Estimate token usage from text length
   * @param {string} text - Text to analyze
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost based on tokens and model
   * @param {string} modelName - Name of the model
   * @param {number} inputTokens - Input token count
   * @param {number} outputTokens - Output token count
   * @returns {number} Estimated cost in USD
   */
  estimateCost(modelName, inputTokens, outputTokens) {
    const costs = this.modelCosts[modelName];
    if (!costs) return 0;

    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;

    return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Record a complete debate result
   * @param {Object} debateResult - Result from debate orchestrator
   * @param {Object} metadata - Additional metadata
   */
  async recordDebate(debateResult, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const debateId = uuidv4();
      const timestamp = Date.now();

      // Categorize the question
      const category = metadata.category ||
        this.categorizeQuestion(metadata.question || '', metadata.projectPath);

      // Estimate complexity
      const complexity = metadata.complexity ||
        this.estimateComplexity(metadata.question || '', metadata.modelsUsed || []);

      // Prepare debate data
      const debateData = {
        id: debateId,
        timestamp,
        category,
        question: metadata.question || 'Unknown question',
        complexity,
        modelsUsed: metadata.modelsUsed || [],
        winner: debateResult.winner,
        consensusScore: debateResult.score || 0,
        userFeedback: metadata.userFeedback || null,
        projectPath: metadata.projectPath || process.cwd(),
        totalTimeSeconds: metadata.totalTimeSeconds || 0
      };

      // Prepare model performance data
      const modelPerformances = [];

      // Extract performance data from proposals
      if (metadata.proposals && typeof metadata.proposals === 'object') {
        for (const [modelName, proposal] of Object.entries(metadata.proposals)) {
          const inputTokens = this.estimateTokens(metadata.question || '');
          const outputTokens = this.estimateTokens(proposal || '');
          const cost = this.estimateCost(modelName, inputTokens, outputTokens);

          modelPerformances.push({
            model: modelName,
            score: modelName === debateResult.winner ? debateResult.score :
              (debateResult.score * 0.7 + Math.random() * 0.3), // Estimate for non-winners
            responseTimeSeconds: metadata.modelTimes?.[modelName] || null,
            tokensUsed: inputTokens + outputTokens,
            cost: cost,
            errorOccurred: false,
            errorMessage: null,
            proposalLength: proposal ? proposal.length : 0,
            improvementsProvided: metadata.improvements &&
              metadata.improvements[modelName] ? true : false
          });
        }
      }

      // Add improvement contributions
      if (metadata.improvements && typeof metadata.improvements === 'object') {
        for (const [modelName, improvement] of Object.entries(metadata.improvements)) {
          // Find existing performance record or create new one
          let perfRecord = modelPerformances.find(p => p.model === modelName);
          if (perfRecord) {
            perfRecord.improvementsProvided = true;
          } else {
            const inputTokens = this.estimateTokens(metadata.question || '');
            const outputTokens = this.estimateTokens(improvement || '');
            const cost = this.estimateCost(modelName, inputTokens, outputTokens);

            modelPerformances.push({
              model: modelName,
              score: debateResult.score * 0.8, // Improvement contributors get good scores
              responseTimeSeconds: metadata.modelTimes?.[modelName] || null,
              tokensUsed: inputTokens + outputTokens,
              cost: cost,
              errorOccurred: false,
              errorMessage: null,
              proposalLength: 0,
              improvementsProvided: true
            });
          }
        }
      }

      // Record failed models
      if (metadata.failedModels && Array.isArray(metadata.failedModels)) {
        for (const modelName of metadata.failedModels) {
          modelPerformances.push({
            model: modelName,
            score: null,
            responseTimeSeconds: null,
            tokensUsed: null,
            cost: 0,
            errorOccurred: true,
            errorMessage: 'Model failed to respond',
            proposalLength: 0,
            improvementsProvided: false
          });
        }
      }

      // Save to database
      await this.queries.recordDebate(debateData, modelPerformances);

      // Clear analysis cache since we have new data
      this.analysisCache.clear();

      console.log(`📊 Debate recorded: ${debateId} (${category}, ${complexity} complexity)`);
      console.log(`   - Winner: ${debateResult.winner} (score: ${debateResult.score})`);
      console.log(`   - Models: ${modelPerformances.length} performance records`);

      return debateId;
    } catch (error) {
      console.error('❌ Failed to record debate:', error);
      throw error;
    }
  }

  /**
   * Get performance recommendations for model selection
   * @param {string} question - The debate question
   * @param {string} projectPath - Project path for context
   * @param {Object} options - Analysis options
   * @returns {Object} Performance-based recommendations
   */
  async getPerformanceRecommendations(question, projectPath = '', options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const category = this.categorizeQuestion(question, projectPath);
      const complexity = this.estimateComplexity(question, []);

      // Check cache first
      const cacheKey = `${category}_${complexity}`;
      if (this.analysisCache.has(cacheKey)) {
        const cached = this.analysisCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      // Get best models for this category
      const categoryPerformance = await this.queries.getBestModelsForCategory(category, 10);

      // Get recent overall performance
      const recentPerformance = await this.queries.getRecentPerformance(30);

      // Get category statistics
      const allCategoryStats = await this.queries.getCategoryStatistics();
      const categoryStats = allCategoryStats.find(stat => stat.category === category);

      // Build recommendations
      const recommendations = {
        category,
        categoryName: PERFORMANCE_CATEGORIES[category] || category,
        complexity,
        categoryPerformance,
        recentPerformance,
        categoryStats,
        modelRecommendations: this.buildModelRecommendations(
          categoryPerformance,
          recentPerformance,
          complexity,
          options
        ),
        costOptimization: this.buildCostOptimization(categoryPerformance, complexity),
        confidenceMetrics: this.buildConfidenceMetrics(categoryStats, categoryPerformance)
      };

      // Cache the results
      this.analysisCache.set(cacheKey, {
        timestamp: Date.now(),
        data: recommendations
      });

      return recommendations;
    } catch (error) {
      console.error('❌ Failed to get performance recommendations:', error);
      return {
        category: this.categorizeQuestion(question, projectPath),
        error: error.message,
        modelRecommendations: [],
        costOptimization: {},
        confidenceMetrics: {}
      };
    }
  }

  /**
   * Build model recommendations based on performance data
   * @param {Array} categoryPerformance - Category-specific performance
   * @param {Array} recentPerformance - Recent overall performance
   * @param {string} complexity - Task complexity
   * @param {Object} options - Additional options
   * @returns {Array} Ranked model recommendations
   */
  buildModelRecommendations(categoryPerformance, recentPerformance, complexity, options = {}) {
    const modelScores = new Map();

    // Score models based on category performance
    categoryPerformance.forEach((perf, index) => {
      const baseScore = (categoryPerformance.length - index) / categoryPerformance.length * 100;
      const winRateBonus = perf.win_rate * 20;
      const scoreBonus = perf.avg_score * 10;

      modelScores.set(perf.model, {
        model: perf.model,
        categoryScore: baseScore + winRateBonus + scoreBonus,
        categoryWinRate: perf.win_rate,
        categoryAvgScore: perf.avg_score,
        categoryDebates: perf.total_debates,
        recentScore: 0
      });
    });

    // Add recent performance scores
    recentPerformance.forEach(perf => {
      const existing = modelScores.get(perf.model) || {
        model: perf.model,
        categoryScore: 0,
        categoryWinRate: 0,
        categoryAvgScore: 0,
        categoryDebates: 0
      };

      existing.recentScore = perf.avg_score * 20 + (perf.wins / perf.debate_count) * 30;
      existing.recentDebates = perf.debate_count;
      existing.recentWins = perf.wins;

      modelScores.set(perf.model, existing);
    });

    // Calculate final scores and rank
    const recommendations = Array.from(modelScores.values()).map(model => {
      const finalScore = (model.categoryScore * 0.7) + (model.recentScore * 0.3);

      // Adjust for complexity
      let complexityAdjustment = 0;
      if (complexity === 'high' && model.model.includes('Opus')) complexityAdjustment += 10;
      if (complexity === 'low' && model.model.includes('Fast')) complexityAdjustment += 15;
      if (complexity === 'medium' && model.model.includes('GPT')) complexityAdjustment += 5;

      return {
        ...model,
        finalScore: Math.min(100, finalScore + complexityAdjustment),
        recommendation: this.getRecommendationReason(model, complexity),
        estimatedCost: this.getEstimatedModelCost(model.model, complexity)
      };
    });

    // Sort by final score and return top recommendations
    return recommendations
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, options.maxRecommendations || 5);
  }

  /**
   * Get recommendation reason for a model
   * @param {Object} model - Model performance data
   * @param {string} complexity - Task complexity
   * @returns {string} Recommendation reason
   */
  getRecommendationReason(model, complexity) {
    const reasons = [];

    if (model.categoryWinRate > 0.8) reasons.push('excellent category performance');
    if (model.categoryDebates > 10) reasons.push('proven track record');
    if (model.recentScore > 80) reasons.push('strong recent performance');

    if (complexity === 'high' && model.model.includes('Opus')) {
      reasons.push('optimal for complex tasks');
    }
    if (complexity === 'low' && model.model.includes('Fast')) {
      reasons.push('cost-efficient for simple tasks');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'balanced performance';
  }

  /**
   * Estimate cost for a model based on complexity
   * @param {string} modelName - Model name
   * @param {string} complexity - Task complexity
   * @returns {number} Estimated cost in USD
   */
  getEstimatedModelCost(modelName, complexity) {
    const baseCosts = this.modelCosts[modelName];
    if (!baseCosts) return 0;

    // Estimate tokens based on complexity
    const tokenMultipliers = { low: 1000, medium: 2500, high: 5000 };
    const tokens = tokenMultipliers[complexity] || 2500;

    return this.estimateCost(modelName, tokens * 0.3, tokens * 0.7);
  }

  /**
   * Build cost optimization recommendations
   * @param {Array} categoryPerformance - Category performance data
   * @param {string} complexity - Task complexity
   * @returns {Object} Cost optimization suggestions
   */
  buildCostOptimization(categoryPerformance, complexity) {
    const costEffective = categoryPerformance
      .filter(p => p.avg_cost > 0)
      .map(p => ({
        model: p.model,
        winRate: p.win_rate,
        avgCost: p.avg_cost,
        costEfficiency: p.win_rate / p.avg_cost
      }))
      .sort((a, b) => b.costEfficiency - a.costEfficiency)
      .slice(0, 3);

    return {
      mostCostEffective: costEffective,
      recommendations: this.generateCostRecommendations(costEffective, complexity)
    };
  }

  /**
   * Generate cost optimization recommendations
   * @param {Array} costEffective - Cost-effective models
   * @param {string} complexity - Task complexity
   * @returns {Array} Cost recommendations
   */
  generateCostRecommendations(costEffective, complexity) {
    const recommendations = [];

    if (costEffective.length > 0) {
      const best = costEffective[0];
      recommendations.push(
        `Use ${best.model} for best cost efficiency (${(best.costEfficiency * 100).toFixed(1)}% win rate per dollar)`
      );
    }

    if (complexity === 'low') {
      recommendations.push('Consider using faster, cheaper models for simple tasks');
    }

    if (complexity === 'high') {
      recommendations.push('Invest in premium models for complex tasks to ensure quality');
    }

    return recommendations;
  }

  /**
   * Build confidence metrics for recommendations
   * @param {Object} categoryStats - Category statistics
   * @param {Array} categoryPerformance - Category performance data
   * @returns {Object} Confidence metrics
   */
  buildConfidenceMetrics(categoryStats, categoryPerformance) {
    if (!categoryStats) {
      return {
        confidence: 'low',
        reason: 'No historical data for this category',
        dataPoints: 0
      };
    }

    const totalDebates = categoryStats.total_debates || 0;
    const modelsUsed = categoryStats.models_used || 0;

    let confidence = 'low';
    let reason = 'Insufficient data';

    if (totalDebates >= 50 && modelsUsed >= 3) {
      confidence = 'high';
      reason = 'Strong historical data with multiple models';
    } else if (totalDebates >= 20 && modelsUsed >= 2) {
      confidence = 'medium';
      reason = 'Moderate historical data';
    } else if (totalDebates >= 5) {
      confidence = 'low';
      reason = 'Limited historical data';
    }

    return {
      confidence,
      reason,
      dataPoints: totalDebates,
      modelsAnalyzed: modelsUsed,
      avgScore: categoryStats.avg_score || 0
    };
  }

  /**
   * Get performance analytics dashboard data
   * @param {Object} options - Analytics options
   * @returns {Object} Dashboard data
   */
  async getAnalyticsDashboard(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const dashboardData = {
        overview: await this.getOverviewStats(),
        categoryBreakdown: await this.queries.getCategoryStatistics(),
        modelComparison: await this.getModelComparisonData(options.models),
        recentTrends: await this.getRecentTrends(options.days || 30),
        performanceInsights: await this.getPerformanceInsights(),
        healthMetrics: await this.queries.getHealthMetrics()
      };

      return dashboardData;
    } catch (error) {
      console.error('❌ Failed to get analytics dashboard:', error);
      throw error;
    }
  }

  /**
   * Get overview statistics
   * @returns {Object} Overview stats
   */
  async getOverviewStats() {
    const stats = await this.schema.getStats();
    const recentPerformance = await this.queries.getRecentPerformance(7);

    const totalCost = recentPerformance.reduce((sum, perf) => sum + (perf.avg_cost || 0), 0);
    const avgScore = recentPerformance.length > 0 ?
      recentPerformance.reduce((sum, perf) => sum + perf.avg_score, 0) / recentPerformance.length : 0;

    return {
      ...stats,
      recentWeekDebates: recentPerformance.reduce((sum, perf) => sum + perf.debate_count, 0),
      avgRecentScore: Math.round(avgScore * 10) / 10,
      estimatedWeeklyCost: Math.round(totalCost * 100) / 100
    };
  }

  /**
   * Get model comparison data
   * @param {Array} models - Models to compare
   * @returns {Array} Comparison data
   */
  async getModelComparisonData(models = null) {
    if (!models) {
      // Get all unique models from recent performance
      const recentPerf = await this.queries.getRecentPerformance(90);
      models = [...new Set(recentPerf.map(p => p.model))];
    }

    return await this.queries.getModelComparison(models);
  }

  /**
   * Get recent performance trends
   * @param {number} days - Number of days to analyze
   * @returns {Object} Trend data
   */
  async getRecentTrends(days = 30) {
    const recentPerf = await this.queries.getRecentPerformance(days);

    // Group by model for trend analysis
    const modelTrends = {};
    recentPerf.forEach(perf => {
      if (!modelTrends[perf.model]) {
        modelTrends[perf.model] = {
          model: perf.model,
          totalDebates: 0,
          totalWins: 0,
          avgScore: 0,
          trend: 'stable'
        };
      }

      const trend = modelTrends[perf.model];
      trend.totalDebates += perf.debate_count;
      trend.totalWins += perf.wins;
      trend.avgScore = perf.avg_score;
    });

    return {
      period: `${days} days`,
      modelTrends: Object.values(modelTrends),
      totalDebates: recentPerf.reduce((sum, p) => sum + p.debate_count, 0)
    };
  }

  /**
   * Get performance insights and recommendations
   * @returns {Object} Performance insights
   */
  async getPerformanceInsights() {
    const insights = [];
    const recentPerf = await this.queries.getRecentPerformance(30);
    const categoryStats = await this.queries.getCategoryStatistics();

    // Identify top performing models
    const topModels = recentPerf
      .filter(p => p.debate_count >= 3)
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 3);

    if (topModels.length > 0) {
      insights.push({
        type: 'success',
        title: 'Top Performing Models',
        message: `${topModels.map(m => m.model).join(', ')} showing excellent performance`,
        data: topModels
      });
    }

    // Identify underused categories
    const underusedCategories = categoryStats
      .filter(c => c.total_debates < 5 && c.total_debates > 0)
      .slice(0, 3);

    if (underusedCategories.length > 0) {
      insights.push({
        type: 'info',
        title: 'Underutilized Categories',
        message: `Categories with limited data: ${underusedCategories.map(c => c.category_name).join(', ')}`,
        data: underusedCategories
      });
    }

    // Cost optimization opportunities
    const highCostModels = recentPerf
      .filter(p => p.avg_cost > 0.1) // Threshold for high cost
      .sort((a, b) => b.avg_cost - a.avg_cost);

    if (highCostModels.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Cost Optimization Opportunity',
        message: `Consider alternative models for cost reduction`,
        data: highCostModels.slice(0, 2)
      });
    }

    return insights;
  }

  /**
   * Export performance data for external analysis
   * @param {Object} options - Export options
   * @returns {Object} Exported data
   */
  async exportPerformanceData(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const stats = await this.schema.getStats();
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalDebates: stats?.totalDebates || 0,
        categories: Object.keys(PERFORMANCE_CATEGORIES).length
      },
      categories: PERFORMANCE_CATEGORIES,
      categoryStats: await this.queries.getCategoryStatistics(),
      recentPerformance: await this.queries.getRecentPerformance(options.days || 90),
      healthMetrics: await this.queries.getHealthMetrics()
    };

    if (options.includeDetailedHistory) {
      exportData.detailedHistory = {};
      for (const category of Object.keys(PERFORMANCE_CATEGORIES)) {
        exportData.detailedHistory[category] = await this.queries.getDebateHistory(category, 100);
      }
    }

    return exportData;
  }

  /**
   * Close the performance tracker and database connections
   */
  async close() {
    if (this.schema) {
      this.schema.close();
    }
    this.initialized = false;
    this.analysisCache.clear();
  }
}

export default PerformanceTracker;