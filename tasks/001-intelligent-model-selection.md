# Task 001: Intelligent Model Selection with Gemini Coordinator

## Current State (NOW)
- All 5 models (k1-k5) always participate in every debate
- No intelligence about which models are best for what
- High cost and slow response for simple questions
- Every question gets same treatment regardless of complexity

## Future State (AFTER)
- Gemini (k4) acts as coordinator/selector
- Analyzes question and selects 3-5 optimal models based on:
  - Question category (from 70+ universal categories)
  - Complexity assessment
  - Historical performance data
  - Urgency/budget constraints
- Minimum 3 models for consensus, up to all 5 for critical tasks
- Can run multiple instances (k1:2) for important questions

## Implementation Steps

### Phase 1: Gemini Coordinator
```javascript
class GeminiCoordinator {
  async analyzeQuestion(question) {
    // Gemini analyzes and returns:
    return {
      category: 'tech/programming/debugging',
      complexity: 'medium',
      criticality: 'low',
      suggestedModels: ['k5', 'k2', 'k3'],
      reasoning: 'Simple debug task - Grok for speed, GPT-5 for accuracy'
    };
  }
}
```

### Phase 2: Smart Selection Logic
```javascript
async function selectModels(question) {
  // Step 1: Gemini analyzes
  const analysis = await gemini.analyze(question);

  // Step 2: Apply rules
  if (analysis.criticality === 'high') {
    // Use all models + duplicates for critical
    return ['k1:2', 'k2:2', 'k3', 'k4', 'k5'];
  }

  if (analysis.complexity === 'low') {
    // Just 3 fast models for simple tasks
    return ['k5', 'k2', 'k3'];
  }

  // Default: Top 3 performers for category
  return getTopPerformers(analysis.category, 3);
}
```

## Benefits
- **50% cost reduction** on simple questions
- **2x faster** responses for low-complexity tasks
- **Better accuracy** by using specialized models
- **Scalable** - can add more models without always using all

## Example Scenarios

### Simple Bug Fix
- Question: "Fix undefined variable error"
- Gemini selects: k5 only (fast, cheap)
- Cost: 1/5 of current

### Complex Architecture
- Question: "Design microservices for banking"
- Gemini selects: k1:2, k2:2, k3, k4, k5
- Cost: 1.4x current (but higher accuracy)

### Medium Task
- Question: "Write unit tests for this class"
- Gemini selects: k2, k1, k5
- Cost: 0.6x current