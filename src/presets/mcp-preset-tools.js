/**
 * MCP Preset Tools
 *
 * This module defines the MCP tools for the Quality Presets system.
 * These tools can be integrated into the main MCP server.
 */

import { PresetSelector, PresetManager, QualityPresets } from './quality-presets.js';
import { PresetIntegratedDebate } from './preset-integration.js';

/**
 * Define MCP tools for preset system
 */
export function getPresetTools() {
  return [
    {
      name: 'debate_with_preset',
      description: 'ENHANCED DEBATE with Quality Presets! Choose speed/cost/accuracy tradeoff: rapid (3-5s, $0.01), balanced (30-45s, $0.20), maximum-accuracy (60-90s, $0.50), cost-optimized ($0.005), deep-analysis (90-120s), security-focused. Auto-selects best preset if none specified. Features full MCP tool access + intelligent model selection.',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The problem to solve or analyze'
          },
          preset: {
            type: 'string',
            description: 'Quality preset: rapid, balanced, maximum-accuracy, cost-optimized, deep-analysis, security-focused. Auto-selected if omitted.',
            enum: ['rapid', 'balanced', 'maximum-accuracy', 'cost-optimized', 'deep-analysis', 'security-focused']
          },
          projectPath: {
            type: 'string',
            description: 'Project path to analyze (optional, defaults to current)'
          },
          urgency: {
            type: 'number',
            description: 'Urgency level 0-1 (affects auto-selection, default: 0.5)',
            minimum: 0,
            maximum: 1
          },
          budget: {
            type: 'number',
            description: 'Budget constraint 0-1 (affects auto-selection, default: 0.5)',
            minimum: 0,
            maximum: 1
          },
          overrides: {
            type: 'object',
            description: 'Override specific preset settings',
            properties: {
              models: {
                type: 'array',
                items: { type: 'string' },
                description: 'Override model selection (e.g., ["k1", "k2:2", "k5"])'
              },
              verification: {
                type: 'boolean',
                description: 'Override verification setting'
              },
              timeoutMinutes: {
                type: 'number',
                description: 'Override timeout in minutes'
              }
            }
          }
        },
        required: ['question']
      }
    },
    {
      name: 'list_presets',
      description: 'List all available quality presets with descriptions, time/cost estimates, and best use cases',
      inputSchema: {
        type: 'object',
        properties: {
          detailed: {
            type: 'boolean',
            description: 'Show detailed information for each preset (default: false)'
          }
        }
      }
    },
    {
      name: 'analyze_question_for_preset',
      description: 'Analyze a question to recommend the optimal quality preset without running the debate',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to analyze'
          },
          projectPath: {
            type: 'string',
            description: 'Project path for context (optional)'
          },
          urgency: {
            type: 'number',
            description: 'Urgency level 0-1 (default: 0.5)',
            minimum: 0,
            maximum: 1
          },
          budget: {
            type: 'number',
            description: 'Budget constraint 0-1 (default: 0.5)',
            minimum: 0,
            maximum: 1
          }
        },
        required: ['question']
      }
    },
    {
      name: 'estimate_preset_cost',
      description: 'Estimate the actual cost for running a debate with a specific preset',
      inputSchema: {
        type: 'object',
        properties: {
          preset: {
            type: 'string',
            description: 'Preset to estimate',
            enum: ['rapid', 'balanced', 'maximum-accuracy', 'cost-optimized', 'deep-analysis', 'security-focused']
          },
          questionLength: {
            type: 'number',
            description: 'Length of the question in characters (affects cost, default: 1000)'
          }
        },
        required: ['preset']
      }
    }
  ];
}

/**
 * Handle MCP tool calls for preset system
 */
export async function handlePresetToolCall(name, args, debateInstance, security, history) {
  switch (name) {
    case 'debate_with_preset':
      return await handleDebateWithPreset(args, debateInstance, security, history);

    case 'list_presets':
      return await handleListPresets(args);

    case 'analyze_question_for_preset':
      return await handleAnalyzeQuestionForPreset(args);

    case 'estimate_preset_cost':
      return await handleEstimatePresetCost(args);

    default:
      throw new Error(`Unknown preset tool: ${name}`);
  }
}

/**
 * Handle debate_with_preset tool call
 */
async function handleDebateWithPreset(args, debateInstance, security, history) {
  try {
    // Security validation
    const sanitizedQuestion = security.validateQuestion(args.question);
    const validatedPath = await security.validateProjectPath(args.projectPath);
    security.checkRateLimit('debate_with_preset', 5, 300000); // 5 debates per 5 minutes

    console.error('Starting preset-based debate for:', sanitizedQuestion);

    if (args.preset) {
      console.error('Using preset:', args.preset);
    } else {
      console.error('Auto-selecting preset based on question analysis');
    }

    // Create preset-integrated debate instance
    const presetDebate = new PresetIntegratedDebate(debateInstance);

    // Run debate with preset configuration
    const result = await presetDebate.runDebateWithPresets(
      sanitizedQuestion,
      validatedPath,
      {
        preset: args.preset,
        urgency: args.urgency,
        budget: args.budget,
        overrides: args.overrides || {}
      }
    );

    // Save to history
    const historyId = await history.save({
      question: args.question,
      type: 'preset',
      ...result
    });

    // Format response with preset information
    let response = `✅ Preset Debate Complete!\n\n`;
    response += `**Question:** ${args.question}\n`;
    response += `**History ID:** ${historyId}\n`;

    if (result.preset) {
      response += `**Preset:** ${result.preset.name} (${result.preset.id})\n`;
      response += `**Selection Reason:** ${result.preset.selectionReason}\n`;
      response += `**Time:** ${result.preset.actualTime} (estimated: ${result.preset.estimatedTime})\n`;
      response += `**Cost:** ${result.preset.actualCost} (estimated: ${result.preset.estimatedCost})\n`;
      if (result.preset.overrides.length > 0) {
        response += `**Overrides:** ${result.preset.overrides.join(', ')}\n`;
      }
    }

    response += `**Winner:** ${result.winner}\n`;
    response += `**Score:** ${(typeof result.score === 'number') ? result.score.toFixed(2) :
                 (result.score && typeof result.score.total === 'number') ? result.score.total.toFixed(2) : 'N/A'}\n`;
    response += `**Contributors:** ${result.contributors.join(', ')}\n`;

    if (result.confidence) {
      response += `**Confidence:** ${result.confidence.score}% (${result.confidence.level})\n`;
    }

    response += `\n## Solution\n\n${result.solution}\n\n`;
    response += `---\n*Enhanced multi-model consensus with quality presets*`;

    return {
      content: [{
        type: 'text',
        text: response
      }]
    };

  } catch (error) {
    console.error('Preset debate error:', error);
    return {
      content: [{
        type: 'text',
        text: `Error running preset debate: ${error.message}\n\nFalling back to regular debate functionality.`
      }]
    };
  }
}

/**
 * Handle list_presets tool call
 */
async function handleListPresets(args) {
  try {
    const manager = new PresetManager();

    if (args.detailed) {
      // Show detailed information for each preset
      let response = `📋 Available Quality Presets (Detailed)\n\n`;

      Object.entries(QualityPresets).forEach(([id, preset]) => {
        response += manager.formatPresetInfo(id) + '\n\n';
      });

      return {
        content: [{
          type: 'text',
          text: response
        }]
      };
    } else {
      // Show comparison table
      const table = manager.getComparisonTable();

      let response = `📋 Available Quality Presets\n\n`;
      response += `┌─────────────────┬────────┬──────────┬──────────┬─────────────────────┐\n`;
      response += `│ Preset          │ Models │ Time     │ Cost     │ Best For            │\n`;
      response += `├─────────────────┼────────┼──────────┼──────────┼─────────────────────┤\n`;

      table.rows.forEach(row => {
        const [preset, models, time, cost, bestFor] = row;
        response += `│ ${preset.padEnd(15)} │ ${models.padEnd(6)} │ ${time.padEnd(8)} │ ${cost.padEnd(8)} │ ${bestFor.padEnd(19)} │\n`;
      });

      response += `└─────────────────┴────────┴──────────┴──────────┴─────────────────────┘\n\n`;
      response += `**Usage:** Use \`debate_with_preset\` tool with \`preset\` parameter, or omit for auto-selection.\n`;
      response += `**Auto-selection:** Based on question complexity, urgency, and budget constraints.\n`;
      response += `**Overrides:** Customize any preset with specific model configurations or settings.`;

      return {
        content: [{
          type: 'text',
          text: response
        }]
      };
    }

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error listing presets: ${error.message}`
      }]
    };
  }
}

/**
 * Handle analyze_question_for_preset tool call
 */
async function handleAnalyzeQuestionForPreset(args) {
  try {
    const selector = new PresetSelector();
    await selector.initialize();

    const selectedPreset = await selector.selectPreset(args.question, {
      projectPath: args.projectPath,
      urgency: args.urgency || 0.5,
      budget: args.budget || 0.5
    });

    const manager = new PresetManager();
    const costEstimate = await manager.estimateActualCost(
      selectedPreset.id,
      args.question.length
    );

    let response = `🧠 Question Analysis & Preset Recommendation\n\n`;
    response += `**Question:** ${args.question}\n\n`;
    response += `**Recommended Preset:** ${selectedPreset.name} (${selectedPreset.id})\n`;
    response += `**Reason:** ${selectedPreset.selectionReason}\n`;
    response += `**Estimated Time:** ${selectedPreset.estimatedTime}\n`;
    response += `**Estimated Cost:** ${selectedPreset.estimatedCost}\n`;
    response += `**Refined Cost Estimate:** $${costEstimate.estimated.toFixed(3)} (range: $${costEstimate.range.min.toFixed(3)} - $${costEstimate.range.max.toFixed(3)})\n\n`;

    response += `**Models:** ${selectedPreset.models.join(', ')}\n`;
    response += `**Verification:** ${selectedPreset.verification ? 'Enabled' : 'Disabled'}\n`;
    response += `**Iterations:** ${selectedPreset.iterations}\n`;
    response += `**Consensus Threshold:** ${selectedPreset.consensusThreshold}%\n\n`;

    response += `**Best For:** ${selectedPreset.bestFor.join(', ')}\n\n`;

    response += `**Cost Breakdown:**\n`;
    response += `- Model calls: ${costEstimate.breakdown.modelCalls}\n`;
    response += `- Verification: ${costEstimate.breakdown.verification ? 'Yes' : 'No'}\n`;
    response += `- Length factor: ${costEstimate.breakdown.lengthFactor.toFixed(2)}x\n\n`;

    response += `To run with this preset, use: \`debate_with_preset\` with \`preset: "${selectedPreset.id}"\`\n`;
    response += `Or simply use \`debate_with_preset\` without preset for auto-selection.`;

    return {
      content: [{
        type: 'text',
        text: response
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error analyzing question: ${error.message}`
      }]
    };
  }
}

/**
 * Handle estimate_preset_cost tool call
 */
async function handleEstimatePresetCost(args) {
  try {
    const manager = new PresetManager();
    const preset = QualityPresets[args.preset];

    if (!preset) {
      throw new Error(`Unknown preset: ${args.preset}`);
    }

    const costEstimate = await manager.estimateActualCost(
      args.preset,
      args.questionLength || 1000
    );

    let response = `💰 Cost Estimation for ${preset.name}\n\n`;
    response += `**Preset:** ${preset.name} (${args.preset})\n`;
    response += `**Question Length:** ${args.questionLength || 1000} characters\n\n`;

    response += `**Estimates:**\n`;
    response += `- Base estimate: ${preset.estimatedCost}\n`;
    response += `- Refined estimate: $${costEstimate.estimated.toFixed(3)}\n`;
    response += `- Range: $${costEstimate.range.min.toFixed(3)} - $${costEstimate.range.max.toFixed(3)}\n\n`;

    response += `**Cost Factors:**\n`;
    response += `- Models: ${preset.models.join(', ')}\n`;
    response += `- Model calls: ${costEstimate.breakdown.modelCalls}\n`;
    response += `- Verification: ${costEstimate.breakdown.verification ? 'Yes (+30%)' : 'No'}\n`;
    response += `- Length multiplier: ${costEstimate.breakdown.lengthFactor.toFixed(2)}x\n\n`;

    response += `**Performance:**\n`;
    response += `- Estimated time: ${preset.estimatedTime}\n`;
    response += `- Timeout: ${preset.timeoutMinutes} minutes\n`;
    response += `- Consensus threshold: ${preset.consensusThreshold}%\n`;

    return {
      content: [{
        type: 'text',
        text: response
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error estimating cost: ${error.message}`
      }]
    };
  }
}

export default {
  getPresetTools,
  handlePresetToolCall
};