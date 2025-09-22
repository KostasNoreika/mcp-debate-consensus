/**
 * Cross-Verification System
 *
 * Implements a multi-layered verification system where models check each other's work:
 * 1. Fact checking - technical accuracy verification
 * 2. Code execution verification (simulated)
 * 3. Adversarial testing - models try to find flaws
 * 4. Confidence scoring based on verification results
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { FactChecker } from './verification/fact-checker.js';
import { AdversarialTester } from './verification/adversarial.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CrossVerifier {
  constructor(models = []) {
    this.models = models;
    this.factChecker = new FactChecker(models);
    this.adversarialTester = new AdversarialTester(models);
    this.logsDir = path.join(__dirname, '..', 'logs', 'verification');

    // Verification thresholds
    this.thresholds = {
      factAccuracy: 0.85,
      codeCorrectness: 0.90,
      securityMinimum: 0.95,
      adversarialChallenges: 3
    };

    // Categories that require verification
    this.requiresVerification = {
      always: ['security', 'financial', 'production', 'data-migration', 'compliance'],
      optional: ['ui', 'documentation', 'prototype', 'internal-tools']
    };
  }

  async initialize() {
    await fs.mkdir(this.logsDir, { recursive: true });
    await this.factChecker.initialize();
    await this.adversarialTester.initialize();
  }

  /**
   * Determines if verification should be enabled for this question
   */
  shouldVerify(question, category = null, options = {}) {
    // Force verification if explicitly requested
    if (options.forceVerification) {
      return true;
    }

    // Skip verification if explicitly disabled
    if (options.skipVerification) {
      return false;
    }

    // Check if question contains security/financial keywords
    const criticalKeywords = [
      'security', 'auth', 'password', 'token', 'encrypt', 'decrypt',
      'payment', 'financial', 'money', 'price', 'cost', 'billing',
      'production', 'deploy', 'migration', 'database', 'sql',
      'compliance', 'gdpr', 'hipaa', 'audit', 'vulnerability'
    ];

    const questionLower = question.toLowerCase();
    const hasCriticalKeywords = criticalKeywords.some(keyword =>
      questionLower.includes(keyword)
    );

    if (hasCriticalKeywords) {
      return true;
    }

    // Check category-based requirements
    if (category && this.requiresVerification.always.includes(category.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Main verification orchestrator
   */
  async verifyProposals(proposals, question, projectPath, options = {}) {
    const startTime = Date.now();
    console.log('\n🔍 VERIFICATION ROUND: Cross-Model Validation\n');

    const verificationEnabled = this.shouldVerify(question, options.category, options);

    if (!verificationEnabled) {
      console.log('⏩ Verification skipped (not required for this question type)');
      return {
        enabled: false,
        skipped: true,
        reason: 'Verification not required for this question category'
      };
    }

    console.log('🛡️ Verification enabled for this question');
    console.log(`📊 ${Object.keys(proposals).length} proposals to verify`);

    const verificationResults = {};

    for (const [modelName, proposal] of Object.entries(proposals)) {
      console.log(`\n🔍 Verifying proposal from ${modelName}...`);

      try {
        const result = await this.verifyProposal(proposal, modelName, question, projectPath);
        verificationResults[modelName] = result;

        console.log(`✅ ${modelName}: Confidence ${(result.confidence * 100).toFixed(1)}%`);
        if (result.warnings.length > 0) {
          console.log(`⚠️  ${result.warnings.length} warnings found`);
        }
      } catch (error) {
        console.error(`❌ Verification failed for ${modelName}:`, error.message);
        verificationResults[modelName] = {
          confidence: 0.5, // Default confidence when verification fails
          warnings: [`Verification failed: ${error.message}`],
          factual_accuracy: 0.5,
          code_correctness: 0.5,
          security_verified: false,
          challenges_passed: 0,
          error: error.message
        };
      }
    }

    const verificationSummary = this.calculateVerificationSummary(verificationResults);

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n📊 Verification completed in ${duration}s`);
    console.log(`🎯 Overall confidence: ${(verificationSummary.averageConfidence * 100).toFixed(1)}%`);
    console.log(`⚠️  Total warnings: ${verificationSummary.totalWarnings}`);

    // Save verification log
    await this.saveVerificationLog(question, proposals, verificationResults, verificationSummary);

    return {
      enabled: true,
      results: verificationResults,
      summary: verificationSummary,
      duration
    };
  }

  /**
   * Verify a single proposal through multiple verification layers
   */
  async verifyProposal(proposal, modelName, question, projectPath) {
    const verification = {
      factual_accuracy: 0,
      code_correctness: 0,
      security_verified: false,
      challenges_passed: 0,
      confidence: 0,
      warnings: []
    };

    // Layer 1: Fact checking
    console.log(`  🔍 Layer 1: Fact checking...`);
    const factCheck = await this.factChecker.checkFacts(proposal, question, {
      excludeModel: modelName,
      projectPath
    });

    verification.factual_accuracy = factCheck.accuracy;
    verification.warnings.push(...factCheck.warnings);

    // Layer 2: Code execution verification (if applicable)
    if (this.containsCode(proposal)) {
      console.log(`  🔍 Layer 2: Code verification...`);
      const codeVerification = await this.verifyCodeExecution(proposal, projectPath);
      verification.code_correctness = codeVerification.correctness;
      verification.warnings.push(...codeVerification.warnings);
    } else {
      verification.code_correctness = 1.0; // No code to verify
    }

    // Layer 3: Adversarial testing
    console.log(`  🔍 Layer 3: Adversarial testing...`);
    const adversarialResults = await this.adversarialTester.testProposal(proposal, question, {
      excludeModel: modelName,
      projectPath
    });

    verification.challenges_passed = adversarialResults.challengesPassed;
    verification.security_verified = adversarialResults.securityVerified;
    verification.warnings.push(...adversarialResults.warnings);

    // Calculate overall confidence
    verification.confidence = this.calculateConfidence(verification);

    return verification;
  }

  /**
   * Simulated code execution verification
   */
  async verifyCodeExecution(proposal, projectPath) {
    // Extract code blocks from proposal
    const codeBlocks = this.extractCodeBlocks(proposal);

    if (codeBlocks.length === 0) {
      return {
        correctness: 1.0,
        warnings: []
      };
    }

    const warnings = [];
    let correctnessScore = 1.0;

    for (const codeBlock of codeBlocks) {
      // Basic syntax checks
      const syntaxIssues = await this.checkSyntax(codeBlock);
      if (syntaxIssues.length > 0) {
        warnings.push(...syntaxIssues.map(issue => `Syntax: ${issue}`));
        correctnessScore *= 0.8;
      }

      // Security pattern checks
      const securityIssues = await this.checkSecurityPatterns(codeBlock);
      if (securityIssues.length > 0) {
        warnings.push(...securityIssues.map(issue => `Security: ${issue}`));
        correctnessScore *= 0.7;
      }

      // Performance pattern checks
      const performanceIssues = await this.checkPerformancePatterns(codeBlock);
      if (performanceIssues.length > 0) {
        warnings.push(...performanceIssues.map(issue => `Performance: ${issue}`));
        correctnessScore *= 0.9;
      }
    }

    return {
      correctness: Math.max(correctnessScore, 0.1), // Minimum 0.1
      warnings
    };
  }

  /**
   * Extract code blocks from markdown-formatted text
   */
  extractCodeBlocks(text) {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        code: match[1],
        language: match[0].split('\n')[0].replace('```', '') || 'unknown'
      });
    }

    return blocks;
  }

  /**
   * Check if proposal contains code
   */
  containsCode(proposal) {
    return proposal.includes('```') ||
           proposal.includes('function ') ||
           proposal.includes('class ') ||
           proposal.includes('import ') ||
           proposal.includes('const ') ||
           proposal.includes('let ') ||
           proposal.includes('var ');
  }

  /**
   * Basic syntax checking for common patterns
   */
  async checkSyntax(codeBlock) {
    const issues = [];
    const { code, language } = codeBlock;

    // Check for basic syntax issues
    if (language === 'javascript' || language === 'js') {
      // Check for missing semicolons in critical places
      if (code.includes('return') && !code.includes('return;') && !code.includes('return ')) {
        issues.push('Potential missing semicolon after return statement');
      }

      // Check for unclosed brackets
      const openBrackets = (code.match(/\{/g) || []).length;
      const closeBrackets = (code.match(/\}/g) || []).length;
      if (openBrackets !== closeBrackets) {
        issues.push('Mismatched curly brackets');
      }
    }

    return issues;
  }

  /**
   * Check for common security anti-patterns
   */
  async checkSecurityPatterns(codeBlock) {
    const issues = [];
    const { code } = codeBlock;

    // Check for potential security issues
    if (code.includes('eval(')) {
      issues.push('Use of eval() function detected');
    }

    if (code.includes('innerHTML') && !code.includes('sanitize')) {
      issues.push('Direct innerHTML usage without sanitization');
    }

    if (code.includes('password') && code.includes('console.log')) {
      issues.push('Potential password logging detected');
    }

    if (code.includes('process.env') && code.includes('console.log')) {
      issues.push('Potential environment variable logging');
    }

    return issues;
  }

  /**
   * Check for performance anti-patterns
   */
  async checkPerformancePatterns(codeBlock) {
    const issues = [];
    const { code } = codeBlock;

    // Check for potential performance issues
    if (code.includes('for') && code.includes('await') && !code.includes('Promise.all')) {
      issues.push('Sequential async operations in loop (consider Promise.all)');
    }

    if (code.includes('forEach') && code.includes('await')) {
      issues.push('Async/await in forEach (consider for...of or Promise.all)');
    }

    return issues;
  }

  /**
   * Calculate overall confidence score
   */
  calculateConfidence(verification) {
    const weights = {
      factual_accuracy: 0.4,
      code_correctness: 0.3,
      security_verified: 0.2,
      challenges_passed: 0.1
    };

    let confidence = 0;
    confidence += verification.factual_accuracy * weights.factual_accuracy;
    confidence += verification.code_correctness * weights.code_correctness;
    confidence += (verification.security_verified ? 1.0 : 0.5) * weights.security_verified;

    // Normalize challenges passed (assuming max 5 challenges)
    const challengeScore = Math.min(verification.challenges_passed / 5, 1.0);
    confidence += challengeScore * weights.challenges_passed;

    // Apply penalty for warnings
    const warningPenalty = Math.min(verification.warnings.length * 0.05, 0.3);
    confidence = Math.max(confidence - warningPenalty, 0.1);

    return confidence;
  }

  /**
   * Calculate verification summary across all proposals
   */
  calculateVerificationSummary(verificationResults) {
    const results = Object.values(verificationResults);

    return {
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
      highestConfidence: Math.max(...results.map(r => r.confidence)),
      lowestConfidence: Math.min(...results.map(r => r.confidence)),
      securityVerified: results.every(r => r.security_verified),
      avgFactualAccuracy: results.reduce((sum, r) => sum + r.factual_accuracy, 0) / results.length,
      avgCodeCorrectness: results.reduce((sum, r) => sum + r.code_correctness, 0) / results.length,
      totalChallengesPassed: results.reduce((sum, r) => sum + r.challenges_passed, 0)
    };
  }

  /**
   * Save verification log
   */
  async saveVerificationLog(question, proposals, verificationResults, summary) {
    const logData = {
      timestamp: new Date().toISOString(),
      question,
      proposalCount: Object.keys(proposals).length,
      verificationResults,
      summary,
      thresholds: this.thresholds
    };

    const logFile = path.join(this.logsDir, `verification_${Date.now()}.json`);
    await fs.writeFile(logFile, JSON.stringify(logData, null, 2));
    console.log(`📁 Verification log saved: ${logFile}`);
  }

  /**
   * Get verification status for a proposal
   */
  getVerificationStatus(verificationResult) {
    if (!verificationResult) {
      return 'not_verified';
    }

    const { confidence, factual_accuracy, code_correctness, security_verified } = verificationResult;

    if (confidence >= 0.9 && factual_accuracy >= this.thresholds.factAccuracy &&
        code_correctness >= this.thresholds.codeCorrectness && security_verified) {
      return 'highly_verified';
    } else if (confidence >= 0.7 && factual_accuracy >= 0.7) {
      return 'verified';
    } else if (confidence >= 0.5) {
      return 'partially_verified';
    } else {
      return 'verification_failed';
    }
  }
}