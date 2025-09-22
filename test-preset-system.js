#!/usr/bin/env node

/**
 * Test script for Quality Presets System
 *
 * This script demonstrates and tests the preset functionality without
 * requiring MCP integration. It shows how presets work and can be used
 * for development and testing.
 */

import { PresetSelector, PresetManager, QualityPresets } from './src/presets/quality-presets.js';
import { ClaudeCliDebate } from './src/claude-cli-debate.js';
import { PresetIntegratedDebate, displayPresetInfo } from './src/presets/preset-integration.js';

console.log('🎯 Quality Presets System Test\n');

async function testPresetSystem() {
  try {
    // Test 1: Display all presets
    console.log('='.repeat(60));
    console.log('TEST 1: Display Available Presets');
    console.log('='.repeat(60));

    displayPresetInfo();

    // Test 2: Test preset selection
    console.log('='.repeat(60));
    console.log('TEST 2: Automatic Preset Selection');
    console.log('='.repeat(60));

    const selector = new PresetSelector();
    await selector.initialize();

    const testQuestions = [
      "How do I fix this syntax error in my JavaScript?",
      "Design a scalable microservices architecture for an e-commerce platform",
      "Review this authentication system for security vulnerabilities",
      "Optimize this database query performance",
      "Debug this memory leak in production"
    ];

    for (const question of testQuestions) {
      console.log(`\n📝 Question: "${question}"`);

      try {
        const preset = await selector.selectPreset(question, {
          urgency: 0.5,
          budget: 0.5
        });

        console.log(`🎯 Selected: ${preset.name} (${preset.id})`);
        console.log(`💡 Reason: ${preset.selectionReason}`);
        console.log(`⏱️  Time: ${preset.estimatedTime}`);
        console.log(`💰 Cost: ${preset.estimatedCost}`);
      } catch (error) {
        console.log(`❌ Selection failed: ${error.message}`);
      }
    }

    // Test 3: Test cost estimation
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Cost Estimation');
    console.log('='.repeat(60));

    const manager = new PresetManager();

    for (const [presetId, preset] of Object.entries(QualityPresets)) {
      console.log(`\n💰 ${preset.name} (${presetId}):`);

      try {
        const estimate = await manager.estimateActualCost(presetId, 1000);
        console.log(`   Base: ${preset.estimatedCost}`);
        console.log(`   Refined: $${estimate.estimated.toFixed(3)}`);
        console.log(`   Range: $${estimate.range.min.toFixed(3)} - $${estimate.range.max.toFixed(3)}`);
        console.log(`   Model calls: ${estimate.breakdown.modelCalls}`);
      } catch (error) {
        console.log(`   ❌ Estimation failed: ${error.message}`);
      }
    }

    // Test 4: Test preset overrides
    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Preset Overrides');
    console.log('='.repeat(60));

    const basePreset = QualityPresets['balanced'];
    console.log(`\n🔧 Base preset: ${basePreset.name}`);
    console.log(`   Models: ${basePreset.models.join(', ')}`);
    console.log(`   Verification: ${basePreset.verification}`);
    console.log(`   Iterations: ${basePreset.iterations}`);

    const overrides = {
      verification: true,
      iterations: 5,
      consensusThreshold: 95
    };

    const modifiedPreset = selector.applyPresetOverrides(basePreset, overrides);
    console.log(`\n✅ With overrides:`);
    console.log(`   Models: ${modifiedPreset.models.join(', ')}`);
    console.log(`   Verification: ${modifiedPreset.verification}`);
    console.log(`   Iterations: ${modifiedPreset.iterations}`);
    console.log(`   Consensus: ${modifiedPreset.consensusThreshold}%`);
    console.log(`   Overrides applied: ${modifiedPreset.overrides.join(', ')}`);

    // Test 5: Test preset validation
    console.log('\n' + '='.repeat(60));
    console.log('TEST 5: Preset Validation');
    console.log('='.repeat(60));

    const validPresets = ['rapid', 'balanced', 'maximum-accuracy'];
    const invalidPresets = ['invalid', 'nonexistent', ''];

    console.log('\n✅ Valid presets:');
    for (const presetId of validPresets) {
      try {
        selector.validatePreset(presetId);
        console.log(`   ${presetId}: ✓`);
      } catch (error) {
        console.log(`   ${presetId}: ❌ ${error.message}`);
      }
    }

    console.log('\n❌ Invalid presets:');
    for (const presetId of invalidPresets) {
      try {
        selector.validatePreset(presetId);
        console.log(`   ${presetId}: ✓ (unexpected!)`);
      } catch (error) {
        console.log(`   ${presetId}: ❌ ${error.message}`);
      }
    }

    // Test 6: Integration test (mock debate)
    console.log('\n' + '='.repeat(60));
    console.log('TEST 6: Integration Test (Mock)');
    console.log('='.repeat(60));

    console.log('\n🎭 Mock debate integration test...');

    // Create a mock debate instance for testing
    const mockDebate = {
      initialize: async () => {
        console.log('   🔧 Debate initialized');
      },
      runDebate: async (question, projectPath, modelConfig) => {
        console.log(`   🎯 Running debate with config: ${modelConfig || 'auto'}`);
        return {
          solution: `Mock solution for: ${question}`,
          winner: 'Claude Opus 4.1',
          score: { total: 85.5 },
          contributors: ['GPT-5', 'Grok 4 Fast'],
          toolsUsed: true
        };
      },
      useIntelligentSelection: true,
      timeout: 60000,
      progressReporter: {
        setPhase: (phase) => console.log(`   📊 Phase: ${phase}`)
      }
    };

    const integratedDebate = new PresetIntegratedDebate(mockDebate);

    try {
      const result = await integratedDebate.runDebateWithPresets(
        "How can I optimize this React component for performance?",
        process.cwd(),
        {
          preset: 'balanced',
          urgency: 0.3,
          budget: 0.7
        }
      );

      console.log('\n✅ Mock debate completed:');
      console.log(`   Winner: ${result.winner}`);
      console.log(`   Score: ${result.score.total}`);
      console.log(`   Contributors: ${result.contributors.join(', ')}`);

      if (result.preset) {
        console.log(`   Preset: ${result.preset.name}`);
        console.log(`   Reason: ${result.preset.selectionReason}`);
      }

    } catch (error) {
      console.log(`❌ Integration test failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPresetSystem().catch(console.error);
}

export { testPresetSystem };