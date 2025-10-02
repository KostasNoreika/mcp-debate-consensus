/**
 * Structured Logging Utility
 * Provides environment-aware logging with sensitive data redaction
 *
 * Features:
 * - Different log levels (error, warn, info, debug)
 * - Environment-based configuration (verbose in dev, minimal in prod)
 * - Automatic redaction of sensitive data (API keys, secrets, tokens)
 * - File and console transports
 * - JSON structured output for production
 * - Pretty console output for development
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../../logs');

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  /api[_-]?key[:\s=]+['"]?([a-zA-Z0-9\-_]+)['"]?/gi,
  /secret[:\s=]+['"]?([a-zA-Z0-9\-_]+)['"]?/gi,
  /password[:\s=]+['"]?([a-zA-Z0-9\-_]+)['"]?/gi,
  /token[:\s=]+['"]?([a-zA-Z0-9\-_]+)['"]?/gi,
  /authorization[:\s=]+['"]?(bearer\s+)?([a-zA-Z0-9\-_\.]+)['"]?/gi,
  /OPENROUTER_API_KEY[:\s=]+['"]?([a-zA-Z0-9\-_]+)['"]?/gi,
  /HMAC_SECRET[:\s=]+['"]?([a-zA-Z0-9\-_]+)['"]?/gi,
];

/**
 * Redact sensitive data from log messages
 * @param {string} message - Original message
 * @returns {string} - Redacted message
 */
function redactSensitiveData(message) {
  if (typeof message !== 'string') {
    return message;
  }

  let redacted = message;
  SENSITIVE_PATTERNS.forEach(pattern => {
    redacted = redacted.replace(pattern, (match) => {
      // Keep the key name but redact the value
      const parts = match.split(/[:=\s]+/);
      if (parts.length > 1) {
        return `${parts[0]}=[REDACTED]`;
      }
      return '[REDACTED]';
    });
  });

  return redacted;
}

/**
 * Custom format for redacting sensitive data
 */
const redactFormat = winston.format((info) => {
  // Redact message
  if (info.message) {
    info.message = redactSensitiveData(info.message);
  }

  // Redact metadata
  if (info.metadata) {
    info.metadata = JSON.parse(
      redactSensitiveData(JSON.stringify(info.metadata))
    );
  }

  // Redact error stack traces
  if (info.error && info.error.stack) {
    info.error.stack = redactSensitiveData(info.error.stack);
  }

  return info;
});

/**
 * Get log level based on environment
 */
function getLogLevel() {
  // Check explicit LOG_LEVEL env var first
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }

  // Environment-based defaults
  const env = process.env.NODE_ENV || 'development';

  // Test environment - minimal logging to avoid test noise
  if (env === 'test' || process.env.JEST_WORKER_ID) {
    return 'error';
  }

  // Development - verbose logging
  if (env === 'development') {
    return 'debug';
  }

  // Production - info level
  return 'info';
}

/**
 * Create console format based on environment
 */
function getConsoleFormat() {
  const env = process.env.NODE_ENV || 'development';
  const isTest = env === 'test' || process.env.JEST_WORKER_ID;

  // Production and test: JSON format
  if (env === 'production' || isTest) {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      redactFormat(),
      winston.format.json()
    );
  }

  // Development: Pretty console format
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    redactFormat(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;

      // Add metadata if present
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
      }

      return msg;
    })
  );
}

/**
 * Create transports based on environment
 */
function createTransports() {
  const transports = [];
  const env = process.env.NODE_ENV || 'development';
  const isTest = env === 'test' || process.env.JEST_WORKER_ID;

  // Console transport (always enabled, except in test mode where it's error-only)
  transports.push(
    new winston.transports.Console({
      format: getConsoleFormat(),
      silent: isTest && getLogLevel() !== 'debug', // Silent in tests unless debug
    })
  );

  // File transports (not in test mode)
  if (!isTest && process.env.LOG_FILE !== 'false') {
    // Combined log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          redactFormat(),
          winston.format.json()
        ),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );

    // Error log file
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          redactFormat(),
          winston.format.json()
        ),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );
  }

  return transports;
}

/**
 * Create and configure the logger instance
 */
const logger = winston.createLogger({
  level: getLogLevel(),
  transports: createTransports(),
  exitOnError: false,
});

/**
 * Helper method to log with context
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
logger.logWithContext = function(level, message, context = {}) {
  this[level](message, { metadata: context });
};

/**
 * Create a child logger with default context
 * @param {Object} defaultContext - Default context to include in all logs
 * @returns {Object} Child logger
 */
logger.child = function(defaultContext) {
  return {
    error: (msg, ctx) => this.error(msg, { ...defaultContext, ...ctx }),
    warn: (msg, ctx) => this.warn(msg, { ...defaultContext, ...ctx }),
    info: (msg, ctx) => this.info(msg, { ...defaultContext, ...ctx }),
    debug: (msg, ctx) => this.debug(msg, { ...defaultContext, ...ctx }),
    logWithContext: (level, msg, ctx) => this.logWithContext(level, msg, { ...defaultContext, ...ctx }),
  };
};

/**
 * Express middleware for request logging
 */
logger.requestMiddleware = function() {
  return (req, res, next) => {
    const start = Date.now();

    // Log request
    this.info('Incoming request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      this.info('Request completed', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  };
};

/**
 * Utility to log performance metrics
 */
logger.performance = function(operation, duration, metadata = {}) {
  this.info(`Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...metadata,
  });
};

/**
 * Utility to log security events
 */
logger.security = function(event, details = {}) {
  this.warn(`Security: ${event}`, {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

/**
 * Utility to log audit events
 */
logger.audit = function(action, details = {}) {
  this.info(`Audit: ${action}`, {
    action,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Export logger instance and utilities
export default logger;
export { logger, redactSensitiveData };
