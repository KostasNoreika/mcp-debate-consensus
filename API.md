# API Documentation

## Overview

The AI Expert Consensus MCP server provides RESTful API endpoints for multi-model debate orchestration with enterprise-grade security features. All endpoints support HMAC-SHA256 request signing for authentication and include comprehensive rate limiting.

## Base URL

```
http://localhost:3457  # k1 proxy (Claude Opus 4.1)
http://localhost:3458  # k2 proxy (GPT-5)
http://localhost:3459  # k3 proxy (Qwen 3 Max)
http://localhost:3460  # k4 proxy (Gemini 2.5 Pro)
http://localhost:3461  # k5 proxy (Grok 4 Fast)
http://localhost:3462  # k7 proxy (DeepSeek R1)
http://localhost:3463  # k8 proxy (GLM-4.5)
```

## Authentication

### HMAC-SHA256 Request Signing

All requests require HMAC-SHA256 signatures for authentication when `ENABLE_REQUEST_SIGNING=true`.

#### Required Headers

```http
X-Signature: <hmac-sha256-signature>
X-Timestamp: <unix-timestamp>
X-Nonce: <unique-nonce>
X-Signature-Version: 1.0
X-API-Key: <optional-api-key>
Content-Type: application/json
```

#### Signature Generation

```javascript
const crypto = require('crypto');

function generateSignature(method, path, timestamp, nonce, apiKey, body, secret) {
    const stringToSign = [
        method.toUpperCase(),
        path,
        timestamp,
        nonce,
        apiKey,
        JSON.stringify(body)
    ].join('\n');

    return crypto
        .createHmac('sha256', secret)
        .update(stringToSign)
        .digest('hex');
}

// Example usage
const signature = generateSignature(
    'POST',
    '/v1/chat/completions',
    Math.floor(Date.now() / 1000),
    crypto.randomBytes(16).toString('hex'),
    'your-api-key',
    requestBody,
    process.env.HMAC_SECRET
);
```

#### Client Implementation Example

```javascript
import crypto from 'crypto';
import fetch from 'node-fetch';

class DebateConsensusClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:3457';
        this.hmacSecret = options.hmacSecret;
        this.apiKey = options.apiKey || '';
        this.enableSigning = options.enableSigning !== false;
    }

    signRequest(method, path, body) {
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomBytes(16).toString('hex');
        const bodyString = JSON.stringify(body || {});

        const stringToSign = [
            method.toUpperCase(),
            path,
            timestamp,
            nonce,
            this.apiKey,
            bodyString
        ].join('\n');

        const signature = crypto
            .createHmac('sha256', this.hmacSecret)
            .update(stringToSign)
            .digest('hex');

        return {
            'X-Signature': signature,
            'X-Timestamp': timestamp.toString(),
            'X-Nonce': nonce,
            'X-Signature-Version': '1.0',
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
        };
    }

    async sendMessage(messages, options = {}) {
        const body = {
            messages,
            model: options.model || 'debate-consensus',
            max_tokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.7
        };

        const headers = this.enableSigning
            ? this.signRequest('POST', '/v1/chat/completions', body)
            : { 'Content-Type': 'application/json' };

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`API Error: ${response.status} ${error.error || response.statusText}`);
        }

        return await response.json();
    }
}
```

## Endpoints

### 1. Chat Completions

**Primary endpoint for multi-model debate orchestration.**

#### `POST /v1/chat/completions`

Start a multi-model debate and return the consensus result.

**Request Body:**
```json
{
    "messages": [
        {
            "role": "user",
            "content": "Design a scalable microservices architecture for e-commerce"
        }
    ],
    "model": "debate-consensus",
    "max_tokens": 4000,
    "temperature": 0.7,
    "debate_config": {
        "preset": "balanced",
        "models": ["k1", "k2", "k4"],
        "enable_verification": true,
        "confidence_threshold": 0.8
    }
}
```

**Response:**
```json
{
    "id": "debate-abc123",
    "object": "chat.completion",
    "created": 1704067200,
    "model": "debate-consensus",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "Based on multi-model consensus analysis...",
                "metadata": {
                    "consensus_confidence": 0.92,
                    "participating_models": ["k1", "k2", "k4"],
                    "debate_rounds": 2,
                    "verification_passed": true,
                    "category": "software_architecture"
                }
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 150,
        "completion_tokens": 800,
        "total_tokens": 950
    },
    "debate_metadata": {
        "duration_ms": 45000,
        "retry_stats": {
            "total_attempts": 3,
            "success_rate": 1.0,
            "failed_attempts": 0
        },
        "performance_category": "software_architecture",
        "cached": false
    }
}
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `messages` | Array | Required | Conversation messages |
| `model` | String | `debate-consensus` | Model identifier |
| `max_tokens` | Integer | `4000` | Maximum tokens in response |
| `temperature` | Float | `0.7` | Response creativity (0-1) |
| `debate_config.preset` | String | `balanced` | Quality preset: `rapid`, `balanced`, `maximum` |
| `debate_config.models` | Array | Auto-selected | Specific models to use |
| `debate_config.enable_verification` | Boolean | `true` | Enable cross-verification |
| `debate_config.confidence_threshold` | Float | `0.8` | Minimum confidence required |

### 2. Health Check

#### `GET /health`

Check server health and status.

**Response:**
```json
{
    "status": "healthy",
    "instance": "k1",
    "timestamp": "2024-01-01T12:00:00Z",
    "version": "2.1.0",
    "uptime_seconds": 3600,
    "checks": {
        "api_connection": "ok",
        "database": "ok",
        "proxy_servers": "ok",
        "claude_cli": "ok"
    }
}
```

### 3. Security Status

#### `GET /security/status`

Get security configuration status (requires authentication).

**Response:**
```json
{
    "instance": "k1",
    "security": {
        "requestSigning": {
            "enabled": true,
            "validityWindow": 300,
            "hasSecret": true
        },
        "rateLimiting": {
            "defaultLimit": 10,
            "defaultWindow": 60000,
            "proxyLimit": 100
        },
        "features": {
            "inputValidation": true,
            "auditLogging": true,
            "securityHeaders": true,
            "nonceTracking": true
        }
    },
    "timestamp": "2024-01-01T12:00:00Z"
}
```

### 4. Performance Metrics

#### `GET /metrics`

Get performance and retry statistics (requires authentication).

**Response:**
```json
{
    "retry_stats": {
        "totalAttempts": 150,
        "successfulOperations": 147,
        "failedOperations": 3,
        "successRate": 0.98,
        "avgRetryCount": 1.2,
        "avgRetryTime": 2500,
        "errorBreakdown": {
            "network": 2,
            "timeout": 1,
            "authentication": 0
        }
    },
    "performance": {
        "categories_analyzed": 25,
        "total_debates": 89,
        "avg_confidence": 0.87,
        "cache_hit_rate": 0.23
    },
    "timestamp": "2024-01-01T12:00:00Z"
}
```

## Rate Limiting

### Default Limits

- **General endpoints**: 10 requests per minute per IP
- **Proxy endpoints**: 100 requests per minute per IP
- **Health endpoints**: No limit

### Rate Limit Headers

All responses include rate limiting information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1704067260
```

### Rate Limit Response

When rate limit is exceeded:

```json
{
    "error": "Too many requests",
    "code": "rate_limit_exceeded",
    "retryAfter": 60,
    "limit": 10,
    "window": 60000
}
```

## Error Handling

### Error Response Format

```json
{
    "error": "Error description",
    "code": "error_code",
    "details": {
        "field": "Additional error details",
        "suggestion": "How to fix the issue"
    },
    "request_id": "req_abc123",
    "timestamp": "2024-01-01T12:00:00Z"
}
```

### Common Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `invalid_signature` | 401 | HMAC signature validation failed | Check HMAC secret and signature generation |
| `expired_request` | 401 | Request timestamp outside validity window | Ensure clocks are synchronized |
| `nonce_reused` | 401 | Nonce has been used before | Generate unique nonce for each request |
| `rate_limit_exceeded` | 429 | Too many requests | Implement exponential backoff |
| `invalid_input` | 400 | Request validation failed | Check input format and content |
| `model_unavailable` | 503 | Model endpoint not responsive | Check proxy server status |
| `debate_timeout` | 504 | Debate exceeded time limit | Reduce complexity or increase timeout |
| `insufficient_consensus` | 422 | Models could not reach consensus | Try different models or lower threshold |

### Retry Logic

Implement exponential backoff for transient errors:

```javascript
async function makeRequestWithRetry(requestFn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await requestFn();
        } catch (error) {
            if (attempt === maxRetries) throw error;

            // Only retry on specific error codes
            const retryableErrors = [500, 502, 503, 504, 429];
            if (!retryableErrors.includes(error.status)) throw error;

            // Exponential backoff with jitter
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
            const jitter = Math.random() * 0.1 * delay;
            await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
    }
}
```

## WebSocket Support (Future)

Real-time debate streaming will be available via WebSocket:

```javascript
// Future implementation
const ws = new WebSocket('ws://localhost:3457/v1/debate/stream');
ws.on('message', (data) => {
    const event = JSON.parse(data);
    switch(event.type) {
        case 'debate_started':
            console.log('Debate started with models:', event.models);
            break;
        case 'model_response':
            console.log(`${event.model} responded:`, event.content);
            break;
        case 'consensus_reached':
            console.log('Final result:', event.result);
            break;
    }
});
```

## SDK and Client Libraries

### Official JavaScript/Node.js SDK

```bash
npm install @debate-consensus/client
```

```javascript
import { DebateConsensusClient } from '@debate-consensus/client';

const client = new DebateConsensusClient({
    baseUrl: 'http://localhost:3457',
    hmacSecret: process.env.HMAC_SECRET,
    enableSigning: true
});

const result = await client.debate([
    { role: 'user', content: 'Your question here' }
], {
    preset: 'balanced',
    models: ['k1', 'k2', 'k4']
});
```

### Python Client Example

```python
import hmac
import hashlib
import time
import secrets
import requests
import json

class DebateConsensusClient:
    def __init__(self, base_url, hmac_secret, api_key=None):
        self.base_url = base_url
        self.hmac_secret = hmac_secret
        self.api_key = api_key or ""

    def _sign_request(self, method, path, body):
        timestamp = str(int(time.time()))
        nonce = secrets.token_hex(16)
        body_str = json.dumps(body) if body else "{}"

        string_to_sign = "\n".join([
            method.upper(),
            path,
            timestamp,
            nonce,
            self.api_key,
            body_str
        ])

        signature = hmac.new(
            self.hmac_secret.encode(),
            string_to_sign.encode(),
            hashlib.sha256
        ).hexdigest()

        return {
            'X-Signature': signature,
            'X-Timestamp': timestamp,
            'X-Nonce': nonce,
            'X-Signature-Version': '1.0',
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        }

    def debate(self, messages, **kwargs):
        body = {
            'messages': messages,
            'model': 'debate-consensus',
            **kwargs
        }

        headers = self._sign_request('POST', '/v1/chat/completions', body)

        response = requests.post(
            f"{self.base_url}/v1/chat/completions",
            headers=headers,
            json=body
        )

        response.raise_for_status()
        return response.json()
```

## Performance Optimization

### Caching

The system automatically caches results for identical questions:

- Cache duration: 24 hours
- Cache invalidation: Automatic based on content changes
- Cache hit rate: ~23% average

### Parallel Processing

Models process requests in parallel for optimal performance:

```json
{
    "debate_config": {
        "parallel_instances": {
            "k1": 2,    // Run 2 instances of Claude Opus
            "k2": 1,    // Single GPT-5 instance
            "k4": 3     // 3 instances of Gemini Pro
        }
    }
}
```

### Quality Presets

Choose appropriate preset for your use case:

| Preset | Duration | Models | Use Case |
|--------|----------|--------|----------|
| `rapid` | 3-5s | 1 fast model | Quick questions, development |
| `balanced` | 30-60s | 3-4 models | Most questions, default |
| `maximum` | 2-5min | 5+ models + verification | Critical decisions |

## Monitoring and Observability

### Health Checks

Regular health checks should monitor:

```bash
# Check all endpoints
curl -f http://localhost:3457/health
curl -f http://localhost:3458/health
# ... check all proxy ports

# Monitor response times
curl -w "@curl-format.txt" http://localhost:3457/v1/chat/completions
```

### Metrics Collection

Key metrics to monitor:

- **Response times**: 95th percentile < 60s for balanced preset
- **Success rates**: > 95% for retry operations
- **Cache hit rates**: > 20% for typical workloads
- **Error rates**: < 5% total error rate
- **Security events**: Monitor signature failures and rate limits

### Alerting Thresholds

Recommended alerting thresholds:

- Response time > 120s (balanced preset)
- Success rate < 90%
- Error rate > 10%
- Security failures > 5 per minute
- Cache hit rate < 10% (may indicate cache issues)

## Security Considerations

### Production Deployment

1. **Always use HTTPS** in production
2. **Set strong HMAC_SECRET** (64+ characters)
3. **Enable request signing**: `ENABLE_REQUEST_SIGNING=true`
4. **Configure rate limits** appropriate for your load
5. **Monitor security logs** for suspicious activity
6. **Rotate secrets** periodically
7. **Use reverse proxy** (nginx, Traefik) for SSL termination

### Network Security

```nginx
# Example nginx configuration
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /v1/ {
        proxy_pass http://localhost:3457;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;

        # Security headers
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

## Changelog

### v2.1.0
- Added HMAC-SHA256 request signing
- Implemented comprehensive rate limiting
- Added retry handler with exponential backoff
- Enhanced security headers and validation
- Improved performance tracking and metrics

### v2.0.0
- Multi-model consensus implementation
- Intelligent model selection
- Caching system
- Confidence scoring
- Performance database

---

For more information, see:
- [Security Implementation Guide](SECURITY.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Telemetry Documentation](TELEMETRY.md)
- [Retry Handler Documentation](docs/RETRY_HANDLER.md)