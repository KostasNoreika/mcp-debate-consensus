# Task 003: Parallel Instance Support

## Current State (NOW)
- Each model runs only once per debate
- No way to get multiple perspectives from same model
- No redundancy for critical tasks
- Fixed single instance per model

## Future State (AFTER)
- Support syntax: `k1:2` (run 2 Claude instances)
- Multiple instances with different seeds/temperatures
- Parallel execution for speed
- Consensus among instances of same model

## Implementation

### Parser
```javascript
function parseModelConfig(config) {
  // "k1:2,k2,k3:3" → multiple instances
  return config.split(',').map(m => {
    const [model, count = "1"] = m.split(':');
    return { model, count: parseInt(count) };
  });
}
```

### Execution
```javascript
async runParallelInstances(model, count, question) {
  const tasks = [];

  for (let i = 0; i < count; i++) {
    tasks.push(
      this.callModel(model, question, {
        seed: i * 1000,
        temperature: 0.3 + (i * 0.2)
      })
    );
  }

  const results = await Promise.all(tasks);
  return this.synthesizeInstanceResults(results);
}
```

## When to Use Multiple Instances

### Critical Code (Security/Finance)
- Config: `k1:2,k2:2,k3,k4,k5`
- Why: Double-check critical implementations
- Example: Payment processing, authentication

### Creative Exploration
- Config: `k2:3,k5:2`
- Why: Multiple creative approaches
- Example: "Design a new product feature"

### Reducing Randomness
- Config: `k5:3` with different temperatures
- Why: Average out model randomness
- Example: Complex reasoning tasks

### Complex Decomposition
- Config: `k1:2` with task splitting
- Why: Divide problem into sub-problems
- Example: "Build real-time chat" → frontend + backend

## Benefits
- **Higher confidence** for critical tasks
- **Creative diversity** for open-ended problems
- **Reduced randomness** through averaging
- **Parallel processing** maintains speed