#!/usr/bin/env node

/**
 * Quick test with just one model to verify the synchronous flow
 */

const { SimpleDebate } = require('./src/simple-debate-fixed.js');

async function testSingleModel() {
    console.log('🧪 Testing Single Model Flow\n');
    
    try {
        const debate = new SimpleDebate();
        
        // Test just one model call
        const model = debate.models[0]; // k1 - Claude Opus 4.1
        const prompt = "Explain JavaScript closures in 2 sentences";
        
        console.log(`Testing ${model.name} (${model.alias})...`);
        
        const result = await debate.callModel(model, prompt);
        
        if (result) {
            console.log(`✅ Success! Response length: ${result.length} chars`);
            console.log(`Preview: ${result.substring(0, 100)}...`);
            return true;
        } else {
            console.log('❌ Failed - no response');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

if (require.main === module) {
    testSingleModel().then(success => {
        console.log(`\nResult: ${success ? '✅ PASS' : '❌ FAIL'}`);
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testSingleModel };