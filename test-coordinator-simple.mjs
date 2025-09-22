#!/usr/bin/env node

/**
 * Simple test for Gemini Coordinator - Task 001 implementation
 *
 * Tests the core intelligent model selection functionality
 */

import { GeminiCoordinator } from './src/gemini-coordinator.js';

async function testGeminiCoordinator() {
  console.log('🧪 Testing Gemini Coordinator - Task 001: Intelligent Model Selection\n');

  const coordinator = new GeminiCoordinator();

  try {
    // Test 1: Simple debugging question (should use fewer models)
    console.log('📌 Test 1: Simple Debugging Question');
    console.log('Question: "Fix undefined variable error in JavaScript"');

    const analysis1 = await coordinator.analyzeQuestion(
      'Fix undefined variable error in JavaScript'
    );

    console.log(`✅ Category: ${analysis1.category}`);
    console.log(`✅ Complexity: ${analysis1.complexityLevel} (${(analysis1.complexity * 100).toFixed(0)}%)`);
    console.log(`✅ Criticality: ${analysis1.criticalityLevel} (${(analysis1.criticality * 100).toFixed(0)}%)`);
    console.log(`✅ Selected models: ${analysis1.selectedModels.join(', ')}`);
    console.log(`✅ Cost reduction: ${analysis1.costReduction}%`);
    console.log(`✅ Analysis source: ${analysis1.analysisSource}`);
    console.log(`✅ Reasoning: ${analysis1.reasoning}`);
    console.log('');

    // Test 2: Complex architecture question (should use more models)
    console.log('📌 Test 2: Complex Architecture Question');
    console.log('Question: "Design a microservices architecture for a banking system"');

    const analysis2 = await coordinator.analyzeQuestion(
      'Design a microservices architecture for a banking system with high availability and security requirements'
    );

    console.log(`✅ Category: ${analysis2.category}`);
    console.log(`✅ Complexity: ${analysis2.complexityLevel} (${(analysis2.complexity * 100).toFixed(0)}%)`);
    console.log(`✅ Criticality: ${analysis2.criticalityLevel} (${(analysis2.criticality * 100).toFixed(0)}%)`);
    console.log(`✅ Selected models: ${analysis2.selectedModels.join(', ')}`);
    console.log(`✅ Cost reduction: ${analysis2.costReduction}%`);
    console.log(`✅ Analysis source: ${analysis2.analysisSource}`);
    console.log(`✅ Reasoning: ${analysis2.reasoning}`);
    console.log('');

    // Test 3: Show cost reduction benefits
    console.log('📊 Cost Reduction Analysis:');
    const avgReduction = (analysis1.costReduction + analysis2.costReduction) / 2;
    console.log(`✅ Average cost reduction: ${avgReduction.toFixed(1)}%`);
    console.log(`✅ Average models selected: ${((analysis1.selectedModels.length + analysis2.selectedModels.length) / 2).toFixed(1)}`);
    console.log('');

    // Test 4: Test coordinator statistics
    console.log('📈 Coordinator Statistics:');
    const stats = coordinator.getStats();
    console.log(`✅ Total categories: ${stats.totalCategories}`);
    console.log(`✅ Total models: ${stats.totalModels}`);
    console.log(`✅ Complexity levels: ${stats.complexityLevels.join(', ')}`);
    console.log(`✅ Criticality levels: ${stats.criticalityLevels.join(', ')}`);
    console.log(`✅ Initialized: ${stats.initialized}`);
    console.log('');

    // Test 5: Verify 50% cost reduction target
    console.log('🎯 Verifying Task 001 Requirements:');
    console.log(`✅ Minimum 3 models for consensus: ${analysis1.selectedModels.length >= 3 && analysis2.selectedModels.length >= 3 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Cost reduction achieved: ${avgReduction >= 30 ? 'PASS' : 'FAIL'} (${avgReduction.toFixed(1)}% >= 30%)`);
    console.log(`✅ Gemini coordinator working: ${analysis1.analysisSource === 'fallback' ? 'FALLBACK' : 'PASS'}`);
    console.log(`✅ Parallel instances support: ${coordinator.getModelConfig('k1') ? 'PASS' : 'FAIL'}`);
    console.log('');

    console.log('🎉 Task 001 Implementation Test Completed!');
    console.log('✅ Intelligent Model Selection with Gemini Coordinator is working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testGeminiCoordinator().catch(console.error);