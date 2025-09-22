# Learning System for Intelligent Model Selection

## Overview
After 50+ categorized debates, the system learns which models perform best for specific task types, enabling automatic optimization of model selection, reducing costs, and improving response times.

## Architecture

### 1. Data Collection Layer
```javascript
class PerformanceDatabase {
  constructor() {
    this.dbPath = './data/performance.db';
    this.categories = new Map();
    this.modelProfiles = new Map();
  }

  async recordDebate(result) {
    const record = {
      id: uuid(),
      timestamp: Date.now(),
      category: result.category,
      subcategories: result.subcategories,
      question: result.question,
      questionEmbedding: await this.getEmbedding(result.question),
      modelsUsed: result.modelsUsed,
      winner: result.winner,
      scores: result.scores,
      times: result.times,
      tokens: result.tokens,
      cost: this.calculateCost(result.tokens),
      userFeedback: null // Updated later
    };

    await this.save(record);
    await this.updateModelProfiles(record);
  }
}
```

### 2. Model Profile System
```javascript
class ModelProfiler {
  profiles = {
    k1: { // Claude Opus 4.1
      strengths: [],
      weaknesses: [],
      avgScore: {},
      winRate: {},
      avgTime: {},
      costEfficiency: {}
    },
    k2: { // GPT-5
      strengths: [],
      weaknesses: [],
      avgScore: {},
      winRate: {},
      avgTime: {},
      costEfficiency: {}
    },
    k3: { // Qwen 3 Max
      strengths: [],
      weaknesses: [],
      avgScore: {},
      winRate: {},
      avgTime: {},
      costEfficiency: {}
    },
    k4: { // Gemini 2.5 Pro
      strengths: [],
      weaknesses: [],
      avgScore: {},
      winRate: {},
      avgTime: {},
      costEfficiency: {}
    },
    k5: { // Grok 4 Fast
      strengths: [],
      weaknesses: [],
      avgScore: {},
      winRate: {},
      avgTime: {},
      costEfficiency: {}
    }
  };

  async updateProfile(model, category, performance) {
    const profile = this.profiles[model];

    // Update category-specific metrics
    if (!profile.avgScore[category]) {
      profile.avgScore[category] = [];
    }
    profile.avgScore[category].push(performance.score);

    // Update win rate
    if (!profile.winRate[category]) {
      profile.winRate[category] = { wins: 0, total: 0 };
    }
    profile.winRate[category].total++;
    if (performance.isWinner) {
      profile.winRate[category].wins++;
    }

    // Identify strengths (>80% win rate)
    if (profile.winRate[category].wins / profile.winRate[category].total > 0.8) {
      if (!profile.strengths.includes(category)) {
        profile.strengths.push(category);
      }
    }

    // Identify weaknesses (<20% win rate after 10+ attempts)
    if (profile.winRate[category].total > 10 &&
        profile.winRate[category].wins / profile.winRate[category].total < 0.2) {
      if (!profile.weaknesses.includes(category)) {
        profile.weaknesses.push(category);
      }
    }
  }
}
```

### 3. Intelligent Model Selector
```javascript
class IntelligentModelSelector {
  constructor() {
    this.minDataPoints = 10; // Minimum debates before making decisions
    this.profiler = new ModelProfiler();
    this.performanceDB = new PerformanceDatabase();
  }

  async selectModels(question, options = {}) {
    // Detect category
    const category = await this.detectCategory(question);
    const complexity = await this.assessComplexity(question);

    // Get historical performance
    const history = await this.performanceDB.getCategoryHistory(category);

    if (history.length < this.minDataPoints) {
      // Not enough data - use all models
      return this.getDefaultModels(complexity);
    }

    // Smart selection based on learned performance
    return await this.smartSelection(category, complexity, options);
  }

  async smartSelection(category, complexity, options) {
    const {
      maxModels = 3,
      urgency = 'normal', // fast, normal, thorough
      budget = 'normal'   // low, normal, unlimited
    } = options;

    const profiles = await this.profiler.getProfilesForCategory(category);

    // Rank models by performance
    const ranked = profiles
      .map(p => ({
        model: p.model,
        score: this.calculateSelectionScore(p, category, urgency, budget)
      }))
      .sort((a, b) => b.score - a.score);

    // Handle different urgency levels
    if (urgency === 'fast') {
      // Prioritize k5 (Grok Fast) and only add others if really needed
      const fast = ranked.filter(r => r.model === 'k5')[0];
      const others = ranked.filter(r => r.model !== 'k5').slice(0, maxModels - 1);
      return [fast, ...others].map(r => r.model);
    }

    if (urgency === 'thorough') {
      // Use all high-performers, ignore maxModels limit
      return ranked
        .filter(r => r.score > 0.7)
        .map(r => r.model);
    }

    // Normal: Top performers up to maxModels
    return ranked.slice(0, maxModels).map(r => r.model);
  }

  calculateSelectionScore(profile, category, urgency, budget) {
    let score = 0;

    // Win rate (40% weight)
    const winRate = profile.winRate[category] || { wins: 0, total: 1 };
    score += (winRate.wins / winRate.total) * 0.4;

    // Average score (30% weight)
    const avgScore = profile.avgScore[category] || [0.5];
    score += (avgScore.reduce((a, b) => a + b) / avgScore.length) * 0.3;

    // Speed consideration (20% weight if urgency is high)
    if (urgency === 'fast') {
      const speedScore = profile.model === 'k5' ? 1.0 : 0.3;
      score += speedScore * 0.2;
    } else {
      const avgTime = profile.avgTime[category] || 30;
      const timeScore = Math.max(0, 1 - (avgTime / 60)); // Normalize to 0-1
      score += timeScore * 0.2;
    }

    // Cost efficiency (10% weight if budget constrained)
    if (budget === 'low') {
      const costScore = profile.costEfficiency[category] || 0.5;
      score += costScore * 0.1;
    } else {
      score += 0.05; // Small bonus for cost efficiency even on normal budget
    }

    return score;
  }

  async detectCategory(question) {
    // Use lightweight embedding model for classification
    const embedding = await this.getQuestionEmbedding(question);

    // Compare to known category embeddings
    const similarities = await this.performanceDB.findSimilarCategories(embedding);

    if (similarities[0].score > 0.85) {
      // High confidence - use this category
      return similarities[0].category;
    }

    // Use k5 (Grok) for quick category detection
    const detected = await this.callModel('k5', `
      Classify this question into one of our categories:
      ${Object.keys(TASK_CATEGORIES).join(', ')}

      Question: ${question}

      Return only the category code (e.g., "code/backend/api").
    `);

    return this.parseCategory(detected);
  }

  async assessComplexity(question) {
    // Simple heuristics
    const wordCount = question.split(' ').length;
    const hasCode = question.includes('```') || question.includes('function');
    const hasMultipleParts = question.includes('and') || question.includes('also');

    if (wordCount > 200 || (hasCode && hasMultipleParts)) {
      return 'high';
    }
    if (wordCount > 50 || hasCode) {
      return 'medium';
    }
    return 'low';
  }
}
```

### 4. Continuous Learning Loop
```javascript
class LearningLoop {
  constructor() {
    this.selector = new IntelligentModelSelector();
    this.scheduler = new CronJob('0 0 * * *', this.updateModels.bind(this)); // Daily
  }

  async updateModels() {
    // Analyze recent performance
    const recentDebates = await this.getRecentDebates(7); // Last 7 days

    for (const debate of recentDebates) {
      // Update model profiles
      await this.updateModelProfile(debate);

      // Detect emerging patterns
      await this.detectPatterns(debate);
    }

    // Prune underperformers
    await this.optimizeModelSelection();

    // Generate report
    await this.generatePerformanceReport();
  }

  async detectPatterns(debate) {
    // Find surprising wins (underdog victories)
    if (debate.winner !== debate.predicted) {
      await this.analyzeUnderdogWin(debate);
    }

    // Find consistent failures
    if (debate.consensusScore < 0.5) {
      await this.analyzeLowConsensus(debate);
    }
  }

  async optimizeModelSelection() {
    // For each category, identify optimal model combinations
    const categories = await this.getAllCategories();

    for (const category of categories) {
      const performance = await this.getCategoryPerformance(category);

      // Find best 3-model combination
      const bestTrio = this.findBestCombination(performance, 3);

      // Save as recommended config
      await this.saveRecommendation(category, bestTrio);
    }
  }
}
```

### 5. Future Model Integration
```javascript
class ModelRegistry {
  models = new Map([
    ['k1', { provider: 'anthropic', model: 'claude-opus-4.1', type: 'llm' }],
    ['k2', { provider: 'openai', model: 'gpt-5', type: 'llm' }],
    ['k3', { provider: 'qwen', model: 'qwen3-max', type: 'llm' }],
    ['k4', { provider: 'google', model: 'gemini-2.5-pro', type: 'llm' }],
    ['k5', { provider: 'x-ai', model: 'grok-4-fast', type: 'llm' }],
    // Future models
    ['k6', { provider: 'anthropic', model: 'claude-haiku-4', type: 'llm' }],
    ['e1', { provider: 'custom', model: 'code-expert-v1', type: 'expert' }],
    ['e2', { provider: 'custom', model: 'security-expert-v1', type: 'expert' }],
    ['t1', { provider: 'tools', model: 'code-analyzer', type: 'tool' }]
  ]);

  async registerModel(id, config) {
    // Validate model
    await this.validateModel(config);

    // Add to registry
    this.models.set(id, config);

    // Initialize profile
    await this.profiler.initializeProfile(id);

    // Run benchmark suite
    await this.runBenchmarks(id);
  }
}
```

## Implementation Phases

### Phase 1: Basic Tracking (Week 1)
- Implement performance database
- Record all debate results
- Simple category detection

### Phase 2: Profile Building (Week 2-3)
- Build model profiles from history
- Calculate win rates and strengths
- Basic model selection

### Phase 3: Smart Selection (Week 4-5)
- Implement intelligent selector
- Category-based optimization
- Cost/speed/quality tradeoffs

### Phase 4: Continuous Learning (Week 6+)
- Automated pattern detection
- Performance optimization
- Model combination discovery

## Expected Outcomes

After 100+ debates:
- **30-50% cost reduction** by using fewer models intelligently
- **40% faster responses** by selecting fast models when appropriate
- **15% accuracy improvement** by using specialized models for their strengths
- **Automatic discovery** of best model combinations per task type

## Monitoring Dashboard

```javascript
{
  "modelPerformance": {
    "k1": {
      "strengths": ["architecture/system", "code/refactoring"],
      "weaknesses": ["data/ml", "devops/cloud"],
      "overallWinRate": 0.35,
      "avgResponseTime": 15.2
    },
    "k5": {
      "strengths": ["debug/quick", "code/simple"],
      "weaknesses": ["architecture/complex"],
      "overallWinRate": 0.15,
      "avgResponseTime": 3.1
    }
  },
  "categoryInsights": {
    "code/backend/api": {
      "bestModels": ["k2", "k1", "k3"],
      "avgDebateTime": 45,
      "successRate": 0.92
    }
  },
  "recommendations": {
    "nextDebate": {
      "suggestedModels": ["k1", "k3", "k5"],
      "reason": "Based on 15 similar past debates",
      "confidence": 0.87
    }
  }
}
```