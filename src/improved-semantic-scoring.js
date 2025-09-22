/**
 * Improved Semantic Scoring Algorithm
 * Score = 0.4*Relevance + 0.2*Novelty + 0.2*Quality + 0.2*Coherence
 * 
 * Uses keyword-based semantic similarity (simulating embeddings until we have a real API)
 */

class ImprovedSemanticScoring {
  constructor() {
    // Weights based on consensus from all models
    this.weights = {
      relevance: 0.4,  // How well it answers the question
      novelty: 0.2,    // How different from other responses
      quality: 0.2,    // Technical quality and insight  
      coherence: 0.2   // Logical structure and flow
    };
  }

  /**
   * Calculate comprehensive semantic score for a response
   */
  calculateScore(response, question, previousResponses = []) {
    const relevance = this.calculateRelevance(response, question);
    const novelty = this.calculateNovelty(response, previousResponses);
    const quality = this.calculateQuality(response);
    const coherence = this.calculateCoherence(response);
    
    const totalScore = (
      relevance * this.weights.relevance +
      novelty * this.weights.novelty +
      quality * this.weights.quality +
      coherence * this.weights.coherence
    );

    return {
      total: Math.round(totalScore * 1000) / 10, // Scale to 0-100 with 1 decimal
      components: {
        relevance: Math.round(relevance * 100) / 100,
        novelty: Math.round(novelty * 100) / 100,  
        quality: Math.round(quality * 100) / 100,
        coherence: Math.round(coherence * 100) / 100
      },
      breakdown: {
        relevance: `${Math.round(relevance * 100)}% (weight: ${this.weights.relevance})`,
        novelty: `${Math.round(novelty * 100)}% (weight: ${this.weights.novelty})`,
        quality: `${Math.round(quality * 100)}% (weight: ${this.weights.quality})`,
        coherence: `${Math.round(coherence * 100)}% (weight: ${this.weights.coherence})`
      }
    };
  }

  /**
   * Calculate semantic relevance to the original question
   * Uses keyword overlap and contextual indicators
   */
  calculateRelevance(response, question) {
    const questionWords = this.extractKeywords(question.toLowerCase());
    const responseWords = this.extractKeywords(response.toLowerCase());
    
    // Direct keyword overlap
    let overlap = 0;
    for (const word of questionWords) {
      if (responseWords.includes(word)) {
        overlap++;
      }
    }
    const keywordRelevance = Math.min(overlap / questionWords.length, 1.0);
    
    // Contextual relevance indicators
    const contextScore = this.assessContextualRelevance(response, question);
    
    // Answer structure indicators
    const structureScore = this.assessAnswerStructure(response);
    
    // Combine with weights
    return (keywordRelevance * 0.5 + contextScore * 0.3 + structureScore * 0.2);
  }

  /**
   * Calculate novelty by comparing against previous responses
   */
  calculateNovelty(response, previousResponses) {
    if (previousResponses.length === 0) {
      return 1.0; // First response is 100% novel
    }

    const responseKeywords = this.extractKeywords(response.toLowerCase());
    let maxSimilarity = 0;
    
    for (const prevResponse of previousResponses) {
      const prevKeywords = this.extractKeywords(prevResponse.toLowerCase());
      const similarity = this.calculateKeywordSimilarity(responseKeywords, prevKeywords);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    // Novelty is inverse of maximum similarity
    const novelty = 1.0 - maxSimilarity;
    
    // Bonus for introducing new concepts
    const conceptBonus = this.assessNewConcepts(response, previousResponses);
    
    return Math.min(novelty + conceptBonus * 0.2, 1.0);
  }

  /**
   * Calculate technical quality and insight depth
   */
  calculateQuality(response) {
    let qualityScore = 0;
    
    // Code examples with explanations (high value)
    const codeBlocks = (response.match(/```[\s\S]*?```/g) || []).length;
    const hasCodeExplanation = /this (code|function|implementation|example)/i.test(response);
    if (codeBlocks > 0 && hasCodeExplanation) {
      qualityScore += 0.25;
    } else if (codeBlocks > 0) {
      qualityScore += 0.15;
    }
    
    // Specific examples and concrete details
    if (/for example|specifically|such as|e\.g\.|i\.e\./gi.test(response)) {
      qualityScore += 0.15;
    }
    
    // Evidence of critical thinking
    if (/because|therefore|however|although|while|whereas|on the other hand/gi.test(response)) {
      qualityScore += 0.15;
    }
    
    // Problem-solving approach
    if (/solution|approach|strategy|method|technique/gi.test(response)) {
      qualityScore += 0.1;
    }
    
    // Best practices and professional knowledge
    if (/best practice|recommended|should consider|important to note|caveat|limitation|trade-?off/gi.test(response)) {
      qualityScore += 0.15;
    }
    
    // Structured thinking
    const hasStructure = /\d+\.|first|second|third|finally|step \d+|stage \d+/gi.test(response);
    if (hasStructure) {
      qualityScore += 0.1;
    }
    
    // Technical depth
    const technicalTerms = this.countTechnicalTerms(response);
    qualityScore += Math.min(technicalTerms / 20, 0.15); // Max 0.15 for technical terms
    
    return Math.min(qualityScore, 1.0);
  }

  /**
   * Calculate logical coherence and flow
   */
  calculateCoherence(response) {
    let coherenceScore = 0;
    
    // Sentence structure and transitions
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) return 0;
    
    // Check for logical flow indicators
    const transitionWords = /^(however|therefore|additionally|furthermore|moreover|consequently|thus|hence|specifically|for example|in contrast|similarly|meanwhile|subsequently|finally)/i;
    
    let transitionCount = 0;
    sentences.forEach(sentence => {
      if (transitionWords.test(sentence.trim())) {
        transitionCount++;
      }
    });
    
    const transitionScore = Math.min(transitionCount / (sentences.length * 0.3), 1.0);
    coherenceScore += transitionScore * 0.3;
    
    // Paragraph structure (headers, sections)
    const hasHeaders = /^#{1,4}\s+/gm.test(response);
    if (hasHeaders) coherenceScore += 0.2;
    
    // List structure
    const hasBullets = /^\s*[-*]\s+/gm.test(response);
    const hasNumbers = /^\s*\d+\.\s+/gm.test(response);
    if (hasBullets || hasNumbers) coherenceScore += 0.15;
    
    // Consistent formatting
    const codeBlocks = (response.match(/```/g) || []).length;
    if (codeBlocks > 0 && codeBlocks % 2 === 0) coherenceScore += 0.1; // Properly closed code blocks
    
    // Length consistency (not too short, not excessively verbose)
    const wordCount = response.split(/\s+/).length;
    if (wordCount >= 100 && wordCount <= 2000) {
      coherenceScore += 0.15;
    } else if (wordCount < 50) {
      coherenceScore -= 0.1; // Penalty for too short
    } else if (wordCount > 3000) {
      coherenceScore -= 0.05; // Minor penalty for verbosity
    }
    
    // Conclusion or summary presence
    if (/conclusion|summary|in summary|to summarize|overall/gi.test(response)) {
      coherenceScore += 0.1;
    }
    
    return Math.max(0, Math.min(coherenceScore, 1.0));
  }

  /**
   * Extract meaningful keywords from text
   */
  extractKeywords(text) {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    return text
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 50); // Limit to top 50 keywords
  }

  /**
   * Calculate keyword similarity between two sets
   */
  calculateKeywordSimilarity(keywords1, keywords2) {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Assess contextual relevance indicators
   */
  assessContextualRelevance(response, question) {
    let score = 0;
    
    // Question type detection and appropriate response
    if (/how to|how do|how can/i.test(question)) {
      if (/step|process|method|approach|way to/gi.test(response)) score += 0.3;
    }
    
    if (/what is|what are|define|explain/i.test(question)) {
      if (/is a|are|definition|means|refers to/gi.test(response)) score += 0.3;
    }
    
    if (/why|reason|cause/i.test(question)) {
      if (/because|due to|reason|cause|result/gi.test(response)) score += 0.3;
    }
    
    // Direct answer indicators
    if (/^(yes|no|the answer is|to answer your question)/i.test(response.trim())) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Assess answer structure quality
   */
  assessAnswerStructure(response) {
    let score = 0;
    
    // Has clear introduction
    if (/^(here|this|to solve|to address|for this)/i.test(response.trim())) {
      score += 0.2;
    }
    
    // Has sections or clear structure
    const sections = (response.match(/^#{1,4}\s+/gm) || []).length;
    if (sections >= 2) score += 0.3;
    else if (sections === 1) score += 0.15;
    
    // Has examples
    if (/example|instance|case|demonstration/gi.test(response)) {
      score += 0.25;
    }
    
    // Has actionable content
    if (/you can|you should|you need|try this|use this|implement/gi.test(response)) {
      score += 0.25;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Assess new concepts introduced
   */
  assessNewConcepts(response, previousResponses) {
    const responseKeywords = this.extractKeywords(response.toLowerCase());
    const allPreviousKeywords = new Set();
    
    previousResponses.forEach(prev => {
      this.extractKeywords(prev.toLowerCase()).forEach(word => {
        allPreviousKeywords.add(word);
      });
    });
    
    const newKeywords = responseKeywords.filter(word => !allPreviousKeywords.has(word));
    return Math.min(newKeywords.length / responseKeywords.length, 0.5);
  }

  /**
   * Count technical terms in response
   */
  countTechnicalTerms(text) {
    const technicalPatterns = [
      /\b\w+\(\)/g,  // Function calls
      /\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/g,  // CamelCase (likely tech terms)
      /\b\w+\.\w+/g,  // Namespaced terms
      /\b(API|HTTP|JSON|XML|SQL|REST|GraphQL|OAuth|JWT|SSL|TLS|CDN|DOM|CSS|HTML|JavaScript|TypeScript|Python|Java|React|Node|Docker|Kubernetes|AWS|GCP|Azure)\b/gi
    ];
    
    let count = 0;
    technicalPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      count += matches.length;
    });
    
    return count;
  }

  /**
   * Get detailed scoring breakdown for debugging
   */
  getDetailedBreakdown(response, question, previousResponses = []) {
    const score = this.calculateScore(response, question, previousResponses);
    
    return {
      ...score,
      details: {
        relevance: {
          keywordOverlap: this.extractKeywords(response.toLowerCase()).filter(word => 
            this.extractKeywords(question.toLowerCase()).includes(word)
          ).length,
          contextualRelevance: this.assessContextualRelevance(response, question),
          answerStructure: this.assessAnswerStructure(response)
        },
        novelty: {
          uniqueKeywords: previousResponses.length > 0 ? 
            this.assessNewConcepts(response, previousResponses) : 1.0,
          conceptIntroduction: this.assessNewConcepts(response, previousResponses)
        },
        quality: {
          codeBlocks: (response.match(/```[\s\S]*?```/g) || []).length,
          technicalTerms: this.countTechnicalTerms(response),
          examples: /for example|specifically|such as/gi.test(response),
          bestPractices: /best practice|recommended|should consider/gi.test(response)
        },
        coherence: {
          wordCount: response.split(/\s+/).length,
          hasHeaders: /^#{1,4}\s+/gm.test(response),
          hasStructure: /^\s*[-*\d]+\./gm.test(response),
          hasConclusion: /conclusion|summary|in summary/gi.test(response)
        }
      }
    };
  }
}

export { ImprovedSemanticScoring };