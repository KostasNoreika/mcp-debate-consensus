/**
 * Prompt Enhancement Layer
 *
 * Automatically enhances user questions to be more specific and structured
 * while preserving the original intent. Uses Gemini Flash for fast, cost-effective enhancement.
 */

import axios from 'axios';
import logger from './utils/logger.js';

export class PromptEnhancer {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.enabled = process.env.ENABLE_PROMPT_ENHANCEMENT !== 'false';
    this.minQuestionLength = 15; // Minimum chars before enhancement kicks in
    this.enhancementCache = new Map(); // Cache enhanced prompts
  }

  /**
   * Validate if question is detailed enough
   */
  validateQuestion(question) {
    const validation = {
      isValid: true,
      warnings: [],
      suggestions: []
    };

    // Check minimum length
    if (question.length < this.minQuestionLength) {
      validation.isValid = false;
      validation.warnings.push('Question is too short (minimum 15 characters)');
      validation.suggestions.push('Provide more context about your problem');
      return validation;
    }

    // Check for overly simple questions
    const simplePatterns = [
      /^(hi|hello|hey|greetings?)$/i,
      /^(what|who|when|where|why|how)\s+is\s+\w+\?$/i, // "What is X?"
      /^(yes|no|ok|okay)$/i,
      /^(help|test)$/i
    ];

    const isSimple = simplePatterns.some(pattern => pattern.test(question.trim()));

    if (isSimple) {
      validation.warnings.push('Question appears too simple for multi-model consensus');
      validation.suggestions.push('Consider adding technical context or specific requirements');
      validation.suggestions.push('Examples: "How should I..." or "What are the trade-offs between..."');
    }

    // Check for technical indicators (good signs)
    const technicalIndicators = [
      /\b(implement|design|optimize|debug|refactor|architecture|performance|security|scalability)\b/i,
      /\b(should I|how to|what are|compare|versus|vs|trade-?offs?)\b/i,
      /\b(best practice|approach|strategy|pattern|solution)\b/i
    ];

    const hasTechnicalContext = technicalIndicators.some(pattern => pattern.test(question));

    if (!hasTechnicalContext && question.length < 50) {
      validation.warnings.push('Question might benefit from more technical context');
      validation.suggestions.push('Add details about: technology stack, constraints, or specific goals');
    }

    return validation;
  }

  /**
   * Enhance question with better structure while preserving intent
   */
  async enhanceQuestion(question) {
    // Validate first
    const validation = this.validateQuestion(question);

    if (!validation.isValid) {
      throw new Error(`Question validation failed: ${validation.warnings.join(', ')}. Suggestions: ${validation.suggestions.join(', ')}`);
    }

    // If disabled, return original (only for test mode)
    if (!this.enabled) {
      logger.info('Prompt enhancement explicitly disabled');
      return {
        original: question,
        enhanced: question,
        wasEnhanced: false,
        validation
      };
    }

    // API key is REQUIRED in production mode
    if (!this.geminiApiKey) {
      // In test mode, allow graceful fallback
      if (process.env.NODE_ENV === 'test') {
        logger.warn('GEMINI_API_KEY not configured (test mode - using original question)');
        return {
          original: question,
          enhanced: question,
          wasEnhanced: false,
          validation
        };
      }

      // In production, this is an error
      throw new Error('GEMINI_API_KEY is required for prompt enhancement. Add it to your .env file. Get your key from: https://aistudio.google.com/app/apikey');
    }

    // Check cache first
    const cacheKey = this.hashQuestion(question);
    if (this.enhancementCache.has(cacheKey)) {
      logger.info('Using cached enhanced prompt');
      return this.enhancementCache.get(cacheKey);
    }

    try {
      // Use Gemini 3 Pro for enhanced reasoning
      const enhancementPrompt = `You are a prompt enhancement specialist. Your task is to improve technical questions while preserving their exact original intent.

INPUT QUESTION:
"${question}"

YOUR TASK:
1. Analyze if the question is already well-structured
2. If it's simple or vague, enhance it with:
   - More specific technical context
   - Clear structure (what/why/constraints)
   - Relevant technical details
3. PRESERVE the original intent 100%
4. NEVER change the core question
5. NEVER add requirements user didn't ask for

RULES:
- If question is already detailed (50+ chars with technical context), return it unchanged
- If question is simple greeting/test, suggest enhancement but mark as "too_simple"
- For technical questions, add structure: context, specific requirements, constraints
- Keep enhanced version concise (max 2x original length)

OUTPUT FORMAT (JSON):
{
  "shouldEnhance": true/false,
  "reason": "why enhancement is needed or not",
  "enhanced": "enhanced question (or original if no enhancement needed)",
  "changes": ["list of changes made"],
  "confidence": 0-100
}

EXAMPLES:

INPUT: "How do I optimize database queries?"
OUTPUT: {
  "shouldEnhance": true,
  "reason": "Question lacks context about database type, current issues, and goals",
  "enhanced": "How can I optimize slow database queries in a Node.js application? Consider: 1) Query patterns causing slowdowns, 2) Indexing strategies, 3) Connection pooling, 4) Caching approaches. Current issue: API response times over 2 seconds.",
  "changes": ["Added technology context (Node.js)", "Added specific areas to analyze", "Added performance constraint"],
  "confidence": 85
}

INPUT: "What are the trade-offs between microservices and monolithic architecture for a high-traffic e-commerce platform with 1M+ users?"
OUTPUT: {
  "shouldEnhance": false,
  "reason": "Question already well-structured with clear context (high-traffic, e-commerce, scale)",
  "enhanced": "What are the trade-offs between microservices and monolithic architecture for a high-traffic e-commerce platform with 1M+ users?",
  "changes": [],
  "confidence": 95
}

INPUT: "hello"
OUTPUT: {
  "shouldEnhance": false,
  "reason": "too_simple - not a technical question suitable for debate",
  "enhanced": "hello",
  "changes": [],
  "confidence": 100
}

Now enhance this question:`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [{
            parts: [{
              text: enhancementPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.3, // Lower temperature for consistent enhancement
            maxOutputTokens: 65536, // Gemini 3 Pro max: 64K tokens (extended thinking mode)
            responseMimeType: 'application/json'
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 300000 // 5 minute timeout (Gemini 3 Pro uses extended thinking)
        }
      );

      const enhancementData = JSON.parse(
        response.data.candidates[0].content.parts[0].text
      );

      // Build result
      const result = {
        original: question,
        enhanced: enhancementData.enhanced || question,
        wasEnhanced: enhancementData.shouldEnhance && enhancementData.enhanced !== question,
        reason: enhancementData.reason,
        changes: enhancementData.changes || [],
        confidence: enhancementData.confidence || 0,
        validation
      };

      // Check for too_simple
      if (enhancementData.reason === 'too_simple') {
        throw new Error(`Question is too simple for multi-model debate: "${question}". This tool is designed for complex technical questions that benefit from multiple expert perspectives. Suggestions: ${validation.suggestions.join(', ')}`);
      }

      // Cache the result
      this.enhancementCache.set(cacheKey, result);

      // Log enhancement
      if (result.wasEnhanced) {
        logger.info('Question enhanced', {
          originalLength: question.length,
          enhancedLength: result.enhanced.length,
          changes: result.changes,
          confidence: result.confidence
        });
      }

      return result;

    } catch (error) {
      // If enhancement fails, log but continue with original question
      if (error.message.includes('too simple')) {
        throw error; // Re-throw validation errors
      }

      logger.warn('Prompt enhancement failed, using original', {
        error: error.message
      });

      return {
        original: question,
        enhanced: question,
        wasEnhanced: false,
        error: error.message,
        validation
      };
    }
  }

  /**
   * Simple hash for caching
   */
  hashQuestion(question) {
    let hash = 0;
    for (let i = 0; i < question.length; i++) {
      const char = question.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Clear enhancement cache
   */
  clearCache() {
    this.enhancementCache.clear();
    logger.info('Enhancement cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.enhancementCache.size,
      enabled: this.enabled,
      apiKeyConfigured: !!this.geminiApiKey
    };
  }
}
