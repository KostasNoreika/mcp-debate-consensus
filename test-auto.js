#!/usr/bin/env node

/**
 * Testas automatiniam režimų pasirinkimui
 */

import { ClaudeCliDebate } from './src/claude-cli-debate.js';

async function test() {
  const debate = new ClaudeCliDebate();

  console.log('🧪 Testuoju automatinį režimų pasirinkimą\n');

  try {
    // Paprasta užklausa - turėtų automatiškai naudoti budget mode
    console.log('Test 1: Paprasta užklausa');
    const result1 = await debate.runDebate(
      'What is Node.js?',
      process.cwd(),
      null,
      { bypassCache: true }
    );
    console.log('✅ Testas 1 baigtas\n');

    // Sudėtinga užklausa - turėtų automatiškai įjungti ultrathink
    console.log('Test 2: Sudėtinga užklausa');
    const result2 = await debate.runDebate(
      'Design a microservices architecture for real-time data processing',
      process.cwd(),
      null,
      { bypassCache: true }
    );
    console.log('✅ Testas 2 baigtas\n');

  } catch (error) {
    console.error('❌ Klaida:', error.message);
  }
}

test().catch(console.error);