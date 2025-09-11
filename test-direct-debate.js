#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ Error: OPENROUTER_API_KEY environment variable is not set');
  console.error('Please copy .env.example to .env and add your OpenRouter API key');
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
    console.log(`  📤 Calling ${model.name}...`);
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
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3456',
          'X-Title': 'Debate Test'
        },
        timeout: 600000 // 10 minutes
      }
    );
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      console.log(`  ✅ ${model.name} responded`);
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format');
  } catch (error) {
    console.log(`  ❌ ${model.name} failed: ${error.message}`);
    return null;
  }
}

async function runDebate(question) {
  console.log('\n🎯 Direct OpenRouter Debate Test\n');
  console.log('Question:', question);
  console.log('\n' + '='.repeat(70) + '\n');
  
  console.log('📊 Round 1: Independent Analysis\n');
  
  const proposals = {};
  for (const model of models) {
    const prompt = `${question}\n\nYour role: ${model.role}\nProvide your perspective focusing on ${model.role.toLowerCase()} aspects.`;
    const response = await callModel(model, prompt);
    if (response) {
      proposals[model.name] = response;
    }
  }
  
  const successCount = Object.keys(proposals).length;
  console.log(`\n✅ Got ${successCount}/${models.length} responses\n`);
  
  if (successCount < 2) {
    console.log('❌ Not enough models responded for debate');
    return;
  }
  
  // Select best (by length for simplicity)
  let best = null;
  let maxLength = 0;
  for (const [name, proposal] of Object.entries(proposals)) {
    if (proposal.length > maxLength) {
      maxLength = proposal.length;
      best = { name, proposal };
    }
  }
  
  console.log(`🏆 Best initial proposal: ${best.name} (${best.proposal.length} chars)\n`);
  console.log('Preview:', best.proposal.substring(0, 200) + '...\n');
  
  console.log('📊 Round 2: Improvements\n');
  
  const improvements = {};
  for (const model of models) {
    if (model.name === best.name) continue;
    
    const prompt = `Original question: ${question}\n\nBest solution so far:\n${best.proposal.substring(0, 1000)}...\n\nProvide improvements from your ${model.role} perspective.`;
    const response = await callModel(model, prompt);
    if (response) {
      improvements[model.name] = response;
    }
  }
  
  console.log(`\n✅ Got ${Object.keys(improvements).length} improvements\n`);
  
  console.log('📝 Final Consensus:\n');
  console.log('Base solution from:', best.name);
  console.log('Contributors:', Object.keys(improvements).join(', '));
  console.log('\n' + '='.repeat(70) + '\n');
  
  return {
    winner: best.name,
    solution: best.proposal,
    improvements
  };
}

// Test questions
const questions = [
  process.argv[2] || "Is the multi-model debate-consensus approach effective for code solutions?"
];

async function main() {
  for (const q of questions) {
    await runDebate(q);
  }
}

main().catch(console.error);