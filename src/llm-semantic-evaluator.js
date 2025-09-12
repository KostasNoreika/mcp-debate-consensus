/**
 * LLM-based Semantic Evaluator
 * 
 * Uses an actual LLM to evaluate responses based on semantic understanding,
 * not keyword matching. The LLM dynamically generates evaluation criteria
 * based on the question context and evaluates holistically.
 */

const { spawn } = require('child_process');
const path = require('path');

class LLMSemanticEvaluator {
  constructor() {
    // Use k1 (Claude Opus) as the evaluator by default
    // Can be overridden to use any model
    this.evaluatorModel = {
      alias: 'k1',
      name: 'Claude Opus 4.1 (Evaluator)',
      wrapper: path.join(__dirname, '..', 'k1-wrapper.sh')
    };
    
    // Timeout for evaluation (shorter than debate timeout)
    this.timeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Evaluate multiple responses using LLM semantic understanding
   */
  async evaluateResponses(question, responses, projectContext = '') {
    console.log('\n🔍 LLM Semantic Evaluation Starting...');
    
    // Build the evaluation prompt
    const evaluationPrompt = this.buildEvaluationPrompt(question, responses, projectContext);
    
    try {
      // Call the evaluator LLM
      const evaluationResult = await this.callEvaluator(evaluationPrompt);
      
      // Parse the JSON response
      const evaluation = this.parseEvaluation(evaluationResult);
      
      // Validate and enhance the evaluation
      const validatedEvaluation = this.validateEvaluation(evaluation, responses);
      
      console.log('✅ Evaluation complete');
      return validatedEvaluation;
      
    } catch (error) {
      console.error('❌ LLM evaluation failed, falling back to basic scoring:', error.message);
      return this.fallbackEvaluation(responses);
    }
  }

  /**
   * Build comprehensive evaluation prompt for the LLM
   */
  buildEvaluationPrompt(question, responses, projectContext) {
    // Format responses for evaluation
    const formattedResponses = Object.entries(responses)
      .map(([model, response], index) => {
        return `### Response ${index + 1} from ${model}:\n${response}\n`;
      })
      .join('\n---\n\n');

    return `You are an expert technical evaluator. Your task is to evaluate multiple responses to a technical question and determine which one is best.

## Original Question:
${question}

${projectContext ? `## Project Context:\n${projectContext}\n` : ''}

## Responses to Evaluate:
${formattedResponses}

## Your Task:

1. **First, determine evaluation criteria** specific to this question. Consider:
   - What type of question is this? (bug fix, architecture, optimization, explanation, etc.)
   - What would make an ideal answer to THIS specific question?
   - What aspects are most important for this context?

2. **Evaluate each response** holistically based on your criteria:
   - Does it actually answer the question?
   - Is the solution correct and complete?
   - How practical and implementable is it?
   - Does it demonstrate deep understanding?
   - Are there any errors or misconceptions?

3. **Score each response** from 0-100 based on how well it meets your criteria.

4. **Return your evaluation as JSON** in this exact format:
\`\`\`json
{
  "criteria": [
    {
      "name": "criterion_name",
      "description": "why this matters for this question",
      "weight": 0.3
    }
  ],
  "evaluations": [
    {
      "model": "model_name",
      "score": 85,
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "reasoning": "detailed explanation of score"
    }
  ],
  "best_response": {
    "model": "winning_model_name",
    "score": 95,
    "why": "explanation of why this is the best"
  },
  "synthesis_suggestions": [
    "suggestion for combining the best parts of all responses"
  ]
}
\`\`\`

Be objective and thorough. Focus on semantic understanding, not surface-level features.`;
  }

  /**
   * Call the evaluator LLM
   */
  async callEvaluator(prompt) {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      
      console.log('  🤖 Calling evaluator LLM...');
      
      const child = spawn(this.evaluatorModel.wrapper, ['--print'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout
      });
      
      child.stdin.write(prompt);
      child.stdin.end();
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && output) {
          resolve(output);
        } else {
          reject(new Error(`Evaluator failed with code ${code}: ${errorOutput}`));
        }
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse the LLM's evaluation response
   */
  parseEvaluation(evaluationText) {
    try {
      // Extract JSON from the response
      const jsonMatch = evaluationText.match(/```json\n?([\s\S]*?)\n?```/);
      if (!jsonMatch) {
        // Try to find raw JSON
        const jsonStart = evaluationText.indexOf('{');
        const jsonEnd = evaluationText.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = evaluationText.substring(jsonStart, jsonEnd);
          return JSON.parse(jsonStr);
        }
        throw new Error('No JSON found in evaluation response');
      }
      
      const jsonStr = jsonMatch[1];
      return JSON.parse(jsonStr);
      
    } catch (error) {
      console.error('Failed to parse evaluation JSON:', error.message);
      throw error;
    }
  }

  /**
   * Validate and enhance the evaluation
   */
  validateEvaluation(evaluation, responses) {
    // Ensure all required fields exist
    if (!evaluation.evaluations || !Array.isArray(evaluation.evaluations)) {
      throw new Error('Invalid evaluation structure: missing evaluations array');
    }
    
    if (!evaluation.best_response) {
      // Determine best from scores
      const best = evaluation.evaluations.reduce((prev, current) => 
        (current.score > prev.score) ? current : prev
      );
      evaluation.best_response = {
        model: best.model,
        score: best.score,
        why: best.reasoning
      };
    }
    
    // Ensure criteria exist
    if (!evaluation.criteria || !Array.isArray(evaluation.criteria)) {
      evaluation.criteria = this.inferCriteria(evaluation);
    }
    
    // Add model names if missing
    const modelNames = Object.keys(responses);
    evaluation.evaluations.forEach((evalItem, index) => {
      if (!evalItem.model && modelNames[index]) {
        evalItem.model = modelNames[index];
      }
    });
    
    return evaluation;
  }

  /**
   * Infer criteria from evaluations if not provided
   */
  inferCriteria(evaluation) {
    return [
      {
        name: "Correctness",
        description: "Technical accuracy and validity of the solution",
        weight: 0.4
      },
      {
        name: "Completeness",
        description: "How thoroughly the question is answered",
        weight: 0.3
      },
      {
        name: "Practicality",
        description: "How implementable and useful the solution is",
        weight: 0.2
      },
      {
        name: "Clarity",
        description: "How well explained and structured the response is",
        weight: 0.1
      }
    ];
  }

  /**
   * Fallback evaluation if LLM fails
   */
  fallbackEvaluation(responses) {
    console.log('  ⚠️  Using fallback evaluation (response length + structure)');
    
    const evaluations = Object.entries(responses).map(([model, response]) => {
      // Simple heuristics
      const score = this.simpleScoringHeuristic(response);
      
      return {
        model: model,
        score: score,
        strengths: ["Provided a response"],
        weaknesses: ["Not semantically evaluated"],
        reasoning: "Fallback scoring based on response structure"
      };
    });
    
    const best = evaluations.reduce((prev, current) => 
      (current.score > prev.score) ? current : prev
    );
    
    return {
      criteria: [{
        name: "Fallback",
        description: "Basic structural evaluation",
        weight: 1.0
      }],
      evaluations: evaluations,
      best_response: {
        model: best.model,
        score: best.score,
        why: "Highest fallback score"
      },
      synthesis_suggestions: ["Combine all responses due to fallback mode"]
    };
  }

  /**
   * Simple scoring heuristic for fallback
   */
  simpleScoringHeuristic(response) {
    if (!response) return 0;
    
    let score = 50; // Base score
    
    // Has code blocks
    if (response.includes('```')) score += 15;
    
    // Has structure (headers, lists)
    if (/^#+\s/m.test(response)) score += 10;
    if (/^\s*[-*]\s/m.test(response)) score += 5;
    
    // Has explanations
    if (/because|therefore|thus|however/i.test(response)) score += 10;
    
    // Length bonus (but not too long)
    const length = response.length;
    if (length > 500 && length < 5000) score += 10;
    
    return Math.min(score, 100);
  }

  /**
   * Get a formatted summary of the evaluation
   */
  formatEvaluationSummary(evaluation) {
    let summary = '\n📊 Evaluation Results:\n\n';
    
    // Criteria
    summary += '📋 Evaluation Criteria:\n';
    evaluation.criteria.forEach(criterion => {
      summary += `  • ${criterion.name} (${(criterion.weight * 100).toFixed(0)}%): ${criterion.description}\n`;
    });
    
    // Scores
    summary += '\n📈 Model Scores:\n';
    evaluation.evaluations.forEach(evalItem => {
      summary += `  • ${evalItem.model}: ${evalItem.score}/100\n`;
      if (evalItem.strengths && evalItem.strengths.length > 0) {
        summary += `    ✓ Strengths: ${evalItem.strengths.join(', ')}\n`;
      }
      if (evalItem.weaknesses && evalItem.weaknesses.length > 0) {
        summary += `    ✗ Weaknesses: ${evalItem.weaknesses.join(', ')}\n`;
      }
    });
    
    // Winner
    summary += `\n🏆 Best Response: ${evaluation.best_response.model} (${evaluation.best_response.score}/100)\n`;
    summary += `   Reason: ${evaluation.best_response.why}\n`;
    
    // Synthesis suggestions
    if (evaluation.synthesis_suggestions && evaluation.synthesis_suggestions.length > 0) {
      summary += '\n💡 Synthesis Suggestions:\n';
      evaluation.synthesis_suggestions.forEach(suggestion => {
        summary += `  • ${suggestion}\n`;
      });
    }
    
    return summary;
  }
}

module.exports = { LLMSemanticEvaluator };