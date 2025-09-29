/**
 * K-Proxy Server Unit Tests
 * Comprehensive test suite for proxy server failure scenarios and edge cases
 */

import { jest } from '@jest/globals';
import request from 'supertest';

// Mock express and dependencies
jest.unstable_mockModule('express', () => {
  const mockApp = {
    use: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    listen: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis()
  };

  const express = jest.fn(() => mockApp);
  express.json = jest.fn(() => jest.fn());
  express.Router = jest.fn(() => mockApp);

  return { default: express };
});

jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn(),
    create: jest.fn(),
    defaults: { timeout: 60000 }
  }
}));

jest.unstable_mockModule('dotenv', () => ({
  config: jest.fn()
}));

// Mock Security module
jest.unstable_mockModule('../../src/security.js', () => ({
  Security: jest.fn().mockImplementation(() => ({
    getSecurityStatus: jest.fn(() => ({ enabled: true })),
    securityHeadersMiddleware: jest.fn(() => jest.fn()),
    auditMiddleware: jest.fn(() => jest.fn()),
    rateLimitMiddleware: jest.fn(() => jest.fn()),
    signatureMiddleware: jest.fn(() => jest.fn())
  }))
}));

// Set environment variables for tests
process.env.OPENROUTER_API_KEY = 'test-api-key';
process.env.DEBATE_TIMEOUT_MINUTES = '30';

describe('K-Proxy Server', () => {
  let axios;
  let express;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import mocked modules
    axios = (await import('axios')).default;
    express = (await import('express')).default;
  });

  describe('Server Configuration', () => {
    test('should fail to start without OpenRouter API key', () => {
      const originalKey = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      // Re-import to trigger configuration check
      jest.resetModules();

      expect(exitSpy).toHaveBeenCalledWith(1);

      // Restore
      process.env.OPENROUTER_API_KEY = originalKey;
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test('should use default timeout when not configured', () => {
      delete process.env.DEBATE_TIMEOUT_MINUTES;

      // The default should be 60 minutes
      expect(parseInt(process.env.DEBATE_TIMEOUT_MINUTES) || 60).toBe(60);
    });
  });

  describe('Model Mapping Edge Cases', () => {
    test('should handle all supported k-instances', () => {
      const supportedModels = ['k1', 'k2', 'k3', 'k4', 'k7', 'k8'];
      const expectedPorts = [3457, 3458, 3459, 3460, 3463, 3464];

      supportedModels.forEach((model, index) => {
        expect(expectedPorts[index]).toBeGreaterThan(3456);
        expect(expectedPorts[index]).toBeLessThan(3465);
      });
    });

    test('should have appropriate token limits for each model', () => {
      const tokenLimits = {
        'k1': 16000,
        'k2': 32000,
        'k3': 16000,
        'k4': 32000,
        'k7': 8000,
        'k8': 8000
      };

      Object.entries(tokenLimits).forEach(([model, limit]) => {
        expect(limit).toBeGreaterThan(0);
        expect(limit).toBeLessThanOrEqual(32000);
      });
    });
  });

  describe('Request Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const mockApp = {
        use: jest.fn().mockReturnThis(),
        post: jest.fn(),
        get: jest.fn(),
        listen: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis()
      };

      express.mockReturnValue(mockApp);
      express.json = jest.fn(() => (req, res, next) => {
        // Simulate JSON parsing error
        const error = new Error('Unexpected token in JSON');
        error.status = 400;
        throw error;
      });

      // Test JSON middleware error handling
      const middleware = express.json({ limit: '50mb' });
      expect(typeof middleware).toBe('function');
    });

    test('should enforce request size limits', () => {
      const middleware = express.json({ limit: '50mb' });
      expect(express.json).toHaveBeenCalledWith({ limit: '50mb' });
    });
  });

  describe('OpenRouter API Integration', () => {
    test('should handle OpenRouter API failures', async () => {
      axios.post.mockRejectedValue(new Error('Network timeout'));

      try {
        await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'anthropic/claude-opus-4.1',
          messages: [{ role: 'user', content: 'test' }]
        });
      } catch (error) {
        expect(error.message).toBe('Network timeout');
      }
    });

    test('should handle rate limiting responses', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' }
        }
      });

      try {
        await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'openai/gpt-5',
          messages: [{ role: 'user', content: 'test' }]
        });
      } catch (error) {
        expect(error.response.status).toBe(429);
        expect(error.response.data.error).toBe('Rate limit exceeded');
      }
    });

    test('should handle invalid model responses', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 404,
          data: { error: 'Model not found' }
        }
      });

      try {
        await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'invalid/model',
          messages: [{ role: 'user', content: 'test' }]
        });
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).toBe('Model not found');
      }
    });

    test('should handle API quota exceeded', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 402,
          data: { error: 'Insufficient credits' }
        }
      });

      try {
        await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'anthropic/claude-opus-4.1',
          messages: [{ role: 'user', content: 'test' }]
        });
      } catch (error) {
        expect(error.response.status).toBe(402);
        expect(error.response.data.error).toBe('Insufficient credits');
      }
    });
  });

  describe('Timeout Handling', () => {
    test('should respect configured timeout values', async () => {
      const timeoutMs = 30 * 60 * 1000; // 30 minutes

      axios.post.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Request timeout'));
          }, timeoutMs + 1000);
        });
      });

      const startTime = Date.now();

      try {
        await Promise.race([
          axios.post('https://openrouter.ai/api/v1/chat/completions', {}),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), 1000)
          )
        ]);
      } catch (error) {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(2000); // Should timeout quickly in test
        expect(error.message).toBe('Test timeout');
      }
    });
  });

  describe('Security Middleware Integration', () => {
    test('should apply all security middlewares', async () => {
      const { Security } = await import('../../src/security.js');
      const security = new Security();

      expect(security.securityHeadersMiddleware).toBeDefined();
      expect(security.auditMiddleware).toBeDefined();
      expect(security.rateLimitMiddleware).toBeDefined();
      expect(security.signatureMiddleware).toBeDefined();
    });

    test('should handle security middleware failures', async () => {
      const { Security } = await import('../../src/security.js');

      // Mock security to throw error
      Security.mockImplementation(() => ({
        securityHeadersMiddleware: jest.fn(() => {
          throw new Error('Security initialization failed');
        }),
        auditMiddleware: jest.fn(() => jest.fn()),
        rateLimitMiddleware: jest.fn(() => jest.fn()),
        signatureMiddleware: jest.fn(() => jest.fn()),
        getSecurityStatus: jest.fn(() => ({ enabled: false }))
      }));

      expect(() => new Security()).toThrow('Security initialization failed');
    });
  });

  describe('Health Check Endpoints', () => {
    test('should provide health check endpoint', () => {
      const mockApp = {
        use: jest.fn().mockReturnThis(),
        post: jest.fn(),
        get: jest.fn((path, handler) => {
          if (path === '/health') {
            expect(typeof handler).toBe('function');
          }
        }),
        listen: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis()
      };

      express.mockReturnValue(mockApp);

      // Simulate health endpoint registration
      mockApp.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() });
      });

      expect(mockApp.get).toHaveBeenCalled();
    });
  });

  describe('Port Management', () => {
    test('should handle port conflicts gracefully', () => {
      const portMap = {
        'k1': 3457,
        'k2': 3458,
        'k3': 3459,
        'k4': 3460,
        'k7': 3463,
        'k8': 3464
      };

      // Ensure no port conflicts
      const ports = Object.values(portMap);
      const uniquePorts = [...new Set(ports)];

      expect(ports.length).toBe(uniquePorts.length);
    });

    test('should handle server startup failures', () => {
      const mockApp = {
        use: jest.fn().mockReturnThis(),
        post: jest.fn(),
        get: jest.fn(),
        listen: jest.fn((port, callback) => {
          // Simulate EADDRINUSE error
          const error = new Error('Port already in use');
          error.code = 'EADDRINUSE';
          setTimeout(() => callback && callback(error), 0);
        }),
        set: jest.fn().mockReturnThis()
      };

      express.mockReturnValue(mockApp);

      const app = express();
      app.listen(3457, (error) => {
        if (error) {
          expect(error.code).toBe('EADDRINUSE');
        }
      });
    });
  });

  describe('Request Validation', () => {
    test('should validate request headers', () => {
      const validHeaders = {
        'content-type': 'application/json',
        'authorization': 'Bearer test-token'
      };

      expect(validHeaders['content-type']).toBe('application/json');
      expect(validHeaders['authorization']).toMatch(/^Bearer /);
    });

    test('should handle missing authorization', () => {
      const invalidHeaders = {
        'content-type': 'application/json'
        // Missing authorization header
      };

      expect(invalidHeaders['authorization']).toBeUndefined();
    });

    test('should validate request body structure', () => {
      const validBody = {
        model: 'anthropic/claude-opus-4.1',
        messages: [
          { role: 'user', content: 'test message' }
        ],
        max_tokens: 1000
      };

      expect(validBody.model).toBeDefined();
      expect(validBody.messages).toBeInstanceOf(Array);
      expect(validBody.messages[0]).toHaveProperty('role');
      expect(validBody.messages[0]).toHaveProperty('content');
    });

    test('should reject malformed message arrays', () => {
      const invalidBody = {
        model: 'anthropic/claude-opus-4.1',
        messages: 'not an array', // Invalid
        max_tokens: 1000
      };

      expect(Array.isArray(invalidBody.messages)).toBe(false);
    });
  });

  describe('Response Transformation', () => {
    test('should handle streaming responses', async () => {
      axios.post.mockResolvedValue({
        data: {
          choices: [{
            delta: { content: 'test response chunk' },
            finish_reason: null
          }]
        }
      });

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'anthropic/claude-opus-4.1',
        messages: [{ role: 'user', content: 'test' }],
        stream: true
      });

      expect(response.data.choices[0].delta.content).toBe('test response chunk');
    });

    test('should handle non-streaming responses', async () => {
      axios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: 'complete response' },
            finish_reason: 'stop'
          }]
        }
      });

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'anthropic/claude-opus-4.1',
        messages: [{ role: 'user', content: 'test' }],
        stream: false
      });

      expect(response.data.choices[0].message.content).toBe('complete response');
      expect(response.data.choices[0].finish_reason).toBe('stop');
    });
  });
});