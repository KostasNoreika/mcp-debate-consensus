/**
 * Quality Presets System
 *
 * Provides different quality/speed/cost tradeoffs for AI Expert Consensus debates.
 * Each preset optimizes for different use cases while maintaining predictable outcomes.
 */

import { GeminiCoordinator } from '../gemini-coordinator.js';

/**
 * Predefined quality presets with different model configurations
 */
export const QualityPresets = {
  'rapid': {
    name: 'Rapid Response',
    description: 'Fast answers, good for simple questions and quick debugging',
    models: ['k5', 'k5', 'k5'], // 3x Grok Fast for speed
    verification: false,
    iterations: 1,
    consensusThreshold: 70,
    timeoutMinutes: 5,
    estimatedTime: '3-5s',
    estimatedCost: '$0.01',
    useIntelligentSelection: false, // Override selection for speed
    bestFor: ['debugging', 'simple-questions', 'quick-fixes', 'syntax-errors']
  },

  'cost-optimized': {
    name: 'Cost Optimized',
    description: 'Minimum cost while maintaining acceptable quality',
    models: ['k5'], // Single Grok model
    verification: false,
    iterations: 1,
    consensusThreshold: 60,
    timeoutMinutes: 3,
    estimatedTime: '2-3s',
    estimatedCost: '$0.005',
    useIntelligentSelection: false,
    bestFor: ['budget-conscious', 'simple-tasks', 'prototyping']
  },

  'balanced': {
    name: 'Balanced',
    description: 'Good accuracy with reasonable speed and cost',
    models: ['k1', 'k2', 'k5'], // Diverse model selection
    verification: false,
    iterations: 3,
    consensusThreshold: 80,
    timeoutMinutes: 15,
    estimatedTime: '30-45s',
    estimatedCost: '$0.20',
    useIntelligentSelection: true,
    bestFor: ['general-development', 'code-review', 'architecture', 'most-tasks']
  },

  'maximum-accuracy': {
    name: 'Maximum Accuracy',
    description: 'Highest quality with all models and verification',
    models: ['k1:2', 'k2:2', 'k3', 'k4', 'k5'], // Multiple instances of key models
    verification: true,
    iterations: 5,
    consensusThreshold: 95,
    timeoutMinutes: 30,
    estimatedTime: '60-90s',
    estimatedCost: '$0.50',
    useIntelligentSelection: false, // Use all specified models
    bestFor: ['critical-decisions', 'security-review', 'production-releases', 'complex-architecture']
  },

  'deep-analysis': {
    name: 'Deep Analysis',
    description: 'Thorough analysis for complex problems with expert focus',
    models: ['k1', 'k1', 'k3', 'k4'], // Architecture and analysis focused
    verification: true,
    iterations: 5,
    consensusThreshold: 90,
    timeoutMinutes: 45,
    estimatedTime: '90-120s',
    estimatedCost: '$0.40',
    useIntelligentSelection: true,
    bestFor: ['complex-problems', 'system-design', 'performance-optimization', 'research']
  },

  'security-focused': {
    name: 'Security Focused',
    description: 'Security-first analysis with thorough verification',
    models: ['k1:2', 'k2', 'k4:2'], // Architecture and integration focus
    verification: true,
    iterations: 4,
    consensusThreshold: 95,
    timeoutMinutes: 25,
    estimatedTime: '50-70s',
    estimatedCost: '$0.35',
    useIntelligentSelection: false,
    bestFor: ['security-review', 'vulnerability-assessment', 'auth-systems', 'data-protection']
  }
};

/**
 * Automatic preset selector based on question analysis
 */
export class PresetSelector {
  constructor() {
    this.geminiCoordinator = new GeminiCoordinator();
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.geminiCoordinator.initialize();
      this.initialized = true;
    }
  }

  /**
   * Select optimal preset based on question analysis
   * @param {string} question - The question to analyze
   * @param {Object} options - Analysis options
   * @param {string} options.userPreference - User-specified preset name
   * @param {string} options.projectPath - Project path for context
   * @param {number} options.urgency - Urgency level (0-1)
   * @param {number} options.budget - Budget constraint (0-1)
   * @returns {Object} Selected preset configuration
   */
  async selectPreset(question, options = {}) {
    const {
      userPreference,
      projectPath = process.cwd(),
      urgency = 0.5,
      budget = 0.5
    } = options;

    // User explicitly chose a preset
    if (userPreference && QualityPresets[userPreference]) {
      console.log(`🎯 User selected preset: ${userPreference}`);
      return {
        ...QualityPresets[userPreference],
        id: userPreference,
        selectionReason: 'User specified'
      };
    }

    // Auto-detect based on question analysis
    await this.initialize();

    try {
      const analysis = await this.analyzeQuestion(question, {
        projectPath,
        urgency,
        budget
      });

      const selectedPreset = this.selectBasedOnAnalysis(analysis, urgency, budget);

      console.log(`🧠 Auto-selected preset: ${selectedPreset.id}`);
      console.log(`   Reason: ${selectedPreset.selectionReason}`);
      console.log(`   Analysis: ${analysis.category} (complexity: ${analysis.complexity}, criticality: ${analysis.criticality})`);

      return selectedPreset;

    } catch (error) {
      console.warn(`⚠️ Preset auto-selection failed: ${error.message}`);
      console.log(`🔄 Falling back to balanced preset`);

      return {
        ...QualityPresets['balanced'],
        id: 'balanced',
        selectionReason: `Fallback due to analysis error: ${error.message}`
      };
    }
  }

  /**
   * Analyze question to determine characteristics
   */
  async analyzeQuestion(question, options = {}) {
    const { projectPath, urgency, budget } = options;

    // Use Gemini Coordinator for question analysis
    const geminiAnalysis = await this.geminiCoordinator.analyzeQuestion(question, {
      projectPath,
      urgency
    });

    // Extract key characteristics
    const analysis = {
      category: geminiAnalysis.category || 'general',
      complexity: geminiAnalysis.complexityLevel || 'medium',
      criticality: geminiAnalysis.criticalityLevel || 'medium',
      domains: geminiAnalysis.domains || [],
      keywords: this.extractKeywords(question),
      urgency,
      budget,
      estimatedScope: geminiAnalysis.estimatedScope || 'medium'
    };

    return analysis;
  }

  /**
   * Select preset based on analysis results
   */
  selectBasedOnAnalysis(analysis, urgency, budget) {
    const { category, complexity, criticality, keywords } = analysis;

    // Security-related questions get security focus
    if (this.isSecurityRelated(category, keywords)) {
      return {
        ...QualityPresets['security-focused'],
        id: 'security-focused',
        selectionReason: 'Security-related question detected'
      };
    }

    // High urgency prioritizes speed
    if (urgency > 0.8) {
      return {
        ...QualityPresets['rapid'],
        id: 'rapid',
        selectionReason: 'High urgency requires rapid response'
      };
    }

    // Low budget prioritizes cost
    if (budget < 0.3) {
      return {
        ...QualityPresets['cost-optimized'],
        id: 'cost-optimized',
        selectionReason: 'Budget constraints require cost optimization'
      };
    }

    // High complexity + high criticality = maximum accuracy
    if (complexity === 'high' && criticality === 'high') {
      return {
        ...QualityPresets['maximum-accuracy'],
        id: 'maximum-accuracy',
        selectionReason: 'High complexity and criticality require maximum accuracy'
      };
    }

    // Complex analysis questions
    if (complexity === 'high' || this.isAnalysisHeavy(category, keywords)) {
      return {
        ...QualityPresets['deep-analysis'],
        id: 'deep-analysis',
        selectionReason: 'Complex analysis required'
      };
    }

    // Simple/debugging questions
    if (complexity === 'low' || this.isSimpleTask(category, keywords)) {
      return {
        ...QualityPresets['rapid'],
        id: 'rapid',
        selectionReason: 'Simple task suitable for rapid response'
      };
    }

    // Default to balanced for most cases
    return {
      ...QualityPresets['balanced'],
      id: 'balanced',
      selectionReason: 'Default balanced approach for general tasks'
    };
  }

  /**
   * Check if question is security-related
   */
  isSecurityRelated(category, keywords) {
    const securityKeywords = [
      'security', 'vulnerability', 'auth', 'authentication', 'authorization',
      'encrypt', 'decrypt', 'password', 'token', 'jwt', 'oauth', 'cors',
      'xss', 'csrf', 'injection', 'sanitize', 'validate', 'secure'
    ];

    return category === 'security' ||
           keywords.some(keyword =>
             securityKeywords.some(secKeyword =>
               keyword.toLowerCase().includes(secKeyword)
             )
           );
  }

  /**
   * Check if question requires deep analysis
   */
  isAnalysisHeavy(category, keywords) {
    const analysisKeywords = [
      'analyze', 'research', 'investigate', 'optimize', 'performance',
      'architecture', 'design', 'pattern', 'algorithm', 'complexity',
      'scalability', 'system', 'structure', 'framework'
    ];

    return ['analysis', 'research', 'architecture', 'optimization'].includes(category) ||
           keywords.some(keyword =>
             analysisKeywords.some(anaKeyword =>
               keyword.toLowerCase().includes(anaKeyword)
             )
           );
  }

  /**
   * Check if question is a simple task
   */
  isSimpleTask(category, keywords) {
    const simpleKeywords = [
      'debug', 'fix', 'error', 'bug', 'syntax', 'typo', 'lint',
      'format', 'style', 'quick', 'simple', 'basic', 'trivial'
    ];

    return ['debugging', 'simple', 'syntax'].includes(category) ||
           keywords.some(keyword =>
             simpleKeywords.some(simpleKeyword =>
               keyword.toLowerCase().includes(simpleKeyword)
             )
           );
  }

  /**
   * Extract keywords from question
   */
  extractKeywords(question) {
    // Simple keyword extraction - remove common words and split
    const commonWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'how', 'what', 'where', 'when', 'why',
      'can', 'could', 'should', 'would', 'do', 'does', 'did', 'have', 'had'
    ]);

    return question
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 20); // Limit to first 20 keywords
  }

  /**
   * Get all available presets
   */
  getAvailablePresets() {
    return Object.keys(QualityPresets).map(id => ({
      id,
      ...QualityPresets[id]
    }));
  }

  /**
   * Validate preset configuration
   */
  validatePreset(presetId) {
    const preset = QualityPresets[presetId];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetId}`);
    }

    if (!preset.models || preset.models.length === 0) {
      throw new Error(`Preset ${presetId} has no models configured`);
    }

    if (typeof preset.consensusThreshold !== 'number' ||
        preset.consensusThreshold < 0 ||
        preset.consensusThreshold > 100) {
      throw new Error(`Preset ${presetId} has invalid consensus threshold`);
    }

    return true;
  }

  /**
   * Apply preset overrides to configuration
   */
  applyPresetOverrides(preset, overrides = {}) {
    const {
      models,
      verification,
      iterations,
      consensusThreshold,
      timeoutMinutes,
      useIntelligentSelection,
      ...otherOverrides
    } = overrides;

    return {
      ...preset,
      models: models || preset.models,
      verification: verification !== undefined ? verification : preset.verification,
      iterations: iterations || preset.iterations,
      consensusThreshold: consensusThreshold || preset.consensusThreshold,
      timeoutMinutes: timeoutMinutes || preset.timeoutMinutes,
      useIntelligentSelection: useIntelligentSelection !== undefined ?
        useIntelligentSelection : preset.useIntelligentSelection,
      ...otherOverrides,
      overrides: Object.keys(overrides) // Track what was overridden
    };
  }
}

/**
 * Utility functions for preset management
 */
export class PresetManager {
  constructor() {
    this.selector = new PresetSelector();
  }

  /**
   * Get preset comparison table
   */
  getComparisonTable() {
    const presets = Object.entries(QualityPresets);

    const table = {
      headers: ['Preset', 'Models', 'Time', 'Cost', 'Best For'],
      rows: presets.map(([id, preset]) => [
        preset.name,
        preset.models.length.toString(),
        preset.estimatedTime,
        preset.estimatedCost,
        preset.bestFor.slice(0, 2).join(', ')
      ])
    };

    return table;
  }

  /**
   * Format preset information for display
   */
  formatPresetInfo(presetId) {
    const preset = QualityPresets[presetId];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetId}`);
    }

    return `
📋 ${preset.name}
   ${preset.description}

🤖 Models: ${preset.models.join(', ')} (${preset.models.length} total)
⏱️  Time: ${preset.estimatedTime}
💰 Cost: ${preset.estimatedCost}
🎯 Best for: ${preset.bestFor.join(', ')}
✅ Verification: ${preset.verification ? 'Enabled' : 'Disabled'}
🔄 Iterations: ${preset.iterations}
📊 Consensus: ${preset.consensusThreshold}%
    `.trim();
  }

  /**
   * Estimate actual costs based on current usage
   */
  async estimateActualCost(presetId, questionLength = 1000) {
    const preset = QualityPresets[presetId];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetId}`);
    }

    // Rough cost estimation based on model usage
    const modelCosts = {
      'k1': 0.015, // Claude Opus
      'k2': 0.020, // GPT-5
      'k3': 0.008, // Qwen
      'k4': 0.012, // Gemini
      'k5': 0.002  // Grok
    };

    let totalCost = 0;
    for (const modelSpec of preset.models) {
      const [alias, instances] = modelSpec.split(':');
      const instanceCount = parseInt(instances) || 1;
      const baseCost = modelCosts[alias] || 0.010;

      // Factor in question length and iterations
      const lengthMultiplier = Math.max(0.5, questionLength / 1000);
      totalCost += baseCost * instanceCount * preset.iterations * lengthMultiplier;
    }

    // Add verification cost if enabled
    if (preset.verification) {
      totalCost *= 1.3;
    }

    return {
      estimated: totalCost,
      range: {
        min: totalCost * 0.7,
        max: totalCost * 1.5
      },
      breakdown: {
        modelCalls: preset.models.length * preset.iterations,
        verification: preset.verification,
        lengthFactor: Math.max(0.5, questionLength / 1000)
      }
    };
  }
}

export default { QualityPresets, PresetSelector, PresetManager };