#!/usr/bin/env node

/**
 * Evaluate and improve the scoring algorithm
 */

const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('Please set OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

const models = [
  { name: 'Claude Opus 4.1', id: 'anthropic/claude-opus-4.1', role: 'Architecture' },
  { name: 'GPT-5', id: 'openai/gpt-5-chat', role: 'Testing' },
  { name: 'Qwen 3 Max', id: 'qwen/qwen3-max', role: 'Algorithms' },
  { name: 'Gemini 2.5 Pro', id: 'google/gemini-2.5-pro', role: 'Integration' }
];

async function callModel(model, prompt) {
  try {
    console.log(`📤 Asking ${model.name}...`);
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000
      }
    );
    
    if (response.data?.choices?.[0]?.message?.content) {
      console.log(`✅ ${model.name} responded\n`);
      return response.data.choices[0].message.content;
    }
  } catch (error) {
    console.log(`❌ ${model.name} failed: ${error.message}\n`);
    return null;
  }
}

async function evaluateScoring() {
  const question = `Analyze the current semantic scoring algorithm and propose improvements:

CURRENT ALGORITHM:
- Code blocks: 500 points each
- Technical keywords: 50 points each  
- File references: 100 points each
- Structure (headers, bullets): 25 points each
- Quality indicators: 75 points each

PROBLEMS WITH CURRENT APPROACH:
1. Can be gamed by adding unnecessary code blocks
2. Doesn't measure actual insight or correctness
3. No consideration for relevance to the question
4. Ignores logical flow and coherence

Your role: ${models[0].role}
Propose a BETTER scoring algorithm that:
1. Uses embeddings for semantic similarity
2. Balances relevance, novelty, and quality
3. Detects and penalizes verbose repetition
4. Rewards genuine insights
5. Is simple to implement

Provide specific implementation with concrete formulas.`;

  console.log('🎯 EVALUATING SCORING ALGORITHM\n');
  console.log('=' .repeat(70) + '\n');
  
  const proposals = {};
  
  // Get proposals from each model
  for (const model of models) {
    const modelPrompt = question.replace('Your role: Architecture', `Your role: ${model.role}`);
    const response = await callModel(model, modelPrompt);
    if (response) {
      proposals[model.name] = response;
    }
  }
  
  console.log('=' .repeat(70) + '\n');
  console.log('📊 CONSENSUS ON BETTER SCORING:\n');
  
  // Extract key recommendations
  const recommendations = [];
  
  for (const [name, proposal] of Object.entries(proposals)) {
    console.log(`\n### ${name}:\n`);
    // Extract first 500 chars of key points
    const summary = proposal.substring(0, 500);
    console.log(summary + '...\n');
    
    // Look for specific recommendations
    if (proposal.includes('embedding') || proposal.includes('cosine')) {
      recommendations.push('Use embeddings for semantic similarity');
    }
    if (proposal.includes('relevance')) {
      recommendations.push('Measure relevance to original question');
    }
    if (proposal.includes('novelty')) {
      recommendations.push('Balance novelty with agreement');
    }
  }
  
  console.log('=' .repeat(70) + '\n');
  console.log('🎯 FINAL RECOMMENDATIONS:\n');
  
  const uniqueRecs = [...new Set(recommendations)];
  uniqueRecs.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });
  
  // Propose the improved algorithm
  console.log('\n📝 PROPOSED IMPROVED ALGORITHM:\n');
  console.log(`
class ImprovedScoring {
  async scoreResponse(response, question, previousResponses) {
    // 1. Semantic Relevance (40%)
    const relevance = await this.cosineSimilarity(
      await this.getEmbedding(response),
      await this.getEmbedding(question)
    );
    
    // 2. Novelty Score (20%)
    let maxSimilarity = 0;
    for (const prev of previousResponses) {
      const sim = await this.cosineSimilarity(
        await this.getEmbedding(response),
        await this.getEmbedding(prev)
      );
      maxSimilarity = Math.max(maxSimilarity, sim);
    }
    const novelty = 1 - maxSimilarity;
    
    // 3. Quality Indicators (20%)
    const quality = this.assessQuality(response);
    
    // 4. Coherence (20%)
    const coherence = this.assessCoherence(response);
    
    // Weighted combination
    return {
      total: (relevance * 0.4 + novelty * 0.2 + quality * 0.2 + coherence * 0.2),
      components: { relevance, novelty, quality, coherence }
    };
  }
  
  assessQuality(text) {
    let score = 0;
    
    // Concrete examples (not just keywords)
    if (text.match(/for example|specifically|such as/gi)) score += 0.2;
    
    // Evidence of analysis
    if (text.match(/because|therefore|however|although/gi)) score += 0.2;
    
    // Structured thinking
    if (text.match(/\\d+\\.|first|second|finally/gi)) score += 0.2;
    
    // Code with explanation
    const codeBlocks = text.match(/\`\`\`/g) || [];
    const hasExplanation = text.match(/this (code|function|implementation)/gi);
    if (codeBlocks.length > 0 && hasExplanation) score += 0.2;
    
    // Addresses limitations
    if (text.match(/limitation|trade-off|consider|caveat/gi)) score += 0.2;
    
    return Math.min(score, 1);
  }
  
  assessCoherence(text) {
    // Simple coherence: sentences should flow logically
    const sentences = text.split(/[.!?]+/);
    let transitions = 0;
    
    const transitionWords = /^(however|therefore|additionally|furthermore|moreover|consequently|thus|hence|specifically|for example|in contrast|similarly)/i;
    
    sentences.forEach(sentence => {
      if (transitionWords.test(sentence.trim())) transitions++;
    });
    
    return Math.min(transitions / Math.max(sentences.length * 0.3, 1), 1);
  }
}
`);
  
  console.log('\n✅ EVALUATION COMPLETE\n');
  
  return proposals;
}

// Run evaluation
evaluateScoring().catch(console.error);