/**
 * Learning System Coordinator - Main interface for the learning capabilities
 *
 * Orchestrates model profiling, pattern detection, and optimization to provide
 * intelligent model selection and continuous improvement.
 */

import { ModelProfiler } from './model-profiler.js';
import { PatternDetector } from './pattern-detector.js';
import { LearningOptimizer } from './optimizer.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class LearningSystem {
  constructor() {
    // Initialize core components
    this.modelProfiler = new ModelProfiler();
    this.patternDetector = new PatternDetector();
    this.optimizer = new LearningOptimizer(this.modelProfiler, this.patternDetector);

    // System state
    this.isInitialized = false;
    this.learningEnabled = process.env.DEBATE_LEARNING_ENABLED !== 'false';
    this.dataDir = path.join(__dirname, '../../data');
    this.reportsDir = path.join(this.dataDir, 'reports');

    // Configuration
    this.config = {
      minDebatesForOptimization: 10,
      patternDetectionInterval: 20, // Run pattern detection every 20 debates
      reportGenerationInterval: 50, // Generate comprehensive reports every 50 debates
      autoOptimizationThreshold: 50, // Start auto-optimization after 50 debates
      confidenceThreshold: 0.7, // Minimum confidence for auto-suggestions
      maxHistoryDays: 365 // Keep learning data for 1 year
    };

    // Learning statistics
    this.stats = {
      totalDebatesAnalyzed: 0,
      patternsDetected: 0,
      optimizationsApplied: 0,
      costSavingsAchieved: 0,
      performanceImprovements: 0,
      lastAnalysis: null,
      lastOptimization: null
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    console.log('🧠 Initializing Learning System...');

    if (!this.learningEnabled) {
      console.log('📚 Learning system disabled via environment variable');
      return;
    }

    // Create necessary directories
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.reportsDir, { recursive: true });

    // Initialize components
    await this.modelProfiler.initialize();
    await this.patternDetector.initialize();
    await this.optimizer.initialize();

    // Load existing statistics
    await this.loadStats();

    console.log('✅ Learning System initialized');
    console.log(`📊 Total debates analyzed: ${this.stats.totalDebatesAnalyzed}`);
    console.log(`🔍 Patterns detected: ${this.stats.patternsDetected}`);
    console.log(`⚡ Optimizations applied: ${this.stats.optimizationsApplied}`);

    this.isInitialized = true;
  }

  /**
   * Process a completed debate for learning
   * @param {Object} debateResult - The completed debate result
   */
  async processDebate(debateResult) {
    if (!this.learningEnabled || !this.isInitialized) return;

    console.log('📚 Processing debate for learning...');

    try {
      // Update model profiles
      await this.modelProfiler.updateAfterDebate(debateResult);

      // Increment stats
      this.stats.totalDebatesAnalyzed++;
      this.stats.lastAnalysis = Date.now();

      // Run pattern detection periodically
      if (this.stats.totalDebatesAnalyzed % this.config.patternDetectionInterval === 0) {
        console.log('🔍 Running periodic pattern detection...');
        await this.patternDetector.detectPatterns();
        this.stats.patternsDetected++;
      }

      // Learn optimizations
      await this.optimizer.learnFromDebate(debateResult);
      this.stats.optimizationsApplied++;

      // Track cost savings if available
      if (debateResult.costReduction && debateResult.costReduction > 0) {
        this.stats.costSavingsAchieved += debateResult.costReduction;
      }

      // Generate comprehensive reports periodically
      if (this.stats.totalDebatesAnalyzed % this.config.reportGenerationInterval === 0) {
        console.log('📋 Generating comprehensive learning report...');
        await this.generateComprehensiveReport();
      }

      // Save updated statistics
      await this.saveStats();

      console.log(`✅ Learning completed (${this.stats.totalDebatesAnalyzed} total debates processed)`);

    } catch (error) {
      console.error('❌ Error during learning process:', error.message);
    }
  }

  /**
   * Get optimal model selection for a given question/category
   * @param {string} question - The question/task to analyze
   * @param {Object} context - Additional context for optimization
   * @returns {Object} Optimization result with model selection and reasoning
   */
  async getOptimalSelection(question, context = {}) {
    if (!this.learningEnabled || !this.isInitialized) {
      return this.getFallbackSelection();
    }

    try {
      // Infer category from question if not provided
      const category = context.category || this.inferCategory(question);
      console.log(`🎯 Learning-based optimization for category: ${category}`);

      // Get optimization from the optimizer
      const optimization = await this.optimizer.optimizeSelection(category, context);

      // Add learning system metadata
      optimization.learningSystem = {
        enabled: true,
        totalDebates: this.stats.totalDebatesAnalyzed,
        confidence: optimization.metrics.confidence,
        recommendationSource: 'learning_system'
      };

      return optimization;

    } catch (error) {
      console.warn('⚠️ Learning-based optimization failed, using fallback:', error.message);
      return this.getFallbackSelection();
    }
  }

  /**
   * Infer category from question text
   */
  inferCategory(question) {
    const questionLower = question.toLowerCase();

    const categoryPatterns = {
      'tech/debug': ['debug', 'error', 'bug', 'fix', 'issue', 'problem', 'troubleshoot'],
      'tech/code': ['code', 'function', 'implement', 'programming', 'develop', 'script'],
      'tech/architecture': ['design', 'architecture', 'system', 'structure', 'pattern', 'framework'],
      'education/explain': ['explain', 'how', 'what', 'why', 'teach', 'understand', 'clarify'],
      'business/strategy': ['business', 'strategy', 'market', 'company', 'revenue', 'plan'],
      'creative/writing': ['write', 'story', 'creative', 'article', 'content', 'blog'],
      'math/calculation': ['calculate', 'math', 'formula', 'equation', 'solve', 'compute'],
      'analysis/data': ['analyze', 'data', 'statistics', 'research', 'study', 'examine']
    };

    // Score each category based on keyword matches
    let bestCategory = 'general';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categoryPatterns)) {
      const score = keywords.reduce((count, keyword) => {
        return count + (questionLower.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  /**
   * Get fallback selection when learning system is unavailable
   */
  getFallbackSelection() {
    return {
      models: [
        { id: 'k1', score: 0.8, confidence: 0.5, cost: 1.0, strategy: 'fallback' },
        { id: 'k2', score: 0.7, confidence: 0.5, cost: 0.7, strategy: 'fallback' },
        { id: 'k3', score: 0.6, confidence: 0.5, cost: 0.3, strategy: 'fallback' }
      ],
      metrics: {
        costReduction: 0,
        expectedPerformance: 0.7,
        confidence: 0.5
      },
      strategy: 'fallback',
      reasoning: 'Learning system unavailable, using default selection',
      learningSystem: {
        enabled: false,
        recommendationSource: 'fallback'
      }
    };
  }

  /**
   * Generate comprehensive learning report
   */
  async generateComprehensiveReport() {
    const report = {
      timestamp: Date.now(),
      systemStatus: await this.getSystemStatus(),
      modelPerformance: await this.getModelPerformanceReport(),
      patternSummary: await this.getPatternSummary(),
      optimizationResults: await this.getOptimizationResults(),
      recommendations: await this.generateRecommendations(),
      costAnalysis: await this.getCostAnalysis(),
      learningProgress: await this.getLearningProgress()
    };

    try {
      // Save report
      const reportPath = path.join(this.reportsDir, `learning-report-${Date.now()}.json`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

      // Generate human-readable summary
      const summaryPath = path.join(this.reportsDir, `learning-summary-${Date.now()}.md`);
      const summary = this.formatReportSummary(report);
      await fs.writeFile(summaryPath, summary, 'utf8');

      console.log(`📋 Comprehensive report saved: ${reportPath}`);
      console.log(`📄 Summary saved: ${summaryPath}`);
    } catch (error) {
      console.error('❌ Failed to save report files:', error.message);
      // Don't add error to report - just log it
    }

    return report;
  }

  /**
   * Get system status
   */
  async getSystemStatus() {
    const profiles = this.modelProfiler.getAllProfiles();
    const optimizationStatus = this.optimizer.getOptimizationStatus();

    return {
      learningEnabled: this.learningEnabled,
      isInitialized: this.isInitialized,
      totalDebatesProcessed: this.stats.totalDebatesAnalyzed,
      modelsTracked: Object.keys(profiles).length,
      learningLevel: optimizationStatus.learningLevel,
      optimizationFeatures: {
        costOptimization: optimizationStatus.costOptimizationEnabled,
        patternOptimization: optimizationStatus.patternOptimizationEnabled,
        advancedOptimization: optimizationStatus.advancedOptimizationsEnabled
      },
      lastUpdate: this.stats.lastAnalysis
    };
  }

  /**
   * Get model performance report
   */
  async getModelPerformanceReport() {
    const profiles = this.modelProfiler.getAllProfiles();
    const modelReport = {};

    for (const [modelId, profile] of Object.entries(profiles)) {
      const winRate = profile.totalDebates > 0 ? profile.totalWins / profile.totalDebates : 0;
      const categories = Object.keys(profile.categoryPerformance);

      modelReport[modelId] = {
        name: profile.name,
        totalDebates: profile.totalDebates,
        winRate: winRate,
        avgResponseTime: profile.avgResponseTime,
        costEfficiency: profile.costEfficiency,
        specializations: profile.specializations.slice(0, 3),
        strongCategories: categories.filter(cat =>
          profile.categoryPerformance[cat].avgScore > 0.7
        ),
        weakCategories: categories.filter(cat =>
          profile.categoryPerformance[cat].avgScore < 0.4
        )
      };
    }

    return modelReport;
  }

  /**
   * Get pattern summary
   */
  async getPatternSummary() {
    const patterns = this.patternDetector.getPatterns();

    return {
      underdogWins: patterns.underdogWins.length,
      consistentFailures: patterns.consistentFailures.length,
      specialists: Object.keys(patterns.specialists).length,
      emergingTrends: patterns.emergingTrends.length,
      performanceShifts: patterns.performanceShifts.length,
      categoryInsights: Object.keys(patterns.categoryInsights).length,
      modelSynergies: patterns.modelSynergies.length,
      timeBasedPatterns: patterns.timeBasedPatterns.length,
      lastAnalyzed: patterns.lastAnalyzed
    };
  }

  /**
   * Get optimization results
   */
  async getOptimizationResults() {
    const optimizationStatus = this.optimizer.getOptimizationStatus();

    return {
      ...optimizationStatus,
      costSavingsAchieved: this.stats.costSavingsAchieved,
      performanceImprovements: this.stats.performanceImprovements,
      optimizationsApplied: this.stats.optimizationsApplied
    };
  }

  /**
   * Generate recommendations based on learning
   */
  async generateRecommendations() {
    const recommendations = [];
    const profiles = this.modelProfiler.getAllProfiles();
    const patterns = this.patternDetector.getPatterns();
    const optimizationStatus = this.optimizer.getOptimizationStatus();

    // Model usage recommendations
    const modelPerformance = Object.entries(profiles)
      .map(([id, profile]) => ({
        id,
        name: profile.name,
        winRate: profile.totalDebates > 0 ? profile.totalWins / profile.totalDebates : 0,
        totalDebates: profile.totalDebates
      }))
      .sort((a, b) => b.winRate - a.winRate);

    if (modelPerformance.length > 0) {
      const topPerformer = modelPerformance[0];
      const bottomPerformer = modelPerformance[modelPerformance.length - 1];

      if (topPerformer.totalDebates >= 10 && topPerformer.winRate > 0.7) {
        recommendations.push({
          type: 'model_usage',
          priority: 'high',
          message: `Consider using ${topPerformer.name} more frequently (${(topPerformer.winRate * 100).toFixed(1)}% win rate)`
        });
      }

      if (bottomPerformer.totalDebates >= 10 && bottomPerformer.winRate < 0.3) {
        recommendations.push({
          type: 'model_review',
          priority: 'medium',
          message: `Review usage of ${bottomPerformer.name} - consistently underperforming (${(bottomPerformer.winRate * 100).toFixed(1)}% win rate)`
        });
      }
    }

    // Cost optimization recommendations
    if (optimizationStatus.costOptimizationEnabled && this.stats.costSavingsAchieved < 20) {
      recommendations.push({
        type: 'cost_optimization',
        priority: 'medium',
        message: 'Cost savings below target - consider using more k3/k5 models for appropriate tasks'
      });
    }

    // Learning milestone recommendations
    if (this.stats.totalDebatesAnalyzed >= 50 && !optimizationStatus.patternOptimizationEnabled) {
      recommendations.push({
        type: 'feature_unlock',
        priority: 'high',
        message: 'Pattern-based optimization available - sufficient data collected'
      });
    }

    // Pattern-based recommendations
    if (patterns.emergingTrends.length > 0) {
      const improving = patterns.emergingTrends.filter(t => t.type === 'improving');
      const declining = patterns.emergingTrends.filter(t => t.type === 'declining');

      if (improving.length > 0) {
        recommendations.push({
          type: 'trending',
          priority: 'low',
          message: `Models showing improvement: ${improving.map(t => t.modelId).join(', ')}`
        });
      }

      if (declining.length > 0) {
        recommendations.push({
          type: 'alert',
          priority: 'medium',
          message: `Models showing decline: ${declining.map(t => t.modelId).join(', ')} - investigate causes`
        });
      }
    }

    return recommendations;
  }

  /**
   * Get cost analysis
   */
  async getCostAnalysis() {
    const profiles = this.modelProfiler.getAllProfiles();
    const totalDebates = Object.values(profiles).reduce((sum, p) => sum + p.totalDebates, 0);

    // Calculate baseline cost (if all debates used k1)
    const baselineCost = totalDebates * 1.0;

    // Calculate actual cost based on usage
    let actualCost = 0;
    for (const [modelId, profile] of Object.entries(profiles)) {
      const modelCost = this.optimizer.modelCosts[modelId] || 0.5;
      actualCost += profile.totalDebates * modelCost;
    }

    const savings = baselineCost > 0 ? ((baselineCost - actualCost) / baselineCost) * 100 : 0;

    return {
      totalDebates,
      baselineCost,
      actualCost,
      totalSavings: savings,
      averageCostPerDebate: totalDebates > 0 ? actualCost / totalDebates : 0,
      costBreakdown: Object.entries(profiles).reduce((breakdown, [modelId, profile]) => {
        breakdown[modelId] = {
          debates: profile.totalDebates,
          unitCost: this.optimizer.modelCosts[modelId] || 0.5,
          totalCost: profile.totalDebates * (this.optimizer.modelCosts[modelId] || 0.5)
        };
        return breakdown;
      }, {})
    };
  }

  /**
   * Get learning progress
   */
  async getLearningProgress() {
    const optimizationStatus = this.optimizer.getOptimizationStatus();

    const milestones = [
      {
        name: 'Basic Category Detection',
        threshold: 10,
        achieved: this.stats.totalDebatesAnalyzed >= 10,
        progress: Math.min(this.stats.totalDebatesAnalyzed / 10, 1.0)
      },
      {
        name: 'Cost Optimization',
        threshold: 50,
        achieved: this.stats.totalDebatesAnalyzed >= 50,
        progress: Math.min(this.stats.totalDebatesAnalyzed / 50, 1.0)
      },
      {
        name: 'Pattern Recognition',
        threshold: 100,
        achieved: this.stats.totalDebatesAnalyzed >= 100,
        progress: Math.min(this.stats.totalDebatesAnalyzed / 100, 1.0)
      },
      {
        name: 'Advanced Optimization',
        threshold: 500,
        achieved: this.stats.totalDebatesAnalyzed >= 500,
        progress: Math.min(this.stats.totalDebatesAnalyzed / 500, 1.0)
      }
    ];

    return {
      currentLevel: optimizationStatus.learningLevel,
      totalDebatesProcessed: this.stats.totalDebatesAnalyzed,
      milestones,
      nextMilestone: milestones.find(m => !m.achieved),
      progressPercentage: milestones.filter(m => m.achieved).length / milestones.length * 100
    };
  }

  /**
   * Format report summary in markdown
   */
  formatReportSummary(report) {
    const date = new Date(report.timestamp).toLocaleDateString();

    return `# Learning System Report - ${date}

## System Status
- **Learning Level**: ${report.systemStatus.learningLevel}
- **Total Debates Processed**: ${report.systemStatus.totalDebatesProcessed}
- **Models Tracked**: ${report.systemStatus.modelsTracked}
- **Cost Optimization**: ${report.systemStatus.optimizationFeatures.costOptimization ? '✅' : '❌'}
- **Pattern Optimization**: ${report.systemStatus.optimizationFeatures.patternOptimization ? '✅' : '❌'}
- **Advanced Optimization**: ${report.systemStatus.optimizationFeatures.advancedOptimization ? '✅' : '❌'}

## Top Model Performers
${Object.entries(report.modelPerformance)
  .filter(([id, data]) => data.totalDebates >= 5)
  .sort((a, b) => b[1].winRate - a[1].winRate)
  .slice(0, 3)
  .map(([id, data]) => `- **${data.name}**: ${(data.winRate * 100).toFixed(1)}% win rate (${data.totalDebates} debates)`)
  .join('\n')}

## Pattern Detection Summary
- **Underdog Wins**: ${report.patternSummary.underdogWins}
- **Consistent Failures**: ${report.patternSummary.consistentFailures}
- **Specialists Identified**: ${report.patternSummary.specialists}
- **Emerging Trends**: ${report.patternSummary.emergingTrends}
- **Performance Shifts**: ${report.patternSummary.performanceShifts}

## Cost Analysis
- **Total Savings**: ${report.costAnalysis.totalSavings.toFixed(1)}%
- **Average Cost per Debate**: ${report.costAnalysis.averageCostPerDebate.toFixed(2)}
- **Total Debates**: ${report.costAnalysis.totalDebates}

## Learning Progress
- **Current Progress**: ${report.learningProgress.progressPercentage.toFixed(1)}%
- **Next Milestone**: ${report.learningProgress.nextMilestone?.name || 'All milestones achieved!'}

## Recommendations
${report.recommendations.map(rec => `- **${rec.type.toUpperCase()}** (${rec.priority}): ${rec.message}`).join('\n')}

---
*Generated automatically by the Learning System at ${new Date(report.timestamp).toLocaleString()}*
`;
  }

  /**
   * Load statistics from file
   */
  async loadStats() {
    try {
      const statsPath = path.join(this.dataDir, 'learning-stats.json');
      const data = await fs.readFile(statsPath, 'utf8');
      this.stats = { ...this.stats, ...JSON.parse(data) };
    } catch (error) {
      // File doesn't exist yet, use defaults
    }
  }

  /**
   * Save statistics to file
   */
  async saveStats() {
    const statsPath = path.join(this.dataDir, 'learning-stats.json');
    await fs.writeFile(statsPath, JSON.stringify(this.stats, null, 2), 'utf8');
  }

  /**
   * Get quick status summary
   */
  getQuickStatus() {
    return {
      enabled: this.learningEnabled,
      initialized: this.isInitialized,
      totalDebates: this.stats.totalDebatesAnalyzed,
      patterns: this.stats.patternsDetected,
      optimizations: this.stats.optimizationsApplied,
      costSavings: this.stats.costSavingsAchieved,
      lastAnalysis: this.stats.lastAnalysis
    };
  }

  /**
   * Reset learning data (for testing or fresh start)
   */
  async resetLearningData() {
    if (!this.learningEnabled) return;

    console.log('🔄 Resetting learning data...');

    // Reset statistics
    this.stats = {
      totalDebatesAnalyzed: 0,
      patternsDetected: 0,
      optimizationsApplied: 0,
      costSavingsAchieved: 0,
      performanceImprovements: 0,
      lastAnalysis: null,
      lastOptimization: null
    };

    // Clear data files
    try {
      const dataFiles = await fs.readdir(this.dataDir);
      for (const file of dataFiles) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.dataDir, file));
        }
      }

      // Clear reports
      const reportFiles = await fs.readdir(this.reportsDir);
      for (const file of reportFiles) {
        await fs.unlink(path.join(this.reportsDir, file));
      }
    } catch (error) {
      console.warn('Warning: Could not clear all learning data files:', error.message);
    }

    // Reinitialize components
    await this.modelProfiler.initialize();
    await this.patternDetector.initialize();
    await this.optimizer.initialize();

    console.log('✅ Learning data reset complete');
  }

  /**
   * Get model recommendations based on learning context
   * @param {Object} context - Context for model selection
   * @returns {Array} Array of model recommendations
   */
  async getModelRecommendations(context) {
    if (!this.learningEnabled || !this.isInitialized) {
      return [
        { model: 'k1', confidence: 0.5 },
        { model: 'k2', confidence: 0.5 },
        { model: 'k4', confidence: 0.5 }
      ];
    }

    try {
      // Use the optimizer to get recommendations
      const optimization = await this.optimizer.optimizeSelection(context.category || 'general', context);
      return optimization.models || [];
    } catch (error) {
      console.warn('Failed to get model recommendations:', error.message);
      return [
        { model: 'k1', confidence: 0.5 },
        { model: 'k2', confidence: 0.5 },
        { model: 'k4', confidence: 0.5 }
      ];
    }
  }

  /**
   * Learn from debate outcomes
   * @param {Array} outcomes - Array of debate outcomes
   */
  async learnFromOutcomes(outcomes) {
    if (!this.learningEnabled || !this.isInitialized) return;

    for (const outcome of outcomes) {
      try {
        await this.modelProfiler.updateAfterDebate(outcome);
      } catch (error) {
        console.warn('Error learning from outcome:', error.message);
      }
    }
  }

  /**
   * Predict debate quality for given parameters
   * @param {Object} params - Debate parameters
   * @returns {Object} Quality prediction
   */
  async predictDebateQuality(params) {
    if (!this.learningEnabled || !this.isInitialized) {
      return {
        expectedConfidence: 0.7,
        riskFactors: ['Learning system not available']
      };
    }

    // Calculate expected confidence based on model selection and question complexity
    let expectedConfidence = 0.7; // Base confidence

    if (params.selectedModels && params.selectedModels.length >= 3) {
      expectedConfidence += 0.1; // Bonus for multiple models
    }

    if (params.complexity < 0.5) {
      expectedConfidence += 0.1; // Bonus for simpler questions
    } else if (params.complexity > 0.8) {
      expectedConfidence -= 0.1; // Penalty for very complex questions
    }

    const riskFactors = [];
    if (params.selectedModels && params.selectedModels.length < 3) {
      riskFactors.push('Insufficient model diversity');
    }
    if (params.complexity > 0.8) {
      riskFactors.push('High complexity question');
    }

    return {
      expectedConfidence: Math.max(0.1, Math.min(1.0, expectedConfidence)),
      riskFactors
    };
  }

  /**
   * Detect performance regressions
   * @returns {Object} Regression analysis
   */
  async detectRegressions() {
    if (!this.learningEnabled || !this.isInitialized) {
      return {
        detected: false,
        severity: 'none'
      };
    }

    try {
      const trends = this.modelProfiler.analyzeModelTrends();

      return {
        detected: trends.regression || false,
        severity: trends.regression ? 'medium' : 'none',
        details: trends
      };
    } catch (error) {
      console.warn('Error detecting regressions:', error.message);
      return {
        detected: false,
        severity: 'none',
        error: error.message
      };
    }
  }

  /**
   * Analyze question patterns
   * @returns {Object} Pattern analysis results
   */
  async analyzeQuestionPatterns() {
    if (!this.learningEnabled || !this.isInitialized) {
      return { patterns: [], error: 'Learning system not available' };
    }

    try {
      return await this.patternDetector.detectPatterns();
    } catch (error) {
      console.error('Error analyzing question patterns:', error.message);
      return { patterns: [], error: error.message };
    }
  }

  /**
   * Analyze model performance
   * @returns {Object} Model performance analysis
   */
  async analyzeModelPerformance() {
    if (!this.learningEnabled || !this.isInitialized) {
      return { accuracy: 0.7, speed: 0.8 };
    }

    try {
      return this.modelProfiler.getModelPerformance();
    } catch (error) {
      console.error('Error analyzing model performance:', error.message);
      return { accuracy: 0.7, speed: 0.8, error: error.message };
    }
  }

  /**
   * Generate optimizations
   * @returns {Object} Optimization suggestions
   */
  async generateOptimizations() {
    if (!this.learningEnabled || !this.isInitialized) {
      return { suggestions: [] };
    }

    try {
      return await this.optimizer.generateOptimizations();
    } catch (error) {
      console.error('Error generating optimizations:', error.message);
      return { suggestions: [], error: error.message };
    }
  }

  /**
   * Apply optimization with confidence check
   * @param {Object} optimization - Optimization to apply
   * @returns {Object} Application result
   */
  async applyOptimization(optimization) {
    if (!this.learningEnabled || !this.isInitialized) {
      return { applied: false, reason: 'Learning system not available' };
    }

    if (optimization.confidence < this.config.confidenceThreshold) {
      return {
        applied: false,
        reason: `Confidence too low: ${optimization.confidence} < ${this.config.confidenceThreshold}`
      };
    }

    try {
      await this.optimizer.applyOptimization(optimization);
      this.stats.optimizationsApplied++;
      await this.saveStats();
      return { applied: true };
    } catch (error) {
      console.error('Error applying optimization:', error.message);
      return { applied: false, error: error.message };
    }
  }

  /**
   * Check learning convergence
   * @returns {Object} Convergence status
   */
  async checkConvergence() {
    if (!this.learningEnabled || !this.isInitialized) {
      return { converged: false, stability: 0.5 };
    }

    try {
      const trends = this.modelProfiler.analyzeModelTrends();
      const converged = !trends.improving && trends.stability > 0.9;

      return {
        converged,
        stability: trends.stability,
        improving: trends.improving,
        variance: trends.variance || 0.1
      };
    } catch (error) {
      console.error('Error checking convergence:', error.message);
      return { converged: false, stability: 0.5, error: error.message };
    }
  }

  /**
   * Get convergence recommendations
   * @returns {Array} Array of recommendation strings
   */
  async getConvergenceRecommendations() {
    const convergence = await this.checkConvergence();
    const recommendations = [];

    if (convergence.converged) {
      recommendations.push('System has converged to stable performance');
      recommendations.push('Consider reducing learning rate to maintain stability');
    } else if (convergence.improving) {
      recommendations.push('System is still improving');
      recommendations.push('Continue current learning strategy');
    } else {
      recommendations.push('System performance appears unstable');
      recommendations.push('Consider adjusting learning parameters');
    }

    return recommendations;
  }
}