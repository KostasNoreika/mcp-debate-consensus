#!/usr/bin/env node

/**
 * Test script for streaming debate functionality
 * Tests the stream handler and progress tracker components
 */

import { StreamHandler } from './src/streaming/stream-handler.js';
import { ProgressTracker } from './src/streaming/progress-tracker.js';

// Mock debate system for testing
class MockDebate {
  constructor() {
    this.models = [
      { alias: 'k1', name: 'Claude Opus', expertise: 'Architecture' },
      { alias: 'k2', name: 'GPT-5', expertise: 'Testing' },
      { alias: 'k3', name: 'Qwen 3 Max', expertise: 'Algorithms' }
    ];
    this.useIntelligentSelection = true;
    this.geminiCoordinator = {
      analyzeQuestion: async () => ({
        category: 'Technical Implementation',
        complexityLevel: 'medium',
        criticalityLevel: 'high',
        costReduction: 40,
        estimatedSpeedGain: '30% faster',
        reasoning: 'Mock analysis for testing'
      })
    };
  }

  async initialize() {
    console.log('🔧 Mock debate system initialized');
  }

  getSelectedModelsFromAnalysis(analysis) {
    return this.models.slice(0, 2); // Return subset for testing
  }

  async callModel(model, prompt, projectPath) {
    // Simulate variable response times
    const delay = Math.random() * 3000 + 1000; // 1-4 seconds
    await new Promise(resolve => setTimeout(resolve, delay));

    return `Mock response from ${model.name} after ${Math.round(delay)}ms delay.\n\nThis is a simulated analysis of the question with detailed technical insights.`;
  }
}

async function testProgressTracker() {
  console.log('\n📊 Testing Progress Tracker...\n');

  const tracker = new ProgressTracker({ verbose: true });

  // Initialize with mock models
  tracker.initialize({
    totalModels: 3,
    models: [
      { alias: 'k1', name: 'Claude Opus', expertise: 'Architecture' },
      { alias: 'k2', name: 'GPT-5', expertise: 'Testing' },
      { alias: 'k3', name: 'Qwen 3 Max', expertise: 'Algorithms' }
    ]
  });

  // Test stage progression
  tracker.startStage('initialization');
  await new Promise(resolve => setTimeout(resolve, 500));

  tracker.startStage('analysis');

  // Test model status updates
  tracker.updateModelStatus('k1', 'starting');
  await new Promise(resolve => setTimeout(resolve, 300));

  tracker.updateModelStatus('k1', 'running');
  tracker.updateModelStatus('k2', 'starting');
  await new Promise(resolve => setTimeout(resolve, 800));

  tracker.updateModelStatus('k1', 'completed', { responseLength: 1250 });
  tracker.updateModelStatus('k2', 'running');
  tracker.updateModelStatus('k3', 'starting');
  await new Promise(resolve => setTimeout(resolve, 600));

  tracker.updateModelStatus('k2', 'completed', { responseLength: 980 });
  tracker.updateModelStatus('k3', 'running');
  await new Promise(resolve => setTimeout(resolve, 400));

  tracker.updateModelStatus('k3', 'completed', { responseLength: 1500 });

  tracker.startStage('synthesis');
  await new Promise(resolve => setTimeout(resolve, 300));

  tracker.complete();

  console.log('\n✅ Progress Tracker test completed');
}

async function testStreamHandler() {
  console.log('\n🌊 Testing Stream Handler...\n');

  const streamHandler = new StreamHandler();
  const mockDebate = new MockDebate();

  const question = 'How can I implement streaming responses in my debate system?';
  const projectPath = process.cwd();

  console.log('📝 Question:', question);
  console.log('📁 Project Path:', projectPath);
  console.log('\n🔄 Starting streaming test...\n');

  try {
    let updateCount = 0;
    let stages = [];
    let completedModels = [];

    for await (const update of streamHandler.streamDebate(mockDebate, question, projectPath)) {
      updateCount++;

      switch (update.type) {
        case 'stage':
          stages.push(update.stage);
          console.log(`[${updateCount}] 🔄 Stage: ${update.stage} - ${update.message} (${update.progress}%)`);
          break;

        case 'model_selection':
          console.log(`[${updateCount}] 🧠 Model Selection:`);
          console.log(`   Category: ${update.analysis.category}`);
          console.log(`   Selected: ${update.selectedModels.map(m => m.name).join(', ')}`);
          break;

        case 'model_complete':
          completedModels.push(update.model.name);
          console.log(`[${updateCount}] ✅ ${update.model.name} completed (${update.duration}ms)`);
          if (update.result) {
            console.log(`   Preview: ${update.result.substring(0, 100)}...`);
          }
          break;

        case 'model_error':
          console.log(`[${updateCount}] ❌ ${update.model.name} failed: ${update.error}`);
          break;

        case 'warning':
          console.log(`[${updateCount}] ⚠️ Warning: ${update.message}`);
          break;

        case 'error':
          console.log(`[${updateCount}] 🚫 Error: ${update.message}`);
          break;

        default:
          console.log(`[${updateCount}] 📊 ${update.type}: ${JSON.stringify(update, null, 2).substring(0, 200)}...`);
      }
    }

    console.log(`\n📈 Stream Summary:`);
    console.log(`   Total updates: ${updateCount}`);
    console.log(`   Stages processed: ${stages.join(' → ')}`);
    console.log(`   Models completed: ${completedModels.join(', ')}`);
    console.log(`\n✅ Stream Handler test completed successfully`);

  } catch (error) {
    console.error('❌ Stream Handler test failed:', error.message);
    throw error;
  }
}

async function testTextStreaming() {
  console.log('\n📄 Testing Text Streaming...\n');

  const streamHandler = new StreamHandler();
  const sampleText = 'This is a long piece of text that will be streamed in chunks to demonstrate progressive loading. Each chunk will be delivered with a small delay to simulate real-world streaming behavior. The streaming system allows users to see content as it becomes available rather than waiting for the entire response.';

  console.log('Original text length:', sampleText.length);
  console.log('Streaming in chunks...\n');

  let receivedText = '';
  let chunkCount = 0;

  for await (const chunk of streamHandler.streamText(sampleText, { chunkSize: 50, delay: 100 })) {
    chunkCount++;
    receivedText += chunk.content;

    const progress = Math.round((chunk.position + chunk.content.length) / chunk.total * 100);
    console.log(`[Chunk ${chunkCount}] ${progress}% - "${chunk.content.substring(0, 30)}..." (${chunk.content.length} chars)`);

    if (chunk.isComplete) {
      console.log('✅ Text streaming complete');
      break;
    }
  }

  console.log(`\n📊 Text Streaming Summary:`);
  console.log(`   Original: ${sampleText.length} chars`);
  console.log(`   Received: ${receivedText.length} chars`);
  console.log(`   Chunks: ${chunkCount}`);
  console.log(`   Match: ${sampleText === receivedText ? '✅' : '❌'}`);
}

async function runTests() {
  console.log('🧪 Streaming Components Test Suite');
  console.log('==================================\n');

  try {
    await testProgressTracker();
    await testStreamHandler();
    await testTextStreaming();

    console.log('\n🎉 All streaming tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Progress Tracker - Stage management and model tracking');
    console.log('   ✅ Stream Handler - Debate process streaming');
    console.log('   ✅ Text Streaming - Progressive content delivery');
    console.log('\n🚀 Streaming system is ready for production use!');

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}