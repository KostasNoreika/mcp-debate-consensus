/**
 * Preset Integration Module
 *
 * This module provides integration methods for the Quality Presets system
 * with the existing ClaudeCliDebate class. It can be imported and used
 * to add preset functionality without modifying the main class directly.
 */

import { PresetSelector, PresetManager, QualityPresets } from './quality-presets.js';
import logger from '../utils/logger.js';

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

    logger.info('Multi-Model Debate Consensus v2.1 (Quality Presets + Intelligent Selection) starting', {
      projectPath,
      question: question.substring(0, 100),
      toolAccess: 'Full MCP integration enabled'
    });

    // Phase 0: Preset Selection and Configuration
    let selectedPreset = null;
    let finalModelConfig = modelConfig;

    if (preset || (!modelConfig && !this.debate.useIntelligentSelection)) {
      this.debate.progressReporter?.setPhase('Selecting quality preset');
      logger.info('PHASE 0: Quality Preset Selection');

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
          logger.info('Applied preset overrides', { overrides: Object.keys(overrides) });
        }

        this.currentPreset = selectedPreset;

        // Log preset information
        logger.info('Preset selected', {
          presetId: selectedPreset.id,
          presetName: selectedPreset.name,
          estimatedCost: selectedPreset.estimatedCost,
          estimatedTime: selectedPreset.estimatedTime
        });

        // Convert preset to model configuration
        finalModelConfig = this.convertPresetToModelConfig(selectedPreset);

        // Update timeout if specified in preset
        if (selectedPreset.timeoutMinutes) {
          this.debate.timeout = selectedPreset.timeoutMinutes * 60 * 1000;
          logger.info('Timeout adjusted', { timeoutMinutes: selectedPreset.timeoutMinutes });
        }

        // Override intelligent selection if preset specifies
        if (selectedPreset.useIntelligentSelection !== undefined) {
          this.debate.useIntelligentSelection = selectedPreset.useIntelligentSelection;
          logger.info('Intelligent selection override', {
            enabled: selectedPreset.useIntelligentSelection,
            source: 'preset'
          });
        }

      } catch (error) {
        logger.warn('Preset selection failed, falling back to standard configuration', {
          error: error.message
        });
      }
    }

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

      logger.info('Preset Performance Summary', {
        preset: selectedPreset.name,
        presetId: selectedPreset.id,
        actualTime: `${actualTime}s`,
        estimatedTime: selectedPreset.estimatedTime,
        actualCost: `$${actualCost.estimated.toFixed(3)}`,
        estimatedCost: selectedPreset.estimatedCost,
        reason: selectedPreset.selectionReason
      });
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

  logger.info('Available Quality Presets');

  const tableHeader = '┌─────────────────┬────────┬──────────┬──────────┬─────────────────────┐\n' +
    '│ Preset          │ Models │ Time     │ Cost     │ Best For            │\n' +
    '├─────────────────┼────────┼──────────┼──────────┼─────────────────────┤';

  const tableRows = table.rows.map(row => {
    const [preset, models, time, cost, bestFor] = row;
    return `│ ${preset.padEnd(15)} │ ${models.padEnd(6)} │ ${time.padEnd(8)} │ ${cost.padEnd(8)} │ ${bestFor.padEnd(19)} │`;
  }).join('\n');

  const tableFooter = '└─────────────────┴────────┴──────────┴──────────┴─────────────────────┘';

  logger.info('Preset comparison table', {
    table: `\n${tableHeader}\n${tableRows}\n${tableFooter}`
  });

  Object.entries(QualityPresets).forEach(([id, preset]) => {
    logger.info('Preset details', {
      id,
      info: manager.formatPresetInfo(id)
    });
  });
}

/**
 * CLI helper for preset selection
 */
export async function selectPresetInteractively(question, options = {}) {
  const selector = new PresetSelector();
  await selector.initialize();

  const selectedPreset = await selector.selectPreset(question, options);

  logger.info('Auto-selected preset', {
    name: selectedPreset.name,
    id: selectedPreset.id,
    reason: selectedPreset.selectionReason,
    estimatedTime: selectedPreset.estimatedTime,
    estimatedCost: selectedPreset.estimatedCost
  });

  return selectedPreset;
}

export default {
  PresetIntegratedDebate,
  createPresetIntegratedDebate,
  displayPresetInfo,
  selectPresetInteractively
};