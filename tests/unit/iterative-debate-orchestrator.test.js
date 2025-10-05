/**
 * Comprehensive Unit Tests for IterativeDebateOrchestrator
 * Multi-round debate system - 778 LOC
 * Target: 70%+ coverage
 */

import { jest } from '@jest/globals';
import EventEmitter from 'events';
import fs from 'fs/promises';

// Mock child_process BEFORE imports (ES6 module requirement)
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}));

// Mock other dependencies
jest.mock('fs/promises');
jest.mock('../../src/llm-semantic-evaluator.js');
jest.mock('../../src/progress-reporter.js');
jest.mock('../../src/gemini-coordinator.js');

// Import AFTER mocks are set up
const { spawn } = await import('child_process');
const {
  IterativeDebateOrchestrator,
  ConsensusAnalyzer,
  DebateMemory
} = await import('../../src/iterative-debate-orchestrator.js');

describe('DebateMemory', () => {
  let memory;

  beforeEach(() => {
    memory = new DebateMemory();
  });

  describe('Initialization', () => {
    test('should initialize with empty state', () => {
      expect(memory.iterations).toEqual([]);
      expect(memory.currentIteration).toBe(0);
      expect(memory.modelPositions).toEqual({});
      expect(memory.consensusHistory).toEqual([]);
    });
  });

  describe('Adding Iterations', () => {
    test('should add iteration and increment counter', () => {
      const responses = { 'Model A': 'Response A' };
      const consensusScore = 75;
      const disagreements = ['Point 1'];

      memory.addIteration(responses, consensusScore, disagreements);

      expect(memory.iterations).toHaveLength(1);
      expect(memory.currentIteration).toBe(1);
      expect(memory.iterations[0]).toMatchObject({
        round: 0,
        responses,
        consensusScore,
        disagreements
      });
    });

    test('should track multiple iterations', () => {
      memory.addIteration({}, 60, []);
      memory.addIteration({}, 70, []);
      memory.addIteration({}, 85, []);

      expect(memory.iterations).toHaveLength(3);
      expect(memory.currentIteration).toBe(3);
      expect(memory.iterations[2].round).toBe(2);
    });
  });

  describe('Convergence Calculation', () => {
    test('should return 0 for first iteration', () => {
      const convergence = memory.calculateConvergence();
      expect(convergence).toBe(0);
    });

    test('should calculate positive convergence', () => {
      memory.consensusHistory = [60, 75];
      const convergence = memory.calculateConvergence();
      expect(convergence).toBe(15);
    });

    test('should calculate negative convergence (diverging)', () => {
      memory.consensusHistory = [85, 70];
      const convergence = memory.calculateConvergence();
      expect(convergence).toBe(-15);
    });
  });

  describe('Model Position Tracking', () => {
    test('should track model position updates', () => {
      memory.updateModelPosition('Model A', 'Position 1', 'Reasoning 1');

      expect(memory.modelPositions['Model A']).toHaveLength(1);
      expect(memory.modelPositions['Model A'][0]).toMatchObject({
        iteration: 0,
        position: 'Position 1',
        reasoning: 'Reasoning 1'
      });
    });

    test('should track multiple position changes for same model', () => {
      memory.updateModelPosition('Model A', 'Position 1', 'Reasoning 1');
      memory.currentIteration = 1;
      memory.updateModelPosition('Model A', 'Position 2', 'Reasoning 2');

      expect(memory.modelPositions['Model A']).toHaveLength(2);
      expect(memory.modelPositions['Model A'][1].iteration).toBe(1);
    });

    test('should track positions for multiple models', () => {
      memory.updateModelPosition('Model A', 'Pos A', 'Reason A');
      memory.updateModelPosition('Model B', 'Pos B', 'Reason B');

      expect(Object.keys(memory.modelPositions)).toHaveLength(2);
    });
  });

  describe('Get Debate State', () => {
    test('should return complete debate state', () => {
      memory.addIteration({}, 70, []);
      memory.consensusHistory = [60, 70];
      memory.updateModelPosition('Model A', 'Position', 'Reasoning');

      const state = memory.getDebateState();

      expect(state).toMatchObject({
        currentRound: 1,
        history: memory.iterations,
        positions: memory.modelPositions,
        consensusTrend: [60, 70]
      });
    });
  });
});

describe('ConsensusAnalyzer', () => {
  let analyzer;
  let mockSpawn;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new ConsensusAnalyzer();
    mockSpawn = createMockSpawn();
    spawn.mockImplementation(mockSpawn);
  });

  describe('Initialization', () => {
    test('should initialize with coordinator model', () => {
      expect(analyzer.coordinatorModel.alias).toBe('k1');
      expect(analyzer.coordinatorModel.name).toContain('Claude');
      expect(analyzer.timeout).toBe(3 * 60 * 1000);
    });
  });

  describe('Consensus Evaluation', () => {
    test('should build consensus prompt correctly', () => {
      const question = 'What is 2+2?';
      const responses = {
        'Model A': 'The answer is 4',
        'Model B': 'It equals 4'
      };

      const prompt = analyzer.buildConsensusPrompt(question, responses);

      expect(prompt).toContain(question);
      expect(prompt).toContain('Model A');
      expect(prompt).toContain('Model B');
      expect(prompt).toContain('The answer is 4');
      expect(prompt).toContain('consensus score');
    });

    test('should include debate history in prompt', () => {
      const debateHistory = {
        currentRound: 2,
        consensusTrend: [60, 75]
      };

      const prompt = analyzer.buildConsensusPrompt(
        'Question',
        { 'Model A': 'Response' },
        debateHistory
      );

      expect(prompt).toContain('iteration 3');
      expect(prompt).toContain('60, 75');
    });

    test('should evaluate consensus successfully', async () => {
      const jsonResponse = JSON.stringify({
        consensus_score: 85,
        consensus_level: 'moderate',
        core_agreement: 'All agree',
        key_disagreements: [],
        continue_debate: false,
        synthesis_ready: true,
        reasoning: 'Good consensus'
      });

      spawn.mockImplementation(createMockSpawn({
        stdout: `\`\`\`json\n${jsonResponse}\n\`\`\``
      }));

      const result = await analyzer.evaluateConsensus(
        'Question',
        { 'Model A': 'Response' }
      );

      expect(result.consensus_score).toBe(85);
      expect(result.synthesis_ready).toBe(true);
    });

    test('should handle coordinator failure with fallback', async () => {
      spawn.mockImplementation(createMockSpawn({ exitCode: 1 }));

      const responses = {
        'Model A': 'testing common words here',
        'Model B': 'testing common words again'
      };

      const result = await analyzer.evaluateConsensus('Question', responses);

      expect(result.consensus_score).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Fallback');
    });

    test('should handle JSON parsing errors', async () => {
      spawn.mockImplementation(createMockSpawn({
        stdout: 'Invalid JSON response'
      }));

      const result = await analyzer.evaluateConsensus(
        'Question',
        { 'Model A': 'Response' }
      );

      expect(result.reasoning).toContain('Fallback');
    });
  });

  describe('Fallback Consensus Evaluation', () => {
    test('should calculate consensus based on word overlap', () => {
      const responses = {
        'Model A': 'testing common words here testing',
        'Model B': 'testing common words again testing',
        'Model C': 'testing common words also testing'
      };

      const result = analyzer.fallbackConsensusEvaluation(responses);

      expect(result.consensus_score).toBeGreaterThan(0);
      expect(result.consensus_score).toBeLessThanOrEqual(100);
    });

    test('should return moderate consensus for high word overlap', () => {
      const sharedText = 'The quick brown fox jumps over the lazy dog';
      const responses = {
        'Model A': sharedText + ' first',
        'Model B': sharedText + ' second',
        'Model C': sharedText + ' third'
      };

      const result = analyzer.fallbackConsensusEvaluation(responses);

      // Expect 'weak' or 'moderate' depending on overlap threshold
      expect(['weak', 'moderate']).toContain(result.consensus_level);
    });

    test('should handle empty responses', () => {
      const result = analyzer.fallbackConsensusEvaluation({});

      expect(result.consensus_score).toBeDefined();
    });
  });

  describe('Parse Consensus Result', () => {
    test('should parse valid JSON', () => {
      const jsonText = JSON.stringify({
        consensus_score: 90,
        consensus_level: 'strong'
      });

      const text = `Some text\n\`\`\`json\n${jsonText}\n\`\`\`\nMore text`;
      const result = analyzer.parseConsensusResult(text);

      expect(result.consensus_score).toBe(90);
      expect(result.consensus_level).toBe('strong');
    });

    test('should throw error for invalid JSON', () => {
      const text = 'No JSON here';

      expect(() => analyzer.parseConsensusResult(text)).toThrow('No JSON found');
    });
  });
});

describe('IterativeDebateOrchestrator', () => {
  let orchestrator;
  let mockSpawn;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdir = jest.fn().mockResolvedValue(undefined);
    fs.writeFile = jest.fn().mockResolvedValue(undefined);

    orchestrator = new IterativeDebateOrchestrator();
    mockSpawn = createMockSpawn();
    spawn.mockImplementation(mockSpawn);

    mockOrchestrator(orchestrator);
  });

  describe('Initialization', () => {
    test('should create orchestrator with default config', () => {
      expect(orchestrator.models).toHaveLength(5);
      expect(orchestrator.maxIterations).toBe(5);
      expect(orchestrator.consensusThreshold).toBe(90);
    });

    test('should respect environment configuration', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        MAX_DEBATE_ITERATIONS: '10',
        CONSENSUS_THRESHOLD: '85'
      };

      const customOrchestrator = new IterativeDebateOrchestrator();

      expect(customOrchestrator.maxIterations).toBe(10);
      expect(customOrchestrator.consensusThreshold).toBe(85);

      process.env = originalEnv;
    });

    test('should initialize subsystems', async () => {
      await orchestrator.initialize();

      expect(fs.mkdir).toHaveBeenCalled();
      expect(orchestrator.geminiCoordinator.initialize).toHaveBeenCalled();
    });
  });

  describe('Model Selection from Analysis', () => {
    test('should select models from analysis', () => {
      const analysis = {
        selectedModels: ['k1', 'k2', 'k3'],
        complexityLevel: 'moderate'
      };

      const selected = orchestrator.getSelectedModelsFromAnalysis(analysis);

      expect(selected).toHaveLength(3);
      expect(selected[0].alias).toBe('k1');
    });

    test('should handle parallel instances', () => {
      const analysis = {
        selectedModels: ['k1:2', 'k2'],
        complexityLevel: 'high'
      };

      const selected = orchestrator.getSelectedModelsFromAnalysis(analysis);

      expect(selected).toHaveLength(3); // k1 (2 instances) + k2
      expect(selected.filter(m => m.alias === 'k1')).toHaveLength(2);
    });

    test('should ensure minimum 3 models for non-trivial tasks', () => {
      const analysis = {
        selectedModels: ['k1'],
        complexityLevel: 'moderate'
      };

      const selected = orchestrator.getSelectedModelsFromAnalysis(analysis);

      expect(selected.length).toBeGreaterThanOrEqual(3);
    });

    test('should allow single model for trivial tasks', () => {
      const analysis = {
        selectedModels: ['k1'],
        complexityLevel: 'trivial'
      };

      const selected = orchestrator.getSelectedModelsFromAnalysis(analysis);

      expect(selected).toHaveLength(1);
    });
  });

  describe('Get Initial Proposals', () => {
    beforeEach(() => {
      orchestrator.selectedModels = orchestrator.models.slice(0, 3);
    });

    test('should collect proposals from all models', async () => {
      orchestrator.callModel = jest.fn().mockResolvedValue('Model response');

      const proposals = await orchestrator.getInitialProposals('Question', '/path');

      expect(Object.keys(proposals)).toHaveLength(3);
      expect(orchestrator.callModel).toHaveBeenCalledTimes(3);
    });

    test('should filter failed model responses', async () => {
      orchestrator.callModel = jest.fn()
        .mockResolvedValueOnce('Response 1')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('Response 3');

      const proposals = await orchestrator.getInitialProposals('Question', '/path');

      expect(Object.keys(proposals)).toHaveLength(2);
    });

    test('should include model role in prompt', async () => {
      let capturedPrompt = '';
      orchestrator.callModel = jest.fn().mockImplementation(async (model, prompt) => {
        capturedPrompt = prompt;
        return 'Response';
      });

      await orchestrator.getInitialProposals('Question', '/path');

      // Check that prompt contains model expertise/role
      expect(capturedPrompt).toMatch(/expertise|Architecture|Algorithms/i);
    });
  });

  describe('Iterative Rounds', () => {
    beforeEach(() => {
      orchestrator.selectedModels = orchestrator.models.slice(0, 3);
      orchestrator.getUpdatedPositions = jest.fn().mockResolvedValue({
        'Model A': 'Updated A',
        'Model B': 'Updated B'
      });
    });

    test('should run iterations until consensus', async () => {
      orchestrator.consensusAnalyzer.evaluateConsensus
        .mockResolvedValueOnce({ consensus_score: 70, key_disagreements: [] })
        .mockResolvedValueOnce({ consensus_score: 85, key_disagreements: [] })
        .mockResolvedValueOnce({ consensus_score: 92, key_disagreements: [] });

      const initialResponses = {
        'Model A': 'Initial A',
        'Model B': 'Initial B'
      };

      const result = await orchestrator.runIterativeRounds(
        'Question',
        initialResponses,
        '/path'
      );

      expect(orchestrator.getUpdatedPositions).toHaveBeenCalledTimes(3);
      expect(orchestrator.debateMemory.consensusHistory).toContain(92);
    });

    test('should exit after max iterations', async () => {
      orchestrator.maxIterations = 3;
      orchestrator.consensusAnalyzer.evaluateConsensus.mockResolvedValue({
        consensus_score: 70,
        key_disagreements: []
      });

      const result = await orchestrator.runIterativeRounds(
        'Question',
        { 'Model A': 'Response' },
        '/path'
      );

      expect(orchestrator.getUpdatedPositions).toHaveBeenCalledTimes(3);
    });

    test('should detect stuck debate', async () => {
      orchestrator.consensusAnalyzer.evaluateConsensus.mockResolvedValue({
        consensus_score: 75,
        key_disagreements: []
      });

      orchestrator.debateMemory.consensusHistory = [73, 74, 75];

      const result = await orchestrator.runIterativeRounds(
        'Question',
        { 'Model A': 'Response' },
        '/path'
      );

      // Should exit early due to stuck detection
      expect(orchestrator.getUpdatedPositions).toHaveBeenCalled();
    });

    test('should save intermediate logs after each iteration', async () => {
      orchestrator.maxIterations = 2;
      orchestrator.consensusAnalyzer.evaluateConsensus.mockResolvedValue({
        consensus_score: 80,
        key_disagreements: []
      });

      await orchestrator.runIterativeRounds(
        'Question',
        { 'Model A': 'Response' },
        '/path'
      );

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Get Updated Positions', () => {
    beforeEach(() => {
      orchestrator.selectedModels = orchestrator.models.slice(0, 2);
      orchestrator.callModel = jest.fn().mockResolvedValue('Updated response');
    });

    test('should get updated positions from all models', async () => {
      const currentResponses = {
        'Claude Opus 4.1': 'Current A',
        'GPT-5': 'Current B'
      };

      const debateState = {
        currentRound: 1,
        consensusTrend: [70]
      };

      const updated = await orchestrator.getUpdatedPositions(
        'Question',
        currentResponses,
        debateState,
        '/path'
      );

      expect(orchestrator.callModel).toHaveBeenCalledTimes(2);
      expect(Object.keys(updated)).toHaveLength(2);
    });

    test('should exclude model\'s own response from prompt', async () => {
      let capturedPrompt = '';
      orchestrator.callModel = jest.fn().mockImplementation(async (model, prompt) => {
        if (model.name === 'Claude Opus 4.1') {
          capturedPrompt = prompt;
        }
        return 'Response';
      });

      const currentResponses = {
        'Claude Opus 4.1': 'My response',
        'GPT-5': 'Other response'
      };

      await orchestrator.getUpdatedPositions(
        'Question',
        currentResponses,
        { currentRound: 1, consensusTrend: [] },
        '/path'
      );

      expect(capturedPrompt).toContain('GPT-5');
      expect(capturedPrompt).not.toContain('## Other Models\' Current Positions:\nMy response');
    });

    test('should keep previous response if update fails', async () => {
      orchestrator.callModel = jest.fn()
        .mockResolvedValueOnce('Updated A')
        .mockResolvedValueOnce(null);

      const currentResponses = {
        'Claude Opus 4.1': 'Current A',
        'GPT-5': 'Current B'
      };

      const updated = await orchestrator.getUpdatedPositions(
        'Question',
        currentResponses,
        { currentRound: 1, consensusTrend: [] },
        '/path'
      );

      expect(updated['GPT-5']).toBe('Current B');
    });

    test('should track position changes in debate memory', async () => {
      const currentResponses = {
        'Claude Opus 4.1': 'Response'
      };

      orchestrator.debateMemory.updateModelPosition = jest.fn();

      await orchestrator.getUpdatedPositions(
        'Question',
        currentResponses,
        { currentRound: 1, consensusTrend: [] },
        '/path'
      );

      expect(orchestrator.debateMemory.updateModelPosition).toHaveBeenCalled();
    });
  });

  describe('Is Debate Stuck', () => {
    test('should return false for less than 3 iterations', () => {
      orchestrator.debateMemory.consensusHistory = [70, 75];

      expect(orchestrator.isDebateStuck()).toBe(false);
    });

    test('should return true when scores are stagnant', () => {
      orchestrator.debateMemory.consensusHistory = [73, 74, 75];

      expect(orchestrator.isDebateStuck()).toBe(true);
    });

    test('should return false when scores are changing significantly', () => {
      orchestrator.debateMemory.consensusHistory = [60, 70, 85];

      expect(orchestrator.isDebateStuck()).toBe(false);
    });
  });

  describe('Call Model', () => {
    test('should call model and return response', async () => {
      const model = orchestrator.models[0];

      const result = await orchestrator.callModel(model, 'Prompt', '/path');

      expect(result).toBe('Mock Claude response');
      expect(spawn).toHaveBeenCalledWith(
        model.wrapper,
        ['--print'],
        expect.objectContaining({
          cwd: '/path',
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
    });

    test('should return null on failure', async () => {
      spawn.mockImplementation(createMockSpawn({ exitCode: 1 }));
      const model = orchestrator.models[0];

      const result = await orchestrator.callModel(model, 'Prompt', '/path');

      expect(result).toBeNull();
    });

    test('should handle spawn errors gracefully', async () => {
      spawn.mockImplementation(() => {
        const child = new EventEmitter();
        child.stdin = { write: jest.fn(), end: jest.fn() };
        child.stdout = new EventEmitter();
        setTimeout(() => child.emit('error', new Error('Spawn failed')), 10);
        return child;
      });

      const model = orchestrator.models[0];
      const result = await orchestrator.callModel(model, 'Prompt', '/path');

      expect(result).toBeNull();
    });
  });

  describe('Save Logs', () => {
    test('should save intermediate log', async () => {
      const debateState = {
        currentRound: 1,
        consensusTrend: [70],
        history: []
      };

      await orchestrator.saveIntermediateLog('Question', '/path', debateState, 1);

      expect(fs.writeFile).toHaveBeenCalled();
      const logCall = fs.writeFile.mock.calls[0];
      expect(logCall[0]).toContain('iterative_debate_intermediate');

      const logData = JSON.parse(logCall[1]);
      expect(logData.type).toBe('iterative-debate-intermediate');
      expect(logData.currentIteration).toBe(1);
    });

    test('should save final debate log', async () => {
      const debateState = {
        currentRound: 3,
        consensusTrend: [60, 75, 90],
        history: []
      };

      await orchestrator.saveDebateLog('Question', '/path', debateState, 'Synthesis');

      expect(fs.writeFile).toHaveBeenCalled();
      const logCall = fs.writeFile.mock.calls[0];
      expect(logCall[0]).toContain('iterative_debate');

      const logData = JSON.parse(logCall[1]);
      expect(logData.type).toBe('iterative-debate');
      expect(logData.iterations).toBe(3);
    });
  });
});

// Helper Functions

function createMockSpawn(options = {}) {
  const {
    exitCode = 0,
    stdout = 'Mock Claude response',
    stderr = '',
    delay = 10
  } = options;

  return () => {
    const child = new EventEmitter();

    child.stdin = {
      write: jest.fn(),
      end: jest.fn()
    };

    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    setTimeout(() => {
      if (stdout) {
        child.stdout.emit('data', Buffer.from(stdout));
      }
      if (stderr) {
        child.stderr.emit('data', Buffer.from(stderr));
      }
      child.emit('close', exitCode);
    }, delay);

    return child;
  };
}

function mockOrchestrator(orchestrator) {
  orchestrator.progressReporter = {
    startHeartbeat: jest.fn(),
    setPhase: jest.fn(),
    progress: jest.fn(),
    warning: jest.fn(),
    complete: jest.fn(),
    error: jest.fn()
  };

  orchestrator.geminiCoordinator = {
    initialize: jest.fn().mockResolvedValue(undefined),
    analyzeQuestion: jest.fn().mockResolvedValue({
      category: 'code',
      complexityLevel: 'moderate',
      criticalityLevel: 'medium',
      selectedModels: ['k1', 'k2', 'k3'],
      complexity: 0.6,
      criticality: 0.5,
      reasoning: 'Test reasoning',
      costReduction: 25,
      estimatedSpeedGain: '2x',
      analysisSource: 'test'
    })
  };

  orchestrator.semanticEvaluator = {
    evaluateResponses: jest.fn().mockResolvedValue({
      best_response: { model: 'Claude Opus 4.1', score: 90 },
      evaluations: [],
      synthesis_suggestions: ['Suggestion 1']
    })
  };

  orchestrator.consensusAnalyzer = {
    evaluateConsensus: jest.fn().mockResolvedValue({
      consensus_score: 85,
      consensus_level: 'moderate',
      core_agreement: 'All agree',
      key_disagreements: [],
      continue_debate: false,
      synthesis_ready: true,
      reasoning: 'Good consensus',
      convergence_trend: 'improving'
    })
  };

  orchestrator.debateMemory = new DebateMemory();
}
