#!/usr/bin/env node

/**
 * Simple demo of the Quality Presets System
 * Shows how to use presets in your applications
 */

import { PresetSelector, PresetManager, QualityPresets } from './src/presets/quality-presets.js';

async function demo() {
  console.log('🎯 Quality Presets Demo\n');

  // 1. Show all available presets
  const manager = new PresetManager();
  const table = manager.getComparisonTable();

  console.log('📋 Available Presets:\n');
  console.log('┌─────────────────┬────────┬──────────┬──────────┬─────────────────────┐');
  console.log('│ Preset          │ Models │ Time     │ Cost     │ Best For            │');
  console.log('├─────────────────┼────────┼──────────┼──────────┼─────────────────────┤');

  table.rows.forEach(row => {
    const [preset, models, time, cost, bestFor] = row;
    console.log(`│ ${preset.padEnd(15)} │ ${models.padEnd(6)} │ ${time.padEnd(8)} │ ${cost.padEnd(8)} │ ${bestFor.padEnd(19)} │`);
  });

  console.log('└─────────────────┴────────┴──────────┴──────────┴─────────────────────┘\n');

  // 2. Demo automatic preset selection
  const selector = new PresetSelector();
  await selector.initialize();

  const questions = [
    "Fix this syntax error quickly",
    "Design a secure payment system architecture",
    "Optimize this slow database query"
  ];

  console.log('🧠 Automatic Preset Selection:\n');

  for (const question of questions) {
    console.log(`Q: "${question}"`);

    try {
      const preset = await selector.selectPreset(question);
      console.log(`   → ${preset.name} (${preset.estimatedTime}, ${preset.estimatedCost})`);
      console.log(`   → Reason: ${preset.selectionReason}\n`);
    } catch (error) {
      console.log(`   → Error: ${error.message}\n`);
    }
  }

  // 3. Show detailed preset info
  console.log('📖 Detailed Preset Examples:\n');

  const examplePresets = ['rapid', 'balanced', 'maximum-accuracy'];

  for (const presetId of examplePresets) {
    console.log(manager.formatPresetInfo(presetId));
    console.log('');
  }

  console.log('✅ Demo complete!\n');
  console.log('To use in your application:');
  console.log('1. Import: import { PresetIntegratedDebate } from "./src/presets/preset-integration.js"');
  console.log('2. Create: const debate = new PresetIntegratedDebate(yourDebateInstance)');
  console.log('3. Use: await debate.runDebateWithPresets(question, path, { preset: "balanced" })');
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}

export { demo };