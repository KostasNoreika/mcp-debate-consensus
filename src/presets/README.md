# Quality Presets System

The Quality Presets System provides different quality/speed/cost tradeoffs for AI Expert Consensus debates, giving users control over the debate configuration while maintaining predictable outcomes.

## Overview

### Available Presets

| Preset | Models | Time | Cost | Best For |
|--------|--------|------|------|----------|
| **Rapid Response** | 3 | 3-5s | $0.01 | Debugging, simple questions, quick fixes |
| **Cost Optimized** | 1 | 2-3s | $0.005 | Budget conscious, simple tasks, prototyping |
| **Balanced** | 3 | 30-45s | $0.20 | General development, code review, most tasks |
| **Maximum Accuracy** | 5-7 | 60-90s | $0.50 | Critical decisions, security review, production releases |
| **Deep Analysis** | 4 | 90-120s | $0.40 | Complex problems, system design, research |
| **Security Focused** | 3-5 | 50-70s | $0.35 | Security review, vulnerability assessment, auth systems |

### Key Features

- **Automatic Preset Selection**: Analyzes questions to recommend optimal presets
- **User Override**: Specify preset manually or let system auto-select
- **Flexible Overrides**: Customize any preset with specific settings
- **Predictable Costs**: Time and cost estimates for planning
- **Quality Control**: Different consensus thresholds and verification levels

## Usage

### Basic Usage

```javascript
import { PresetIntegratedDebate } from './src/presets/preset-integration.js';
import { ClaudeCliDebate } from './src/claude-cli-debate.js';

// Create debate instance with preset support
const debate = new ClaudeCliDebate();
const presetDebate = new PresetIntegratedDebate(debate);

// Auto-select preset (recommended)
const result = await presetDebate.runDebateWithPresets(
  "How do I optimize this database query?",
  "/path/to/project"
);

// Use specific preset
const result = await presetDebate.runRapid(
  "Fix this syntax error quickly"
);

// Use preset with custom options
const result = await presetDebate.runDebateWithPresets(
  "Design a secure authentication system",
  "/path/to/project",
  {
    preset: 'security-focused',
    urgency: 0.8,
    budget: 0.3,
    overrides: {
      verification: true,
      timeoutMinutes: 30
    }
  }
);
```

### MCP Tool Usage

When using the MCP server, use the enhanced `debate_with_preset` tool:

```json
{
  "name": "debate_with_preset",
  "arguments": {
    "question": "How can I improve the performance of this React component?",
    "preset": "balanced",
    "urgency": 0.5,
    "budget": 0.7
  }
}
```

### Convenience Methods

```javascript
// Quick access to common presets
await presetDebate.runRapid(question);           // 3-5s, $0.01
await presetDebate.runBalanced(question);        // 30-45s, $0.20
await presetDebate.runMaximumAccuracy(question); // 60-90s, $0.50
await presetDebate.runDeepAnalysis(question);    // 90-120s, $0.40
await presetDebate.runCostOptimized(question);   // 2-3s, $0.005
await presetDebate.runSecurityFocused(question); // 50-70s, $0.35
```

## Preset Details

### Rapid Response
- **Models**: 3x Grok Fast (k5)
- **Use Case**: Quick debugging, syntax errors, simple questions
- **Features**: Fast execution, minimal cost, basic consensus
- **Tradeoffs**: Lower accuracy for speed

### Cost Optimized
- **Models**: 1x Grok Fast (k5)
- **Use Case**: Budget constraints, simple tasks, experimentation
- **Features**: Lowest cost, fastest execution
- **Tradeoffs**: Single model, no consensus

### Balanced (Default)
- **Models**: Claude Opus + GPT-5 + Grok Fast
- **Use Case**: Most development tasks, general questions
- **Features**: Good balance of speed, cost, and accuracy
- **Tradeoffs**: Middle ground approach

### Maximum Accuracy
- **Models**: All models with parallel instances
- **Use Case**: Critical decisions, production releases
- **Features**: Highest consensus threshold, verification enabled
- **Tradeoffs**: Highest cost and time

### Deep Analysis
- **Models**: Architecture and analysis focused models
- **Use Case**: Complex system design, research, optimization
- **Features**: Extended analysis, verification, high consensus
- **Tradeoffs**: Longer execution time

### Security Focused
- **Models**: Security and integration experts
- **Use Case**: Security reviews, vulnerability assessment
- **Features**: Security-optimized model selection
- **Tradeoffs**: Specialized for security domain

## Automatic Selection

The system automatically selects the best preset based on:

### Question Analysis
- **Keywords**: Detects security, debugging, architecture terms
- **Complexity**: Analyzes technical complexity
- **Domain**: Identifies question category

### Context Factors
- **Urgency**: Higher urgency → faster presets
- **Budget**: Lower budget → cost-optimized presets
- **Project Type**: Affects model selection

### Selection Logic
```javascript
// Security questions → Security Focused
if (isSecurityRelated(question)) return 'security-focused';

// High urgency → Rapid Response
if (urgency > 0.8) return 'rapid';

// Low budget → Cost Optimized
if (budget < 0.3) return 'cost-optimized';

// Complex + Critical → Maximum Accuracy
if (complexity === 'high' && criticality === 'high') return 'maximum-accuracy';

// Complex analysis → Deep Analysis
if (isAnalysisHeavy(question)) return 'deep-analysis';

// Simple tasks → Rapid Response
if (isSimpleTask(question)) return 'rapid';

// Default → Balanced
return 'balanced';
```

## Configuration Overrides

Customize any preset with specific overrides:

```javascript
const result = await presetDebate.runDebateWithPresets(question, path, {
  preset: 'balanced',
  overrides: {
    models: ['k1', 'k2:2', 'k4'],     // Custom model selection
    verification: true,                // Enable verification
    iterations: 5,                     // More iterations
    consensusThreshold: 95,            // Higher consensus
    timeoutMinutes: 20                 // Custom timeout
  }
});
```

## Cost Estimation

Get cost estimates before running debates:

```javascript
import { PresetManager } from './src/presets/quality-presets.js';

const manager = new PresetManager();

// Estimate cost for specific preset
const estimate = await manager.estimateActualCost('balanced', 1500);
console.log(`Estimated cost: $${estimate.estimated.toFixed(3)}`);
console.log(`Range: $${estimate.range.min.toFixed(3)} - $${estimate.range.max.toFixed(3)}`);

// Get comparison table
const table = manager.getComparisonTable();
```

## Advanced Features

### Preset Analysis
```javascript
import { PresetSelector } from './src/presets/quality-presets.js';

const selector = new PresetSelector();
await selector.initialize();

// Analyze question for optimal preset
const analysis = await selector.selectPreset(question, {
  urgency: 0.7,
  budget: 0.5,
  projectPath: '/path/to/project'
});

console.log(`Recommended: ${analysis.name}`);
console.log(`Reason: ${analysis.selectionReason}`);
```

### Preset Validation
```javascript
// Validate preset configuration
try {
  selector.validatePreset('balanced');
  console.log('Preset is valid');
} catch (error) {
  console.error('Invalid preset:', error.message);
}
```

### Custom Presets
```javascript
// Create custom preset configuration
const customPreset = {
  name: 'Custom Research',
  models: ['k1:3', 'k3:2'],
  verification: true,
  iterations: 7,
  consensusThreshold: 90,
  timeoutMinutes: 45,
  estimatedTime: '120-150s',
  estimatedCost: '$0.60'
};

// Apply custom configuration
const result = await presetDebate.runDebateWithPresets(question, path, {
  preset: null,
  overrides: customPreset
});
```

## Testing

Run the test suite to verify preset functionality:

```bash
# Run comprehensive tests
node test-preset-system.js

# Run quick demo
node demo-presets.js
```

## Integration

### With Existing Debate System
```javascript
// Wrap existing debate instance
const existingDebate = new ClaudeCliDebate();
const presetDebate = new PresetIntegratedDebate(existingDebate);

// All existing functionality remains available
const regularResult = await existingDebate.runDebate(question);
const presetResult = await presetDebate.runDebateWithPresets(question);
```

### With MCP Server
The preset system is integrated into the MCP server via additional tools:

- `debate_with_preset` - Enhanced debate with preset support
- `list_presets` - List available presets
- `analyze_question_for_preset` - Analyze questions for preset recommendation
- `estimate_preset_cost` - Estimate costs for presets

## Best Practices

### When to Use Each Preset

**Rapid Response**
- Syntax errors and quick fixes
- Simple debugging questions
- Urgent but non-critical issues
- Development environment testing

**Balanced**
- Most development questions
- Code reviews and architecture discussions
- General technical guidance
- Default choice when unsure

**Maximum Accuracy**
- Production deployment decisions
- Security-critical implementations
- High-stakes technical choices
- Final validation before release

**Deep Analysis**
- Complex system design
- Performance optimization strategies
- Research and investigation
- Architectural planning

**Security Focused**
- Security code reviews
- Vulnerability assessments
- Authentication/authorization systems
- Compliance requirements

**Cost Optimized**
- Learning and experimentation
- Simple prototyping
- Budget-constrained projects
- Bulk processing

### Optimization Tips

1. **Use Auto-Selection**: Let the system choose the optimal preset
2. **Override Sparingly**: Only customize when necessary
3. **Monitor Costs**: Track usage with cost estimation
4. **Cache Results**: Use caching for repeated questions
5. **Validate Presets**: Check configurations before use

## Error Handling

The preset system includes comprehensive error handling:

```javascript
try {
  const result = await presetDebate.runDebateWithPresets(question);
} catch (error) {
  if (error.message.includes('Unknown preset')) {
    // Handle invalid preset
  } else if (error.message.includes('Model configuration')) {
    // Handle model config issues
  } else {
    // Handle other errors
    console.error('Preset error:', error.message);
  }
}
```

## Performance Monitoring

The preset system tracks performance metrics:

```javascript
const result = await presetDebate.runDebateWithPresets(question);

if (result.preset) {
  console.log(`Preset: ${result.preset.name}`);
  console.log(`Estimated time: ${result.preset.estimatedTime}`);
  console.log(`Actual time: ${result.preset.actualTime}`);
  console.log(`Estimated cost: ${result.preset.estimatedCost}`);
  console.log(`Actual cost: ${result.preset.actualCost}`);
}
```

## Future Enhancements

- **Learning-Based Selection**: Improve preset selection based on historical performance
- **Dynamic Pricing**: Real-time cost adjustments based on model availability
- **Custom Preset Saving**: Save and reuse custom preset configurations
- **Performance Benchmarks**: Detailed performance tracking and optimization
- **Domain-Specific Presets**: Specialized presets for specific domains (web dev, data science, etc.)