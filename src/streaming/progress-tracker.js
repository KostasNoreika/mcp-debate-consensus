/**
 * Progress Tracker for Streaming Debates
 *
 * Enhanced progress tracking with real-time status updates, stage management,
 * and performance metrics for streaming debate operations.
 */

import { EventEmitter } from 'events';

export class ProgressTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.startTime = Date.now();
    this.stages = new Map();
    this.models = new Map();
    this.metrics = {
      totalModels: 0,
      completedModels: 0,
      failedModels: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
      stageTimings: {}
    };
    this.currentStage = null;
    this.stageHistory = [];
    this.updateInterval = options.updateInterval || 1000; // 1 second
    this.heartbeatTimer = null;
    this.verbose = options.verbose || false;
  }

  /**
   * Initialize progress tracking with debate configuration
   */
  initialize(config = {}) {
    this.metrics.totalModels = config.totalModels || 0;

    // Initialize model states
    if (config.models) {
      config.models.forEach(model => {
        this.models.set(model.alias, {
          name: model.name,
          alias: model.alias,
          expertise: model.expertise,
          status: 'pending',
          startTime: null,
          endTime: null,
          duration: null,
          responseLength: 0,
          error: null
        });
      });
    }

    // Define stage configuration
    this.initializeStages();

    this.startHeartbeat();
    this.emit('initialized', { config, timestamp: Date.now() });
  }

  /**
   * Initialize predefined stages with progress ranges
   */
  initializeStages() {
    const stageConfig = [
      { name: 'initialization', label: 'Initializing system', progressRange: [0, 10] },
      { name: 'model_selection', label: 'Selecting optimal models', progressRange: [10, 25] },
      { name: 'analysis', label: 'Models analyzing question', progressRange: [25, 60] },
      { name: 'evaluation', label: 'Evaluating proposals', progressRange: [60, 70] },
      { name: 'improvements', label: 'Collaborative improvements', progressRange: [70, 85] },
      { name: 'synthesis', label: 'Building consensus', progressRange: [85, 95] },
      { name: 'finalization', label: 'Finalizing results', progressRange: [95, 100] },
      { name: 'complete', label: 'Complete', progressRange: [100, 100] }
    ];

    stageConfig.forEach(stage => {
      this.stages.set(stage.name, {
        ...stage,
        startTime: null,
        endTime: null,
        duration: null,
        progress: stage.progressRange[0],
        status: 'pending'
      });
    });
  }

  /**
   * Start a new stage
   */
  startStage(stageName, customProgress = null) {
    const stage = this.stages.get(stageName);
    if (!stage) {
      throw new Error(`Unknown stage: ${stageName}`);
    }

    // End previous stage
    if (this.currentStage) {
      this.endStage(this.currentStage);
    }

    // Start new stage
    const now = Date.now();
    stage.startTime = now;
    stage.status = 'active';
    stage.progress = customProgress || stage.progressRange[0];
    this.currentStage = stageName;

    this.stageHistory.push({
      stage: stageName,
      action: 'started',
      timestamp: now,
      progress: stage.progress
    });

    this.metrics.stageTimings[stageName] = { start: now };

    this.emit('stage_started', {
      stage: stageName,
      label: stage.label,
      progress: stage.progress,
      timestamp: now
    });

    if (this.verbose) {
      console.error(`[STAGE] ➤ ${stage.label} (${stage.progress}%)`);
    }
  }

  /**
   * End the current stage
   */
  endStage(stageName) {
    const stage = this.stages.get(stageName);
    if (!stage || stage.status !== 'active') return;

    const now = Date.now();
    stage.endTime = now;
    stage.duration = now - stage.startTime;
    stage.status = 'completed';
    stage.progress = stage.progressRange[1];

    this.stageHistory.push({
      stage: stageName,
      action: 'completed',
      timestamp: now,
      duration: stage.duration,
      progress: stage.progress
    });

    if (this.metrics.stageTimings[stageName]) {
      this.metrics.stageTimings[stageName].end = now;
      this.metrics.stageTimings[stageName].duration = stage.duration;
    }

    this.emit('stage_completed', {
      stage: stageName,
      label: stage.label,
      duration: stage.duration,
      progress: stage.progress,
      timestamp: now
    });

    if (this.verbose) {
      console.error(`[STAGE] ✅ ${stage.label} completed (${this.formatDuration(stage.duration)})`);
    }
  }

  /**
   * Update model status
   */
  updateModelStatus(modelAlias, status, data = {}) {
    const model = this.models.get(modelAlias);
    if (!model) return;

    const now = Date.now();
    const previousStatus = model.status;
    model.status = status;

    switch (status) {
      case 'starting':
        model.startTime = now;
        break;

      case 'running':
        if (!model.startTime) model.startTime = now;
        break;

      case 'completed':
        model.endTime = now;
        if (model.startTime) {
          model.duration = now - model.startTime;
          this.metrics.totalResponseTime += model.duration;
          this.metrics.completedModels++;
          this.metrics.avgResponseTime = this.metrics.totalResponseTime / this.metrics.completedModels;
        }
        if (data.responseLength) {
          model.responseLength = data.responseLength;
        }
        break;

      case 'failed':
        model.endTime = now;
        if (model.startTime) {
          model.duration = now - model.startTime;
        }
        model.error = data.error || 'Unknown error';
        this.metrics.failedModels++;
        break;
    }

    this.emit('model_status_updated', {
      model: {
        alias: modelAlias,
        name: model.name,
        expertise: model.expertise
      },
      status,
      previousStatus,
      duration: model.duration,
      timestamp: now,
      ...data
    });

    // Update stage progress for analysis phase
    if (this.currentStage === 'analysis' && status === 'completed') {
      const completionRate = this.metrics.completedModels / this.metrics.totalModels;
      const stageRange = this.stages.get('analysis').progressRange;
      const newProgress = stageRange[0] + (completionRate * (stageRange[1] - stageRange[0]));
      this.updateStageProgress('analysis', newProgress);
    }

    if (this.verbose) {
      const statusIcon = this.getStatusIcon(status);
      const duration = model.duration ? ` (${this.formatDuration(model.duration)})` : '';
      console.error(`[MODEL] ${statusIcon} ${model.name}: ${status}${duration}`);
    }
  }

  /**
   * Update progress for the current stage
   */
  updateStageProgress(stageName, progress) {
    const stage = this.stages.get(stageName);
    if (!stage) return;

    stage.progress = Math.min(progress, stage.progressRange[1]);

    this.emit('progress_updated', {
      stage: stageName,
      progress: stage.progress,
      timestamp: Date.now()
    });
  }

  /**
   * Get comprehensive progress status
   */
  getProgressStatus() {
    const elapsed = Date.now() - this.startTime;
    const currentStage = this.currentStage ? this.stages.get(this.currentStage) : null;

    return {
      elapsed,
      formattedElapsed: this.formatDuration(elapsed),
      currentStage: currentStage ? {
        name: this.currentStage,
        label: currentStage.label,
        progress: currentStage.progress,
        duration: currentStage.startTime ? Date.now() - currentStage.startTime : 0
      } : null,
      overallProgress: this.calculateOverallProgress(),
      models: this.getModelSummary(),
      metrics: { ...this.metrics },
      stages: this.getStagesSummary(),
      timestamp: Date.now()
    };
  }

  /**
   * Calculate overall progress across all stages
   */
  calculateOverallProgress() {
    if (!this.currentStage) return 0;

    const currentStage = this.stages.get(this.currentStage);
    return currentStage ? currentStage.progress : 0;
  }

  /**
   * Get summary of all models and their status
   */
  getModelSummary() {
    const summary = {
      total: this.metrics.totalModels,
      pending: 0,
      running: 0,
      completed: this.metrics.completedModels,
      failed: this.metrics.failedModels,
      models: []
    };

    this.models.forEach((model, alias) => {
      summary.models.push({
        alias,
        name: model.name,
        status: model.status,
        duration: model.duration,
        responseLength: model.responseLength,
        error: model.error
      });

      if (model.status === 'pending') summary.pending++;
      else if (model.status === 'running' || model.status === 'starting') summary.running++;
    });

    return summary;
  }

  /**
   * Get summary of all stages
   */
  getStagesSummary() {
    const stages = [];
    this.stages.forEach((stage, name) => {
      stages.push({
        name,
        label: stage.label,
        status: stage.status,
        progress: stage.progress,
        duration: stage.duration,
        progressRange: stage.progressRange
      });
    });
    return stages;
  }

  /**
   * Start periodic heartbeat updates
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.emit('heartbeat', this.getProgressStatus());
    }, this.updateInterval);
  }

  /**
   * Stop heartbeat updates
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Mark progress tracking as complete
   */
  complete() {
    this.endStage(this.currentStage);
    this.startStage('complete');
    this.stopHeartbeat();

    const totalDuration = Date.now() - this.startTime;

    this.emit('completed', {
      totalDuration,
      formattedDuration: this.formatDuration(totalDuration),
      metrics: this.metrics,
      stages: this.getStagesSummary(),
      timestamp: Date.now()
    });

    if (this.verbose) {
      this.printSummary();
    }
  }

  /**
   * Handle errors and mark as failed
   */
  error(message, error = null) {
    this.stopHeartbeat();

    this.emit('error', {
      message,
      error: error?.message || error,
      timestamp: Date.now(),
      progress: this.getProgressStatus()
    });

    if (this.verbose) {
      console.error(`[ERROR] ❌ ${message}`);
      if (error) console.error(`Details: ${error.message || error}`);
    }
  }

  /**
   * Print a comprehensive summary
   */
  printSummary() {
    const status = this.getProgressStatus();
    console.error('\n' + '='.repeat(60));
    console.error('📊 DEBATE PROGRESS SUMMARY');
    console.error('='.repeat(60));
    console.error(`Total Duration: ${status.formattedElapsed}`);
    console.error(`Models: ${status.models.completed}/${status.models.total} completed`);
    if (status.models.failed > 0) {
      console.error(`Failed: ${status.models.failed}`);
    }
    console.error(`Average Response Time: ${this.formatDuration(this.metrics.avgResponseTime)}`);

    console.error('\nStage Timings:');
    this.stages.forEach((stage, name) => {
      if (stage.duration) {
        console.error(`  ${stage.label}: ${this.formatDuration(stage.duration)}`);
      }
    });
    console.error('='.repeat(60) + '\n');
  }

  /**
   * Get status icon for different states
   */
  getStatusIcon(status) {
    const icons = {
      'pending': '⏳',
      'starting': '🔄',
      'running': '⚡',
      'completed': '✅',
      'failed': '❌'
    };
    return icons[status] || '❓';
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopHeartbeat();
    this.removeAllListeners();
    this.stages.clear();
    this.models.clear();
  }
}