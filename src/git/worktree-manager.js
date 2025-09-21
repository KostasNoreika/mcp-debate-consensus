/**
 * Git Worktree Manager
 * Manages isolated git worktrees for parallel agent execution
 */

import { EventEmitter } from 'events';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

class WorktreeManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.baseDir = config.baseDir || '/tmp/debate-worktrees';
    this.repoPath = config.repoPath || process.cwd();
    this.worktrees = new Map();
    this.baseBranch = config.baseBranch || 'main';
    this.maxWorktrees = config.maxWorktrees || 10;
  }

  /**
   * Initialize the worktree manager
   */
  async initialize() {
    // Ensure base directory exists
    await fs.mkdir(this.baseDir, { recursive: true });

    // Verify we're in a git repository
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.repoPath });
    } catch (error) {
      throw new Error(`Not a git repository: ${this.repoPath}`);
    }

    // Get current branch info
    const { stdout: currentBranch } = await execAsync(
      'git symbolic-ref --short HEAD',
      { cwd: this.repoPath }
    );
    this.currentBranch = currentBranch.trim();

    this.emit('initialized', {
      baseDir: this.baseDir,
      repoPath: this.repoPath,
      currentBranch: this.currentBranch
    });

    return this;
  }

  /**
   * Create a new worktree for an agent
   */
  async createWorktree(agentId, options = {}) {
    if (this.worktrees.size >= this.maxWorktrees) {
      throw new Error(`Maximum worktrees (${this.maxWorktrees}) reached`);
    }

    const workspaceId = this.generateWorkspaceId(agentId);
    const worktreePath = path.join(this.baseDir, workspaceId);
    const branchName = options.branchName || `debate-v2/agent-${agentId}`;

    try {
      // Create new branch from base
      const baseBranch = options.baseBranch || this.baseBranch;

      // Check if branch already exists
      try {
        await execAsync(`git show-ref --verify refs/heads/${branchName}`, {
          cwd: this.repoPath
        });
        // Branch exists, delete it first
        await execAsync(`git branch -D ${branchName}`, {
          cwd: this.repoPath
        });
      } catch {
        // Branch doesn't exist, that's fine
      }

      // Create worktree with new branch
      await execAsync(
        `git worktree add -b ${branchName} "${worktreePath}" ${baseBranch}`,
        { cwd: this.repoPath }
      );

      const worktree = {
        id: workspaceId,
        agentId,
        path: worktreePath,
        branch: branchName,
        created: new Date(),
        status: 'active'
      };

      this.worktrees.set(workspaceId, worktree);

      this.emit('worktree:created', worktree);

      return worktree;
    } catch (error) {
      this.emit('worktree:error', {
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute git command in a worktree
   */
  async executeInWorktree(workspaceId, command, options = {}) {
    const worktree = this.worktrees.get(workspaceId);
    if (!worktree) {
      throw new Error(`Worktree not found: ${workspaceId}`);
    }

    try {
      const result = await execAsync(command, {
        cwd: worktree.path,
        ...options
      });

      this.emit('command:executed', {
        workspaceId,
        command,
        output: result.stdout
      });

      return result;
    } catch (error) {
      this.emit('command:error', {
        workspaceId,
        command,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Stage and commit changes in a worktree
   */
  async commitChanges(workspaceId, message, options = {}) {
    const worktree = this.worktrees.get(workspaceId);
    if (!worktree) {
      throw new Error(`Worktree not found: ${workspaceId}`);
    }

    try {
      // Stage changes
      if (options.files) {
        for (const file of options.files) {
          await this.executeInWorktree(workspaceId, `git add "${file}"`);
        }
      } else {
        await this.executeInWorktree(workspaceId, 'git add -A');
      }

      // Check if there are changes to commit
      const { stdout: status } = await this.executeInWorktree(
        workspaceId,
        'git status --porcelain'
      );

      if (!status.trim()) {
        return { committed: false, message: 'No changes to commit' };
      }

      // Commit changes
      const commitMessage = `[Agent ${worktree.agentId}] ${message}`;
      await this.executeInWorktree(
        workspaceId,
        `git commit -m "${commitMessage}"`
      );

      // Get commit hash
      const { stdout: commitHash } = await this.executeInWorktree(
        workspaceId,
        'git rev-parse HEAD'
      );

      this.emit('commit:created', {
        workspaceId,
        agentId: worktree.agentId,
        commitHash: commitHash.trim(),
        message: commitMessage
      });

      return {
        committed: true,
        commitHash: commitHash.trim(),
        message: commitMessage
      };
    } catch (error) {
      this.emit('commit:error', {
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get diff between worktree and base branch
   */
  async getDiff(workspaceId, options = {}) {
    const worktree = this.worktrees.get(workspaceId);
    if (!worktree) {
      throw new Error(`Worktree not found: ${workspaceId}`);
    }

    try {
      const baseBranch = options.baseBranch || this.baseBranch;
      const diffOptions = options.unified ? `-U${options.unified}` : '';

      const { stdout: diff } = await this.executeInWorktree(
        workspaceId,
        `git diff ${diffOptions} ${baseBranch}...HEAD`
      );

      // Get file list
      const { stdout: files } = await this.executeInWorktree(
        workspaceId,
        `git diff --name-only ${baseBranch}...HEAD`
      );

      return {
        diff,
        files: files.trim().split('\n').filter(f => f),
        workspaceId,
        agentId: worktree.agentId
      };
    } catch (error) {
      this.emit('diff:error', {
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Apply patch from another worktree
   */
  async applyPatch(targetWorkspaceId, sourceWorkspaceId, options = {}) {
    const targetWorktree = this.worktrees.get(targetWorkspaceId);
    const sourceWorktree = this.worktrees.get(sourceWorkspaceId);

    if (!targetWorktree || !sourceWorktree) {
      throw new Error('Invalid worktree IDs');
    }

    try {
      // Get diff from source
      const sourceDiff = await this.getDiff(sourceWorkspaceId);

      if (!sourceDiff.diff) {
        return { applied: false, message: 'No changes to apply' };
      }

      // Save diff to temporary file
      const patchFile = path.join(this.baseDir, `patch-${Date.now()}.diff`);
      await fs.writeFile(patchFile, sourceDiff.diff);

      try {
        // Apply patch
        await this.executeInWorktree(
          targetWorkspaceId,
          `git apply ${options.check ? '--check' : ''} "${patchFile}"`
        );

        if (!options.check) {
          this.emit('patch:applied', {
            targetWorkspaceId,
            sourceWorkspaceId,
            files: sourceDiff.files
          });
        }

        return {
          applied: true,
          files: sourceDiff.files
        };
      } finally {
        // Clean up patch file
        await fs.unlink(patchFile).catch(() => {});
      }
    } catch (error) {
      this.emit('patch:error', {
        targetWorkspaceId,
        sourceWorkspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Merge worktree branch back to base
   */
  async mergeToBase(workspaceId, options = {}) {
    const worktree = this.worktrees.get(workspaceId);
    if (!worktree) {
      throw new Error(`Worktree not found: ${workspaceId}`);
    }

    try {
      // Switch to base branch in main repo
      await execAsync(`git checkout ${this.baseBranch}`, {
        cwd: this.repoPath
      });

      // Merge the worktree branch
      const mergeOptions = options.squash ? '--squash' : '';
      await execAsync(`git merge ${mergeOptions} ${worktree.branch}`, {
        cwd: this.repoPath
      });

      this.emit('merge:completed', {
        workspaceId,
        branch: worktree.branch,
        targetBranch: this.baseBranch
      });

      return {
        merged: true,
        sourceBranch: worktree.branch,
        targetBranch: this.baseBranch
      };
    } catch (error) {
      // Try to recover
      await execAsync(`git merge --abort`, { cwd: this.repoPath }).catch(() => {});
      await execAsync(`git checkout ${this.currentBranch}`, {
        cwd: this.repoPath
      }).catch(() => {});

      this.emit('merge:error', {
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(workspaceId, options = {}) {
    const worktree = this.worktrees.get(workspaceId);
    if (!worktree) {
      return { removed: false, message: 'Worktree not found' };
    }

    try {
      // Remove worktree
      await execAsync(`git worktree remove ${options.force ? '--force' : ''} "${worktree.path}"`, {
        cwd: this.repoPath
      });

      // Delete branch if requested
      if (options.deleteBranch) {
        await execAsync(`git branch -D ${worktree.branch}`, {
          cwd: this.repoPath
        }).catch(() => {}); // Ignore if branch doesn't exist
      }

      this.worktrees.delete(workspaceId);

      this.emit('worktree:removed', {
        workspaceId,
        agentId: worktree.agentId
      });

      return {
        removed: true,
        workspaceId,
        agentId: worktree.agentId
      };
    } catch (error) {
      this.emit('worktree:remove:error', {
        workspaceId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up all worktrees
   */
  async cleanup(options = {}) {
    const results = [];

    for (const [workspaceId, worktree] of this.worktrees) {
      try {
        const result = await this.removeWorktree(workspaceId, {
          force: true,
          deleteBranch: options.deleteBranches
        });
        results.push(result);
      } catch (error) {
        results.push({
          removed: false,
          workspaceId,
          error: error.message
        });
      }
    }

    // Prune worktree list
    try {
      await execAsync('git worktree prune', { cwd: this.repoPath });
    } catch {}

    this.emit('cleanup:completed', { results });

    return results;
  }

  /**
   * Get status of all worktrees
   */
  async getStatus() {
    const statuses = [];

    for (const [workspaceId, worktree] of this.worktrees) {
      try {
        const { stdout: status } = await this.executeInWorktree(
          workspaceId,
          'git status --porcelain'
        );

        const { stdout: logLine } = await this.executeInWorktree(
          workspaceId,
          'git log -1 --oneline'
        );

        statuses.push({
          workspaceId,
          agentId: worktree.agentId,
          branch: worktree.branch,
          path: worktree.path,
          hasChanges: !!status.trim(),
          lastCommit: logLine.trim(),
          status: worktree.status
        });
      } catch (error) {
        statuses.push({
          workspaceId,
          agentId: worktree.agentId,
          error: error.message
        });
      }
    }

    return statuses;
  }

  /**
   * Generate unique workspace ID
   */
  generateWorkspaceId(agentId) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5')
      .update(`${agentId}-${timestamp}`)
      .digest('hex')
      .substring(0, 8);
    return `agent-${agentId}-${hash}`;
  }
}

export default WorktreeManager;