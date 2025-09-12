/**
 * Security module for MCP Debate Consensus Server
 * Handles input validation, sanitization, and security checks
 */

const path = require('path');
const fs = require('fs').promises;

class Security {
  constructor() {
    // Maximum allowed lengths
    this.MAX_QUESTION_LENGTH = 5000;
    this.MAX_PATH_LENGTH = 500;
    this.MAX_DEBATE_TIME = 3600000; // 1 hour
    
    // Allowed characters in questions (alphanumeric, spaces, common punctuation)
    this.QUESTION_REGEX = /^[\w\s\-.,!?:;'"()\[\]{}@#$%&*+=/<>|\\~`\n\r]+$/;
    
    // Path traversal prevention
    this.PATH_TRAVERSAL_REGEX = /(\.\.|~|^\/)/;
  }

  /**
   * Validate and sanitize question input
   */
  validateQuestion(question) {
    if (!question || typeof question !== 'string') {
      throw new Error('Question must be a non-empty string');
    }
    
    if (question.length > this.MAX_QUESTION_LENGTH) {
      throw new Error(`Question exceeds maximum length of ${this.MAX_QUESTION_LENGTH} characters`);
    }
    
    // Check for potential injection attempts
    if (!this.QUESTION_REGEX.test(question)) {
      throw new Error('Question contains invalid characters');
    }
    
    // Check for common injection patterns
    const injectionPatterns = [
      /\$\{.*\}/,  // Template literal injection
      /\$\(.*\)/,  // Command substitution
      /`.*`/,      // Backtick command execution
      /<script/i,  // Script tags
      /javascript:/i, // JavaScript protocol
      /on\w+=/i,   // Event handlers
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(question)) {
        throw new Error('Question contains potentially malicious content');
      }
    }
    
    // Sanitize by trimming and normalizing whitespace
    return question.trim().replace(/\s+/g, ' ');
  }

  /**
   * Validate project path input
   */
  async validateProjectPath(projectPath) {
    if (!projectPath || typeof projectPath !== 'string') {
      return process.cwd(); // Default to current directory
    }
    
    if (projectPath.length > this.MAX_PATH_LENGTH) {
      throw new Error(`Path exceeds maximum length of ${this.MAX_PATH_LENGTH} characters`);
    }
    
    // Check for path traversal attempts
    if (this.PATH_TRAVERSAL_REGEX.test(projectPath)) {
      throw new Error('Path contains potentially malicious patterns');
    }
    
    // Resolve to absolute path and check if it exists
    const absolutePath = path.resolve(projectPath);
    
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Project path does not exist');
      }
      throw error;
    }
    
    // Ensure path is within allowed boundaries (not system directories)
    const restrictedPaths = [
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      '/var',
      '/sys',
      '/proc',
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\ProgramData'
    ];
    
    const normalizedPath = absolutePath.toLowerCase();
    for (const restricted of restrictedPaths) {
      if (normalizedPath.startsWith(restricted.toLowerCase())) {
        throw new Error('Access to system directories is restricted');
      }
    }
    
    return absolutePath;
  }

  /**
   * Validate environment variables
   */
  validateEnvironment() {
    const errors = [];
    
    // Check for required environment variables
    if (!process.env.OPENROUTER_API_KEY) {
      errors.push('OPENROUTER_API_KEY environment variable is not set');
    } else if (process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
      errors.push('OPENROUTER_API_KEY has not been configured (still using default value)');
    }
    
    // Validate API key format (basic check)
    if (process.env.OPENROUTER_API_KEY) {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (apiKey.length < 20 || apiKey.length > 200) {
        errors.push('OPENROUTER_API_KEY appears to be invalid');
      }
      
      // Check for common placeholder patterns
      if (/^(sk-)?[xX]+$/.test(apiKey) || /your.*key/i.test(apiKey)) {
        errors.push('OPENROUTER_API_KEY appears to be a placeholder');
      }
    }
    
    return errors;
  }

  /**
   * Sanitize output before sending to client
   */
  sanitizeOutput(output) {
    if (typeof output !== 'string') {
      return output;
    }
    
    // Remove any potential API keys or sensitive data
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{48}/g,  // OpenAI-style keys
      /Bearer [a-zA-Z0-9\-._~+/]+=*/g,  // Bearer tokens
      /api[_-]?key[\"']?\s*[:=]\s*[\"']?[a-zA-Z0-9\-._~+/]+/gi,  // API key patterns
      /password[\"']?\s*[:=]\s*[\"']?[^\s\"']+/gi,  // Password patterns
      /secret[\"']?\s*[:=]\s*[\"']?[^\s\"']+/gi,  // Secret patterns
    ];
    
    let sanitized = output;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }

  /**
   * Rate limiting check (simple in-memory implementation)
   */
  checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    if (!this.rateLimits) {
      this.rateLimits = new Map();
    }
    
    const now = Date.now();
    const window = this.rateLimits.get(identifier) || { count: 0, resetTime: now + windowMs };
    
    // Reset window if expired
    if (now > window.resetTime) {
      window.count = 0;
      window.resetTime = now + windowMs;
    }
    
    window.count++;
    this.rateLimits.set(identifier, window);
    
    if (window.count > maxRequests) {
      const waitTime = Math.ceil((window.resetTime - now) / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds before trying again.`);
    }
    
    return true;
  }

  /**
   * Validate debate timeout
   */
  validateTimeout(timeout) {
    if (timeout && (typeof timeout !== 'number' || timeout < 0 || timeout > this.MAX_DEBATE_TIME)) {
      throw new Error(`Invalid timeout. Must be between 0 and ${this.MAX_DEBATE_TIME}ms`);
    }
    return timeout || 1800000; // Default 30 minutes
  }

  /**
   * Clean up old logs and temporary files
   */
  async cleanupOldFiles(logsDir, maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
    try {
      const files = await fs.readdir(logsDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

module.exports = { Security };