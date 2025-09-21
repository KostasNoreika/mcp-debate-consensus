/**
 * Debate Agent
 * Autonomous agent that implements solutions and participates in peer review
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

class DebateAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    this.id = config.id || this.generateId();
    this.adapter = config.adapter;
    this.worktree = null;
    this.role = config.role || 'contributor';
    this.specialization = config.specialization || 'general';
    this.state = 'idle';
    this.memory = new Map();
    this.metrics = {
      tasksCompleted: 0,
      reviewsGiven: 0,
      reviewsReceived: 0,
      improvementsMade: 0,
      executionTime: 0
    };
  }

  /**
   * Initialize the agent
   */
  async initialize(worktreeManager) {
    if (!this.adapter) {
      throw new Error('Adapter is required');
    }

    // Create dedicated worktree
    this.worktree = await worktreeManager.createWorktree(this.id, {
      branchName: `debate-v2/${this.role}-${this.id}`
    });

    this.state = 'ready';

    this.emit('initialized', {
      agentId: this.id,
      role: this.role,
      worktree: this.worktree.path
    });

    return this;
  }

  /**
   * Execute a task
   */
  async executeTask(task, context = {}) {
    if (this.state !== 'ready') {
      throw new Error(`Agent ${this.id} is not ready (state: ${this.state})`);
    }

    const startTime = Date.now();
    this.state = 'executing';

    try {
      // Build prompt based on role and task
      const prompt = this.buildPrompt(task, context);

      // Add system prompt for role
      const systemPrompt = this.getSystemPrompt();

      // Execute via adapter with project context
      const result = await this.adapter.execute(prompt, {
        systemPrompt,
        projectDir: this.worktree.path,
        temperature: this.getTemperature(),
        maxTokens: context.maxTokens || 8192,
        enableMCP: this.role === 'architect' || this.role === 'tester',
        files: context.files || []
      });

      // Process response and extract actions
      const actions = this.parseResponse(result.response);

      // Execute actions in worktree
      const executionResults = await this.executeActions(actions);

      // Update metrics
      this.metrics.tasksCompleted++;
      this.metrics.executionTime += Date.now() - startTime;

      // Store in memory for future reference
      this.memory.set(`task-${Date.now()}`, {
        task,
        response: result.response,
        actions,
        results: executionResults
      });

      this.state = 'ready';

      this.emit('task:completed', {
        agentId: this.id,
        task,
        executionTime: Date.now() - startTime,
        results: executionResults
      });

      return {
        agentId: this.id,
        role: this.role,
        response: result.response,
        actions,
        executionResults,
        code: result.code || []
      };
    } catch (error) {
      this.state = 'error';

      this.emit('task:error', {
        agentId: this.id,
        task,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Review another agent's solution
   */
  async reviewSolution(solution, diff, context = {}) {
    this.state = 'reviewing';

    try {
      const prompt = this.buildReviewPrompt(solution, diff, context);

      const result = await this.adapter.execute(prompt, {
        systemPrompt: this.getReviewSystemPrompt(),
        temperature: 0.3, // Lower temperature for more focused review
        maxTokens: 4096
      });

      const review = this.parseReview(result.response);

      this.metrics.reviewsGiven++;
      this.state = 'ready';

      this.emit('review:completed', {
        agentId: this.id,
        review
      });

      return {
        agentId: this.id,
        role: this.role,
        review,
        suggestions: review.suggestions || [],
        score: review.score || null
      };
    } catch (error) {
      this.state = 'error';

      this.emit('review:error', {
        agentId: this.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Improve solution based on feedback
   */
  async improveSolution(feedback, context = {}) {
    this.state = 'improving';

    try {
      const prompt = this.buildImprovementPrompt(feedback, context);

      const result = await this.adapter.execute(prompt, {
        systemPrompt: this.getImprovementSystemPrompt(),
        projectDir: this.worktree.path,
        temperature: 0.5,
        maxTokens: 8192
      });

      const actions = this.parseResponse(result.response);
      const executionResults = await this.executeActions(actions);

      this.metrics.improvementsMade++;
      this.metrics.reviewsReceived++;
      this.state = 'ready';

      this.emit('improvement:completed', {
        agentId: this.id,
        improvements: executionResults
      });

      return {
        agentId: this.id,
        improvements: executionResults,
        code: result.code || []
      };
    } catch (error) {
      this.state = 'error';

      this.emit('improvement:error', {
        agentId: this.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Build prompt for task execution
   */
  buildPrompt(task, context) {
    const memoryContext = this.getRelevantMemory(task);

    return `
# Task
${task}

# Context
Project Path: ${this.worktree.path}
Your Role: ${this.role}
Specialization: ${this.specialization}

${context.requirements ? `# Requirements\n${context.requirements}\n` : ''}
${context.constraints ? `# Constraints\n${context.constraints}\n` : ''}
${memoryContext ? `# Previous Related Work\n${memoryContext}\n` : ''}

# Instructions
1. Analyze the task requirements
2. Design an appropriate solution
3. Implement the solution with clean, maintainable code
4. Include tests where appropriate
5. Document your implementation decisions

Provide your solution with clear code blocks and explanations.
`;
  }

  /**
   * Build prompt for review
   */
  buildReviewPrompt(solution, diff, context) {
    return `
# Solution to Review
${solution}

# Code Changes (Diff)
\`\`\`diff
${diff}
\`\`\`

# Review Focus
As a ${this.role} with ${this.specialization} expertise, review this solution for:
1. Correctness and completeness
2. Code quality and maintainability
3. Performance implications
4. Security considerations
5. Testing adequacy

# Instructions
Provide constructive feedback with:
- Specific issues found (if any)
- Suggestions for improvement
- Positive aspects to preserve
- Overall assessment score (1-10)

Format your review as JSON with structure:
{
  "score": <number>,
  "strengths": ["..."],
  "issues": ["..."],
  "suggestions": ["..."],
  "mustFix": ["..."]
}
`;
  }

  /**
   * Build prompt for improvement
   */
  buildImprovementPrompt(feedback, context) {
    const aggregatedFeedback = this.aggregateFeedback(feedback);

    return `
# Current Implementation
Located in: ${this.worktree.path}

# Feedback Received
${aggregatedFeedback}

# Improvement Instructions
Based on the feedback:
1. Address all "must fix" issues
2. Implement high-value suggestions
3. Preserve identified strengths
4. Maintain backward compatibility
5. Update tests as needed

Provide specific code changes to improve the solution.
`;
  }

  /**
   * Parse response and extract actions
   */
  parseResponse(response) {
    const actions = [];

    // Extract code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const content = match[2].trim();

      // Determine action type from context
      if (response.includes('create') || response.includes('new file')) {
        actions.push({
          type: 'create_file',
          language,
          content
        });
      } else if (response.includes('update') || response.includes('modify')) {
        actions.push({
          type: 'update_file',
          language,
          content
        });
      } else if (response.includes('test')) {
        actions.push({
          type: 'create_test',
          language,
          content
        });
      }
    }

    // Extract file paths mentioned
    const filePathRegex = /(?:file|create|update|modify)\s+[`"]?([\w\-/.]+\.\w+)[`"]?/gi;
    while ((match = filePathRegex.exec(response)) !== null) {
      const filePath = match[1];
      const existingAction = actions.find(a => a.type.includes('file'));
      if (existingAction && !existingAction.path) {
        existingAction.path = filePath;
      }
    }

    return actions;
  }

  /**
   * Parse review response
   */
  parseReview(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    // Fallback to text parsing
    return {
      score: this.extractScore(response),
      strengths: this.extractListItems(response, 'strength'),
      issues: this.extractListItems(response, 'issue'),
      suggestions: this.extractListItems(response, 'suggestion'),
      mustFix: this.extractListItems(response, 'must fix')
    };
  }

  /**
   * Execute actions in worktree
   */
  async executeActions(actions) {
    const results = [];

    for (const action of actions) {
      try {
        let result;

        switch (action.type) {
          case 'create_file':
            result = await this.createFile(action);
            break;
          case 'update_file':
            result = await this.updateFile(action);
            break;
          case 'create_test':
            result = await this.createTest(action);
            break;
          default:
            result = { success: false, message: `Unknown action: ${action.type}` };
        }

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          action: action.type,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Create a file in worktree
   */
  async createFile(action) {
    const filePath = action.path || this.generateFilePath(action);
    const fullPath = path.join(this.worktree.path, filePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, action.content);

    return {
      success: true,
      type: 'file_created',
      path: filePath
    };
  }

  /**
   * Update a file in worktree
   */
  async updateFile(action) {
    const filePath = action.path;
    if (!filePath) {
      throw new Error('File path required for update');
    }

    const fullPath = path.join(this.worktree.path, filePath);
    await fs.writeFile(fullPath, action.content);

    return {
      success: true,
      type: 'file_updated',
      path: filePath
    };
  }

  /**
   * Create a test file
   */
  async createTest(action) {
    const testPath = action.path || `tests/${this.generateTestFileName(action)}`;
    const fullPath = path.join(this.worktree.path, testPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, action.content);

    return {
      success: true,
      type: 'test_created',
      path: testPath
    };
  }

  /**
   * Get system prompt based on role
   */
  getSystemPrompt() {
    const prompts = {
      architect: 'You are a system architect focused on design patterns, scalability, and maintainability.',
      implementer: 'You are a skilled programmer focused on clean, efficient implementation.',
      tester: 'You are a QA engineer focused on comprehensive testing and edge cases.',
      reviewer: 'You are a code reviewer focused on quality, security, and best practices.',
      optimizer: 'You are a performance engineer focused on optimization and efficiency.'
    };

    return prompts[this.role] || prompts.implementer;
  }

  /**
   * Get review system prompt
   */
  getReviewSystemPrompt() {
    return `You are a ${this.role} providing constructive peer review.
Focus on actionable feedback that improves the solution.
Be specific about issues and provide concrete suggestions.`;
  }

  /**
   * Get improvement system prompt
   */
  getImprovementSystemPrompt() {
    return `You are improving your solution based on peer feedback.
Prioritize critical issues and high-value suggestions.
Maintain the working parts while fixing problems.`;
  }

  /**
   * Get temperature based on role
   */
  getTemperature() {
    const temperatures = {
      architect: 0.7,
      implementer: 0.5,
      tester: 0.3,
      reviewer: 0.3,
      optimizer: 0.4
    };

    return temperatures[this.role] || 0.5;
  }

  /**
   * Get relevant memory for context
   */
  getRelevantMemory(task) {
    // Simple keyword matching for now
    const relevant = [];

    for (const [key, memory] of this.memory) {
      if (memory.task && memory.task.includes(task.substring(0, 50))) {
        relevant.push(memory);
      }
    }

    return relevant.map(m => `Previous: ${m.task}\nResult: ${m.results}`).join('\n');
  }

  /**
   * Aggregate feedback from multiple agents
   */
  aggregateFeedback(feedback) {
    if (Array.isArray(feedback)) {
      return feedback.map(f =>
        `## Feedback from ${f.agentId} (${f.role})\n` +
        `Score: ${f.review.score}/10\n` +
        `Issues: ${f.review.issues?.join(', ') || 'None'}\n` +
        `Suggestions: ${f.review.suggestions?.join(', ') || 'None'}\n`
      ).join('\n');
    }

    return JSON.stringify(feedback, null, 2);
  }

  /**
   * Utility functions
   */
  extractScore(text) {
    const match = text.match(/score[:\s]+(\d+)/i);
    return match ? parseInt(match[1]) : null;
  }

  extractListItems(text, keyword) {
    const regex = new RegExp(`${keyword}[s]?[:\s]+([^\n]+)`, 'gi');
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1].trim());
    }

    return matches;
  }

  generateFilePath(action) {
    const ext = action.language === 'javascript' ? 'js' : action.language;
    return `src/generated-${Date.now()}.${ext}`;
  }

  generateTestFileName(action) {
    const ext = action.language === 'javascript' ? 'js' : action.language;
    return `test-${Date.now()}.test.${ext}`;
  }

  generateId() {
    return Math.random().toString(36).substring(2, 9);
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      id: this.id,
      role: this.role,
      specialization: this.specialization,
      state: this.state,
      worktree: this.worktree?.path,
      metrics: this.metrics,
      memorySize: this.memory.size
    };
  }

  /**
   * Cleanup agent resources
   */
  async cleanup() {
    this.state = 'cleaning';
    this.memory.clear();
    this.removeAllListeners();
    // Worktree cleanup handled by manager
  }
}

export default DebateAgent;