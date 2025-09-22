/**
 * Progress Reporter for MCP Debate Consensus
 *
 * Provides visual feedback during long-running debate operations
 * Uses console.error to avoid interfering with MCP protocol on stdout
 */

class ProgressReporter {
  constructor(options = {}) {
    this.interval = options.interval || 30000; // 30s default heartbeat
    this.enabled = options.enabled !== false;
    this.verbose = options.verbose || false;
    this.startTime = Date.now();
    this.modelStatus = new Map();
    this.currentPhase = 'initializing';
    this.heartbeatTimer = null;
    this.lastProgressTime = Date.now();
  }

  /**
   * Start the heartbeat timer that shows the process is alive
   */
  startHeartbeat() {
    if (!this.enabled || this.heartbeatTimer) return;

    // Emit initial status
    this.emitHeartbeat();

    // Start regular heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.emitHeartbeat();
    }, this.interval);
  }

  /**
   * Stop the heartbeat timer
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Emit a heartbeat message showing current status
   */
  emitHeartbeat() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    const activeModels = Array.from(this.modelStatus.entries())
      .filter(([_, status]) => status === 'running')
      .map(([model, _]) => model);

    const waitingModels = Array.from(this.modelStatus.entries())
      .filter(([_, status]) => status === 'waiting')
      .map(([model, _]) => model);

    const completedCount = Array.from(this.modelStatus.values())
      .filter(status => status === 'completed').length;

    let statusMsg = `[MCP ALIVE] ${minutes}m ${seconds}s | Phase: ${this.currentPhase}`;

    if (activeModels.length > 0) {
      statusMsg += ` | Active: ${activeModels.join(', ')}`;
    }

    if (waitingModels.length > 0 && this.verbose) {
      statusMsg += ` | Waiting: ${waitingModels.join(', ')}`;
    }

    if (completedCount > 0) {
      statusMsg += ` | Completed: ${completedCount}`;
    }

    console.error(statusMsg);
  }

  /**
   * Update the status of a specific model
   */
  updateModelStatus(model, status) {
    this.modelStatus.set(model, status);

    if (this.verbose || status === 'failed' || status === 'completed') {
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);
      const statusIcon = {
        'starting': '🔄',
        'running': '⚡',
        'completed': '✅',
        'failed': '❌',
        'waiting': '⏳'
      }[status] || '❓';

      console.error(`[${elapsed}s] ${statusIcon} ${model}: ${status}`);
    }
  }

  /**
   * Set the current phase of the debate
   */
  setPhase(phase) {
    this.currentPhase = phase;
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    console.error(`\n[${elapsed}s] ➤ ${phase}`);
    console.error('─'.repeat(50));
  }

  /**
   * Report progress with optional details
   */
  progress(message, details = {}) {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    console.error(`[${elapsed}s] ${message}`);

    if (details.model) {
      console.error(`  └─ Model: ${details.model}`);
    }

    if (details.status) {
      console.error(`  └─ Status: ${details.status}`);
    }

    if (details.percentage !== undefined) {
      const bar = this.renderProgressBar(details.percentage);
      console.error(`  └─ ${bar} ${details.percentage}%`);
    }

    if (details.details) {
      console.error(`  └─ ${details.details}`);
    }

    this.lastProgressTime = Date.now();
  }

  /**
   * Render a visual progress bar
   */
  renderProgressBar(percentage) {
    const width = 20;
    const filled = Math.round(width * percentage / 100);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }

  /**
   * Report completion of the entire operation
   */
  complete(message) {
    this.stopHeartbeat();
    const totalTime = Math.round((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;

    console.error('\n' + '='.repeat(50));
    console.error(`[COMPLETE] ✅ ${message}`);
    console.error(`Total time: ${minutes}m ${seconds}s`);
    console.error('='.repeat(50) + '\n');
  }

  /**
   * Report an error
   */
  error(message, error = null) {
    this.stopHeartbeat();
    console.error('\n' + '!'.repeat(50));
    console.error(`[ERROR] ❌ ${message}`);
    if (error && this.verbose) {
      console.error(`Details: ${error.message || error}`);
    }
    console.error('!'.repeat(50) + '\n');
  }

  /**
   * Report a warning
   */
  warning(message) {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    console.error(`[${elapsed}s] ⚠️  ${message}`);
  }

  /**
   * Check if progress reporting is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime() {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  /**
   * Format time in human-readable format
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }
}

export { ProgressReporter };