#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
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
    console.log(`📤 Calling ${model.name}...`);
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3456',
          'X-Title': 'Full Debate Test'
        },
        timeout: 600000 // 10 minutes
      }
    );
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      console.log(`✅ ${model.name} responded (${response.data.choices[0].message.content.length} chars)`);
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format');
  } catch (error) {
    console.log(`❌ ${model.name} failed: ${error.message}`);
    return null;
  }
}

async function runFullDebate(question) {
  const timestamp = Date.now();
  const debateId = `debate_${timestamp}`;
  const logsDir = '/opt/mcp/servers/debate-consensus/logs';
  
  console.log('\n🎯 FULL DEBATE CONSENSUS TEST\n');
  console.log('Question:', question);
  console.log('Debate ID:', debateId);
  console.log('\n' + '='.repeat(70) + '\n');
  
  const debateLog = {
    id: debateId,
    timestamp,
    question,
    round1: {},
    round2: {},
    consensus: null
  };
  
  // ROUND 1: Independent proposals
  console.log('📊 ROUND 1: Independent Analysis\n');
  
  for (const model of models) {
    const prompt = `Task: ${question}

Your role: ${model.role}
Your expertise: ${model.role.toLowerCase()} aspects

Provide a comprehensive solution focusing on your area of expertise.
Be specific with implementation details and code examples where relevant.`;
    
    const response = await callModel(model, prompt);
    if (response) {
      debateLog.round1[model.name] = {
        role: model.role,
        response,
        length: response.length
      };
    }
  }
  
  const successCount = Object.keys(debateLog.round1).length;
  console.log(`\n✅ Round 1: Got ${successCount}/${models.length} responses\n`);
  
  if (successCount < 2) {
    console.log('❌ Not enough models responded for debate');
    return debateLog;
  }
  
  // Select best proposal
  let best = null;
  let maxScore = 0;
  for (const [name, data] of Object.entries(debateLog.round1)) {
    // Scoring: length + code blocks + specific terms
    const score = data.length + 
      (data.response.match(/```/g) || []).length * 500 +
      (data.response.match(/implementation|specific|code|algorithm/gi) || []).length * 50;
    
    if (score > maxScore) {
      maxScore = score;
      best = { name, ...data, score };
    }
  }
  
  debateLog.winner = best.name;
  debateLog.winnerScore = best.score;
  
  console.log(`🏆 Best initial proposal: ${best.name} (score: ${best.score})\n`);
  
  // ROUND 2: Improvements and critique
  console.log('📊 ROUND 2: Collaborative Improvements\n');
  
  for (const model of models) {
    if (model.name === best.name) continue;
    
    const prompt = `The task was: ${question}

The current best solution (from ${best.name} - ${best.role} perspective):
${best.response.substring(0, 2000)}...

Your role: ${model.role}

Please:
1. Identify what's missing or could be improved from your ${model.role} perspective
2. Provide specific enhancements or corrections
3. Suggest how to integrate your improvements with the existing solution`;
    
    const response = await callModel(model, prompt);
    if (response) {
      debateLog.round2[model.name] = {
        role: model.role,
        improvements: response,
        length: response.length
      };
    }
  }
  
  console.log(`\n✅ Round 2: Got ${Object.keys(debateLog.round2).length} improvements\n`);
  
  // SYNTHESIS
  console.log('📝 SYNTHESIS: Creating final consensus\n');
  
  // Build consensus document
  let consensus = `# CONSENSUS SOLUTION\n\n`;
  consensus += `## Base Solution (${best.name} - ${best.role})\n\n`;
  consensus += best.response + '\n\n';
  consensus += `## Improvements from Other Models\n\n`;
  
  for (const [name, data] of Object.entries(debateLog.round2)) {
    consensus += `### ${name} (${data.role} Perspective)\n\n`;
    consensus += data.improvements + '\n\n';
  }
  
  debateLog.consensus = consensus;
  
  // Save full debate log
  const logPath = path.join(logsDir, `${debateId}_full.json`);
  await fs.writeFile(logPath, JSON.stringify(debateLog, null, 2));
  console.log(`\n💾 Full debate saved to: ${logPath}\n`);
  
  // Save consensus document
  const consensusPath = path.join(logsDir, `${debateId}_consensus.md`);
  await fs.writeFile(consensusPath, consensus);
  console.log(`📄 Consensus document saved to: ${consensusPath}\n`);
  
  console.log('=' .repeat(70));
  console.log('\n📊 DEBATE SUMMARY:\n');
  console.log(`Winner: ${best.name} (${best.role})`);
  console.log(`Score: ${best.score}`);
  console.log(`Contributors: ${Object.keys(debateLog.round2).join(', ')}`);
  console.log(`Total responses: ${successCount + Object.keys(debateLog.round2).length}`);
  console.log('\n' + '=' .repeat(70) + '\n');
  
  return debateLog;
}

// Main execution
async function main() {
  const question = process.argv[2] || `How to improve the debate-consensus MCP server with:
1. Better iterative debate mechanism where models can see and respond to each other
2. Improved scoring system using semantic analysis instead of simple length
3. Weighted consensus building based on model expertise
4. Specific code implementation for simple-debate.js`;

  await runFullDebate(question);
}

main().catch(console.error);