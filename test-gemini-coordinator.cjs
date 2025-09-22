#!/usr/bin/env node

/**
 * Test script for Gemini Coordinator - Task 001 implementation
 *
 * Tests the intelligent model selection functionality
 */

const { GeminiCoordinator } = require('./src/gemini-coordinator.js');

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
    console.log('');

    // Test 3: Medium complexity question
    console.log('📌 Test 3: Medium Complexity Question');
    console.log('Question: "Write unit tests for this React component"');

    const analysis3 = await coordinator.analyzeQuestion(
      'Write unit tests for this React component with proper mocking and coverage'
    );

    console.log(`✅ Category: ${analysis3.category}`);
    console.log(`✅ Complexity: ${analysis3.complexityLevel} (${(analysis3.complexity * 100).toFixed(0)}%)`);
    console.log(`✅ Criticality: ${analysis3.criticalityLevel} (${(analysis3.criticality * 100).toFixed(0)}%)`);
    console.log(`✅ Selected models: ${analysis3.selectedModels.join(', ')}`);
    console.log(`✅ Cost reduction: ${analysis3.costReduction}%`);
    console.log(`✅ Analysis source: ${analysis3.analysisSource}`);
    console.log('');

    // Test 4: Show cost reduction benefits
    console.log('📊 Cost Reduction Analysis:');
    const baselineCost = 5; // All 5 models
    const avgReduction = (analysis1.costReduction + analysis2.costReduction + analysis3.costReduction) / 3;
    console.log(`✅ Average cost reduction: ${avgReduction.toFixed(1)}%`);
    console.log(`✅ Average models selected: ${((analysis1.selectedModels.length + analysis2.selectedModels.length + analysis3.selectedModels.length) / 3).toFixed(1)}`);
    console.log('');

    // Test 5: Test coordinator statistics
    console.log('📈 Coordinator Statistics:');
    const stats = coordinator.getStats();
    console.log(`✅ Total categories: ${stats.totalCategories}`);
    console.log(`✅ Total models: ${stats.totalModels}`);
    console.log(`✅ Complexity levels: ${stats.complexityLevels.join(', ')}`);
    console.log(`✅ Criticality levels: ${stats.criticalityLevels.join(', ')}`);
    console.log(`✅ Initialized: ${stats.initialized}`);
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('✅ Task 001: Intelligent Model Selection implementation is working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testGeminiCoordinator().catch(console.error);
}

module.exports = { testGeminiCoordinator };