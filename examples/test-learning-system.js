#!/usr/bin/env node

/**
 * Test script for the Learning System
 *
 * This script demonstrates and tests the learning system capabilities,
 * including model profiling, pattern detection, and optimization.
 */

import { LearningSystem } from './src/learning/learning-system.js';
import { ModelProfiler } from './src/learning/model-profiler.js';
import { PatternDetector } from './src/learning/pattern-detector.js';
import { LearningOptimizer } from './src/learning/optimizer.js';

async function testLearningSystem() {
  console.log('🧠 Testing Learning System for Model Selection\n');

  const learningSystem = new LearningSystem();
  await learningSystem.initialize();

  // Test 1: Get optimization for different categories
  console.log('📊 Test 1: Category-Based Optimization\n');

  const categories = [
    'tech/debug',
    'tech/code',
    'education/explain',
    'business/strategy',
    'math/calculation'
  ];

  for (const category of categories) {
    try {
      const optimization = await learningSystem.getOptimalSelection(
        `How to solve ${category} problems?`,
        {
          category,
          urgency: 0.5,
          budgetConstraint: 0.3,
          quality: 0.8,
          maxModels: 3
        }
      );

      console.log(`🎯 Category: ${category}`);
      console.log(`   Selected models: ${optimization.models.map(m => m.id).join(', ')}`);
      console.log(`   Strategy: ${optimization.strategy}`);
      console.log(`   Expected cost reduction: ${optimization.metrics.costReduction.toFixed(1)}%`);
      console.log(`   Expected performance: ${(optimization.metrics.expectedPerformance * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${optimization.reasoning}\n`);
    } catch (error) {
      console.error(`❌ Error optimizing for ${category}:`, error.message);
    }
  }

  // Test 2: Simulate debate results for learning
  console.log('📚 Test 2: Simulating Debate Results for Learning\n');

  const simulatedDebates = [
    {
      question: 'Debug a Node.js memory leak',
      category: 'tech/debug',
      participants: ['k5', 'k2', 'k3'],
      selectedModels: ['k5', 'k2', 'k3'],
      winner: 'k5',
      scores: { k5: 0.9, k2: 0.7, k3: 0.6 },
      timings: { k5: 15000, k2: 25000, k3: 30000 },
      costReduction: 60
    },
    {
      question: 'Implement binary search algorithm',
      category: 'tech/code',
      participants: ['k3', 'k1', 'k2'],
      selectedModels: ['k3', 'k1', 'k2'],
      winner: 'k3',
      scores: { k3: 0.95, k1: 0.8, k2: 0.7 },
      timings: { k3: 20000, k1: 40000, k2: 35000 },
      costReduction: 40
    },
    {
      question: 'Explain quantum computing basics',
      category: 'education/explain',
      participants: ['k1', 'k4', 'k2'],
      selectedModels: ['k1', 'k4', 'k2'],
      winner: 'k1',
      scores: { k1: 0.9, k4: 0.75, k2: 0.65 },
      timings: { k1: 45000, k4: 30000, k2: 25000 },
      costReduction: 10
    },
    {
      question: 'Calculate compound interest formula',
      category: 'math/calculation',
      participants: ['k3', 'k2', 'k1'],
      selectedModels: ['k3', 'k2', 'k1'],
      winner: 'k3',
      scores: { k3: 0.92, k2: 0.8, k1: 0.7 },
      timings: { k3: 18000, k2: 22000, k1: 35000 },
      costReduction: 50
    },
    {
      question: 'Develop business strategy for startup',
      category: 'business/strategy',
      participants: ['k1', 'k4', 'k2'],
      selectedModels: ['k1', 'k4', 'k2'],
      winner: 'k1',
      scores: { k1: 0.85, k4: 0.8, k2: 0.7 },
      timings: { k1: 50000, k4: 40000, k2: 30000 },
      costReduction: 5
    }
  ];

  for (const debate of simulatedDebates) {
    try {
      await learningSystem.processDebate(debate);
      console.log(`✅ Processed debate: ${debate.question.substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Error processing debate:`, error.message);
    }
  }

  // Test 3: Show learning progress
  console.log('\n📈 Test 3: Learning System Status\n');

  const status = learningSystem.getQuickStatus();
  console.log('Learning System Status:');
  console.log(`  Enabled: ${status.enabled}`);
  console.log(`  Initialized: ${status.initialized}`);
  console.log(`  Total debates processed: ${status.totalDebates}`);
  console.log(`  Patterns detected: ${status.patterns}`);
  console.log(`  Optimizations applied: ${status.optimizations}`);
  console.log(`  Cost savings: ${status.costSavings.toFixed(1)}%`);

  // Test 4: Generate comprehensive report
  if (status.totalDebates >= 3) {
    console.log('\n📋 Test 4: Generating Comprehensive Report\n');

    try {
      const report = await learningSystem.generateComprehensiveReport();
      console.log('✅ Comprehensive report generated');
      console.log(`   System Level: ${report.systemStatus.learningLevel}`);
      console.log(`   Models Tracked: ${report.systemStatus.modelsTracked}`);
      console.log(`   Recommendations: ${report.recommendations.length}`);

      if (report.recommendations.length > 0) {
        console.log('\n💡 Top Recommendations:');
        report.recommendations.slice(0, 3).forEach((rec, index) => {
          console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
        });
      }
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
    }
  }

  // Test 5: Test individual components
  console.log('\n🔧 Test 5: Testing Individual Components\n');

  // Test Model Profiler
  const profiler = new ModelProfiler();
  await profiler.initialize();

  const k1Profile = profiler.getProfile('k1');
  if (k1Profile) {
    console.log('📊 k1 Profile:');
    console.log(`   Total debates: ${k1Profile.totalDebates}`);
    console.log(`   Win rate: ${k1Profile.totalDebates > 0 ? (k1Profile.totalWins / k1Profile.totalDebates * 100).toFixed(1) : 0}%`);
    console.log(`   Strengths: ${k1Profile.strengths.join(', ')}`);
    console.log(`   Specializations: ${k1Profile.specializations.length}`);
  }

  // Test Pattern Detector
  const detector = new PatternDetector();
  await detector.initialize();

  try {
    const patterns = await detector.detectPatterns();
    console.log(`\n🔍 Pattern Detection Results:`);
    console.log(`   Underdog wins: ${patterns.underdogWins?.length || 0}`);
    console.log(`   Consistent failures: ${patterns.consistentFailures?.length || 0}`);
    console.log(`   Specialists found: ${Object.keys(patterns.specialists || {}).length}`);
    console.log(`   Emerging trends: ${patterns.emergingTrends?.length || 0}`);
  } catch (error) {
    console.log(`⚠️ Pattern detection needs more data (${error.message})`);
  }

  // Test Optimizer
  const optimizer = new LearningOptimizer(profiler, detector);
  await optimizer.initialize();

  const optimizationStatus = optimizer.getOptimizationStatus();
  console.log(`\n⚡ Optimization Status:`);
  console.log(`   Learning level: ${optimizationStatus.learningLevel}`);
  console.log(`   Cost optimization: ${optimizationStatus.costOptimizationEnabled ? 'enabled' : 'disabled'}`);
  console.log(`   Pattern optimization: ${optimizationStatus.patternOptimizationEnabled ? 'enabled' : 'disabled'}`);
  console.log(`   Category rules: ${optimizationStatus.totalCategoryRules}`);

  console.log('\n✅ Learning System test completed!\n');

  // Show next steps
  console.log('🎯 Next Steps:');
  console.log('1. Run more debates to reach learning milestones:');
  console.log('   - 10 debates: Basic category detection');
  console.log('   - 50 debates: Cost optimization');
  console.log('   - 100 debates: Pattern recognition');
  console.log('   - 500 debates: Advanced optimization');
  console.log('2. Learning system will automatically improve model selection');
  console.log('3. Expected 30-50% cost reduction after 50+ debates');
  console.log('4. Use `npm run learning:report` to generate detailed analytics');
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLearningSystem().catch(console.error);
}

export { testLearningSystem };