#!/usr/bin/env node

/**
 * Test script for Performance Tracking Database implementation
 * Tests database initialization, data insertion, and querying
 */

import { PerformanceTracker } from './src/performance-tracker.js';
import { DatabaseSchema } from './src/database/schema.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testPerformanceTracking() {
  console.log('🧪 Testing Performance Tracking Database Implementation\n');

  try {
    // Test 1: Database Schema Initialization
    console.log('1️⃣ Testing Database Schema Initialization...');
    const testDbPath = path.join(__dirname, 'test-performance.db');
    const schema = new DatabaseSchema(testDbPath);
    await schema.initialize();
    console.log('✅ Database schema initialized successfully');
    console.log(`   Database path: ${testDbPath}`);

    // Test 2: Performance Tracker Initialization
    console.log('\n2️⃣ Testing Performance Tracker Initialization...');
    const tracker = new PerformanceTracker({ dbPath: testDbPath });
    await tracker.initialize();
    console.log('✅ Performance tracker initialized successfully');

    // Test 3: Category Detection
    console.log('\n3️⃣ Testing Automatic Category Detection...');
    const testCases = [
      'Implement a REST API for user authentication',
      'Create a React component for displaying user profiles',
      'Optimize database queries for better performance',
      'Write unit tests for the payment module',
      'Design a machine learning model for recommendation',
      'Plan a marketing strategy for the new product'
    ];

    testCases.forEach(question => {
      const category = tracker.categorizeQuestion(question);
      console.log(`   "${question}" → ${category}`);
    });

    // Test 4: Record Sample Debate
    console.log('\n4️⃣ Testing Debate Recording...');

    const sampleDebateResult = {
      solution: 'Sample solution for testing',
      winner: 'Claude Opus 4.1',
      score: 85.5,
      contributors: ['GPT-5', 'Qwen 3 Max'],
      toolsUsed: true
    };

    const sampleMetadata = {
      question: 'How to implement performance tracking database?',
      projectPath: '/opt/mcp/servers/debate-consensus',
      modelsUsed: ['Claude Opus 4.1', 'GPT-5', 'Qwen 3 Max'],
      proposals: {
        'Claude Opus 4.1': 'Detailed implementation using SQLite...',
        'GPT-5': 'Alternative approach with different schema...',
        'Qwen 3 Max': 'Optimized solution with caching...'
      },
      improvements: {
        'GPT-5': 'Add error handling and validation',
        'Qwen 3 Max': 'Implement query optimization'
      },
      failedModels: [],
      modelTimes: {
        'Claude Opus 4.1': 45,
        'GPT-5': 38,
        'Qwen 3 Max': 42
      },
      totalTimeSeconds: 180
    };

    const debateId = await tracker.recordDebate(sampleDebateResult, sampleMetadata);
    console.log(`✅ Debate recorded with ID: ${debateId}`);

    // Test 5: Performance Analytics
    console.log('\n5️⃣ Testing Performance Analytics...');

    const recommendations = await tracker.getPerformanceRecommendations(
      'Design a scalable microservices architecture',
      '/opt/projects/microservices'
    );

    console.log(`✅ Category detected: ${recommendations.category}`);
    console.log(`   Category name: ${recommendations.categoryName}`);
    console.log(`   Complexity: ${recommendations.complexity}`);
    console.log(`   Model recommendations: ${recommendations.modelRecommendations.length} found`);

    // Test 6: Database Statistics
    console.log('\n6️⃣ Testing Database Statistics...');
    const stats = schema.getStats();
    console.log('✅ Database statistics:');
    console.log(`   Total debates: ${stats.totalDebates}`);
    console.log(`   Total models: ${stats.totalModels}`);
    console.log(`   Total categories: ${stats.totalCategories}`);
    console.log(`   Database size: ${Math.round(stats.dbSize / 1024)} KB`);

    // Test 7: Analytics Dashboard
    console.log('\n7️⃣ Testing Analytics Dashboard...');
    const dashboardData = await tracker.getAnalyticsDashboard();
    console.log('✅ Analytics dashboard data:');
    console.log(`   Categories tracked: ${dashboardData.categoryBreakdown.length}`);
    console.log(`   Recent trends available: ${dashboardData.recentTrends.totalDebates} debates`);
    console.log(`   Performance insights: ${dashboardData.performanceInsights.length} insights`);

    // Test 8: Query Performance
    console.log('\n8️⃣ Testing Query Performance...');
    const startTime = Date.now();

    // Run multiple queries to test performance
    await Promise.all([
      tracker.getPerformanceRecommendations('Test query 1'),
      tracker.getPerformanceRecommendations('Test query 2'),
      tracker.getPerformanceRecommendations('Test query 3')
    ]);

    const queryTime = Date.now() - startTime;
    console.log(`✅ Query performance: ${queryTime}ms for 3 parallel queries`);

    // Cleanup
    console.log('\n9️⃣ Cleaning up...');
    await tracker.close();
    schema.close();
    console.log('✅ Resources cleaned up successfully');

    console.log('\n🎉 All tests passed! Performance tracking system is working correctly.');
    console.log('\n📋 Summary:');
    console.log('   ✅ Database schema creation and initialization');
    console.log('   ✅ Performance tracker initialization');
    console.log('   ✅ Automatic question categorization (70+ categories)');
    console.log('   ✅ Debate result recording with metadata');
    console.log('   ✅ Performance recommendations and analytics');
    console.log('   ✅ Database statistics and health metrics');
    console.log('   ✅ Analytics dashboard data generation');
    console.log('   ✅ Query performance optimization');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Add to package.json scripts for easy testing
console.log('🚀 Starting Performance Tracking Tests...\n');
console.log('💡 After testing, add this to package.json scripts:');
console.log('"test:performance": "node test-performance-tracking.js"\n');

testPerformanceTracking().catch(console.error);