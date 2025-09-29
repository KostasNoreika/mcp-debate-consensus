/**
 * Security module for MCP Debate Consensus Server
 * Handles input validation, sanitization, request signing, and security checks
 */

import path from 'path';
import fs from 'fs/promises';
import * as crypto from 'crypto';

class Security {
  constructor() {
    // Maximum allowed lengths
    this.MAX_QUESTION_LENGTH = 5000;
    this.MAX_PATH_LENGTH = 500;
    this.MAX_DEBATE_TIME = 3600000; // 1 hour

    // Allowed characters in questions (alphanumeric, spaces, common punctuation)
    this.QUESTION_REGEX = /^[\w\s\-.,!?:;'"()\[\]{}@#$%&*+=/<>|\\~`\n\r]+$/;

    // Path traversal prevention - allow absolute paths but block .. and ~
    this.PATH_TRAVERSAL_REGEX = /(\.\.|~)/;

    // Request signing configuration
    this.ENABLE_REQUEST_SIGNING = process.env.ENABLE_REQUEST_SIGNING !== 'false';
    this.SIGNATURE_VALIDITY_WINDOW = parseInt(process.env.SIGNATURE_VALIDITY_WINDOW) || 300; // 5 minutes
    this.HMAC_SECRET = process.env.HMAC_SECRET || this._generateHmacSecret();

    // Rate limiting configuration
    this.DEFAULT_RATE_LIMIT = 10; // requests per window
    this.DEFAULT_RATE_WINDOW = 60000; // 1 minute

    // Security features configuration
    this.features = {
      inputValidation: true,
      rateLimiting: true,
      signatureValidation: this.ENABLE_REQUEST_SIGNING,
      contentTypeValidation: true,
      ipValidation: true,
      auditLogging: true,
      securityHeaders: true
    };

    // Track rate limits per IP/identifier
    this.rateLimitStore = new Map();

    // Track nonces for replay protection
    this.nonceStore = new Map();
    this.NONCE_EXPIRY = 300000; // 5 minutes
  }

  /**
   * Generate HMAC secret if not provided
   */
  _generateHmacSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate input string for security threats
   */
  validateInput(input) {
    try {
      // Check if input exists and is a string
      if (!input || typeof input !== 'string') {
        return false;
      }

      // Check length limits
      if (input.length > this.MAX_QUESTION_LENGTH) {
        return false;
      }

      // Check for malicious patterns
      const maliciousPatterns = [
        // Script injection
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,
        /<img\s+[^>]*src\s*=/gi,
        /<svg\s+[^>]*on/gi,
        /<iframe/gi,
        /eval\s*\(/gi,
        /Function\s*\(/gi,
        /setTimeout\s*\(/gi,

        // SQL injection
        /(union\s+select|insert\s+into|delete\s+from|drop\s+table|update\s+set)/gi,
        /('|(\\x27)|(\\x2D\\x2D)|(\*\/)|(\*)).*?(\s*(or|and)\s+)/gi,
        /'\s*(or|OR|and|AND)\s+['"]?\d*['"]?\s*=\s*['"]?\d*['"]?/gi,
        /;\s*(DROP|INSERT|UPDATE|DELETE|SELECT)/gi,
        /SLEEP\s*\(/gi,

        // Command injection
        /[;&|`$]/gi,
        /\$\([^)]*\)/gi,
        /`[^`]*`/gi,
        /rm\s+-rf/gi,
        /cat\s+\/etc\/passwd/gi,
        /wget\s+/gi,
        /curl\s+/gi,
        /nc\s+/gi,
        /python\s+-c/gi,

        // Path traversal
        this.PATH_TRAVERSAL_REGEX,
        /file:\/\//gi,
        /\.\.\/|\.\.%2[fF]/gi,
        /\.\.\\|\.\.%5[cC]/gi,
        /%00/gi,

        // Encoded attacks
        /%3c%73%63%72%69%70%74/gi,
        /%22%3e%3cscript/gi,
        /&lt;script/gi,

        // NoSQL injection
        /\$ne\s*:/gi,
        /\$regex\s*:/gi,
        /\$where\s*:/gi,
        /\$gt\s*:/gi,

        // LDAP injection
        /\*\)\(/gi,
        /\*\)\|\(/gi,

        // Null bytes
        /\x00/gi,

        // Protocol handlers
        /mailto:/gi,
        /ftp:/gi,
        /file:/gi
      ];

      return !maliciousPatterns.some(pattern => pattern.test(input));
    } catch (error) {
      console.error('Input validation error:', error);
      return false;
    }
  }

  /**
   * Validate file path for security
   */
  validatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    if (filePath.length > this.MAX_PATH_LENGTH) {
      return false;
    }

    // Check for path traversal
    if (this.PATH_TRAVERSAL_REGEX.test(filePath)) {
      return false;
    }

    return true;
  }

  /**
   * Generate HMAC signature for request
   */
  generateSignature(data, secret = this.HMAC_SECRET) {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(data);
      return hmac.digest('hex');
    } catch (error) {
      console.error('Signature generation error:', error);
      return null;
    }
  }

  /**
   * Validate HMAC signature
   */
  validateSignature(data, signature, secret = this.HMAC_SECRET) {
    try {
      if (!signature) {
        return false;
      }

      const expectedSignature = this.generateSignature(data, secret);
      if (!expectedSignature) {
        return false;
      }

      // Use timing-safe comparison to prevent timing attacks
      const sigBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (error) {
      console.error('Signature validation error:', error);
      return false;
    }
  }

  /**
   * Generate and validate nonces for replay protection
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate nonce and ensure it hasn't been used before
   */
  validateNonce(nonce) {
    if (!nonce || typeof nonce !== 'string') {
      return false;
    }

    // Check if nonce was already used
    if (this.nonceStore.has(nonce)) {
      return false;
    }

    // Store nonce with timestamp
    const now = Date.now();
    this.nonceStore.set(nonce, now);

    // Clean up expired nonces
    this._cleanupExpiredNonces();

    return true;
  }

  /**
   * Clean up expired nonces
   */
  _cleanupExpiredNonces() {
    const now = Date.now();
    const expired = [];

    for (const [nonce, timestamp] of this.nonceStore.entries()) {
      if (now - timestamp > this.NONCE_EXPIRY) {
        expired.push(nonce);
      }
    }

    expired.forEach(nonce => this.nonceStore.delete(nonce));
  }

  /**
   * Validate timestamp for request freshness
   */
  validateTimestamp(timestamp) {
    if (!timestamp) {
      return false;
    }

    const requestTime = parseInt(timestamp);
    const now = Date.now();
    const timeDiff = Math.abs(now - requestTime);

    // Allow requests within the validity window
    return timeDiff <= this.SIGNATURE_VALIDITY_WINDOW * 1000;
  }

  /**
   * Sanitize output to remove sensitive information
   */
  sanitizeOutput(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // Remove potential sensitive patterns
    let sanitized = text
      // Remove API keys
      .replace(/sk-[a-zA-Z0-9]{32,}/g, '[API_KEY_REDACTED]')
      .replace(/Bearer\s+[a-zA-Z0-9\-_\.]+/g, '[BEARER_TOKEN_REDACTED]')
      // Remove secrets
      .replace(/secret["\s]*[:=]["\s]*[a-zA-Z0-9]{16,}/gi, 'secret="[REDACTED]"')
      .replace(/password["\s]*[:=]["\s]*[^\s"]+/gi, 'password="[REDACTED]"')
      // Remove potential file paths with sensitive info
      .replace(/\/home\/[^\s]+/g, '/home/[USER_PATH_REDACTED]')
      .replace(/\/Users\/[^\s]+/g, '/Users/[USER_PATH_REDACTED]')
      // Remove email addresses in error messages
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

    return sanitized;
  }

  /**
   * Sign outgoing request for enhanced security
   */
  signOutgoingRequest(method, url, body, apiKey) {
    try {
      const timestamp = Date.now().toString();
      const nonce = this.generateNonce();
      const bodyString = typeof body === 'object' ? JSON.stringify(body) : body;
      const dataToSign = `${method}:${url}:${timestamp}:${nonce}:${bodyString}`;

      const signature = this.generateSignature(dataToSign, apiKey);

      return {
        headers: {
          'X-Timestamp': timestamp,
          'X-Nonce': nonce,
          'X-Signature': signature
        },
        signedData: dataToSign
      };
    } catch (error) {
      console.error('Outgoing request signing error:', error);
      return { headers: {} };
    }
  }

  /**
   * Validate IP address
   */
  validateIPAddress(ip) {
    if (!ip || typeof ip !== 'string') {
      return false;
    }

    // Basic IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) {
      return false;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /0\.0\.0\.0/,
      /255\.255\.255\.255/,
      /[<>'"]/,
      /;|\||&/
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(ip));
  }

  /**
   * Validate JSON content for security threats
   */
  validateJsonContent(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const jsonStr = JSON.stringify(parsed);

      // Check for prototype pollution attempts
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      const hasDangerousKeys = dangerousKeys.some(key =>
        jsonStr.includes(`"${key}"`) || jsonStr.includes(`'${key}'`)
      );

      if (hasDangerousKeys) {
        return false;
      }

      // Check for NoSQL injection patterns
      const nosqlPatterns = [
        /\$ne/gi,
        /\$regex/gi,
        /\$where/gi,
        /\$gt/gi,
        /\$lt/gi,
        /\$in/gi,
        /\$nin/gi
      ];

      const hasNosqlInjection = nosqlPatterns.some(pattern => pattern.test(jsonStr));
      if (hasNosqlInjection) {
        return false;
      }

      // Validate each string value in the JSON
      const validateJsonValue = (obj) => {
        if (typeof obj === 'string') {
          return this.validateInput(obj);
        } else if (Array.isArray(obj)) {
          return obj.every(validateJsonValue);
        } else if (obj && typeof obj === 'object') {
          return Object.values(obj).every(validateJsonValue);
        }
        return true;
      };

      return validateJsonValue(parsed);
    } catch (error) {
      return false;
    }
  }

  /**
   * Create rate limiting middleware
   */
  rateLimitMiddleware(options = {}) {
    const {
      maxRequests = this.DEFAULT_RATE_LIMIT,
      windowMs = this.DEFAULT_RATE_WINDOW,
      keyGenerator = (req) => req.ip
    } = options;

    return (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      if (this.rateLimitStore.has(key)) {
        const requests = this.rateLimitStore.get(key).filter(time => time > windowStart);
        this.rateLimitStore.set(key, requests);
      } else {
        this.rateLimitStore.set(key, []);
      }

      const requests = this.rateLimitStore.get(key);

      if (requests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      requests.push(now);
      next();
    };
  }

  /**
   * Security headers middleware
   */
  securityHeadersMiddleware() {
    return (req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none';");
      next();
    };
  }

  /**
   * Audit middleware for logging security events
   */
  auditMiddleware() {
    return (req, res, next) => {
      const auditData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type']
      };

      // Log basic request info
      console.log(`[AUDIT] ${auditData.method} ${auditData.url} from ${auditData.ip}`);

      // Check for suspicious patterns in request body
      if (req.body && typeof req.body === 'object') {
        const bodyString = JSON.stringify(req.body);
        if (!this.validateJsonContent(bodyString)) {
          console.warn(`[AUDIT] Suspicious request detected from ${auditData.ip}:`, {
            ...auditData,
            suspiciousBody: bodyString.substring(0, 200)
          });
        }
      }

      next();
    };
  }

  /**
   * Signature validation middleware
   */
  signatureMiddleware() {
    return (req, res, next) => {
      if (!this.ENABLE_REQUEST_SIGNING) {
        return next();
      }

      const signature = req.headers['x-signature'];
      const timestamp = req.headers['x-timestamp'];
      const nonce = req.headers['x-nonce'];

      if (!signature || !timestamp) {
        return res.status(401).json({
          error: 'Missing required signature headers'
        });
      }

      // Check timestamp validity
      if (!this.validateTimestamp(timestamp)) {
        return res.status(401).json({
          error: 'Request timestamp expired'
        });
      }

      // Check nonce for replay protection
      if (nonce && !this.validateNonce(nonce)) {
        return res.status(401).json({
          error: 'Invalid or reused nonce'
        });
      }

      // Validate signature
      const payload = req.rawBody || JSON.stringify(req.body || {});
      const dataToSign = nonce
        ? `${req.method}:${req.url}:${timestamp}:${nonce}:${payload}`
        : `${req.method}:${req.url}:${timestamp}:${payload}`;

      if (!this.validateSignature(dataToSign, signature)) {
        return res.status(401).json({
          error: 'Invalid request signature'
        });
      }

      next();
    };
  }

  /**
   * Configure security features
   */
  configure(config) {
    this.features = { ...this.features, ...config };
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      enabled: true,
      features: this.features,
      rateLimitStore: {
        size: this.rateLimitStore.size,
        activeIPs: Array.from(this.rateLimitStore.keys())
      },
      nonceStore: {
        size: this.nonceStore.size
      },
      config: {
        maxQuestionLength: this.MAX_QUESTION_LENGTH,
        maxPathLength: this.MAX_PATH_LENGTH,
        signatureValidityWindow: this.SIGNATURE_VALIDITY_WINDOW,
        requestSigningEnabled: this.ENABLE_REQUEST_SIGNING,
        nonceExpiry: this.NONCE_EXPIRY
      }
    };
  }
}

export { Security };