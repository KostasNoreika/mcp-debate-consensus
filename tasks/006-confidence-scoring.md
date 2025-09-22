# Task 006: Confidence Scoring System

## Current State (NOW)
- Binary winner/loser selection
- No confidence metrics
- No way to know reliability of answer
- User doesn't know when to trust output

## Future State (AFTER)
- Confidence percentage (0-100%)
- Multiple confidence factors
- Transparency about uncertainty
- Actionable confidence thresholds

## Implementation

### Confidence Calculation
```javascript
class ConfidenceScorer {
  calculateConfidence(debate) {
    const factors = {
      // Agreement between models (40% weight)
      consensus: this.calculateConsensus(debate.responses),

      // Verification results (30% weight)
      verification: debate.verificationScore || 0.5,

      // Historical accuracy (20% weight)
      historical: this.getHistoricalAccuracy(debate.category),

      // Response consistency (10% weight)
      consistency: this.checkConsistency(debate.responses)
    };

    return {
      overall: this.weightedAverage(factors),
      factors,
      interpretation: this.interpret(factors)
    };
  }

  interpret(factors) {
    const overall = this.weightedAverage(factors);

    if (overall > 0.9) return 'Very High Confidence';
    if (overall > 0.75) return 'High Confidence';
    if (overall > 0.6) return 'Moderate Confidence';
    if (overall > 0.4) return 'Low Confidence';
    return 'Very Low Confidence - Verify Manually';
  }
}
```

### Consensus Measurement
```javascript
calculateConsensus(responses) {
  // Semantic similarity between responses
  const similarities = [];

  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      similarities.push(
        this.semanticSimilarity(responses[i], responses[j])
      );
    }
  }

  return average(similarities);
}
```

### User-Facing Output
```javascript
{
  "solution": "The consensus solution...",
  "confidence": {
    "score": 87,
    "level": "High Confidence",
    "factors": {
      "model_agreement": 92,
      "verification_passed": 85,
      "historical_accuracy": 88,
      "response_consistency": 83
    },
    "recommendation": "Safe to implement with standard review"
  }
}
```

## Confidence Thresholds

### > 90% - Very High Confidence
- Auto-implement safe
- Minimal review needed
- Historical accuracy proven

### 75-90% - High Confidence
- Standard review recommended
- Most tests passed
- Good model agreement

### 60-75% - Moderate Confidence
- Careful review required
- Some disagreement between models
- Additional verification suggested

### 40-60% - Low Confidence
- Manual verification required
- Significant model disagreement
- Consider running again

### < 40% - Very Low Confidence
- Do not implement without expert review
- Models strongly disagree
- Likely needs human intervention

## Benefits
- **User knows when to trust** the output
- **Automated decision making** based on thresholds
- **Risk management** for critical tasks
- **Transparency** about model uncertainty