/**
 * Confidence Scoring System for AI Expert Consensus
 *
 * Provides comprehensive confidence metrics to help users understand
 * when to trust the AI consensus outputs. Integrates multiple factors
 * including model agreement, verification results, and historical accuracy.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ConfidenceScorer {
  constructor() {
    this.historyFile = path.join(__dirname, '..', 'logs', 'confidence-history.json');
    this.categoryMappings = {
      'architecture': ['system design', 'architecture', 'patterns', 'structure'],
      'bug_fix': ['bug', 'error', 'fix', 'debug', 'issue'],
      'optimization': ['optimize', 'performance', 'speed', 'efficiency'],
      'testing': ['test', 'testing', 'unit test', 'integration'],
      'implementation': ['implement', 'code', 'develop', 'create'],
      'documentation': ['document', 'docs', 'readme', 'explain'],
      'deployment': ['deploy', 'production', 'release', 'ci/cd'],
      'security': ['security', 'auth', 'secure', 'vulnerability']
    };

    // Load historical data
    this.loadHistoricalData().catch(console.error);
  }

  /**
   * Calculate comprehensive confidence score for a debate result
   */
  async calculateConfidence(debate) {
    const factors = {
      // Model agreement between responses (40% weight)
      consensus: await this.calculateConsensus(debate.responses || debate.proposals),

      // Verification results if available (30% weight)
      verification: this.calculateVerificationScore(debate),

      // Historical accuracy for this category (20% weight)
      historical: await this.getHistoricalAccuracy(debate.question),

      // Response consistency and quality (10% weight)
      consistency: this.checkConsistency(debate.responses || debate.proposals)
    };

    const weights = {
      consensus: 0.40,
      verification: 0.30,
      historical: 0.20,
      consistency: 0.10
    };

    const overall = this.weightedAverage(factors, weights);
    const percentage = Math.round(overall * 100);

    const result = {
      score: percentage,
      level: this.interpretConfidence(percentage),
      factors: {
        model_agreement: Math.round(factors.consensus * 100),
        verification_passed: Math.round(factors.verification * 100),
        historical_accuracy: Math.round(factors.historical * 100),
        response_consistency: Math.round(factors.consistency * 100)
      },
      weights: {
        model_agreement: Math.round(weights.consensus * 100),
        verification_passed: Math.round(weights.verification * 100),
        historical_accuracy: Math.round(weights.historical * 100),
        response_consistency: Math.round(weights.consistency * 100)
      },
      recommendation: this.getRecommendation(percentage),
      analysis: this.getDetailedAnalysis(factors, percentage),
      thresholds: this.getThresholds()
    };

    // Store this result for historical learning
    await this.storeResult(debate, result);

    return result;
  }

  /**
   * Calculate consensus between model responses using semantic similarity
   */
  async calculateConsensus(responses) {
    if (!responses || Object.keys(responses).length < 2) {
      return 0.3; // Low consensus if insufficient responses
    }

    const responseTexts = Object.values(responses);
    const similarities = [];

    // Calculate pairwise similarities
    for (let i = 0; i < responseTexts.length; i++) {
      for (let j = i + 1; j < responseTexts.length; j++) {
        const similarity = this.semanticSimilarity(responseTexts[i], responseTexts[j]);
        similarities.push(similarity);
      }
    }

    if (similarities.length === 0) return 0.3;

    // Return average similarity
    const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    return Math.min(avgSimilarity, 1.0);
  }

  /**
   * Calculate semantic similarity between two responses
   */
  semanticSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;

    // Normalize texts
    const norm1 = this.normalizeText(text1);
    const norm2 = this.normalizeText(text2);

    // Extract key concepts
    const concepts1 = this.extractKeyConcepts(norm1);
    const concepts2 = this.extractKeyConcepts(norm2);

    // Calculate concept overlap
    const conceptSimilarity = this.calculateConceptOverlap(concepts1, concepts2);

    // Calculate structural similarity
    const structureSimilarity = this.calculateStructuralSimilarity(text1, text2);

    // Calculate length similarity
    const lengthSimilarity = this.calculateLengthSimilarity(text1, text2);

    // Weighted combination
    return (conceptSimilarity * 0.6) + (structureSimilarity * 0.3) + (lengthSimilarity * 0.1);
  }

  /**
   * Normalize text for comparison
   */
  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract key concepts from text
   */
  extractKeyConcepts(text) {
    const words = text.split(' ');
    const concepts = new Set();

    // Technical terms (longer words)
    words.forEach(word => {
      if (word.length > 4 && !this.isCommonWord(word)) {
        concepts.add(word);
      }
    });

    // Code patterns
    const codePatterns = text.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g) || [];
    codePatterns.forEach(pattern => concepts.add(pattern.toLowerCase()));

    return Array.from(concepts);
  }

  /**
   * Check if word is common and should be filtered
   */
  isCommonWord(word) {
    const commonWords = new Set([
      'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know',
      'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
      'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over',
      'such', 'take', 'than', 'them', 'well', 'were', 'your', 'work'
    ]);
    return commonWords.has(word);
  }

  /**
   * Calculate concept overlap between two concept sets
   */
  calculateConceptOverlap(concepts1, concepts2) {
    if (concepts1.length === 0 && concepts2.length === 0) return 1.0;
    if (concepts1.length === 0 || concepts2.length === 0) return 0.0;

    const set1 = new Set(concepts1);
    const set2 = new Set(concepts2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate structural similarity between responses
   */
  calculateStructuralSimilarity(text1, text2) {
    const features1 = this.extractStructuralFeatures(text1);
    const features2 = this.extractStructuralFeatures(text2);

    let similarity = 0;
    let total = 0;

    for (const feature in features1) {
      if (features2[feature] !== undefined) {
        const diff = Math.abs(features1[feature] - features2[feature]);
        const max = Math.max(features1[feature], features2[feature]);
        similarity += max === 0 ? 1 : (1 - diff / max);
      }
      total++;
    }

    return total > 0 ? similarity / total : 0;
  }

  /**
   * Extract structural features from text
   */
  extractStructuralFeatures(text) {
    return {
      codeBlocks: (text.match(/```/g) || []).length / 2,
      headers: (text.match(/^#+\s/gm) || []).length,
      lists: (text.match(/^\s*[-*+]\s/gm) || []).length,
      numberedLists: (text.match(/^\s*\d+\.\s/gm) || []).length,
      paragraphs: text.split('\n\n').length,
      sentences: (text.match(/[.!?]+/g) || []).length
    };
  }

  /**
   * Calculate length similarity
   */
  calculateLengthSimilarity(text1, text2) {
    const len1 = text1.length;
    const len2 = text2.length;

    if (len1 === 0 && len2 === 0) return 1.0;

    const maxLen = Math.max(len1, len2);
    const minLen = Math.min(len1, len2);

    return minLen / maxLen;
  }

  /**
   * Calculate verification score from debate results
   */
  calculateVerificationScore(debate) {
    // Check if verification was performed
    if (debate.verificationScore !== undefined) {
      return debate.verificationScore;
    }

    // Look for verification indicators in the debate
    let score = 0.5; // Default neutral score

    // Check if tests were mentioned or run
    const hasTestingEvidence = this.hasTestingEvidence(debate);
    if (hasTestingEvidence) score += 0.2;

    // Check if code examples were provided
    const hasCodeExamples = this.hasCodeExamples(debate);
    if (hasCodeExamples) score += 0.15;

    // Check if tools were used
    const toolsUsed = debate.toolsUsed || debate.toolsEnabled;
    if (toolsUsed) score += 0.15;

    // Check winner score confidence
    const winnerScore = debate.score || 0;
    if (winnerScore > 0.8) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Check for testing evidence in debate
   */
  hasTestingEvidence(debate) {
    const allText = this.getAllDebateText(debate);
    const testIndicators = [
      /test.*pass/i, /test.*fail/i, /unit test/i, /integration test/i,
      /npm test/i, /jest/i, /mocha/i, /pytest/i, /junit/i
    ];

    return testIndicators.some(pattern => pattern.test(allText));
  }

  /**
   * Check for code examples in debate
   */
  hasCodeExamples(debate) {
    const allText = this.getAllDebateText(debate);
    const codeBlocks = (allText.match(/```[\s\S]*?```/g) || []).length;
    return codeBlocks >= 2; // At least 2 code blocks
  }

  /**
   * Get all text from debate for analysis
   */
  getAllDebateText(debate) {
    let text = debate.question || '';

    if (debate.responses) {
      text += ' ' + Object.values(debate.responses).join(' ');
    }

    if (debate.proposals) {
      text += ' ' + Object.values(debate.proposals).join(' ');
    }

    if (debate.improvements) {
      text += ' ' + Object.values(debate.improvements).join(' ');
    }

    if (debate.solution) {
      text += ' ' + debate.solution;
    }

    return text;
  }

  /**
   * Get historical accuracy for question category
   */
  async getHistoricalAccuracy(question) {
    try {
      const history = await this.loadHistoricalData();
      const category = this.categorizeQuestion(question);

      if (!history.categories[category]) {
        return 0.7; // Default for new categories
      }

      const categoryData = history.categories[category];
      const totalOutcomes = categoryData.successful + categoryData.failed;

      if (totalOutcomes === 0) {
        return 0.7; // Default for categories with no history
      }

      return categoryData.successful / totalOutcomes;
    } catch (error) {
      console.error('Error getting historical accuracy:', error);
      return 0.7; // Default fallback
    }
  }

  /**
   * Categorize question for historical tracking
   */
  categorizeQuestion(question) {
    const questionLower = question.toLowerCase();

    for (const [category, keywords] of Object.entries(this.categoryMappings)) {
      if (keywords.some(keyword => questionLower.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Check response consistency
   */
  checkConsistency(responses) {
    if (!responses || Object.keys(responses).length < 2) {
      return 0.5;
    }

    const responseTexts = Object.values(responses);
    let consistencyScore = 0;

    // Check for contradictions
    const contradictionPenalty = this.detectContradictions(responseTexts);
    consistencyScore = 1.0 - contradictionPenalty;

    // Check for similar conclusions
    const conclusionSimilarity = this.measureConclusionSimilarity(responseTexts);
    consistencyScore = (consistencyScore + conclusionSimilarity) / 2;

    // Check for consistent technical approach
    const approachConsistency = this.measureApproachConsistency(responseTexts);
    consistencyScore = (consistencyScore + approachConsistency) / 2;

    return Math.max(0, Math.min(1, consistencyScore));
  }

  /**
   * Detect contradictions between responses
   */
  detectContradictions(responses) {
    const negationPatterns = [
      /not recommended/i, /should not/i, /avoid/i, /don't use/i,
      /incorrect/i, /wrong/i, /bad practice/i, /anti-pattern/i
    ];

    const recommendations = [];

    responses.forEach(response => {
      const hasNegation = negationPatterns.some(pattern => pattern.test(response));
      recommendations.push(hasNegation ? 'negative' : 'positive');
    });

    // Calculate contradiction ratio
    const positiveCount = recommendations.filter(r => r === 'positive').length;
    const negativeCount = recommendations.filter(r => r === 'negative').length;
    const total = recommendations.length;

    if (total === 0) return 0;

    // Higher penalty for mixed recommendations
    const mixedRatio = Math.min(positiveCount, negativeCount) / total;
    return mixedRatio * 0.5; // Max 50% penalty for full contradiction
  }

  /**
   * Measure similarity in conclusions
   */
  measureConclusionSimilarity(responses) {
    const conclusions = responses.map(response => this.extractConclusion(response));

    if (conclusions.length < 2) return 1.0;

    const similarities = [];
    for (let i = 0; i < conclusions.length; i++) {
      for (let j = i + 1; j < conclusions.length; j++) {
        similarities.push(this.semanticSimilarity(conclusions[i], conclusions[j]));
      }
    }

    return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
  }

  /**
   * Extract conclusion from response
   */
  extractConclusion(response) {
    // Look for conclusion indicators
    const conclusionPatterns = [
      /in conclusion/i, /to summarize/i, /in summary/i, /therefore/i,
      /final.*recommendation/i, /my recommendation/i, /the solution/i
    ];

    for (const pattern of conclusionPatterns) {
      const match = response.match(new RegExp(`${pattern.source}[\\s\\S]*?(?=\\n\\n|$)`, 'i'));
      if (match) {
        return match[0];
      }
    }

    // If no explicit conclusion, use last paragraph
    const paragraphs = response.split('\n\n');
    return paragraphs[paragraphs.length - 1] || response.slice(-500);
  }

  /**
   * Measure consistency in technical approach
   */
  measureApproachConsistency(responses) {
    const approaches = responses.map(response => this.extractTechnicalApproach(response));

    // Count common technical terms
    const allTerms = new Set();
    const termCounts = {};

    approaches.forEach(approach => {
      const terms = this.extractTechnicalTerms(approach);
      terms.forEach(term => {
        allTerms.add(term);
        termCounts[term] = (termCounts[term] || 0) + 1;
      });
    });

    if (allTerms.size === 0) return 0.5;

    // Calculate consistency based on shared terms
    const sharedTerms = Object.values(termCounts).filter(count => count > 1).length;
    return sharedTerms / allTerms.size;
  }

  /**
   * Extract technical approach from response
   */
  extractTechnicalApproach(response) {
    // Extract code blocks and technical paragraphs
    const codeBlocks = response.match(/```[\s\S]*?```/g) || [];
    const technicalParagraphs = response.match(/\b(?:use|implement|create|configure|setup|install)[^.]*\./gi) || [];

    return codeBlocks.join(' ') + ' ' + technicalParagraphs.join(' ');
  }

  /**
   * Extract technical terms from text
   */
  extractTechnicalTerms(text) {
    const terms = new Set();

    // Function names, class names, etc.
    const identifiers = text.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\(/g) || [];
    identifiers.forEach(id => terms.add(id.toLowerCase()));

    // Framework/library names
    const frameworks = text.match(/\b(?:react|vue|angular|express|django|flask|spring)\b/gi) || [];
    frameworks.forEach(fw => terms.add(fw.toLowerCase()));

    // Technology terms
    const techTerms = text.match(/\b(?:api|rest|graphql|database|sql|nosql|redis|mongodb|postgres)\b/gi) || [];
    techTerms.forEach(term => terms.add(term.toLowerCase()));

    return Array.from(terms);
  }

  /**
   * Calculate weighted average of factors
   */
  weightedAverage(factors, weights) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [factor, value] of Object.entries(factors)) {
      if (weights[factor] && value !== undefined) {
        weightedSum += value * weights[factor];
        totalWeight += weights[factor];
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Interpret confidence percentage into human-readable level
   */
  interpretConfidence(percentage) {
    if (percentage >= 90) return 'Very High Confidence';
    if (percentage >= 75) return 'High Confidence';
    if (percentage >= 60) return 'Moderate Confidence';
    if (percentage >= 40) return 'Low Confidence';
    return 'Very Low Confidence';
  }

  /**
   * Get actionable recommendation based on confidence level
   */
  getRecommendation(percentage) {
    if (percentage >= 90) {
      return 'Safe to implement with minimal review. High reliability indicated.';
    }
    if (percentage >= 75) {
      return 'Implement with standard code review. Good consensus achieved.';
    }
    if (percentage >= 60) {
      return 'Careful review required. Consider additional verification or expert consultation.';
    }
    if (percentage >= 40) {
      return 'Manual verification strongly recommended. Significant uncertainty detected.';
    }
    return 'Do not implement without expert review. Consider re-running consensus or seeking human expertise.';
  }

  /**
   * Get detailed analysis of confidence factors
   */
  getDetailedAnalysis(factors, percentage) {
    const analysis = {
      summary: this.getAnalysisSummary(factors, percentage),
      strengths: [],
      concerns: [],
      suggestions: []
    };

    // Analyze each factor
    if (factors.consensus >= 0.8) {
      analysis.strengths.push('Strong agreement between AI models');
    } else if (factors.consensus <= 0.4) {
      analysis.concerns.push('Significant disagreement between models');
      analysis.suggestions.push('Consider re-running with different prompts or additional models');
    }

    if (factors.verification >= 0.8) {
      analysis.strengths.push('High verification confidence with evidence');
    } else if (factors.verification <= 0.4) {
      analysis.concerns.push('Limited verification evidence');
      analysis.suggestions.push('Run additional tests or verification steps');
    }

    if (factors.historical >= 0.8) {
      analysis.strengths.push('Strong historical performance in this category');
    } else if (factors.historical <= 0.4) {
      analysis.concerns.push('Lower historical accuracy for this type of question');
      analysis.suggestions.push('Extra caution recommended based on historical data');
    }

    if (factors.consistency >= 0.8) {
      analysis.strengths.push('Highly consistent responses across models');
    } else if (factors.consistency <= 0.4) {
      analysis.concerns.push('Inconsistent approaches or conclusions detected');
      analysis.suggestions.push('Review for contradictions and resolve conflicts');
    }

    return analysis;
  }

  /**
   * Get analysis summary
   */
  getAnalysisSummary(factors, percentage) {
    if (percentage >= 90) {
      return 'Exceptional confidence with strong consensus, verification, and historical support.';
    }
    if (percentage >= 75) {
      return 'High confidence with good agreement and verification. Minor uncertainties present.';
    }
    if (percentage >= 60) {
      return 'Moderate confidence with some concerns. Additional review recommended.';
    }
    if (percentage >= 40) {
      return 'Low confidence with significant concerns. Manual verification required.';
    }
    return 'Very low confidence with major concerns. Expert review essential.';
  }

  /**
   * Get confidence thresholds for reference
   */
  getThresholds() {
    return {
      very_high: { min: 90, max: 100, action: 'Safe to implement', review: 'Minimal' },
      high: { min: 75, max: 89, action: 'Standard implementation', review: 'Normal' },
      moderate: { min: 60, max: 74, action: 'Careful implementation', review: 'Thorough' },
      low: { min: 40, max: 59, action: 'Manual verification', review: 'Expert' },
      very_low: { min: 0, max: 39, action: 'Do not implement', review: 'Required' }
    };
  }

  /**
   * Load historical accuracy data
   */
  async loadHistoricalData() {
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Initialize empty history
      const emptyHistory = {
        categories: {},
        totalOutcomes: 0,
        lastUpdated: Date.now()
      };
      await this.saveHistoricalData(emptyHistory);
      return emptyHistory;
    }
  }

  /**
   * Save historical accuracy data
   */
  async saveHistoricalData(data) {
    try {
      await fs.mkdir(path.dirname(this.historyFile), { recursive: true });
      await fs.writeFile(this.historyFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving historical data:', error);
    }
  }

  /**
   * Store result for historical learning
   */
  async storeResult(debate, confidenceResult) {
    try {
      const history = await this.loadHistoricalData();
      const category = this.categorizeQuestion(debate.question);

      if (!history.categories[category]) {
        history.categories[category] = {
          successful: 0,
          failed: 0,
          totalConfidence: 0,
          totalQuestions: 0
        };
      }

      const categoryData = history.categories[category];
      categoryData.totalQuestions++;
      categoryData.totalConfidence += confidenceResult.score;

      // For now, assume successful unless explicitly marked as failed
      // This could be enhanced with user feedback or verification results
      const isSuccessful = confidenceResult.score >= 60; // Threshold for success

      if (isSuccessful) {
        categoryData.successful++;
      } else {
        categoryData.failed++;
      }

      history.totalOutcomes++;
      history.lastUpdated = Date.now();

      await this.saveHistoricalData(history);
    } catch (error) {
      console.error('Error storing confidence result:', error);
    }
  }

  /**
   * Get confidence trends and statistics
   */
  async getConfidenceStats() {
    try {
      const history = await this.loadHistoricalData();
      const stats = {
        totalQuestions: history.totalOutcomes,
        categories: {},
        overall: {
          averageConfidence: 0,
          successRate: 0
        }
      };

      let totalConfidence = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;

      for (const [category, data] of Object.entries(history.categories)) {
        const total = data.successful + data.failed;
        stats.categories[category] = {
          total: data.totalQuestions,
          successRate: total > 0 ? data.successful / total : 0,
          averageConfidence: data.totalQuestions > 0 ? data.totalConfidence / data.totalQuestions : 0
        };

        totalConfidence += data.totalConfidence;
        totalSuccessful += data.successful;
        totalFailed += data.failed;
      }

      const overallTotal = totalSuccessful + totalFailed;
      stats.overall = {
        averageConfidence: history.totalOutcomes > 0 ? totalConfidence / history.totalOutcomes : 0,
        successRate: overallTotal > 0 ? totalSuccessful / overallTotal : 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting confidence stats:', error);
      return null;
    }
  }
}

export { ConfidenceScorer };