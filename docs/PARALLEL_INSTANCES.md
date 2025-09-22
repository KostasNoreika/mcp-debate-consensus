# Parallel Instance Support - Implementation Guide

## When to Run Multiple Instances of Same Model

### Use Cases for Parallel Instances:

#### 1. **Non-Deterministic Problem Solving**
When dealing with creative or open-ended problems where multiple approaches exist:
```javascript
// Example: "Design a user authentication system"
// Run k1:3 (3 Claude instances) to get 3 different architectural approaches
{
  "models": ["k1:3"], // 3 parallel Claude Opus instances
  "reason": "Multiple valid architectures possible"
}
```

#### 2. **Verification of Critical Code**
For mission-critical code where we need high confidence:
```javascript
// Example: "Implement payment processing with Stripe"
// Run k2:2 for double-verification of security aspects
{
  "models": ["k1", "k2:2", "k3", "k4"], // 2 GPT-5 instances for security focus
  "reason": "Payment code requires extra security verification"
}
```

#### 3. **Randomness Reduction**
When model temperature affects output quality:
```javascript
// Run same model with different seeds/temperatures
{
  "models": ["k5:3"], // 3 Grok instances
  "configs": [
    { "temperature": 0.3, "seed": 1 },
    { "temperature": 0.5, "seed": 2 },
    { "temperature": 0.7, "seed": 3 }
  ]
}
```

#### 4. **Complex Problem Decomposition**
Split complex problems into sub-problems:
```javascript
// Example: "Build a real-time chat application"
{
  "models": {
    "k1:2": ["frontend architecture", "backend architecture"],
    "k2:2": ["testing strategy", "security review"],
    "k3": ["optimization approach"]
  }
}
```

## Implementation Approach

### Phase 1: Simple Parallel Execution
```javascript
class ParallelDebate {
  async runWithInstances(question, modelConfig) {
    // Parse model config: "k1:2,k2,k3:3"
    const instances = this.parseModelConfig(modelConfig);

    const tasks = [];
    for (const [model, count] of instances) {
      for (let i = 0; i < count; i++) {
        tasks.push(this.runModel(model, question, {
          instanceId: `${model}_${i}`,
          seed: i * 1000 // Different seeds for variety
        }));
      }
    }

    const results = await Promise.all(tasks);
    return this.synthesizeResults(results);
  }

  parseModelConfig(config) {
    // "k1:2,k2,k3:3" → [["k1", 2], ["k2", 1], ["k3", 3]]
    return config.split(',').map(m => {
      const [model, count = "1"] = m.split(':');
      return [model, parseInt(count)];
    });
  }
}
```

### Phase 2: Smart Instance Allocation
```javascript
class SmartInstanceAllocator {
  async allocateInstances(question, category) {
    const complexity = await this.assessComplexity(question);
    const criticality = await this.assessCriticality(question);

    if (criticality === 'high' && complexity === 'high') {
      // Maximum verification for complex critical tasks
      return {
        k1: 2, // 2x Architecture review
        k2: 2, // 2x Testing verification
        k3: 1, // 1x Algorithm check
        k4: 1, // 1x Integration
        k5: 2  // 2x Fast verification
      };
    }

    if (complexity === 'low' && criticality === 'low') {
      // Single fast instance for simple tasks
      return { k5: 1 };
    }

    // Default balanced approach
    return { k1: 1, k3: 1, k5: 1 };
  }
}
```

### Phase 3: Consensus Among Instances
```javascript
class InstanceConsensus {
  async evaluateInstanceAgreement(results) {
    // Group by model type
    const byModel = {};
    results.forEach(r => {
      if (!byModel[r.model]) byModel[r.model] = [];
      byModel[r.model].push(r.response);
    });

    // Calculate intra-model agreement
    const agreements = {};
    for (const [model, responses] of Object.entries(byModel)) {
      if (responses.length > 1) {
        agreements[model] = await this.calculateSimilarity(responses);
      }
    }

    return {
      agreements,
      shouldAddMoreInstances: this.needsMoreInstances(agreements),
      consensusLevel: this.overallConsensus(agreements)
    };
  }

  needsMoreInstances(agreements) {
    // If any model has low internal agreement, might need more instances
    return Object.values(agreements).some(a => a < 0.7);
  }
}
```

## Cost-Benefit Analysis

### When Parallel Instances are Worth It:
1. **High-stakes decisions** - Cost of error > cost of extra tokens
2. **Creative exploration** - Need diverse solutions
3. **Verification critical** - Security, financial, healthcare
4. **Learning phase** - Building training data for model selection

### When to Avoid:
1. **Simple factual questions** - Single instance sufficient
2. **Tight budget constraints** - Use single k5 (Grok Fast)
3. **Time-critical responses** - Parallel adds latency
4. **Deterministic problems** - Math, logic with single answer

## Practical Examples

### Example 1: Security Audit
```javascript
// High criticality = multiple instances
await debate.run({
  question: "Audit this authentication code for vulnerabilities",
  config: {
    models: "k1:2,k2:3,k4:2", // Heavy on testing & security
    reason: "Security requires multiple perspectives"
  }
});
```

### Example 2: Algorithm Optimization
```javascript
// Complex algorithm = specialized single instances
await debate.run({
  question: "Optimize this sorting algorithm",
  config: {
    models: "k3:2,k5", // 2x algorithm expert + fast verify
    reason: "Algorithm optimization needs deep expertise"
  }
});
```

### Example 3: Quick Bug Fix
```javascript
// Simple bug = single fast instance
await debate.run({
  question: "Fix this undefined variable error",
  config: {
    models: "k5", // Just Grok Fast
    reason: "Simple syntax error"
  }
});
```