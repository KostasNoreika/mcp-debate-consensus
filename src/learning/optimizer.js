/**
 * Learning Optimizer - Optimizes model selection based on historical performance
 *
 * Uses model profiles and detected patterns to intelligently select optimal
 * model combinations for different categories and contexts.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class LearningOptimizer {
  constructor(modelProfiler, patternDetector) {
    this.modelProfiler = modelProfiler;
    this.patternDetector = patternDetector;
    this.dataDir = path.join(__dirname, '../../data');
    this.optimizationPath = path.join(this.dataDir, 'optimization-rules.json');

    // Optimization rules that learn over time
    this.optimizationRules = {
      categoryRules: {},
      costOptimizations: {},
      performanceBoosts: {},
      selectionStrategies: {},
      learningMilestones: {
        debates10: false,
        debates50: false,
        debates100: false,
        debates500: false
      },
      lastUpdated: null
    };

    // Model cost factors (relative to k1=1.0)
    this.modelCosts = {
      k1: 1.0,   // Claude Opus 4.1 - Most expensive but highest quality
      k2: 0.7,   // GPT-5 - Premium but efficient
      k3: 0.3,   // Qwen 3 Max - Very cost effective
      k4: 0.6,   // Gemini 2.5 Pro - Balanced cost/performance
      k5: 0.1    // Grok 4 Fast - Cheapest and fastest
    };
  }

  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.loadOptimizationRules();
  }

  async loadOptimizationRules() {
    try {
      const data = await fs.readFile(this.optimizationPath, 'utf8');
      this.optimizationRules = { ...this.optimizationRules, ...JSON.parse(data) };
    } catch (error) {
      console.log('🎯 Creating new optimization rules...');
    }
  }

  async saveOptimizationRules() {
    await fs.writeFile(
      this.optimizationPath,
      JSON.stringify(this.optimizationRules, null, 2),
      'utf8'
    );
  }

  /**
   * Main optimization method - selects optimal models for a given context
   * @param {string} category - The category/type of question
   * @param {Object} context - Additional context (urgency, budget constraints, etc.)
   * @returns {Array} Optimal model selection with reasons
   */
  async optimizeSelection(category, context = {}) {
    const {
      urgency = 0.5,        // 0 = no rush, 1 = urgent
      budgetConstraint = 0.5, // 0 = unlimited, 1 = strict budget
      quality = 0.8,        // 0 = any quality, 1 = highest quality
      maxModels = 3,        // Maximum number of models to select
      minModels = 2         // Minimum number of models needed
    } = context;

    console.log(`🎯 Optimizing model selection for: ${category}`);
    console.log(`   Context: urgency=${urgency}, budget=${budgetConstraint}, quality=${quality}`);

    // Get historical data
    const profiles = this.modelProfiler.getAllProfiles();
    const patterns = this.patternDetector.getPatterns();
    const totalDebates = this.getTotalDebateCount(profiles);

    // Update learning milestones
    await this.updateLearningMilestones(totalDebates);

    // Determine optimization strategy based on available data
    let selection;
    if (totalDebates >= 50) {
      selection = await this.dataBasedOptimization(category, context, profiles, patterns);
    } else if (totalDebates >= 10) {
      selection = await this.hybridOptimization(category, context, profiles, patterns);
    } else {
      selection = await this.heuristicOptimization(category, context);
    }

    // Ensure selection meets constraints
    selection = this.enforceConstraints(selection, { maxModels, minModels });

    // Calculate metrics for the selection
    const metrics = await this.calculateSelectionMetrics(selection, category, profiles);

    console.log(`✅ Selected ${selection.length} models: ${selection.map(s => s.id).join(', ')}`);
    console.log(`   Expected cost reduction: ${metrics.costReduction.toFixed(1)}%`);
    console.log(`   Expected performance: ${(metrics.expectedPerformance * 100).toFixed(1)}%`);

    return {
      models: selection,
      metrics,
      strategy: selection[0]?.strategy || 'default',
      reasoning: this.explainSelection(selection, category, context)
    };
  }

  /**
   * Data-based optimization (50+ debates available)
   */
  async dataBasedOptimization(category, context, profiles, patterns) {
    console.log('📊 Using data-based optimization (50+ debates)');

    // Get category specialists
    const specialists = patterns.specialists[category] || [];
    const categoryPerformers = this.modelProfiler.getCategoryBestPerformers(category, 5);

    // Score all models for this category
    const modelScores = await this.scoreModelsForCategory(category, context, profiles, patterns);

    // Apply learned optimizations
    const optimizedScores = this.applyLearnedOptimizations(modelScores, category, context);

    // Select top performers considering cost and context
    const selection = this.selectOptimalCombination(optimizedScores, context);

    return selection.map(s => ({ ...s, strategy: 'data_based' }));
  }

  /**
   * Hybrid optimization (10-49 debates available)
   */
  async hybridOptimization(category, context, profiles, patterns) {
    console.log('🔄 Using hybrid optimization (10-49 debates)');

    // Combine historical data with heuristics
    const dataScores = await this.scoreModelsForCategory(category, context, profiles, patterns, 0.6);
    const heuristicScores = await this.getHeuristicScores(category, context, 0.4);

    // Merge scores
    const combinedScores = {};
    const allModels = new Set([...Object.keys(dataScores), ...Object.keys(heuristicScores)]);

    for (const modelId of allModels) {
      combinedScores[modelId] = {
        id: modelId,
        score: (dataScores[modelId]?.score || 0) + (heuristicScores[modelId]?.score || 0),
        confidence: Math.min(
          (dataScores[modelId]?.confidence || 0),
          (heuristicScores[modelId]?.confidence || 1)
        ),
        cost: this.modelCosts[modelId] || 0.5
      };
    }

    const selection = this.selectOptimalCombination(Object.values(combinedScores), context);
    return selection.map(s => ({ ...s, strategy: 'hybrid' }));
  }

  /**
   * Heuristic optimization (< 10 debates available)
   */
  async heuristicOptimization(category, context) {
    console.log('🎲 Using heuristic optimization (< 10 debates)');

    const heuristicScores = await this.getHeuristicScores(category, context);
    const selection = this.selectOptimalCombination(Object.values(heuristicScores), context);

    return selection.map(s => ({ ...s, strategy: 'heuristic' }));
  }

  /**
   * Score models for a specific category based on historical performance
   */
  async scoreModelsForCategory(category, context, profiles, patterns, weight = 1.0) {
    const scores = {};

    for (const [modelId, profile] of Object.entries(profiles)) {
      let score = 0;
      let confidence = 0;

      // Category-specific performance
      const categoryPerf = profile.categoryPerformance[category];
      if (categoryPerf && categoryPerf.debates >= 3) {
        score += categoryPerf.avgScore * 0.4;
        confidence += Math.min(categoryPerf.debates / 10, 1.0) * 0.3;
      }

      // Overall win rate
      const overallWinRate = profile.totalDebates > 0 ? profile.totalWins / profile.totalDebates : 0;
      score += overallWinRate * 0.3;

      // Specialization bonus
      const specialization = profile.specializations.find(s => s.category === category);
      if (specialization) {
        score += specialization.strength * 0.2;
        confidence += specialization.confidence * 0.3;
      }

      // Pattern-based adjustments
      if (patterns.specialists[category]) {
        const specialist = patterns.specialists[category].find(s => s.modelId === modelId);
        if (specialist) {
          score += specialist.winRate * 0.1;
          confidence += specialist.confidence * 0.2;
        }
      }

      // Recent performance trends
      const recentTrends = profile.performanceTrends.slice(-5);
      if (recentTrends.length >= 3) {
        const recentAvg = recentTrends.reduce((sum, t) => sum + t.score, 0) / recentTrends.length;
        score += recentAvg * 0.1;
      }

      // Apply context modifiers
      score = this.applyContextModifiers(score, modelId, context);

      // Apply weight for hybrid optimization
      score *= weight;
      confidence = Math.min(confidence, 1.0);

      scores[modelId] = {
        id: modelId,
        score,
        confidence,
        cost: this.modelCosts[modelId] || 0.5,
        profile
      };
    }

    return scores;
  }

  /**
   * Get heuristic-based scores for models based on category
   */
  async getHeuristicScores(category, context, weight = 1.0) {
    const scores = {};

    // Category-based heuristics
    const categoryHeuristics = {
      'tech/debug': { k5: 0.9, k2: 0.8, k3: 0.6, k1: 0.5, k4: 0.4 },
      'tech/code': { k3: 0.9, k5: 0.8, k2: 0.7, k1: 0.6, k4: 0.5 },
      'tech/architecture': { k1: 0.9, k4: 0.8, k2: 0.6, k3: 0.5, k5: 0.4 },
      'education/explain': { k1: 0.9, k4: 0.7, k2: 0.6, k3: 0.5, k5: 0.4 },
      'business/strategy': { k1: 0.8, k4: 0.7, k2: 0.6, k3: 0.4, k5: 0.3 },
      'creative/writing': { k1: 0.9, k4: 0.6, k2: 0.5, k3: 0.3, k5: 0.4 },
      'math/calculation': { k3: 0.9, k2: 0.7, k5: 0.6, k1: 0.5, k4: 0.4 },
      'analysis/data': { k3: 0.8, k1: 0.7, k4: 0.6, k2: 0.5, k5: 0.4 }
    };

    const categoryScores = categoryHeuristics[category] || {
      k1: 0.7, k2: 0.6, k3: 0.6, k4: 0.6, k5: 0.5
    };

    for (const [modelId, baseScore] of Object.entries(categoryScores)) {
      let score = baseScore;

      // Apply context modifiers
      score = this.applyContextModifiers(score, modelId, context);

      // Apply weight for hybrid optimization
      score *= weight;

      scores[modelId] = {
        id: modelId,
        score,
        confidence: 0.6, // Lower confidence for heuristics
        cost: this.modelCosts[modelId] || 0.5
      };
    }

    return scores;
  }

  /**
   * Apply context modifiers to scores
   */
  applyContextModifiers(score, modelId, context) {
    const { urgency, budgetConstraint, quality } = context;

    // Urgency modifier (favor faster models)
    if (urgency > 0.7) {
      if (modelId === 'k5') score *= 1.3; // Grok is fastest
      if (modelId === 'k1') score *= 0.8; // Claude can be slower
    }

    // Budget constraint modifier
    if (budgetConstraint > 0.7) {
      const costPenalty = this.modelCosts[modelId] || 0.5;
      score *= (1.5 - costPenalty); // Lower cost = higher score
    }

    // Quality requirement modifier
    if (quality > 0.8) {
      if (modelId === 'k1') score *= 1.2; // Claude Opus for highest quality
      if (modelId === 'k5') score *= 0.8; // Grok might sacrifice quality for speed
    }

    return score;
  }

  /**
   * Apply learned optimizations from patterns
   */
  applyLearnedOptimizations(modelScores, category, context) {
    const optimized = { ...modelScores };

    // Apply category-specific learned rules
    const categoryRules = this.optimizationRules.categoryRules[category];
    if (categoryRules) {
      for (const rule of categoryRules) {
        if (this.ruleApplies(rule, context)) {
          if (optimized[rule.modelId]) {
            optimized[rule.modelId].score *= rule.multiplier;
            optimized[rule.modelId].confidence *= rule.confidenceBoost || 1.0;
          }
        }
      }
    }

    // Apply cost optimizations
    const costOpts = this.optimizationRules.costOptimizations;
    if (context.budgetConstraint > 0.5 && costOpts.enabledCategories?.includes(category)) {
      for (const [modelId, score] of Object.entries(optimized)) {
        if (costOpts.preferredModels?.includes(modelId)) {
          score.score *= costOpts.multiplier || 1.2;
        }
      }
    }

    return optimized;
  }

  /**
   * Select optimal combination of models
   */
  selectOptimalCombination(modelScores, context) {
    const { maxModels = 3, minModels = 2, budgetConstraint = 0.5 } = context;

    // Sort models by score
    const sortedModels = modelScores
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);

    if (sortedModels.length === 0) {
      throw new Error('No models have positive scores for this category');
    }

    // Start with the top performer
    const selection = [sortedModels[0]];
    let totalCost = sortedModels[0].cost;

    // Add additional models considering diversity and budget
    for (let i = 1; i < sortedModels.length && selection.length < maxModels; i++) {
      const candidate = sortedModels[i];
      const newTotalCost = totalCost + candidate.cost;

      // Check budget constraint
      if (budgetConstraint > 0.7 && newTotalCost > (3.0 * (1 - budgetConstraint))) {
        continue;
      }

      // Check for role diversity (avoid too many similar models)
      const roleConflict = this.checkRoleConflict(selection, candidate);
      if (!roleConflict || selection.length < minModels) {
        selection.push(candidate);
        totalCost = newTotalCost;
      }
    }

    // Ensure minimum models
    while (selection.length < minModels && sortedModels.length > selection.length) {
      const nextBest = sortedModels.find(m => !selection.includes(m));
      if (nextBest) {
        selection.push(nextBest);
      } else {
        break;
      }
    }

    return selection;
  }

  /**
   * Check if adding a model would create role conflicts
   */
  checkRoleConflict(currentSelection, candidate) {
    // Define role relationships - models with similar roles might conflict
    const roleGroups = {
      speed: ['k5'],
      quality: ['k1'],
      technical: ['k2', 'k3'],
      integration: ['k4']
    };

    const candidateGroups = Object.entries(roleGroups)
      .filter(([group, models]) => models.includes(candidate.id))
      .map(([group]) => group);

    for (const selected of currentSelection) {
      const selectedGroups = Object.entries(roleGroups)
        .filter(([group, models]) => models.includes(selected.id))
        .map(([group]) => group);

      // Check for overlap in role groups
      const overlap = candidateGroups.some(group => selectedGroups.includes(group));
      if (overlap && currentSelection.length >= 2) {
        return true; // Conflict detected
      }
    }

    return false; // No conflict
  }

  /**
   * Enforce selection constraints
   */
  enforceConstraints(selection, constraints) {
    const { maxModels, minModels } = constraints;

    // Trim to max models if needed
    if (selection.length > maxModels) {
      selection = selection.slice(0, maxModels);
    }

    // Add random models if below minimum (fallback)
    if (selection.length < minModels) {
      const allModelIds = ['k1', 'k2', 'k3', 'k4', 'k5'];
      const usedIds = selection.map(s => s.id);
      const availableIds = allModelIds.filter(id => !usedIds.includes(id));

      while (selection.length < minModels && availableIds.length > 0) {
        const randomId = availableIds.splice(Math.floor(Math.random() * availableIds.length), 1)[0];
        selection.push({
          id: randomId,
          score: 0.5,
          confidence: 0.3,
          cost: this.modelCosts[randomId] || 0.5,
          strategy: 'fallback'
        });
      }
    }

    return selection;
  }

  /**
   * Calculate metrics for a model selection
   */
  async calculateSelectionMetrics(selection, category, profiles) {
    const baseCost = 3.0 * this.modelCosts.k1; // Cost of using 3x Claude Opus
    const selectionCost = selection.reduce((sum, model) => sum + model.cost, 0);
    const costReduction = ((baseCost - selectionCost) / baseCost) * 100;

    // Calculate expected performance based on historical data
    let expectedPerformance = 0;
    let confidenceSum = 0;

    for (const model of selection) {
      const profile = profiles[model.id];
      if (profile && profile.categoryPerformance[category]) {
        const categoryPerf = profile.categoryPerformance[category];
        expectedPerformance += categoryPerf.avgScore * model.confidence;
        confidenceSum += model.confidence;
      } else {
        // Fallback to model score
        expectedPerformance += model.score * 0.5;
        confidenceSum += 0.5;
      }
    }

    expectedPerformance = confidenceSum > 0 ? expectedPerformance / confidenceSum : 0.6;

    return {
      costReduction: Math.max(0, costReduction),
      expectedPerformance,
      totalCost: selectionCost,
      confidence: confidenceSum / selection.length,
      diversityScore: this.calculateDiversityScore(selection)
    };
  }

  /**
   * Calculate diversity score for model selection
   */
  calculateDiversityScore(selection) {
    if (selection.length <= 1) return 0;

    const roles = ['Architecture', 'Testing', 'Algorithms', 'Integration', 'Fast Reasoning'];
    const selectedRoles = new Set();

    // Map model IDs to roles (simplified)
    const modelRoles = {
      k1: 'Architecture',
      k2: 'Testing',
      k3: 'Algorithms',
      k4: 'Integration',
      k5: 'Fast Reasoning'
    };

    for (const model of selection) {
      const role = modelRoles[model.id];
      if (role) selectedRoles.add(role);
    }

    return selectedRoles.size / roles.length;
  }

  /**
   * Generate explanation for model selection
   */
  explainSelection(selection, category, context) {
    const reasons = [];

    // Strategy-based reasoning
    const strategies = selection.map(s => s.strategy).filter(Boolean);
    const primaryStrategy = strategies[0] || 'default';

    switch (primaryStrategy) {
      case 'data_based':
        reasons.push('Selection based on extensive historical performance data');
        break;
      case 'hybrid':
        reasons.push('Selection combines historical data with proven heuristics');
        break;
      case 'heuristic':
        reasons.push('Selection based on model expertise and category matching');
        break;
    }

    // Context-based reasoning
    if (context.urgency > 0.7) {
      reasons.push('Prioritized fast models due to urgency requirement');
    }
    if (context.budgetConstraint > 0.7) {
      reasons.push('Selected cost-effective models due to budget constraints');
    }
    if (context.quality > 0.8) {
      reasons.push('Included high-quality models for critical accuracy');
    }

    // Selection-specific reasoning
    const topModel = selection[0];
    if (topModel) {
      reasons.push(`Primary model: ${topModel.id} (score: ${topModel.score.toFixed(2)})`);
    }

    if (selection.length > 1) {
      reasons.push(`Supporting models selected for diversity and consensus validation`);
    }

    return reasons.join('. ') + '.';
  }

  /**
   * Update learning milestones based on total debate count
   */
  async updateLearningMilestones(totalDebates) {
    const milestones = this.optimizationRules.learningMilestones;
    let updated = false;

    if (totalDebates >= 500 && !milestones.debates500) {
      milestones.debates500 = true;
      await this.unlockAdvancedOptimizations();
      updated = true;
      console.log('🎓 Learning Milestone: 500 debates - Advanced optimizations unlocked!');
    } else if (totalDebates >= 100 && !milestones.debates100) {
      milestones.debates100 = true;
      await this.enablePatternBasedOptimization();
      updated = true;
      console.log('🎓 Learning Milestone: 100 debates - Pattern-based optimization enabled!');
    } else if (totalDebates >= 50 && !milestones.debates50) {
      milestones.debates50 = true;
      await this.enableCostOptimization();
      updated = true;
      console.log('🎓 Learning Milestone: 50 debates - Cost optimization enabled!');
    } else if (totalDebates >= 10 && !milestones.debates10) {
      milestones.debates10 = true;
      await this.enableBasicCategoryDetection();
      updated = true;
      console.log('🎓 Learning Milestone: 10 debates - Category detection enabled!');
    }

    if (updated) {
      await this.saveOptimizationRules();
    }
  }

  /**
   * Enable basic category detection (10+ debates)
   */
  async enableBasicCategoryDetection() {
    if (!this.optimizationRules.categoryRules) {
      this.optimizationRules.categoryRules = {};
    }

    console.log('📊 Basic category detection enabled');
  }

  /**
   * Enable cost optimization (50+ debates)
   */
  async enableCostOptimization() {
    this.optimizationRules.costOptimizations = {
      enabled: true,
      enabledCategories: [],
      preferredModels: ['k3', 'k5'], // Cost-effective models
      multiplier: 1.2,
      targetSavings: 0.3
    };

    console.log('💰 Cost optimization enabled - targeting 30% savings');
  }

  /**
   * Enable pattern-based optimization (100+ debates)
   */
  async enablePatternBasedOptimization() {
    this.optimizationRules.performanceBoosts = {
      enabled: true,
      underdogBoosts: true,
      specialistPreference: true,
      synergyDetection: true
    };

    console.log('🔍 Pattern-based optimization enabled');
  }

  /**
   * Unlock advanced optimizations (500+ debates)
   */
  async unlockAdvancedOptimizations() {
    this.optimizationRules.selectionStrategies = {
      adaptive: true,
      predictive: true,
      contextAware: true,
      learningRate: 0.1
    };

    console.log('🚀 Advanced optimizations unlocked - predictive selection enabled');
  }

  /**
   * Check if a rule applies to the current context
   */
  ruleApplies(rule, context) {
    if (!rule.conditions) return true;

    for (const [condition, value] of Object.entries(rule.conditions)) {
      if (context[condition] !== undefined && context[condition] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get total debate count across all models
   */
  getTotalDebateCount(profiles) {
    return Object.values(profiles).reduce((sum, profile) => sum + profile.totalDebates, 0);
  }

  /**
   * Learn from a completed debate and update optimization rules
   */
  async learnFromDebate(debateResult) {
    const { category, selectedModels, winner, scores, costReduction } = debateResult;

    // Learn category-specific patterns
    await this.learnCategoryOptimizations(category, selectedModels, winner, scores);

    // Learn cost optimization patterns
    if (costReduction && costReduction > 20) {
      await this.learnCostOptimizations(category, selectedModels, costReduction);
    }

    // Update selection strategies
    await this.updateSelectionStrategies(debateResult);

    this.optimizationRules.lastUpdated = Date.now();
    await this.saveOptimizationRules();
  }

  /**
   * Learn category-specific optimizations
   */
  async learnCategoryOptimizations(category, selectedModels, winner, scores) {
    if (!this.optimizationRules.categoryRules[category]) {
      this.optimizationRules.categoryRules[category] = [];
    }

    const categoryRules = this.optimizationRules.categoryRules[category];

    // Create rule for winning model
    if (winner && scores[winner] > 0.8) {
      const existingRule = categoryRules.find(r => r.modelId === winner);
      if (existingRule) {
        existingRule.multiplier = Math.min(existingRule.multiplier * 1.1, 2.0);
        existingRule.confidence++;
      } else {
        categoryRules.push({
          modelId: winner,
          multiplier: 1.2,
          confidence: 1,
          confidenceBoost: 1.1,
          conditions: {},
          learned: Date.now()
        });
      }
    }

    // Limit rules per category
    if (categoryRules.length > 5) {
      categoryRules.sort((a, b) => b.confidence - a.confidence);
      this.optimizationRules.categoryRules[category] = categoryRules.slice(0, 5);
    }
  }

  /**
   * Learn cost optimization patterns
   */
  async learnCostOptimizations(category, selectedModels, costReduction) {
    const costOpts = this.optimizationRules.costOptimizations;
    if (!costOpts.enabled) return;

    // Add successful category to enabled list
    if (!costOpts.enabledCategories.includes(category)) {
      costOpts.enabledCategories.push(category);
    }

    // Update preferred models based on cost-effective performers
    const lowCostModels = selectedModels.filter(m => this.modelCosts[m] < 0.5);
    for (const model of lowCostModels) {
      if (!costOpts.preferredModels.includes(model)) {
        costOpts.preferredModels.push(model);
      }
    }

    // Update target savings based on achieved results
    if (costReduction > costOpts.targetSavings * 100) {
      costOpts.targetSavings = Math.min(costOpts.targetSavings * 1.1, 0.6);
    }
  }

  /**
   * Update selection strategies based on results
   */
  async updateSelectionStrategies(debateResult) {
    const strategies = this.optimizationRules.selectionStrategies;
    if (!strategies.enabled) return;

    // Update adaptive parameters based on performance
    if (strategies.adaptive) {
      const performance = debateResult.scores[debateResult.winner] || 0;
      const learningRate = strategies.learningRate || 0.1;

      // Adjust strategy parameters based on performance feedback
      if (performance > 0.8) {
        strategies.confidenceBoost = (strategies.confidenceBoost || 1.0) * (1 + learningRate);
      } else if (performance < 0.5) {
        strategies.confidenceBoost = (strategies.confidenceBoost || 1.0) * (1 - learningRate);
      }

      strategies.confidenceBoost = Math.max(0.5, Math.min(2.0, strategies.confidenceBoost));
    }
  }

  /**
   * Get optimization status and statistics
   */
  getOptimizationStatus() {
    const milestones = this.optimizationRules.learningMilestones;
    const totalRules = Object.values(this.optimizationRules.categoryRules || {})
      .reduce((sum, rules) => sum + rules.length, 0);

    return {
      learningLevel: this.getLearningLevel(milestones),
      totalCategoryRules: totalRules,
      costOptimizationEnabled: this.optimizationRules.costOptimizations?.enabled || false,
      patternOptimizationEnabled: this.optimizationRules.performanceBoosts?.enabled || false,
      advancedOptimizationsEnabled: this.optimizationRules.selectionStrategies?.enabled || false,
      enabledCategories: this.optimizationRules.costOptimizations?.enabledCategories?.length || 0,
      lastUpdated: this.optimizationRules.lastUpdated
    };
  }

  /**
   * Determine current learning level
   */
  getLearningLevel(milestones) {
    if (milestones.debates500) return 'Expert';
    if (milestones.debates100) return 'Advanced';
    if (milestones.debates50) return 'Intermediate';
    if (milestones.debates10) return 'Basic';
    return 'Novice';
  }
}