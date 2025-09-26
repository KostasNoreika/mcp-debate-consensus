# Telemetry Documentation

## Overview
AI Expert Consensus includes **anonymous telemetry** to help improve the system. Telemetry is:
- ✅ **Anonymous** - No personal data collected
- ✅ **Opt-out** - Can be disabled anytime
- ✅ **Non-blocking** - Never affects main functionality
- ✅ **Graceful** - Silently fails if API is down

## Data Collected
Only anonymous usage statistics:
- Debate category (e.g., "technical", "creative")
- Models used (e.g., ["k1", "k2", "k3"])
- Consensus confidence score (0-1)
- Response time in milliseconds
- Cache hit/miss status
- Preset used (e.g., "balanced", "quick")

**NOT collected:**
- ❌ User questions or prompts
- ❌ Model responses or content
- ❌ API keys or credentials
- ❌ Personal identifiers
- ❌ IP addresses

## Opt-Out Instructions
To disable telemetry, add to your `.env` file:
```env
TELEMETRY_DISABLED=true
```

Or set environment variable:
```bash
export TELEMETRY_DISABLED=true
```

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