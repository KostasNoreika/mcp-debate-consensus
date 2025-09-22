/**
 * Adversarial Tester Module
 *
 * Implements adversarial testing where models actively try to find flaws,
 * edge cases, and vulnerabilities in other models' proposals.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class AdversarialTester {
  constructor(models = []) {
    this.models = models;
    this.timeout = 90000; // 90 seconds for adversarial testing

    // Define adversarial challenges
    this.challenges = [
      {
        name: 'Security Vulnerability Hunt',
        description: 'Find security weaknesses and attack vectors',
        severity: 'high',
        requiredModels: ['k2', 'k4'] // GPT-5 and Gemini for security testing
      },
      {
        name: 'Edge Case Discovery',
        description: 'Identify edge cases and boundary conditions',
        severity: 'medium',
        requiredModels: ['k1', 'k3'] // Claude and Qwen for logical analysis
      },
      {
        name: 'Performance Stress Test',
        description: 'Find performance bottlenecks and scalability issues',
        severity: 'medium',
        requiredModels: ['k3', 'k5'] // Qwen and Grok for optimization
      },
      {
        name: 'Logic Error Detection',
        description: 'Hunt for logical inconsistencies and errors',
        severity: 'high',
        requiredModels: ['k1', 'k2'] // Claude and GPT-5 for logic analysis
      },
      {
        name: 'Integration Failure Points',
        description: 'Find integration issues and dependency problems',
        severity: 'medium',
        requiredModels: ['k4'] // Gemini for integration testing
      }
    ];
  }

  async initialize() {
    console.log(`⚔️ Adversarial tester initialized with ${this.challenges.length} challenge types`);
  }

  /**
   * Run adversarial testing on a proposal
   */
  async testProposal(proposal, question, options = {}) {
    const { excludeModel, projectPath = process.cwd() } = options;

    console.log(`    ⚔️ Running adversarial tests (excluding ${excludeModel})...`);

    // Select available adversarial models
    const adversarialModels = this.models.filter(model =>
      model.name !== excludeModel && model.alias !== excludeModel
    );

    if (adversarialModels.length === 0) {
      console.log(`    ⚠️ No adversarial models available`);
      return {
        challengesPassed: 0,
        securityVerified: false,
        warnings: ['No models available for adversarial testing'],
        results: []
      };
    }

    const testResults = [];
    let totalChallengesPassed = 0;
    let securityVerified = true;
    const warnings = [];

    // Run each challenge type
    for (const challenge of this.challenges) {
      try {
        console.log(`      🎯 Challenge: ${challenge.name}...`);

        const challengeResult = await this.runChallenge(
          challenge,
          proposal,
          question,
          adversarialModels,
          projectPath
        );

        testResults.push(challengeResult);

        if (challengeResult.passed) {
          totalChallengesPassed++;
          console.log(`      ✅ ${challenge.name}: PASSED`);
        } else {
          console.log(`      ❌ ${challenge.name}: FAILED - ${challengeResult.issues.length} issues found`);
          warnings.push(...challengeResult.issues.map(issue =>
            `${challenge.name}: ${issue}`
          ));

          // Security challenges affect security verification
          if (challenge.severity === 'high' && challenge.name.includes('Security')) {
            securityVerified = false;
          }
        }

      } catch (error) {
        console.log(`      ❌ ${challenge.name}: ERROR - ${error.message}`);
        warnings.push(`${challenge.name}: Testing failed - ${error.message}`);
        testResults.push({
          challenge: challenge.name,
          passed: false,
          issues: [`Testing failed: ${error.message}`],
          model: 'error',
          confidence: 0.1
        });
      }
    }

    const summary = {
      challengesPassed: totalChallengesPassed,
      totalChallenges: this.challenges.length,
      securityVerified,
      warnings,
      results: testResults
    };

    console.log(`    📊 Adversarial testing: ${totalChallengesPassed}/${this.challenges.length} challenges passed`);

    return summary;
  }

  /**
   * Run a specific adversarial challenge
   */
  async runChallenge(challenge, proposal, question, adversarialModels, projectPath) {
    // Select best model for this challenge
    const availableModels = adversarialModels.filter(model =>
      challenge.requiredModels.includes(model.alias)
    );

    const selectedModel = availableModels.length > 0 ?
      availableModels[0] : adversarialModels[0];

    if (!selectedModel) {
      throw new Error(`No suitable model available for ${challenge.name}`);
    }

    const challengePrompt = this.buildChallengePrompt(challenge, proposal, question);

    try {
      const response = await this.callModel(selectedModel, challengePrompt, projectPath);
      return this.parseChallengeResponse(challenge, response, selectedModel.alias);
    } catch (error) {
      throw new Error(`Challenge ${challenge.name} failed: ${error.message}`);
    }
  }

  /**
   * Build adversarial challenge prompt
   */
  buildChallengePrompt(challenge, proposal, question) {
    const basePrompt = `You are an adversarial tester. Your job is to find flaws in this solution.

CHALLENGE: ${challenge.name}
DESCRIPTION: ${challenge.description}
SEVERITY: ${challenge.severity}

ORIGINAL QUESTION:
${question}

SOLUTION TO ATTACK:
${proposal}

YOUR MISSION: ${challenge.description}`;

    // Add challenge-specific instructions
    switch (challenge.name) {
      case 'Security Vulnerability Hunt':
        return `${basePrompt}

SECURITY ATTACK VECTORS TO TEST:
1. Input validation bypasses
2. Authentication/authorization flaws
3. Injection vulnerabilities (SQL, XSS, etc.)
4. Data exposure risks
5. Privilege escalation opportunities
6. Cryptographic weaknesses
7. Session management issues
8. API security flaws

TOOLS AVAILABLE:
- Read code files to understand implementation
- Check configuration files for security settings
- Analyze dependencies for known vulnerabilities
- Test input validation logic

RESPONSE FORMAT:
{
  "vulnerabilities_found": [
    {
      "type": "SQL Injection",
      "location": "user input handler",
      "severity": "critical",
      "description": "User input is not sanitized before SQL query",
      "exploit_scenario": "Attacker could extract entire database",
      "remediation": "Use parameterized queries"
    }
  ],
  "security_score": 0.3,
  "overall_assessment": "Critical security flaws found"
}

Be thorough and aggressive in finding security issues.`;

      case 'Edge Case Discovery':
        return `${basePrompt}

EDGE CASES TO EXPLORE:
1. Boundary value conditions (min/max inputs)
2. Empty/null inputs
3. Extremely large inputs
4. Invalid data types
5. Concurrent access scenarios
6. Network failure conditions
7. Resource exhaustion
8. Timing-dependent issues

RESPONSE FORMAT:
{
  "edge_cases_found": [
    {
      "scenario": "Empty input array",
      "issue": "Code crashes with null pointer exception",
      "impact": "Application failure",
      "test_case": "processArray([])"
    }
  ],
  "robustness_score": 0.7,
  "overall_assessment": "Solution handles most edge cases well"
}

Think of unusual, unexpected scenarios that could break the solution.`;

      case 'Performance Stress Test':
        return `${basePrompt}

PERFORMANCE ATTACK VECTORS:
1. Large data volumes
2. Complex computational scenarios
3. Memory usage patterns
4. CPU-intensive operations
5. I/O bottlenecks
6. Database query efficiency
7. Caching effectiveness
8. Scalability limits

RESPONSE FORMAT:
{
  "performance_issues": [
    {
      "scenario": "Processing 1M records",
      "issue": "Linear search causes exponential slowdown",
      "impact": "Timeout after 30 seconds",
      "optimization": "Use hash table for O(1) lookup"
    }
  ],
  "performance_score": 0.6,
  "overall_assessment": "Good for small scale, issues at enterprise scale"
}

Focus on scalability and performance bottlenecks.`;

      case 'Logic Error Detection':
        return `${basePrompt}

LOGICAL FLAWS TO HUNT:
1. Algorithm correctness
2. Control flow errors
3. State management issues
4. Race conditions
5. Deadlock potential
6. Data consistency problems
7. Business logic violations
8. Mathematical errors

RESPONSE FORMAT:
{
  "logic_errors": [
    {
      "type": "Off-by-one error",
      "location": "loop iteration",
      "description": "Array access beyond bounds",
      "consequence": "Runtime error or incorrect results"
    }
  ],
  "logic_score": 0.8,
  "overall_assessment": "Logic is mostly sound with minor issues"
}

Scrutinize every logical assumption and flow.`;

      case 'Integration Failure Points':
        return `${basePrompt}

INTEGRATION VULNERABILITIES:
1. API compatibility issues
2. Data format mismatches
3. Version dependency conflicts
4. Service availability assumptions
5. Error propagation problems
6. Transaction boundary issues
7. Timeout handling
8. Fallback mechanism gaps

RESPONSE FORMAT:
{
  "integration_issues": [
    {
      "component": "Payment Gateway API",
      "issue": "No timeout configured",
      "impact": "Hanging requests in production",
      "solution": "Add 30-second timeout with retry logic"
    }
  ],
  "integration_score": 0.5,
  "overall_assessment": "Several integration risks identified"
}

Look for ways external dependencies could fail the system.`;

      default:
        return `${basePrompt}

Find any flaws, weaknesses, or issues in this solution.

RESPONSE FORMAT:
{
  "issues_found": [
    {
      "category": "general",
      "description": "Issue description",
      "severity": "medium",
      "impact": "Potential impact"
    }
  ],
  "confidence": 0.8,
  "overall_assessment": "Assessment summary"
}`;
    }
  }

  /**
   * Call model for adversarial testing
   */
  async callModel(model, prompt, projectPath) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Adversarial test timeout after ${this.timeout}ms`));
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
          reject(new Error(`Adversarial test process exited with code ${code}: ${errorOutput}`));
          return;
        }

        resolve(output);
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn adversarial tester: ${error.message}`));
      });

      // Send the prompt
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  /**
   * Parse adversarial challenge response
   */
  parseChallengeResponse(challenge, response, modelAlias) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        return this.formatChallengeResult(challenge, parsed, modelAlias);
      }

      // Fallback: parse text response
      return this.parseTextChallengeResponse(challenge, response, modelAlias);

    } catch (error) {
      console.log(`    ⚠️ Failed to parse challenge response: ${error.message}`);
      return this.parseTextChallengeResponse(challenge, response, modelAlias);
    }
  }

  /**
   * Format challenge result from parsed JSON
   */
  formatChallengeResult(challenge, parsed, modelAlias) {
    const issues = [];
    let confidence = 0.7;

    // Extract issues based on challenge type
    if (parsed.vulnerabilities_found) {
      issues.push(...parsed.vulnerabilities_found.map(v =>
        `${v.type}: ${v.description} (${v.severity})`
      ));
      confidence = 1.0 - (parsed.security_score || 0.5);
    } else if (parsed.edge_cases_found) {
      issues.push(...parsed.edge_cases_found.map(e =>
        `${e.scenario}: ${e.issue}`
      ));
      confidence = 1.0 - (parsed.robustness_score || 0.7);
    } else if (parsed.performance_issues) {
      issues.push(...parsed.performance_issues.map(p =>
        `${p.scenario}: ${p.issue}`
      ));
      confidence = 1.0 - (parsed.performance_score || 0.6);
    } else if (parsed.logic_errors) {
      issues.push(...parsed.logic_errors.map(l =>
        `${l.type}: ${l.description}`
      ));
      confidence = 1.0 - (parsed.logic_score || 0.8);
    } else if (parsed.integration_issues) {
      issues.push(...parsed.integration_issues.map(i =>
        `${i.component}: ${i.issue}`
      ));
      confidence = 1.0 - (parsed.integration_score || 0.5);
    } else if (parsed.issues_found) {
      issues.push(...parsed.issues_found.map(i =>
        `${i.category}: ${i.description}`
      ));
      confidence = parsed.confidence || 0.7;
    }

    return {
      challenge: challenge.name,
      passed: issues.length === 0,
      issues: issues.slice(0, 10), // Limit issues
      model: modelAlias,
      confidence,
      assessment: parsed.overall_assessment || 'Assessment not provided'
    };
  }

  /**
   * Parse text-based challenge response
   */
  parseTextChallengeResponse(challenge, response, modelAlias) {
    const issues = [];
    const lines = response.split('\n');

    // Look for issue indicators
    const issuePatterns = [
      /vulnerability|exploit|attack|security flaw/i,
      /bug|error|flaw|problem|issue/i,
      /performance|slow|bottleneck|inefficient/i,
      /edge case|boundary|limit|fail/i,
      /integration|dependency|compatibility/i
    ];

    for (const line of lines) {
      if (issuePatterns.some(pattern => pattern.test(line))) {
        // Skip lines that seem positive
        if (!/good|correct|proper|well|no issues|secure/.test(line.toLowerCase())) {
          issues.push(line.trim());
        }
      }
    }

    // Estimate confidence based on issues found
    let confidence = 0.7;
    if (issues.length === 0) {
      confidence = 0.9; // High confidence if no issues found
    } else if (issues.length <= 2) {
      confidence = 0.6;
    } else {
      confidence = 0.4;
    }

    return {
      challenge: challenge.name,
      passed: issues.length === 0,
      issues: issues.slice(0, 10), // Limit issues
      model: modelAlias,
      confidence,
      assessment: `Text analysis found ${issues.length} potential issues`
    };
  }

  /**
   * Generate adversarial test report
   */
  generateTestReport(testResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChallenges: testResults.totalChallenges,
        challengesPassed: testResults.challengesPassed,
        passRate: testResults.challengesPassed / testResults.totalChallenges,
        securityVerified: testResults.securityVerified,
        totalWarnings: testResults.warnings.length
      },
      challenges: testResults.results,
      recommendations: this.generateRecommendations(testResults)
    };

    return report;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(testResults) {
    const recommendations = [];

    // Security recommendations
    const securityIssues = testResults.results
      .filter(r => r.challenge.includes('Security'))
      .reduce((sum, r) => sum + r.issues.length, 0);

    if (securityIssues > 0) {
      recommendations.push({
        category: 'Security',
        priority: 'High',
        recommendation: 'Address security vulnerabilities before deployment',
        details: `${securityIssues} security issues found`
      });
    }

    // Performance recommendations
    const performanceIssues = testResults.results
      .filter(r => r.challenge.includes('Performance'))
      .reduce((sum, r) => sum + r.issues.length, 0);

    if (performanceIssues > 0) {
      recommendations.push({
        category: 'Performance',
        priority: 'Medium',
        recommendation: 'Optimize performance bottlenecks',
        details: `${performanceIssues} performance issues identified`
      });
    }

    // Logic recommendations
    const logicIssues = testResults.results
      .filter(r => r.challenge.includes('Logic'))
      .reduce((sum, r) => sum + r.issues.length, 0);

    if (logicIssues > 0) {
      recommendations.push({
        category: 'Logic',
        priority: 'High',
        recommendation: 'Review and fix logical errors',
        details: `${logicIssues} logic issues detected`
      });
    }

    return recommendations;
  }
}