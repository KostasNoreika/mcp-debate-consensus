/**
 * Simple Adapter Tests
 * Basic tests without complex mocking
 */

import BaseAdapter from '../../src/adapters/base-adapter.js';
import ClaudeAdapter from '../../src/adapters/claude-adapter.js';
import CodexAdapter from '../../src/adapters/codex-adapter.js';
import GeminiAdapter from '../../src/adapters/gemini-adapter.js';
import FallbackAdapter from '../../src/adapters/fallback-adapter.js';

describe('BaseAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new BaseAdapter({
      name: 'TestAdapter',
      modelId: 'test-model',
      cliPath: '/usr/bin/test'
    });
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
    adapter.startResourceMonitoring();
    expect(adapter.resourceMonitor).toBeDefined();

    adapter.stopResourceMonitoring();
    expect(adapter.resourceMonitor).toBeNull();
  });
});

describe('ClaudeAdapter', () => {
  let adapter;

  beforeEach(() => {
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

  test('should build Codex CLI arguments correctly', () => {
    const args = adapter.buildArgs({
      model: 'gpt-5',
      temperature: 0.5,
      maxTokens: 2000,
      systemPrompt: 'You are an assistant',
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
    adapter = new GeminiAdapter({
      modelId: 'gemini-2.5-pro',
      apiKey: 'test-key'
    });
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
    // Enable capabilities for testing
    adapter.capabilities.codeExecution = true;
    adapter.capabilities.grounding = true;

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
});

describe('FallbackAdapter', () => {
  let adapter;

  beforeEach(() => {
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
});