/**
 * @jest-environment node
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PromptEnhancer } from '../../src/prompt-enhancer.js';

describe('PromptEnhancer', () => {
  let enhancer;

  beforeEach(() => {
    enhancer = new PromptEnhancer();
  });

  describe('validateQuestion', () => {
    test('should reject questions that are too short', () => {
      const result = enhancer.validateQuestion('test');
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Question is too short (minimum 15 characters)');
    });

    test('should warn about simple greetings', () => {
      const result = enhancer.validateQuestion('hello');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should warn about questions that lack technical context', () => {
      // Questions without technical indicators should get warning about context
      const result = enhancer.validateQuestion('What is the answer?');
      expect(result.isValid).toBe(true); // Valid length
      expect(result.warnings.some(w => w.includes('technical context'))).toBe(true);
    });

    test('should accept technical questions', () => {
      const result = enhancer.validateQuestion('How should I implement caching in my Express API to reduce database load?');
      expect(result.isValid).toBe(true);
      // Long technical questions should have no warnings
    });

    test('should accept questions with technical indicators', () => {
      const technicalQuestions = [
        'How to optimize database performance for high-traffic applications?',
        'What are the trade-offs between microservices and monolithic architecture?',
        'Best practice for implementing authentication in React applications?',
        'Compare different approaches to state management in Vue.js',
        'Debug: API returns 500 errors after Redis upgrade'
      ];

      technicalQuestions.forEach(question => {
        const result = enhancer.validateQuestion(question);
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject yes/no single word answers', () => {
      const result = enhancer.validateQuestion('yes');
      expect(result.isValid).toBe(false);
    });

    test('should provide helpful suggestions for simple questions', () => {
      const result = enhancer.validateQuestion('What is Node.js API?');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('technology stack') || s.includes('constraints') || s.includes('specific goals'))).toBe(true);
    });
  });

  describe('enhanceQuestion - disabled mode', () => {
    test('should return original question when disabled', async () => {
      process.env.ENABLE_PROMPT_ENHANCEMENT = 'false';
      const newEnhancer = new PromptEnhancer();

      const result = await newEnhancer.enhanceQuestion('How to optimize database queries for performance?');

      expect(result.wasEnhanced).toBe(false);
      expect(result.enhanced).toBe('How to optimize database queries for performance?');
    });

    test('should return original question when API key not configured', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const newEnhancer = new PromptEnhancer();
      const result = await newEnhancer.enhanceQuestion('How to optimize database queries for performance?');

      expect(result.wasEnhanced).toBe(false);
      expect(result.enhanced).toBe('How to optimize database queries for performance?');

      // Restore
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });
  });

  describe('cache management', () => {
    test('should clear cache', () => {
      // Manually add something to cache
      enhancer.enhancementCache.set('test', { wasEnhanced: true });

      const statsBefore = enhancer.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);

      enhancer.clearCache();

      const statsAfter = enhancer.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });

    test('should return cache statistics', () => {
      const stats = enhancer.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('apiKeyConfigured');
    });

    test('should report API key status correctly', () => {
      const originalKey = process.env.GEMINI_API_KEY;

      // Test with API key
      process.env.GEMINI_API_KEY = 'test-key';
      const enhancerWithKey = new PromptEnhancer();
      expect(enhancerWithKey.getCacheStats().apiKeyConfigured).toBe(true);

      // Test without API key
      delete process.env.GEMINI_API_KEY;
      const enhancerWithoutKey = new PromptEnhancer();
      expect(enhancerWithoutKey.getCacheStats().apiKeyConfigured).toBe(false);

      // Restore
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });
  });

  describe('hashQuestion', () => {
    test('should generate consistent hashes', () => {
      const question = 'How to optimize database queries?';

      const hash1 = enhancer.hashQuestion(question);
      const hash2 = enhancer.hashQuestion(question);

      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different questions', () => {
      const hash1 = enhancer.hashQuestion('Question 1');
      const hash2 = enhancer.hashQuestion('Question 2');

      expect(hash1).not.toBe(hash2);
    });

    test('should generate string hashes', () => {
      const hash = enhancer.hashQuestion('test question');
      expect(typeof hash).toBe('string');
    });
  });

  describe('validation edge cases', () => {
    test('should handle empty string', () => {
      const result = enhancer.validateQuestion('');
      expect(result.isValid).toBe(false);
    });

    test('should handle whitespace-only string', () => {
      const result = enhancer.validateQuestion('   ');
      expect(result.isValid).toBe(false);
    });

    test('should accept questions at exact minimum length', () => {
      const result = enhancer.validateQuestion('123456789012345'); // Exactly 15 chars
      expect(result.isValid).toBe(true);
    });

    test('should provide useful error messages', () => {
      const result = enhancer.validateQuestion('hi');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    test('should use default minimum length', () => {
      expect(enhancer.minQuestionLength).toBe(15);
    });

    test('should be enabled by default unless explicitly disabled', () => {
      // Save original value
      const originalValue = process.env.ENABLE_PROMPT_ENHANCEMENT;

      // Test default (enabled)
      delete process.env.ENABLE_PROMPT_ENHANCEMENT;
      const defaultEnhancer = new PromptEnhancer();
      expect(defaultEnhancer.enabled).toBe(true);

      // Test explicitly disabled
      process.env.ENABLE_PROMPT_ENHANCEMENT = 'false';
      const disabledEnhancer = new PromptEnhancer();
      expect(disabledEnhancer.enabled).toBe(false);

      // Restore
      if (originalValue !== undefined) {
        process.env.ENABLE_PROMPT_ENHANCEMENT = originalValue;
      } else {
        delete process.env.ENABLE_PROMPT_ENHANCEMENT;
      }
    });
  });
});
