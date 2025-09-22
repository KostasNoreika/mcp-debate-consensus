/**
 * Preset Integration Module
 *
 * This module provides integration methods for the Quality Presets system
 * with the existing ClaudeCliDebate class. It can be imported and used
 * to add preset functionality without modifying the main class directly.
 */

import { PresetSelector, PresetManager, QualityPresets } from './quality-presets.js';

/**
 * Enhanced debate runner with preset support
 */
export class PresetIntegratedDebate {
  constructor(debateInstance) {
    this.debate = debateInstance;
    this.presetSelector = new PresetSelector();
    this.presetManager = new PresetManager();
    this.currentPreset = null;
  }

  /**
   * Initialize preset system
   */
  async initialize() {
    await this.debate.initialize();
    await this.presetSelector.initialize();
  }

  /**
   * Run debate with preset support
   */
  async runDebateWithPresets(question, projectPath = process.cwd(), options = {}) {
    const {
      preset = null,
      modelConfig = null,
      urgency = 0.5,
      budget = 0.5,
      overrides = {}
    } = options;

    await this.initialize();

    console.log('🎯 Multi-Model Debate Consensus v2.1 (Quality Presets + Intelligent Selection)\n');
    console.log('📍 Project:', projectPath);
    console.log('❓ Question:', question);
    console.log('🔧 Tool Access: Full MCP integration enabled');

    // Phase 0: Preset Selection and Configuration
    let selectedPreset = null;
    let finalModelConfig = modelConfig;

    if (preset || (!modelConfig && !this.debate.useIntelligentSelection)) {
      this.debate.progressReporter?.setPhase('Selecting quality preset');
      console.log('\n📋 PHASE 0: Quality Preset Selection\n');

      try {
        selectedPreset = await this.presetSelector.selectPreset(question, {
          userPreference: preset,
          projectPath,
          urgency,
          budget
        });

        // Apply overrides to the preset
        if (Object.keys(overrides).length > 0) {
          selectedPreset = this.presetSelector.applyPresetOverrides(selectedPreset, overrides);
          console.log(`🔧 Applied overrides: ${Object.keys(overrides).join(', ')}`);
        }

        this.currentPreset = selectedPreset;

        // Display preset information
        console.log(this.presetManager.formatPresetInfo(selectedPreset.id));

        // Convert preset to model configuration
        finalModelConfig = this.convertPresetToModelConfig(selectedPreset);

        // Update timeout if specified in preset
        if (selectedPreset.timeoutMinutes) {
          this.debate.timeout = selectedPreset.timeoutMinutes * 60 * 1000;
          console.log(`⏱️  Timeout adjusted to: ${selectedPreset.timeoutMinutes} minutes`);
        }

        // Override intelligent selection if preset specifies
        if (selectedPreset.useIntelligentSelection !== undefined) {
          this.debate.useIntelligentSelection = selectedPreset.useIntelligentSelection;
          console.log(`🧠 Intelligent selection: ${selectedPreset.useIntelligentSelection ? 'enabled' : 'disabled'} (preset override)`);
        }

        console.log(`\n💰 Estimated cost: ${selectedPreset.estimatedCost}`);
        console.log(`⏱️  Estimated time: ${selectedPreset.estimatedTime}`);

      } catch (error) {
        console.warn(`⚠️ Preset selection failed: ${error.message}`);
        console.log(`🔄 Falling back to standard debate configuration`);
      }
    }

    console.log('\n' + '='.repeat(70) + '\n');

    // Run the debate with the configured settings
    const startTime = Date.now();
    const result = await this.debate.runDebate(question, projectPath, finalModelConfig);

    // Add preset information to result
    if (selectedPreset) {
      const actualTime = Math.round((Date.now() - startTime) / 1000);
      const actualCost = await this.estimateActualCost(selectedPreset, question.length);

      result.preset = {
        id: selectedPreset.id,
        name: selectedPreset.name,
        estimatedTime: selectedPreset.estimatedTime,
        actualTime: `${actualTime}s`,
        estimatedCost: selectedPreset.estimatedCost,
        actualCost: `$${actualCost.estimated.toFixed(3)}`,
        overrides: selectedPreset.overrides || [],
        selectionReason: selectedPreset.selectionReason
      };

      console.log('\n📊 Preset Performance Summary:');
      console.log(`   Preset: ${selectedPreset.name} (${selectedPreset.id})`);
      console.log(`   Time: ${actualTime}s (estimated: ${selectedPreset.estimatedTime})`);
      console.log(`   Cost: $${actualCost.estimated.toFixed(3)} (estimated: ${selectedPreset.estimatedCost})`);
      console.log(`   Reason: ${selectedPreset.selectionReason}`);
    }

    return result;
  }

  /**
   * Convert preset configuration to model configuration string
   */
  convertPresetToModelConfig(preset) {
    if (!preset.models || preset.models.length === 0) {
      return null;
    }

    return preset.models.join(',');
  }

  /**
   * Estimate actual cost based on preset and usage
   */
  async estimateActualCost(preset, questionLength = 1000) {
    return await this.presetManager.estimateActualCost(preset.id, questionLength);
  }

  /**
   * Get available presets with descriptions
   */
  getAvailablePresets() {
    return this.presetSelector.getAvailablePresets();
  }

  /**
   * Get preset comparison table
   */
  getPresetComparison() {
    return this.presetManager.getComparisonTable();
  }

  /**
   * Validate a preset configuration
   */
  validatePreset(presetId) {
    return this.presetSelector.validatePreset(presetId);
  }

  /**
   * Run debate with specific preset (convenience method)
   */
  async runRapid(question, projectPath = process.cwd()) {
    return await this.runDebateWithPresets(question, projectPath, {
      preset: 'rapid'
    });
  }

  async runBalanced(question, projectPath = process.cwd()) {
    return await this.runDebateWithPresets(question, projectPath, {
      preset: 'balanced'
    });
  }

  async runMaximumAccuracy(question, projectPath = process.cwd()) {
    return await this.runDebateWithPresets(question, projectPath, {
      preset: 'maximum-accuracy'
    });
  }

  async runDeepAnalysis(question, projectPath = process.cwd()) {
    return await this.runDebateWithPresets(question, projectPath, {
      preset: 'deep-analysis'
    });
  }

  async runCostOptimized(question, projectPath = process.cwd()) {
    return await this.runDebateWithPresets(question, projectPath, {
      preset: 'cost-optimized'
    });
  }

  async runSecurityFocused(question, projectPath = process.cwd()) {
    return await this.runDebateWithPresets(question, projectPath, {
      preset: 'security-focused'
    });
  }
}

/**
 * Factory function to create a preset-integrated debate instance
 */
export function createPresetIntegratedDebate(debateInstance) {
  return new PresetIntegratedDebate(debateInstance);
}

/**
 * Helper function to display preset information
 */
export function displayPresetInfo() {
  const manager = new PresetManager();
  const table = manager.getComparisonTable();

  console.log('\n📋 Available Quality Presets:\n');
  console.log('┌─────────────────┬────────┬──────────┬──────────┬─────────────────────┐');
  console.log('│ Preset          │ Models │ Time     │ Cost     │ Best For            │');
  console.log('├─────────────────┼────────┼──────────┼──────────┼─────────────────────┤');

  table.rows.forEach(row => {
    const [preset, models, time, cost, bestFor] = row;
    console.log(`│ ${preset.padEnd(15)} │ ${models.padEnd(6)} │ ${time.padEnd(8)} │ ${cost.padEnd(8)} │ ${bestFor.padEnd(19)} │`);
  });

  console.log('└─────────────────┴────────┴──────────┴──────────┴─────────────────────┘\n');

  Object.entries(QualityPresets).forEach(([id, preset]) => {
    console.log(manager.formatPresetInfo(id));
    console.log('');
  });
}

/**
 * CLI helper for preset selection
 */
export async function selectPresetInteractively(question, options = {}) {
  const selector = new PresetSelector();
  await selector.initialize();

  const selectedPreset = await selector.selectPreset(question, options);

  console.log('\n🎯 Auto-selected preset:');
  console.log(`   ${selectedPreset.name} (${selectedPreset.id})`);
  console.log(`   Reason: ${selectedPreset.selectionReason}`);
  console.log(`   Time: ${selectedPreset.estimatedTime}`);
  console.log(`   Cost: ${selectedPreset.estimatedCost}`);

  return selectedPreset;
}

export default {
  PresetIntegratedDebate,
  createPresetIntegratedDebate,
  displayPresetInfo,
  selectPresetInteractively
};