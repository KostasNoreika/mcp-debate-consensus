# Task 009: Quality Presets

## Current State (NOW)
- One-size-fits-all approach
- No way to prioritize speed vs accuracy
- No budget control options
- Same process for all questions

## Future State (AFTER)
- Multiple quality presets
- User can choose speed/cost/accuracy balance
- Automatic preset selection based on context
- Flexible system for different needs

## Implementation

### Preset Definitions
```javascript
const QualityPresets = {
  'maximum-accuracy': {
    name: 'Maximum Accuracy',
    description: 'Highest quality, all models, verification',
    models: ['k1:2', 'k2:2', 'k3', 'k4', 'k5'],
    verification: true,
    iterations: 5,
    consensusThreshold: 95,
    estimatedTime: '60-90s',
    estimatedCost: '$0.50'
  },

  'balanced': {
    name: 'Balanced',
    description: 'Good accuracy with reasonable speed',
    models: ['k1', 'k2', 'k5'],
    verification: false,
    iterations: 3,
    consensusThreshold: 80,
    estimatedTime: '30-45s',
    estimatedCost: '$0.20'
  },

  'rapid': {
    name: 'Rapid Response',
    description: 'Fast answers, good for simple questions',
    models: ['k5', 'k5', 'k5'], // 3x Grok
    verification: false,
    iterations: 1,
    consensusThreshold: 70,
    estimatedTime: '5-10s',
    estimatedCost: '$0.02'
  },

  'cost-optimized': {
    name: 'Cost Optimized',
    description: 'Minimum cost, acceptable quality',
    models: ['k5'], // Just Grok
    verification: false,
    iterations: 1,
    consensusThreshold: 60,
    estimatedTime: '3-5s',
    estimatedCost: '$0.01'
  },

  'deep-analysis': {
    name: 'Deep Analysis',
    description: 'Thorough analysis for complex problems',
    models: ['k1', 'k1', 'k3', 'k4'],
    verification: true,
    iterations: 5,
    consensusThreshold: 90,
    estimatedTime: '90-120s',
    estimatedCost: '$0.40'
  }
};
```

### Automatic Preset Selection
```javascript
class PresetSelector {
  async selectPreset(question, userPreference) {
    // User explicitly chose
    if (userPreference) {
      return QualityPresets[userPreference];
    }

    // Auto-detect based on question
    const analysis = await this.analyzeQuestion(question);

    if (analysis.complexity === 'high' &&
        analysis.criticality === 'high') {
      return QualityPresets['maximum-accuracy'];
    }

    if (analysis.complexity === 'low') {
      return QualityPresets['rapid'];
    }

    if (analysis.category.includes('debug')) {
      return QualityPresets['rapid'];
    }

    if (analysis.category.includes('security')) {
      return QualityPresets['maximum-accuracy'];
    }

    // Default
    return QualityPresets['balanced'];
  }
}
```

### Usage Examples
```javascript
// User specifies preset
await debate.run(question, {
  preset: 'rapid'
});

// Auto-detection
await debate.run(question); // System chooses

// Override specific settings
await debate.run(question, {
  preset: 'balanced',
  verification: true // Add verification to balanced
});
```

## Preset Comparison

| Preset | Models | Time | Cost | Best For |
|--------|--------|------|------|----------|
| Maximum | 5-7 | 60-90s | $0.50 | Critical decisions |
| Balanced | 3 | 30-45s | $0.20 | Most tasks |
| Rapid | 1-3 | 5-10s | $0.02 | Simple questions |
| Cost | 1 | 3-5s | $0.01 | Budget conscious |
| Deep | 4 | 90-120s | $0.40 | Complex analysis |

## Benefits
- **User control** over quality/speed/cost
- **Predictable** time and cost
- **Optimized** for different use cases
- **Flexible** system that adapts