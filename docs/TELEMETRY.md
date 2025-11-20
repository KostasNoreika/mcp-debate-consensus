# Telemetry Documentation

## Overview

The AI Expert Consensus system includes an optional telemetry system that collects anonymous usage statistics to help improve the service. This document describes what data is collected, how privacy is protected, and how to opt-out.

## 🔒 Privacy First

**Your data privacy is our top priority.** The telemetry system is designed with privacy-by-design principles:

- ✅ **Completely anonymous** - no user identification
- ✅ **No sensitive data** - questions and responses are never collected
- ✅ **Easy opt-out** - single environment variable
- ✅ **Transparent** - all collection documented
- ✅ **Secure transport** - HTTPS only
- ✅ **Minimal data** - only essential metrics
- ✅ **Non-blocking** - Never affects main functionality
- ✅ **Graceful** - Silently fails if API is down

## What Data is Collected

### Debate Metadata Only

The system collects **only metadata** about debates, never the actual content:

```json
{
    "debateId": "a1b2c3d4e5f6g7h8",    // Anonymous hash
    "category": "software_architecture",  // Question category
    "models": ["k1", "k2", "k4"],        // Models used
    "winner": "k2",                      // Winning model
    "confidence": 0.87,                  // Confidence score
    "responseTime": 45000,               // Duration in ms
    "consensus": true,                   // Whether consensus reached
    "metadata": {
        "modelCount": 3,
        "hasCache": false,
        "preset": "balanced",
        "version": "2.1.0"
    }
}
```

### What is NOT Collected

- ❌ **User questions** - never stored or transmitted
- ❌ **Model responses** - never stored or transmitted
- ❌ **User identity** - no usernames, emails, or IDs
- ❌ **IP addresses** - not stored permanently
- ❌ **File contents** - never accessed
- ❌ **System details** - no hardware or OS info
- ❌ **API keys** - never transmitted
- ❌ **Personal data** - no GDPR-sensitive information

### Data Anonymization

All data is anonymized before transmission:

1. **Question Hashing**: Questions are hashed using SHA-256 with timestamp salt
2. **Category Only**: Only the broad category is recorded, not specific topics
3. **No Correlation**: No way to correlate different debates from same user
4. **Temporal Aggregation**: Data is aggregated over time windows

## Why Collect Telemetry

### Service Improvement

Telemetry helps improve the system in several ways:

1. **Model Performance**: Understand which models perform best for different categories
2. **Quality Optimization**: Identify when consensus fails and why
3. **Performance Tuning**: Optimize response times and resource usage
4. **Reliability**: Track error rates and improve retry logic
5. **Feature Usage**: Understand which presets and features are most valuable

### Community Benefits

Aggregated insights benefit the entire user community:

- **Better Model Selection**: Improve automatic model selection algorithms
- **Performance Baselines**: Establish performance benchmarks
- **Usage Patterns**: Optimize for common use cases
- **Quality Metrics**: Improve confidence scoring accuracy

## How to Opt-Out

### Simple Environment Variable

Opt-out is easy and immediate:

```bash
# Add to your .env file
TELEMETRY_DISABLED=true
```

Or set as environment variable:

```bash
export TELEMETRY_DISABLED=true
```

### Verification

Verify telemetry is disabled:

```bash
# Check configuration
npm run config:show | grep -i telemetry

# Or check in logs (should show "Telemetry disabled")
npm start
```

### Immediate Effect

- Opt-out takes effect immediately
- No data is collected from that point forward
- Previously collected data cannot be retroactively identified
- No restart required

## API Endpoint
Telemetry is sent to: `https://stats.noreika.lt/api/telemetry`

The endpoint:
- Returns HTTP 200 on success
- Has 5-second timeout (won't block if down)
- Batches data every 60 seconds
- Re-queues failed sends (up to 3x batch size)

## Privacy & Security
- Data is hashed using SHA-256 for anonymization
- No PII (Personally Identifiable Information) collected
- Compliant with GDPR principles
- Open source - inspect the code anytime

## Implementation Details
See `/src/telemetry-client.js` for full implementation.

Key features:
- Automatic retry with exponential backoff
- Queue limit to prevent memory issues
- Debug mode for troubleshooting
- Graceful shutdown on process exit

## Testing
Run telemetry tests:
```bash
node test-telemetry-failure.js
```

This verifies:
- Graceful failure when API unreachable
- Opt-out mechanism works correctly
- Invalid data is safely rejected
- Valid telemetry sends successfully