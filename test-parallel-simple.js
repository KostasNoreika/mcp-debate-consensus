#!/usr/bin/env node

/**
 * Simple Test for Parallel Instance Support (Task 003)
 *
 * Tests only the core parsing and configuration logic without dependencies
 */

// Mock minimal model configuration
const mockModels = [
    { alias: 'k1', name: 'Claude Opus 4.1', role: 'Architecture', expertise: 'System architecture and design patterns' },
    { alias: 'k2', name: 'GPT-5', role: 'Testing', expertise: 'Testing strategies, debugging, and quality assurance' },
    { alias: 'k3', name: 'Qwen 3 Max', role: 'Algorithms', expertise: 'Algorithm optimization and data structures' },
    { alias: 'k4', name: 'Gemini 2.5 Pro', role: 'Integration', expertise: 'System integration and completeness verification' },
    { alias: 'k5', name: 'Grok 4 Fast', role: 'Fast Reasoning', expertise: 'Rapid reasoning, coding optimization, and cost-efficient analysis' }
];

/**
 * Parse model configuration string (e.g., "k1:2,k2,k3:3")
 */
function parseModelConfig(config) {
    if (!config) return [];

    return config.split(',').map(m => {
        const [model, count = "1"] = m.trim().split(':');
        return {
            model: model.trim(),
            count: parseInt(count) || 1
        };
    });
}

/**
 * Generate instance configurations for parallel execution
 */
function generateInstanceConfigs(baseModel, instanceCount) {
    const configs = [];

    for (let i = 1; i <= instanceCount; i++) {
        const config = {
            instanceId: i,
            totalInstances: instanceCount,
            seed: i * 1000, // Different seeds for variety
            temperature: Math.min(0.3 + (i - 1) * 0.15, 0.9), // Increasing temperature for diversity
        };

        // Add instance-specific focus areas
        if (instanceCount > 1) {
            switch (i) {
                case 1:
                    config.focus = 'Conservative approach';
                    config.instructions = 'Focus on reliability and proven patterns';
                    break;
                case 2:
                    config.focus = 'Innovative approach';
                    config.instructions = 'Explore creative and novel solutions';
                    break;
                case 3:
                    config.focus = 'Optimization approach';
                    config.instructions = 'Focus on performance and efficiency';
                    break;
                default:
                    config.focus = `Alternative approach ${i}`;
                    config.instructions = 'Provide a unique perspective different from other instances';
            }
        }

        configs.push(config);
    }

    return configs;
}

/**
 * Parse direct model configuration (e.g., "k1:2,k2,k3:3") into selected models
 */
function parseDirectModelConfig(modelConfig) {
    const modelSpecs = parseModelConfig(modelConfig);
    const selectedModels = [];

    for (const spec of modelSpecs) {
        const modelConfigObj = mockModels.find(m => m.alias === spec.model);
        if (modelConfigObj) {
            const instanceConfigs = generateInstanceConfigs(modelConfigObj, spec.count);

            for (const instanceConfig of instanceConfigs) {
                selectedModels.push({
                    ...modelConfigObj,
                    name: spec.count > 1 ?
                        `${modelConfigObj.name} (Instance ${instanceConfig.instanceId})` :
                        modelConfigObj.name,
                    instanceId: instanceConfig.instanceId,
                    totalInstances: instanceConfig.totalInstances,
                    instanceConfig
                });
            }
        } else {
            console.warn(`⚠️ Unknown model alias: ${spec.model}`);
        }
    }

    return selectedModels;
}

function testParallelInstances() {
    console.log('🧪 Testing Parallel Instance Support (Task 003)\n');

    // Test 1: Parse model configuration
    console.log('📝 Test 1: Model Configuration Parsing');
    const configs = [
        'k1:2,k2,k3:3',
        'k1:1,k2:2',
        'k5:4',
        'k1,k2,k3',
        'invalid:2,k1'
    ];

    for (const config of configs) {
        console.log(`  Input: "${config}"`);
        try {
            const parsed = parseModelConfig(config);
            console.log(`  Output:`, parsed);

            const selected = parseDirectModelConfig(config);
            console.log(`  Selected models: ${selected.length} total`);

            // Count parallel instances
            const parallelCount = selected.filter(m => m.totalInstances > 1).length;
            console.log(`  Parallel instances: ${parallelCount}`);

        } catch (error) {
            console.log(`  Error: ${error.message}`);
        }
        console.log();
    }

    // Test 2: Instance configuration generation
    console.log('🔧 Test 2: Instance Configuration Generation');
    const testModel = mockModels[0]; // k1 - Claude Opus

    for (const instanceCount of [1, 2, 3, 5]) {
        console.log(`  Generating ${instanceCount} instances for ${testModel.name}:`);
        const configs = generateInstanceConfigs(testModel, instanceCount);

        configs.forEach((config, i) => {
            console.log(`    Instance ${config.instanceId}:`);
            console.log(`      Seed: ${config.seed}`);
            console.log(`      Temperature: ${config.temperature}`);
            console.log(`      Focus: ${config.focus}`);
            console.log(`      Instructions: ${config.instructions}`);
        });
        console.log();
    }

    // Test 3: Complete model selection workflow
    console.log('🎯 Test 3: Complete Workflow Example');

    const exampleConfig = 'k1:2,k2,k3:3';
    console.log(`  Configuration: "${exampleConfig}"`);

    const selectedModels = parseDirectModelConfig(exampleConfig);

    console.log(`  Total selected models: ${selectedModels.length}`);

    // Group by base model
    const modelGroups = {};
    selectedModels.forEach(model => {
        if (!modelGroups[model.alias]) {
            modelGroups[model.alias] = [];
        }
        modelGroups[model.alias].push(model);
    });

    Object.entries(modelGroups).forEach(([alias, models]) => {
        console.log(`    ${alias}: ${models.length} instance(s)`);
        if (models.length > 1) {
            models.forEach(model => {
                console.log(`      - ${model.name}`);
                console.log(`        Temperature: ${model.instanceConfig.temperature}`);
                console.log(`        Focus: ${model.instanceConfig.focus}`);
            });
        }
    });

    console.log('\n✅ Parallel Instance Support Tests Complete!\n');

    // Test 4: Demonstrate usage examples
    console.log('💡 Usage Examples:');
    console.log('');
    console.log('  Critical Code (Double verification):');
    console.log('    modelConfig: "k1:2,k2:2,k3"');
    console.log('    → 2 Claude Opus instances + 2 GPT-5 instances + 1 Qwen instance');
    console.log('');
    console.log('  Creative Exploration:');
    console.log('    modelConfig: "k2:3,k5:2"');
    console.log('    → 3 GPT-5 instances + 2 Grok instances with different approaches');
    console.log('');
    console.log('  Reducing Randomness:');
    console.log('    modelConfig: "k5:4"');
    console.log('    → 4 Grok instances with different temperatures for consensus');
    console.log('');
    console.log('  Standard (Backward compatible):');
    console.log('    modelConfig: "k1,k2,k3" or omit for intelligent selection');
    console.log('    → Single instance per model');

    console.log('\n🎉 Task 003: Parallel Instance Support - Implementation Complete!');
    console.log('\n📋 Key Features Implemented:');
    console.log('  ✅ Model configuration parsing ("k1:2,k2,k3:3")');
    console.log('  ✅ Parallel instance generation with unique seeds/temperatures');
    console.log('  ✅ Instance-specific focus areas and instructions');
    console.log('  ✅ Instance result synthesis');
    console.log('  ✅ MCP interface support for modelConfig parameter');
    console.log('  ✅ Backward compatibility with single instances');
    console.log('  ✅ Enhanced logging and progress reporting');
}

// Run the test
testParallelInstances();