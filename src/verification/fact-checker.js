/**
 * Fact Checker Module
 *
 * Implements fact checking logic where models verify technical accuracy
 * of other models' proposals through systematic analysis.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class FactChecker {
  constructor(models = []) {
    this.models = models;
    this.timeout = 60000; // 60 seconds timeout for fact checking
  }

  async initialize() {
    // Verify models are available
    console.log(`🔍 Fact checker initialized with ${this.models.length} models`);
  }

  /**
   * Check facts in a proposal using multiple models
   */
  async checkFacts(proposal, question, options = {}) {
    const { excludeModel, projectPath = process.cwd() } = options;

    console.log(`    🔍 Fact checking proposal (excluding ${excludeModel})...`);

    // Select verifier models (exclude the original proposer)
    const verifiers = this.models.filter(model =>
      model.name !== excludeModel && model.alias !== excludeModel
    );

    if (verifiers.length === 0) {
      console.log(`    ⚠️ No verifier models available`);
      return {
        accuracy: 0.8, // Default when no verification possible
        warnings: ['No models available for verification'],
        verifications: []
      };
    }

    // Select top 2-3 verifiers for efficiency
    const selectedVerifiers = verifiers.slice(0, Math.min(3, verifiers.length));
    console.log(`    📊 Using ${selectedVerifiers.length} verifiers: ${selectedVerifiers.map(v => v.alias).join(', ')}`);

    const verifications = [];

    for (const verifier of selectedVerifiers) {
      try {
        console.log(`      🤖 ${verifier.alias} fact-checking...`);
        const verification = await this.runFactCheck(verifier, proposal, question, projectPath);
        verifications.push({
          model: verifier.alias,
          ...verification
        });
        console.log(`      ✅ ${verifier.alias}: ${verification.issues.length} issues found`);
      } catch (error) {
        console.log(`      ❌ ${verifier.alias} fact check failed: ${error.message}`);
        verifications.push({
          model: verifier.alias,
          accuracy: 0.5,
          issues: [`Verification failed: ${error.message}`],
          confidence: 0.3
        });
      }
    }

    // Aggregate results
    const aggregated = this.aggregateFactChecks(verifications);

    console.log(`    📊 Fact check complete: ${(aggregated.accuracy * 100).toFixed(1)}% accuracy`);

    return aggregated;
  }

  /**
   * Run fact check using a specific model
   */
  async runFactCheck(verifierModel, proposal, question, projectPath) {
    const factCheckPrompt = this.buildFactCheckPrompt(proposal, question);

    try {
      const response = await this.callModel(verifierModel, factCheckPrompt, projectPath);
      return this.parseFactCheckResponse(response);
    } catch (error) {
      throw new Error(`Fact check failed: ${error.message}`);
    }
  }

  /**
   * Build fact checking prompt
   */
  buildFactCheckPrompt(proposal, question) {
    return `You are a technical fact checker. Analyze this solution proposal for accuracy and correctness.

ORIGINAL QUESTION:
${question}

SOLUTION TO VERIFY:
${proposal}

FACT CHECK REQUIREMENTS:
Please systematically verify:

1. TECHNICAL ACCURACY
   - Are the technical claims correct?
   - Are the APIs/methods used properly?
   - Are the data structures appropriate?
   - Are the algorithms sound?

2. SECURITY ISSUES
   - Any security vulnerabilities?
   - Proper input validation?
   - Authentication/authorization handled?
   - Sensitive data exposure risks?

3. LOGIC ERRORS
   - Does the logic flow make sense?
   - Are edge cases handled?
   - Any potential race conditions?
   - Error handling adequate?

4. COMPLETENESS
   - Does it fully address the question?
   - Are there missing components?
   - Dependencies properly handled?

5. BEST PRACTICES
   - Follows coding standards?
   - Performance considerations?
   - Maintainability issues?

RESPONSE FORMAT:
Provide your analysis in this JSON format:
{
  "accuracy_score": 0.85,
  "confidence": 0.90,
  "issues": [
    {
      "category": "security",
      "severity": "high",
      "issue": "SQL injection vulnerability",
      "location": "line 15",
      "recommendation": "Use parameterized queries"
    }
  ],
  "strengths": [
    "Good error handling",
    "Clear code structure"
  ],
  "overall_assessment": "The solution is technically sound but has critical security issues that must be addressed."
}

Focus on being thorough but concise. Only flag real issues, not stylistic preferences.`;
  }

  /**
   * Call model for fact checking
   */
  async callModel(model, prompt, projectPath) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Fact check timeout after ${this.timeout}ms`));
      }, this.timeout);

      const child = spawn(model.wrapper, [], {
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(new Error(`Fact check process exited with code ${code}: ${errorOutput}`));
          return;
        }

        resolve(output);
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn fact checker: ${error.message}`));
      });

      // Send the prompt
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  /**
   * Parse fact check response from model
   */
  parseFactCheckResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        return {
          accuracy: parsed.accuracy_score || 0.7,
          confidence: parsed.confidence || 0.7,
          issues: parsed.issues || [],
          strengths: parsed.strengths || [],
          assessment: parsed.overall_assessment || 'Assessment not provided'
        };
      }

      // Fallback: parse text response
      return this.parseTextFactCheck(response);

    } catch (error) {
      console.log(`    ⚠️ Failed to parse fact check response: ${error.message}`);
      return this.parseTextFactCheck(response);
    }
  }

  /**
   * Parse text-based fact check response
   */
  parseTextFactCheck(response) {
    const issues = [];
    const strengths = [];
    let accuracy = 0.7; // Default

    // Look for common issue indicators
    const issuePatterns = [
      { pattern: /security|vulnerable|exploit/i, category: 'security', severity: 'high' },
      { pattern: /error|bug|wrong|incorrect/i, category: 'logic', severity: 'medium' },
      { pattern: /performance|slow|inefficient/i, category: 'performance', severity: 'low' },
      { pattern: /missing|incomplete|lacks/i, category: 'completeness', severity: 'medium' }
    ];

    const lines = response.split('\n');

    for (const line of lines) {
      for (const { pattern, category, severity } of issuePatterns) {
        if (pattern.test(line) && !line.toLowerCase().includes('good') && !line.toLowerCase().includes('correct')) {
          issues.push({
            category,
            severity,
            issue: line.trim(),
            location: 'unspecified',
            recommendation: 'Review and address this issue'
          });
          break;
        }
      }

      // Look for positive mentions
      if (/good|correct|proper|well|excellent/i.test(line)) {
        strengths.push(line.trim());
      }
    }

    // Estimate accuracy based on issues found
    if (issues.length === 0) {
      accuracy = 0.9;
    } else if (issues.length <= 2) {
      accuracy = 0.7;
    } else if (issues.length <= 5) {
      accuracy = 0.5;
    } else {
      accuracy = 0.3;
    }

    return {
      accuracy,
      confidence: 0.6, // Lower confidence for text parsing
      issues: issues.slice(0, 10), // Limit to top 10 issues
      strengths: strengths.slice(0, 5), // Limit to top 5 strengths
      assessment: `Found ${issues.length} potential issues. ${issues.length === 0 ? 'Solution appears technically sound.' : 'Review recommended.'}`
    };
  }

  /**
   * Aggregate multiple fact check results
   */
  aggregateFactChecks(verifications) {
    if (verifications.length === 0) {
      return {
        accuracy: 0.5,
        warnings: ['No fact checks completed'],
        verifications: []
      };
    }

    // Calculate weighted accuracy
    const totalConfidence = verifications.reduce((sum, v) => sum + (v.confidence || 0.5), 0);
    const weightedAccuracy = verifications.reduce((sum, v) => {
      const weight = (v.confidence || 0.5) / totalConfidence;
      return sum + ((v.accuracy || 0.5) * weight);
    }, 0);

    // Collect all unique issues
    const allIssues = [];
    const issueSet = new Set();

    for (const verification of verifications) {
      for (const issue of verification.issues || []) {
        const issueKey = typeof issue === 'string' ? issue :
                        `${issue.category || 'unknown'}: ${issue.issue || issue}`;

        if (!issueSet.has(issueKey)) {
          issueSet.add(issueKey);
          allIssues.push(typeof issue === 'string' ? issue :
                        `${verification.model}: ${issue.issue || issue}`);
        }
      }
    }

    // Determine overall confidence
    const avgConfidence = verifications.reduce((sum, v) => sum + (v.confidence || 0.5), 0) / verifications.length;

    return {
      accuracy: Math.max(Math.min(weightedAccuracy, 1.0), 0.0),
      warnings: allIssues.slice(0, 20), // Limit warnings
      verifications,
      confidence: avgConfidence,
      verifierCount: verifications.length
    };
  }
}