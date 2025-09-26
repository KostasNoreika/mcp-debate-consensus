/**
 * Telemetry Client for AI Consensus Stats Server
 *
 * Sends anonymous usage statistics to the global stats server
 */

import crypto from 'crypto';

export class TelemetryClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || 'https://stats.noreika.lt/api/telemetry';
    this.enabled = options.enabled !== false && process.env.TELEMETRY_DISABLED !== 'true';
    this.queue = [];
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 60000; // 1 minute
    this.debugMode = options.debug || false;

    if (this.enabled) {
      // Start periodic flush
      this.flushTimer = setInterval(() => this.flush(), this.flushInterval);

      // Show opt-out message once
      if (!process.env.TELEMETRY_NOTICE_SHOWN) {
        console.log('📊 Anonymous telemetry is enabled to help improve AI Expert Consensus');
        console.log('   To opt-out, set TELEMETRY_DISABLED=true in your .env file');
        process.env.TELEMETRY_NOTICE_SHOWN = 'true';
      }
    }
  }

  /**
   * Send telemetry for a debate result
   */
  async send(debateResult) {
    if (!this.enabled) return;

    try {
      // Generate anonymous debate ID
      const debateId = this.generateDebateId(debateResult);

      // Extract telemetry data
      const telemetry = {
        debateId,
        category: debateResult.category || 'unknown',
        models: debateResult.models?.map(m => typeof m === 'string' ? m : m.alias) || [],
        winner: debateResult.winner || null,
        confidence: debateResult.confidence || null,
        responseTime: debateResult.responseTime || debateResult.duration || null,
        consensus: debateResult.consensus !== undefined ? debateResult.consensus : true,
        metadata: {
          modelCount: debateResult.models?.length || 0,
          hasCache: debateResult.fromCache || false,
          preset: debateResult.preset || 'balanced',
          version: '2.0.0'
        }
      };

      // Validate data
      if (!this.validateTelemetry(telemetry)) {
        if (this.debugMode) {
          console.log('Invalid telemetry data:', telemetry);
        }
        return;
      }

      // Add to queue
      this.queue.push(telemetry);

      if (this.debugMode) {
        console.log('Telemetry queued:', telemetry.debateId);
      }

      // Flush if batch size reached
      if (this.queue.length >= this.batchSize) {
        await this.flush();
      }

    } catch (error) {
      if (this.debugMode) {
        console.error('Telemetry error:', error);
      }
    }
  }

  /**
   * Flush telemetry queue to server
   */
  async flush() {
    if (this.queue.length === 0) return;

    // Take current batch
    const batch = this.queue.splice(0, this.batchSize);

    try {
      const response = await fetch(this.endpoint + '/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Expert-Consensus/2.0'
        },
        body: JSON.stringify({ batch }),
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (this.debugMode) {
        console.log(`Telemetry sent: ${result.processed}/${batch.length} items`);
      }

    } catch (error) {
      // Silently fail - don't disrupt main functionality
      if (this.debugMode) {
        console.error('Telemetry flush failed:', error.message);
      }

      // Re-queue failed items (up to a limit)
      if (this.queue.length < this.batchSize * 3) {
        this.queue.push(...batch);
      }
    }
  }

  /**
   * Generate anonymous debate ID
   */
  generateDebateId(debateResult) {
    const data = [
      debateResult.question || '',
      debateResult.category || '',
      JSON.stringify(debateResult.models || []),
      Date.now().toString()
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Validate telemetry data
   */
  validateTelemetry(data) {
    if (!data.debateId || !data.category || !Array.isArray(data.models)) {
      return false;
    }

    if (data.confidence !== null && (data.confidence < 0 || data.confidence > 1)) {
      return false;
    }

    if (data.responseTime !== null && (data.responseTime < 0 || data.responseTime > 3600000)) {
      return false;
    }

    return true;
  }

  /**
   * Shutdown telemetry client
   */
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    await this.flush();
  }
}

// Global telemetry instance
let globalTelemetry = null;

/**
 * Get or create global telemetry client
 */
export function getTelemetryClient(options) {
  if (!globalTelemetry) {
    globalTelemetry = new TelemetryClient(options);
  }
  return globalTelemetry;
}

/**
 * Send telemetry using global client
 */
export async function sendTelemetry(debateResult) {
  const client = getTelemetryClient();
  await client.send(debateResult);
}