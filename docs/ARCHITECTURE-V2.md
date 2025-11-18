# Debate-Consensus v2.0 Architecture

## Overview

The Debate-Consensus v2.0 system transforms from a simple multi-model consultation platform to a sophisticated collaborative development system with native CLI integration, branch-based isolation, and iterative peer review.

## Core Principles

1. **Native CLI Utilization**: Each model uses its optimal CLI to preserve unique capabilities
2. **Branch Isolation**: Complete separation of model work through git branches
3. **Iterative Improvement**: Models learn from each other through peer review cycles
4. **Configurable Teams**: Dynamic composition of 2-10 models
5. **Transparent Decision-Making**: All branches and decisions are traceable

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         MCP Interface                        │
├─────────────────────────────────────────────────────────────┤
│                     Orchestration Layer                      │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ CLI Adapters │ Branch Mgr   │ Iteration    │ Synthesis     │
│              │              │ Engine       │ Engine        │
├──────────────┴──────────────┴──────────────┴───────────────┤
│                      Git Repository                          │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. CLI Adapter Layer

Provides unified interface for different model CLIs while preserving their unique capabilities.

```javascript
// Base adapter interface
class BaseAdapter {
  async initialize(config) {}
  async execute(prompt, options) {}
  async cleanup() {}
  get capabilities() {}
}
```

**Supported CLIs:**
- **Claude CLI**: Anthropic models (claude)
- **Codex CLI**: OpenAI models (@openai/codex)
- **Gemini CLI**: Google models (gemini)
- **Fallback**: Claude CLI with model override via proxy

**Adapter Features:**
- Standardized input/output format
- Error handling and recovery
- Capability detection
- Authentication management
- Resource monitoring

### 2. Branch Management System

Handles git operations for branch-based isolation.

**Branch Naming Convention:**
```
debate-[session-id]-[model-id]-[timestamp]
Example: debate-a3f2-gpt5-20250116-143022
```

**Operations:**
- Create isolated branches for each model
- Switch between branches safely
- Generate diffs between branches
- Track changes and conflicts
- Cleanup after completion

### 3. Iteration Engine

Orchestrates the peer review and improvement cycles.

**Process Flow:**
```
Round 1: Independent Implementation
├── Model 1: Creates solution in branch-1
├── Model 2: Creates solution in branch-2
├── Model 3: Creates solution in branch-3
└── Model 4: Creates solution in branch-4

Rounds 2-5: Iterative Improvement
├── Share diffs with all models
├── Each model reviews others' work
├── Identify strengths and weaknesses
├── Update own implementation
└── Track convergence metrics
```

**Convergence Metrics:**
- Test pass rate
- Code similarity score
- Performance benchmarks
- Quality metrics (lint, complexity)
- Model consensus level

### 4. Configuration System

Enables flexible team composition and model configuration.

```yaml
# config/debate-config.yaml
models:
  - id: "gpt5-architect"
    cli: "codex"
    auth:
      type: "token"
      source: "env:OPENAI_TOKEN"
    model: "gpt-5"
    role: "system-architect"

  - id: "gemini-reviewer"
    cli: "gemini"
    auth:
      type: "api-key"
      source: "env:GEMINI_API_KEY"
    model: "gemini-3-pro-preview"
    role: "code-reviewer"

  - id: "claude-optimizer"
    cli: "claude"
    auth:
      type: "config"
      source: "~/.claude.json"
    model: "claude-opus-4.1"
    role: "performance-optimizer"

debate:
  min_models: 2
  max_models: 10
  iterations: 5
  convergence_threshold: 0.85
  timeout_minutes: 30

branches:
  cleanup: true
  merge_strategy: "best-branch"
  conflict_resolution: "manual"
```

### 5. Synthesis Engine

Combines insights from all models and produces final output.

**Output Structure:**
```javascript
{
  "session_id": "debate-a3f2",
  "branches": [
    {
      "model_id": "gpt5-architect",
      "branch": "debate-a3f2-gpt5-20250116-143022",
      "metrics": {
        "tests_passed": 45,
        "coverage": 0.92,
        "complexity": 12.3
      }
    }
  ],
  "winner": "debate-a3f2-gemini-20250116-143024",
  "consensus": {
    "level": 0.87,
    "agreements": ["architecture", "testing"],
    "disagreements": ["optimization approach"]
  },
  "recommendation": {
    "strategy": "merge-best",
    "branches_to_merge": ["gemini", "claude"],
    "conflicts": [],
    "rationale": "Gemini provided best overall solution with Claude's optimizations"
  }
}
```

## Data Flow

### 1. Request Phase
```
User Request → MCP Interface → Orchestrator → Configuration Load
```

### 2. Execution Phase
```
Orchestrator → CLI Adapters → Model Execution → Branch Creation
```

### 3. Iteration Phase
```
Branch Diffs → Peer Review → Model Updates → Convergence Check
```

### 4. Synthesis Phase
```
All Branches → Analysis → Winner Selection → Recommendation
```

### 5. Response Phase
```
Final Report → MCP Response → User
```

## Authentication Architecture

### Multi-Provider Authentication
```javascript
// auth/auth-manager.js
class AuthManager {
  providers = {
    'openai': OpenAIAuthProvider,
    'google': GoogleAuthProvider,
    'anthropic': AnthropicAuthProvider
  }

  async authenticate(modelConfig) {
    const provider = this.providers[modelConfig.provider];
    return provider.authenticate(modelConfig.auth);
  }
}
```

### Credential Storage
- Environment variables for API keys
- Config files for tokens
- Secure keychain integration (future)

## Error Handling

### Failure Modes
1. **CLI Unavailable**: Fallback to proxy-based approach
2. **Authentication Failed**: Retry with alternative auth method
3. **Branch Conflict**: Manual resolution or skip model
4. **Timeout**: Return partial results with available branches
5. **Convergence Failed**: Return all branches for manual selection

### Recovery Strategies
```javascript
// Error recovery chain
try {
  await adapter.execute(prompt);
} catch (error) {
  if (error.type === 'CLI_NOT_FOUND') {
    return fallbackAdapter.execute(prompt);
  } else if (error.type === 'AUTH_FAILED') {
    await authManager.refreshCredentials();
    return adapter.execute(prompt);
  } else if (error.type === 'TIMEOUT') {
    return partialResults;
  }
  throw error;
}
```

## Performance Optimization

### Resource Management
- Process pooling for multiple CLIs
- Memory monitoring and limits
- CPU throttling for parallel execution
- Disk space management for branches

### Caching Strategy
- Model response caching
- Branch diff caching
- Authentication token caching
- Configuration caching

## Migration Path

### Phase 1: CLI Adapters (Week 1-2)
- Implement base adapter
- Create CLI-specific adapters
- Test with 2-3 models

### Phase 2: Branch Management (Week 3)
- Git operations wrapper
- Branch lifecycle management
- Diff generation

### Phase 3: Iteration Engine (Week 4-5)
- Peer review orchestration
- Convergence tracking
- Metrics collection

### Phase 4: Configuration (Week 6)
- Dynamic team composition
- Authentication system
- Role management

### Phase 5: Synthesis (Week 7)
- Multi-branch analysis
- Winner selection
- Report generation

## Testing Strategy

### Unit Tests
- CLI adapter interfaces
- Git operations
- Configuration parsing
- Authentication

### Integration Tests
- Multi-model execution
- Branch management
- Iteration cycles
- End-to-end flow

### Performance Tests
- Concurrent model execution
- Large codebase handling
- Memory usage
- Response times

## Future Enhancements

### Short Term (1-3 months)
- Add more CLI integrations (Qwen, Ollama)
- Implement smart merge strategies
- Add visualization dashboard
- Enhance metrics collection

### Medium Term (3-6 months)
- Machine learning for winner selection
- Automatic conflict resolution
- Custom evaluation metrics
- Plugin system for extensions

### Long Term (6+ months)
- Distributed execution across multiple machines
- Real-time collaboration features
- Integration with CI/CD pipelines
- Advanced caching and optimization

## Security Considerations

### Code Execution
- Sandboxed CLI execution
- Resource limits enforcement
- Input sanitization
- Output validation

### Credential Management
- Encrypted storage
- Rotation policies
- Audit logging
- Access controls

### Branch Protection
- Temporary branch cleanup
- Protected main branch
- Review requirements
- Signed commits

## Monitoring and Observability

### Metrics
- Model performance
- Iteration convergence
- Resource usage
- Error rates

### Logging
- Structured logging
- Log aggregation
- Error tracking
- Audit trails

### Alerting
- Failure notifications
- Performance degradation
- Resource exhaustion
- Security events