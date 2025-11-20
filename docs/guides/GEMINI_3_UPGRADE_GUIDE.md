# Gemini 3 Pro Upgrade Guide for AI Assistants

**Purpose:** This guide helps AI assistants (Claude Code, etc.) upgrade any project from older Gemini models (2.5, 2.0, 1.5) to the new Gemini 3 Pro Preview released on November 18, 2025.

---

## 🎯 Quick Reference

### Model Mappings

| Old Model | New Model | When to Use |
|-----------|-----------|-------------|
| `gemini-2.5-pro` | `gemini-3-pro-preview` | OpenRouter API |
| `gemini-2.5-pro-latest` | `gemini-3-pro-preview` | OpenRouter API |
| `gemini-2.5-flash` | Keep as is | Not yet available as Gemini 3 |
| `gemini-2.0-flash-exp` | Keep as is | Not yet available as Gemini 3 |
| `gemini-1.5-pro` | `gemini-3-pro-preview` | Direct Google API |

### API Endpoints

**OpenRouter:** `https://openrouter.ai/api/v1/chat/completions`
- Model ID: `google/gemini-3-pro-preview`

**Google AI Studio (Direct):** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Model ID: `gemini-3-pro-preview` (no date suffix needed)
- Alternative: `gemini-exp-1121` (might work in some cases)

---

## 📋 Step-by-Step Upgrade Process

### Step 1: Find All Gemini Usage

Search for these patterns in the codebase:

```bash
# Search for model IDs
grep -r "gemini-2\\.5-pro" .
grep -r "gemini-2\\.0-flash" .
grep -r "gemini-1\\.5-pro" .
grep -r "gemini-pro" .

# Search for configuration files
grep -r "gemini.*model" . --include="*.json" --include="*.yaml" --include="*.env*"

# Search for API calls
grep -r "generativelanguage\\.googleapis\\.com" .
grep -r "openrouter.*gemini" .
```

**Files to Check:**
- Configuration files: `config/*.json`, `.env`, `.env.example`
- Server/proxy files: `*-server.js`, `*-proxy.js`
- Adapter/client files: `src/adapters/*`, `src/clients/*`
- Documentation: `README.md`, `CLAUDE.md`, `*.md`

---

### Step 2: Update Model IDs

#### For OpenRouter Integration

**OLD:**
```javascript
const modelMap = {
  'k4': 'google/gemini-2.5-pro',  // Integration expert
};

const maxTokensMap = {
  'k4': 65536,   // Gemini 2.5 Pro (maximum output)
};
```

**NEW:**
```javascript
const modelMap = {
  'k4': 'google/gemini-3-pro-preview',  // Integration expert
};

const maxTokensMap = {
  'k4': 1048576, // Gemini 3 Pro Preview (1M context window)
};
```

#### For Direct Google API

**OLD:**
```javascript
const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
  {
    contents: [...],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000
    }
  },
  { timeout: 10000 }
);
```

**NEW:**
```javascript
const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
  {
    contents: [...],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 65536  // Gemini 3 Pro max: 64K tokens
    }
  },
  { timeout: 300000 }  // 5 minutes for extended thinking
);
```

---

### Step 3: Update Token Limits

**Gemini 3 Pro Limits:**
- **Input tokens:** 1,048,576 (1M)
- **Output tokens:** 65,536 (64K)
- **Context window:** 1,048,576 tokens

**Update all references:**

```javascript
// OLD
maxTokens: 8192        // Gemini 2.5 Flash
maxTokens: 65536       // Gemini 2.5 Pro

// NEW
maxTokens: 65536       // Gemini 3 Pro (output limit)
contextWindow: 1048576 // Gemini 3 Pro (input limit)
```

---

### Step 4: Update Timeouts

Gemini 3 Pro uses **extended thinking mode** which takes longer:

```javascript
// OLD - Fast models (Flash, etc.)
timeout: 10000   // 10 seconds

// NEW - Gemini 3 Pro
timeout: 300000  // 5 minutes (300 seconds)

// For critical/complex operations
timeout: 600000  // 10 minutes
```

**Environment Variables:**
```bash
# .env
GEMINI_TIMEOUT=300000           # 5 minutes
GEMINI_MAX_OUTPUT_TOKENS=65536  # 64K tokens
```

---

### Step 5: Update Configuration Files

#### config/default.json
```json
{
  "models": {
    "gemini": {
      "id": "google/gemini-3-pro-preview",
      "name": "Gemini 3 Pro Preview",
      "provider": "openrouter",
      "capabilities": ["integration", "completeness", "reasoning"],
      "maxTokens": 1048576,
      "temperature": 0.7
    }
  }
}
```

#### .env.example
```bash
# OLD
# k4: google/gemini-2.5-pro - Integration and completeness

# NEW
# k4: google/gemini-3-pro-preview - Integration and completeness (1M context)
```

---

### Step 6: Update Documentation

Search and replace in all `.md` files:

**README.md / CLAUDE.md / docs/*.md:**

```markdown
<!-- OLD -->
- Gemini 2.5 Pro (65K tokens)
- Uses Gemini Flash for fast enhancement

<!-- NEW -->
- Gemini 3 Pro Preview (1M tokens)
- Uses Gemini 3 Pro for enhanced reasoning with extended thinking
- 5-minute timeout, 64K max output tokens for complex reasoning
```

---

### Step 7: Update Comments in Code

```javascript
// OLD
// Use Gemini Flash for fast enhancement
// Gemini 2.5 Pro (maximum output)

// NEW
// Use Gemini 3 Pro for enhanced reasoning
// Gemini 3 Pro Preview (1M context window)
// Gemini 3 Pro uses extended thinking - needs more tokens
// 5 minute timeout (Gemini 3 Pro uses extended thinking)
```

---

## 🧪 Testing Protocol

### 1. Verify Model Availability

**OpenRouter:**
```bash
curl -s "https://openrouter.ai/api/v1/models/google/gemini-3-pro-preview" | jq '{id, context_length, pricing}'
```

**Google AI Studio:**
```bash
# Test available model IDs
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say OK"}]}],"generationConfig":{"maxOutputTokens":100}}'
```

### 2. Test Basic Functionality

Create test file:
```javascript
// test-gemini3.js
import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const test = async () => {
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: 'Explain quantum computing in one sentence.' }] }],
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.3
      }
    },
    { timeout: 300000 }
  );

  console.log('✅ Success:', response.data.candidates[0].content.parts[0].text);
};

test().catch(console.error);
```

Run: `node test-gemini3.js`

### 3. Run Existing Tests

```bash
# Run unit tests
npm test

# Run specific tests
npm run test:gemini
npm run test:adapters
npm run test:integration

# Check for failures
echo $?  # Should be 0
```

### 4. Health Checks

If project has health endpoints:
```bash
curl http://localhost:3460/health
# Should return: "model": "google/gemini-3-pro-preview"

curl -X POST http://localhost:3460/health/test
# Should return: "status": "healthy"
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: 404 Model Not Found

**Symptom:** `models/gemini-3-pro-preview-11-2025 is not found`

**Solution:** Remove date suffix
```javascript
// WRONG
'gemini-3-pro-preview-11-2025'

// CORRECT
'gemini-3-pro-preview'
```

### Issue 2: Timeout Errors

**Symptom:** `timeout of 10000ms exceeded`

**Solution:** Increase timeout to 5 minutes
```javascript
timeout: 300000  // 5 minutes
```

### Issue 3: Empty Response / MAX_TOKENS

**Symptom:** `finishReason: "MAX_TOKENS"` with empty content

**Solution:** Increase maxOutputTokens
```javascript
maxOutputTokens: 65536  // Use full 64K limit
```

### Issue 4: JSON Mode Returns Empty Content

**Symptom:** `content: {}` when using `responseMimeType: 'application/json'`

**Solution:** Increase maxOutputTokens (Gemini 3 uses many tokens for thinking)
```javascript
generationConfig: {
  maxOutputTokens: 65536,  // Critical for JSON mode
  responseMimeType: 'application/json'
}
```

### Issue 5: Key Limit Exceeded

**Symptom:** `Key limit exceeded (monthly limit)`

**Solution:** This confirms model is working, just API key needs credits
- Add credits to OpenRouter account
- Or use different API key

---

## 📊 Verification Checklist

After upgrade, verify:

- [ ] All old model IDs replaced (`gemini-2.5-pro` → `gemini-3-pro-preview`)
- [ ] Token limits updated (context: 1M, output: 64K)
- [ ] Timeouts increased to 5 minutes minimum
- [ ] Configuration files updated (`.env`, `config/*.json`)
- [ ] Documentation updated (README, CLAUDE.md)
- [ ] Code comments updated
- [ ] All tests passing (`npm test`)
- [ ] Health checks passing (if applicable)
- [ ] Real API call successful (test script)
- [ ] No hardcoded date suffixes in model IDs
- [ ] Server restart performed (if applicable)

---

## 🚀 Example Migration

**Before:**
```javascript
// k-proxy-server.js
const modelMap = {
  'k4': 'google/gemini-2.5-pro'
};
const maxTokensMap = {
  'k4': 65536
};

// prompt-enhancer.js
const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
  { /* ... */ },
  { timeout: 10000 }
);
```

**After:**
```javascript
// k-proxy-server.js
const modelMap = {
  'k4': 'google/gemini-3-pro-preview'
};
const maxTokensMap = {
  'k4': 1048576  // 1M context
};

// prompt-enhancer.js
const response = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
  {
    /* ... */
    generationConfig: {
      maxOutputTokens: 65536  // 64K for thinking
    }
  },
  { timeout: 300000 }  // 5 minutes
);
```

---

## 📝 Commit Message Template

```
feat: Upgrade Gemini models to 3 Pro Preview

Upgrade all Gemini 2.5/2.0/1.5 models to Gemini 3 Pro Preview:

**Changes:**
- Model ID: gemini-2.5-pro → gemini-3-pro-preview
- Context window: 65K → 1M tokens
- Max output tokens: 8K → 64K tokens
- Timeout: 10s → 300s (5 minutes for extended thinking)

**Benefits:**
- 16x larger context window (1M tokens)
- Extended thinking capabilities
- Latest Google AI technology (Nov 18, 2025)
- Improved reasoning quality and depth

**Files Updated:**
- [list files]

All tests passing ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🔗 References

- **Gemini 3 Release:** https://blog.google/products/gemini/gemini-3/
- **API Documentation:** https://ai.google.dev/gemini-api/docs/models
- **OpenRouter Models:** https://openrouter.ai/models
- **Rate Limits:** https://ai.google.dev/gemini-api/docs/rate-limits

---

## 💡 AI Assistant Instructions

**When executing this upgrade:**

1. **Search Phase:**
   - Use Grep/Glob to find all Gemini references
   - Check configuration files, code, and documentation
   - Create a list of files to update

2. **Update Phase:**
   - Update model IDs systematically
   - Update token limits and timeouts
   - Update configuration files
   - Update documentation and comments

3. **Test Phase:**
   - Run existing test suite
   - Create simple test script to verify API
   - Check health endpoints (if applicable)

4. **Commit Phase:**
   - Create clear commit with all changes
   - Use template commit message above
   - Push to appropriate branch

**Remember:**
- Gemini 3 Flash is NOT yet available - keep Flash models as-is
- Direct API uses `gemini-3-pro-preview` (no date suffix)
- OpenRouter uses `google/gemini-3-pro-preview`
- Extended thinking requires 5+ minute timeouts
- Max output is 64K tokens (critical for JSON mode)

---

**Last Updated:** 2025-11-18
**Applies To:** All projects using Gemini models
**AI Assistant:** Claude Code, Cursor, Copilot, etc.
