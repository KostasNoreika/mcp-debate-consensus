#!/usr/bin/env node

/**
 * Standalone test for Quality Presets System (without dependencies)
 */

import { PresetSelector, PresetManager, QualityPresets } from './src/presets/quality-presets.js';

console.log('🎯 Quality Presets System - Standalone Test\n');

async function testPresetsOnly() {
  let testsPassed = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  // Test 1: Preset definitions
  test('Preset definitions exist', () => {
    const expectedPresets = ['rapid', 'balanced', 'maximum-accuracy', 'cost-optimized', 'deep-analysis', 'security-focused'];
    for (const preset of expectedPresets) {
      if (!QualityPresets[preset]) {
        throw new Error(`Missing preset: ${preset}`);
      }
    }
  });

  // Test 2: Preset structure validation
  test('Preset structure validation', () => {
    for (const [id, preset] of Object.entries(QualityPresets)) {
      if (!preset.name || !preset.models || !preset.estimatedTime || !preset.estimatedCost) {
        throw new Error(`Invalid preset structure: ${id}`);
      }
    }
  });

  // Test 3: PresetManager functionality
  test('PresetManager comparison table', () => {
    const manager = new PresetManager();
    const table = manager.getComparisonTable();
    if (!table.headers || !table.rows || table.rows.length === 0) {
      throw new Error('Invalid comparison table');
    }
  });

  // Test 4: Cost estimation
  test('Cost estimation', async () => {
    const manager = new PresetManager();
    const estimate = await manager.estimateActualCost('balanced', 1000);
    if (!estimate.estimated || !estimate.range || !estimate.breakdown) {
      throw new Error('Invalid cost estimate structure');
    }
  });

  // Test 5: Preset validation
  test('Preset validation', () => {
    const selector = new PresetSelector();

    // Valid presets should pass
    selector.validatePreset('balanced');
    selector.validatePreset('rapid');

    // Invalid presets should fail
    try {
      selector.validatePreset('invalid');
      throw new Error('Should have failed validation');
    } catch (error) {
      if (!error.message.includes('Unknown preset')) {
        throw error;
      }
    }
  });

  // Test 6: Preset overrides
  test('Preset overrides', () => {
    const selector = new PresetSelector();
    const basePreset = QualityPresets['balanced'];
    const overrides = { verification: true, iterations: 5 };
    const modified = selector.applyPresetOverrides(basePreset, overrides);

    if (modified.verification !== true || modified.iterations !== 5) {
      throw new Error('Overrides not applied correctly');
    }
  });

  // Test 7: Keyword extraction
  test('Keyword extraction', () => {
    const selector = new PresetSelector();
    const keywords = selector.extractKeywords('How do I fix this security vulnerability in my authentication system?');

    if (!keywords.includes('security') || !keywords.includes('authentication')) {
      throw new Error('Keywords not extracted correctly');
    }
  });

  // Test 8: Simple pattern detection
  test('Pattern detection', () => {
    const selector = new PresetSelector();

    // Security detection
    if (!selector.isSecurityRelated('security', ['security', 'auth'])) {
      throw new Error('Security pattern not detected');
    }

    // Analysis detection
    if (!selector.isAnalysisHeavy('research', ['analyze', 'research'])) {
      throw new Error('Analysis pattern not detected');
    }

    // Simple task detection
    if (!selector.isSimpleTask('debugging', ['debug', 'fix'])) {
      throw new Error('Simple task pattern not detected');
    }
  });

  // Test 9: Preset formatting
  test('Preset formatting', () => {
    const manager = new PresetManager();
    const info = manager.formatPresetInfo('balanced');

    if (!info.includes('Balanced') || !info.length > 50) {
      throw new Error('Preset formatting failed');
    }
  });

  // Test 10: Available presets listing
  test('Available presets listing', () => {
    const selector = new PresetSelector();
    const presets = selector.getAvailablePresets();

    if (!Array.isArray(presets) || presets.length !== Object.keys(QualityPresets).length) {
      throw new Error('Available presets listing failed');
    }
  });

  console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);

  if (testsPassed === totalTests) {
    console.log('🎉 All tests passed! Quality Presets system is working correctly.');
  } else {
    console.log('❌ Some tests failed. Please check the implementation.');
    process.exit(1);
  }

  // Demo section
  console.log('\n' + '='.repeat(60));
  console.log('🎭 DEMO: Preset Selection Examples');
  console.log('='.repeat(60));

  const demoQuestions = [
    "Fix this syntax error",
    "Design secure payment architecture",
    "Optimize database performance"
  ];

  for (const question of demoQuestions) {
    console.log(`\nQ: "${question}"`);

    // Use fallback analysis instead of Gemini
    const analysis = {
      category: question.includes('security') || question.includes('payment') ? 'security' :
                question.includes('optimize') || question.includes('performance') ? 'analysis' :
                question.includes('fix') || question.includes('syntax') ? 'debugging' : 'general',
      complexity: question.includes('design') || question.includes('architecture') ? 'high' :
                  question.includes('optimize') ? 'medium' : 'low',
      criticality: question.includes('payment') || question.includes('security') ? 'high' : 'low',
      keywords: question.toLowerCase().split(' ')
    };

    const selector = new PresetSelector();
    const selectedPreset = selector.selectBasedOnAnalysis(analysis, 0.5, 0.5);

    console.log(`   → ${selectedPreset.name} (${selectedPreset.estimatedTime}, ${selectedPreset.estimatedCost})`);
    console.log(`   → Reason: ${selectedPreset.selectionReason}`);
  }

  console.log('\n✅ Quality Presets system is ready for use!');
}

// Run tests
testPresetsOnly().catch(console.error);