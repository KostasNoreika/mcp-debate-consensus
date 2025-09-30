/**
 * Adapter Test Suite
 * Tests for CLI adapter system
 */

import { jest } from '@jest/globals';

// Mock fs module for ESM
jest.unstable_mockModule('fs', () => {
  const mocked = {
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => '{}'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(() => []),
    promises: {
      readFile: jest.fn(() => Promise.resolve('{}')),
      writeFile: jest.fn(() => Promise.resolve()),
      mkdir: jest.fn(() => Promise.resolve()),
      access: jest.fn(() => Promise.resolve())
    }
  };
  return {
    ...mocked,
    default: mocked  // Add default export for compatibility
  };
});

// Mock child_process for CLI testing
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn()
}));

jest.unstable_mockModule('node-fetch', () => ({
  default: jest.fn()
}));

// Import modules after mocking
const { default: BaseAdapter } = await import('../../src/adapters/base-adapter.js');
const { default: ClaudeAdapter } = await import('../../src/adapters/claude-adapter.js');
const { default: CodexAdapter } = await import('../../src/adapters/codex-adapter.js');
const { default: GeminiAdapter } = await import('../../src/adapters/gemini-adapter.js');
const { default: FallbackAdapter } = await import('../../src/adapters/fallback-adapter.js');
const { AdapterFactory } = await import('../../src/adapters/adapter-factory.js');
const fs = await import('fs');

describe('BaseAdapter', () => {
  let adapter;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    adapter = new BaseAdapter({
      name: 'TestAdapter',
      modelId: 'test-model',
      cliPath: '/usr/bin/test'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up environment
    delete process.env.NODE_ENV;
  });

  test('should initialize with correct properties', () => {
    expect(adapter.name).toBe('TestAdapter');
    expect(adapter.modelId).toBe('test-model');
    expect(adapter.cliPath).toBe('/usr/bin/test');
    expect(adapter.capabilities).toMatchObject({
      streaming: false,
      mcp: false,
      fileAccess: false,
      toolUse: false,
      contextWindow: 8192
    });
  });

  test('should throw error for unimplemented detectCapabilities', async () => {
    await expect(adapter.detectCapabilities()).rejects.toThrow(
      'detectCapabilities() must be implemented by subclass'
    );
  });

  test('should validate configuration', async () => {
    // Should pass in test environment
    await expect(adapter.validateConfiguration()).resolves.toBe(true);
  });

  test('should throw error if CLI path not configured', async () => {
    // Temporarily disable test environment detection
    const originalIsTest = adapter.isTestEnvironment;
    adapter.isTestEnvironment = () => false;

    adapter.cliPath = null;
    await expect(adapter.validateConfiguration()).rejects.toThrow(
      'CLI path not configured for TestAdapter'
    );

    // Restore original method
    adapter.isTestEnvironment = originalIsTest;
  });

  test('should format response correctly', () => {
    const result = {
      stdout: 'Test output',
      stderr: 'Test error',
      code: 0
    };

    const formatted = adapter.formatResponse(result);

    expect(formatted).toMatchObject({
      adapter: 'TestAdapter',
      model: 'test-model',
      response: 'Test output',
      metadata: {
        stderr: 'Test error',
        exitCode: 0
      }
    });

    expect(formatted.metadata.timestamp).toBeDefined();
  });

  test('should handle resource monitoring', () => {
    jest.useFakeTimers();

    adapter.startResourceMonitoring();
    expect(adapter.resourceMonitor).toBeDefined();

    adapter.stopResourceMonitoring();
    expect(adapter.resourceMonitor).toBeNull();

    jest.useRealTimers();
  });

  test('should clean up resources', async () => {
    adapter.startResourceMonitoring();
    await adapter.cleanup();
    expect(adapter.resourceMonitor).toBeNull();
  });
});

describe('ClaudeAdapter', () => {
  let adapter;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    adapter = new ClaudeAdapter({
      modelId: 'claude-opus-4.1',
      cliPath: 'claude'
    });
  });

  test('should initialize with Claude-specific capabilities', () => {
    expect(adapter.capabilities).toMatchObject({
      streaming: true,
      mcp: true,
      fileAccess: true,
      toolUse: true,
      contextWindow: 200000
    });
  });

  test('should build Claude CLI arguments correctly', () => {
    const args = adapter.buildArgs({
      model: 'claude-opus-4.1',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: 'You are helpful',
      files: ['file1.txt', 'file2.md']
    });

    expect(args).toContain('--model');
    expect(args).toContain('claude-opus-4.1');
    expect(args).toContain('--temperature');
    expect(args).toContain('0.7');
    expect(args).toContain('--max-tokens');
    expect(args).toContain('1000');
    expect(args).toContain('--system');
    expect(args).toContain('You are helpful');
    expect(args).toContain('--file');
    expect(args).toContain('file1.txt');
    expect(args).toContain('--non-interactive');
  });

  test('should build environment variables correctly', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const env = adapter.buildEnv({
      debug: true
    });

    expect(env.ANTHROPIC_API_KEY).toBe('test-key');
    expect(env.CLAUDE_DEBUG).toBe('1');
  });

  test('should extract code blocks from response', () => {
    const text = `
Here is some code:
\`\`\`javascript
console.log('hello');
\`\`\`
And more:
\`\`\`python
print("world")
\`\`\`
    `;

    const blocks = adapter.extractCodeBlocks(text);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      language: 'javascript',
      content: "console.log('hello');"
    });
    expect(blocks[1]).toMatchObject({
      language: 'python',
      content: 'print("world")'
    });
  });
});

describe('CodexAdapter', () => {
  let adapter;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    adapter = new CodexAdapter({
      modelId: 'gpt-5',
      apiKey: 'test-key'
    });
  });

  test('should initialize with Codex-specific capabilities', () => {
    expect(adapter.capabilities).toMatchObject({
      streaming: true,
      mcp: false,
      fileAccess: true,
      toolUse: true,
      contextWindow: 128000
    });
  });

  test('should handle rate limiting', async () => {
    jest.useFakeTimers();

    // Set rate limiter near limit
    adapter.rateLimiter.currentRequests = 49;
    adapter.rateLimiter.currentTokens = 140000;

    const checkPromise = adapter.checkRateLimit(20000);

    // Should wait
    jest.advanceTimersByTime(60000);

    await checkPromise;

    // Counters should be reset
    expect(adapter.rateLimiter.currentRequests).toBe(1);
    expect(adapter.rateLimiter.currentTokens).toBe(20000);

    jest.useRealTimers();
  });

  test('should build Codex CLI arguments correctly', () => {
    const args = adapter.buildArgs({
      model: 'gpt-5',
      temperature: 0.5,
      maxTokens: 2000,
      systemPrompt: 'You are an assistant',
      functions: [{ name: 'test' }],
      seed: 42
    });

    expect(args).toContain('--model');
    expect(args).toContain('gpt-5');
    expect(args).toContain('--temperature');
    expect(args).toContain('0.5');
    expect(args).toContain('--seed');
    expect(args).toContain('42');
    expect(args).toContain('--json');
    expect(args).toContain('--non-interactive');
  });

  test('should get default functions', () => {
    const functions = adapter.getDefaultFunctions();

    expect(functions).toHaveLength(3);
    expect(functions[0].name).toBe('read_file');
    expect(functions[1].name).toBe('write_file');
    expect(functions[2].name).toBe('run_command');
  });
});

describe('GeminiAdapter', () => {
  let adapter;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    adapter = new GeminiAdapter({
      modelId: 'gemini-2.5-pro',
      apiKey: 'test-key'
    });
    // Set capabilities for test since detectCapabilities won't run properly in mock environment
    adapter.capabilities.codeExecution = true;
    adapter.capabilities.grounding = true;
    adapter.sandboxMode = true;
  });

  test('should initialize with Gemini-specific capabilities', () => {
    expect(adapter.capabilities).toMatchObject({
      streaming: true,
      mcp: false,
      fileAccess: true,
      toolUse: true,
      contextWindow: 1000000,
      multimodal: true
    });
  });

  test('should build Gemini CLI arguments correctly', () => {
    const args = adapter.buildArgs({
      model: 'gemini-2.5-pro',
      temperature: 0.8,
      maxTokens: 4096,
      systemPrompt: 'Be creative',
      codeExecution: true,
      grounding: true,
      topK: 40,
      topP: 0.95
    });

    expect(args).toContain('--model');
    expect(args).toContain('gemini-2.5-pro');
    expect(args).toContain('--enable-code-execution');
    expect(args).toContain('--sandbox');
    expect(args).toContain('--enable-grounding');
    expect(args).toContain('--top-k');
    expect(args).toContain('40');
    expect(args).toContain('--top-p');
    expect(args).toContain('0.95');
  });

  test('should handle safety settings', () => {
    const args = adapter.buildArgs({
      safetySettings: {
        'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE'
      }
    });

    const safetyIndex = args.indexOf('--safety-settings');
    expect(safetyIndex).toBeGreaterThan(-1);
    expect(JSON.parse(args[safetyIndex + 1])).toMatchObject({
      'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE'
    });
  });
});

describe('FallbackAdapter', () => {
  let adapter;
  let fetch;

  beforeEach(async () => {
    fetch = (await import('node-fetch')).default;
    jest.mocked(fetch).mockClear();

    adapter = new FallbackAdapter({
      modelId: 'anthropic/claude-opus-4.1',
      apiKey: 'test-key'
    });
  });

  test('should detect capabilities based on model', async () => {
    await adapter.detectCapabilities();
    expect(adapter.capabilities.contextWindow).toBe(200000);
    expect(adapter.capabilities.toolUse).toBe(true);
  });

  test('should validate configuration', async () => {
    await expect(adapter.validateConfiguration()).resolves.toBe(true);

    adapter.apiKey = null;
    await expect(adapter.validateConfiguration()).rejects.toThrow(
      'OpenRouter API key not configured'
    );

    adapter.apiKey = 'test-key';
    adapter.modelId = null;
    await expect(adapter.validateConfiguration()).rejects.toThrow(
      'Model ID not specified for fallback adapter'
    );
  });

  test('should build messages correctly', () => {
    const messages = adapter.buildMessages('Hello', {
      systemPrompt: 'You are helpful',
      files: ['file1.txt', 'file2.txt']
    });

    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('You are helpful');
    expect(messages[1].role).toBe('system');
    expect(messages[1].content).toContain('file1.txt');
    expect(messages[2].role).toBe('user');
    expect(messages[2].content).toBe('Hello');
  });

  test('should handle API call', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'Test response',
            role: 'assistant'
          },
          finish_reason: 'stop'
        }],
        model: 'anthropic/claude-opus-4.1',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      })
    });

    const response = await adapter.execute('Test prompt');

    expect(response.response).toBe('Test response');
    expect(response.metadata.usage.total_tokens).toBe(15);
    expect(fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key'
        })
      })
    );
  });
});

describe('AdapterFactory', () => {
  let factory;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    factory = new AdapterFactory({
      apiKey: 'test-key'
    });
  });

  afterEach(async () => {
    await factory.cleanup();
  });

  test('should create Claude adapter', async () => {
    const adapter = await factory.createAdapter('claude', {
      modelId: 'claude-opus-4.1'
    });

    expect(adapter).toBeInstanceOf(ClaudeAdapter);
    expect(adapter.modelId).toBe('claude-opus-4.1');
  });

  test('should create Codex adapter', async () => {
    const adapter = await factory.createAdapter('codex', {
      modelId: 'gpt-5'
    });

    expect(adapter).toBeInstanceOf(CodexAdapter);
    expect(adapter.model).toBe('gpt-5');
  });

  test('should create Gemini adapter', async () => {
    const adapter = await factory.createAdapter('gemini', {
      modelId: 'gemini-2.5-pro'
    });

    expect(adapter).toBeInstanceOf(GeminiAdapter);
    expect(adapter.model).toBe('gemini-2.5-pro');
  });

  test('should create Fallback adapter', async () => {
    const adapter = await factory.createAdapter('fallback', {
      modelId: 'test-model'
    });

    expect(adapter).toBeInstanceOf(FallbackAdapter);
    expect(adapter.modelId).toBe('test-model');
  });

  test('should infer adapter from model ID', async () => {
    const claudeAdapter = await factory.inferAdapter({
      modelId: 'anthropic/claude-opus-4.1'
    });

    // Will fallback since CLI not available in test
    expect(claudeAdapter).toBeInstanceOf(FallbackAdapter);
  });

  test('should create team of adapters', async () => {
    const teamConfig = [
      {
        type: 'fallback',
        modelId: 'anthropic/claude-opus-4.1',
        role: 'architect',
        specialization: 'system design'
      },
      {
        type: 'fallback',
        modelId: 'openai/gpt-5',
        role: 'reviewer',
        specialization: 'code review'
      }
    ];

    const team = await factory.createTeam(teamConfig);

    expect(team).toHaveLength(2);
    expect(team[0].role).toBe('architect');
    expect(team[0].model).toBe('anthropic/claude-opus-4.1');
    expect(team[1].role).toBe('reviewer');
    expect(team[1].model).toBe('openai/gpt-5');
  });

  test('should clean up all adapters', async () => {
    await factory.createAdapter('fallback', { modelId: 'model1' });
    await factory.createAdapter('fallback', { modelId: 'model2' });

    expect(factory.adapters.size).toBe(2);

    await factory.cleanup();

    expect(factory.adapters.size).toBe(0);
  });
});