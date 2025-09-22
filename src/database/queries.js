/**
 * Database Query Helpers
 * Provides efficient query methods for performance tracking
 */

/**
 * Database Query Helper Class
 * Provides optimized queries for performance tracking and analysis
 */
export class DatabaseQueries {
  constructor(db) {
    this.db = db;
    this.preparedStatements = {};
    this.initializePreparedStatements();
  }

  /**
   * Initialize prepared statements for better performance
   */
  initializePreparedStatements() {
    // Insert operations
    this.preparedStatements.insertDebate = this.db.prepare(`
      INSERT INTO debates (id, timestamp, category, question, complexity, models_used, winner, consensus_score, user_feedback, project_path, total_time_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.preparedStatements.insertModelPerformance = this.db.prepare(`
      INSERT INTO model_performance (debate_id, model, score, response_time_seconds, tokens_used, cost, error_occurred, error_message, proposal_length, improvements_provided)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.preparedStatements.upsertCategoryProfile = this.db.prepare(`
      INSERT INTO category_profiles (category, model, win_rate, avg_score, avg_time_seconds, avg_cost, total_debates, total_wins, total_errors, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(category, model) DO UPDATE SET
        win_rate = excluded.win_rate,
        avg_score = excluded.avg_score,
        avg_time_seconds = excluded.avg_time_seconds,
        avg_cost = excluded.avg_cost,
        total_debates = excluded.total_debates,
        total_wins = excluded.total_wins,
        total_errors = excluded.total_errors,
        last_updated = excluded.last_updated
    `);

    this.preparedStatements.insertPerformanceTrend = this.db.prepare(`
      INSERT OR REPLACE INTO performance_trends (model, category, date, avg_score, debates_count, win_rate, avg_cost, avg_time_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Select operations
    this.preparedStatements.getModelPerformanceByCategory = this.db.prepare(`
      SELECT * FROM category_profiles
      WHERE category = ?
      ORDER BY win_rate DESC, avg_score DESC
    `);

    this.preparedStatements.getModelOverallPerformance = this.db.prepare(`
      SELECT
        model,
        AVG(win_rate) as overall_win_rate,
        AVG(avg_score) as overall_avg_score,
        AVG(avg_time_seconds) as overall_avg_time,
        SUM(total_debates) as total_debates,
        SUM(total_wins) as total_wins,
        SUM(total_errors) as total_errors
      FROM category_profiles
      WHERE model = ?
      GROUP BY model
    `);

    this.preparedStatements.getDebateHistory = this.db.prepare(`
      SELECT * FROM debates
      WHERE category = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    this.preparedStatements.getRecentPerformance = this.db.prepare(`
      SELECT
        mp.model,
        AVG(mp.score) as avg_score,
        COUNT(*) as debate_count,
        SUM(CASE WHEN d.winner = mp.model THEN 1 ELSE 0 END) as wins
      FROM model_performance mp
      JOIN debates d ON mp.debate_id = d.id
      WHERE d.timestamp > ?
      GROUP BY mp.model
      ORDER BY avg_score DESC
    `);
  }

  /**
   * Record a complete debate result
   * @param {Object} debateData - Complete debate information
   * @param {Array} modelPerformances - Array of model performance data
   */
  async recordDebate(debateData, modelPerformances) {
    const transaction = this.db.transaction(() => {
      // Insert main debate record
      this.preparedStatements.insertDebate.run(
        debateData.id,
        debateData.timestamp,
        debateData.category,
        debateData.question,
        debateData.complexity,
        JSON.stringify(debateData.modelsUsed),
        debateData.winner,
        debateData.consensusScore,
        debateData.userFeedback,
        debateData.projectPath,
        debateData.totalTimeSeconds
      );

      // Insert model performance records
      modelPerformances.forEach(perf => {
        this.preparedStatements.insertModelPerformance.run(
          debateData.id,
          perf.model,
          perf.score || null,
          perf.responseTimeSeconds || null,
          perf.tokensUsed || null,
          perf.cost || null,
          perf.errorOccurred || false,
          perf.errorMessage || null,
          perf.proposalLength || null,
          perf.improvementsProvided || false
        );
      });

      // Update category profiles for each model
      this.updateCategoryProfiles(debateData.category, modelPerformances, debateData.winner);

      // Update daily performance trends
      this.updatePerformanceTrends(debateData.category, modelPerformances, debateData.timestamp);
    });

    transaction();
  }

  /**
   * Update category profiles based on new debate results
   * @param {string} category - Debate category
   * @param {Array} modelPerformances - Model performance data
   * @param {string} winner - Winning model name
   */
  updateCategoryProfiles(category, modelPerformances, winner) {
    modelPerformances.forEach(perf => {
      // Get current profile
      const current = this.db.prepare(`
        SELECT * FROM category_profiles WHERE category = ? AND model = ?
      `).get(category, perf.model);

      let newProfile;
      if (current) {
        // Update existing profile
        const newTotalDebates = current.total_debates + 1;
        const newTotalWins = current.total_wins + (winner === perf.model ? 1 : 0);
        const newTotalErrors = current.total_errors + (perf.errorOccurred ? 1 : 0);

        newProfile = {
          category,
          model: perf.model,
          winRate: newTotalWins / newTotalDebates,
          avgScore: perf.score ?
            ((current.avg_score * current.total_debates) + perf.score) / newTotalDebates :
            current.avg_score,
          avgTimeSeconds: perf.responseTimeSeconds ?
            ((current.avg_time_seconds * current.total_debates) + perf.responseTimeSeconds) / newTotalDebates :
            current.avg_time_seconds,
          avgCost: perf.cost ?
            ((current.avg_cost * current.total_debates) + perf.cost) / newTotalDebates :
            current.avg_cost,
          totalDebates: newTotalDebates,
          totalWins: newTotalWins,
          totalErrors: newTotalErrors,
          lastUpdated: Date.now()
        };
      } else {
        // Create new profile
        newProfile = {
          category,
          model: perf.model,
          winRate: winner === perf.model ? 1.0 : 0.0,
          avgScore: perf.score || 0.0,
          avgTimeSeconds: perf.responseTimeSeconds || 0.0,
          avgCost: perf.cost || 0.0,
          totalDebates: 1,
          totalWins: winner === perf.model ? 1 : 0,
          totalErrors: perf.errorOccurred ? 1 : 0,
          lastUpdated: Date.now()
        };
      }

      this.preparedStatements.upsertCategoryProfile.run(
        newProfile.category,
        newProfile.model,
        newProfile.winRate,
        newProfile.avgScore,
        newProfile.avgTimeSeconds,
        newProfile.avgCost,
        newProfile.totalDebates,
        newProfile.totalWins,
        newProfile.totalErrors,
        newProfile.lastUpdated
      );
    });
  }

  /**
   * Update daily performance trends
   * @param {string} category - Debate category
   * @param {Array} modelPerformances - Model performance data
   * @param {number} timestamp - Debate timestamp
   */
  updatePerformanceTrends(category, modelPerformances, timestamp) {
    const date = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD format

    modelPerformances.forEach(perf => {
      // Get existing trend data for today
      const existing = this.db.prepare(`
        SELECT * FROM performance_trends
        WHERE model = ? AND category = ? AND date = ?
      `).get(perf.model, category, date);

      if (existing) {
        // Update existing trend
        const newDebatesCount = existing.debates_count + 1;
        const newAvgScore = perf.score ?
          ((existing.avg_score * existing.debates_count) + perf.score) / newDebatesCount :
          existing.avg_score;

        this.preparedStatements.insertPerformanceTrend.run(
          perf.model,
          category,
          date,
          newAvgScore,
          newDebatesCount,
          existing.win_rate, // Will be updated separately
          existing.avg_cost,
          existing.avg_time_seconds
        );
      } else {
        // Create new trend entry
        this.preparedStatements.insertPerformanceTrend.run(
          perf.model,
          category,
          date,
          perf.score || 0,
          1,
          0, // Will be calculated later
          perf.cost || 0,
          perf.responseTimeSeconds || 0
        );
      }
    });
  }

  /**
   * Get best performing models for a specific category
   * @param {string} category - Category to analyze
   * @param {number} limit - Maximum number of models to return
   * @returns {Array} Array of model performance data
   */
  getBestModelsForCategory(category, limit = 5) {
    return this.preparedStatements.getModelPerformanceByCategory.all(category).slice(0, limit);
  }

  /**
   * Get overall model performance across all categories
   * @param {string} model - Model name
   * @returns {Object} Overall performance statistics
   */
  getModelOverallPerformance(model) {
    return this.preparedStatements.getModelOverallPerformance.get(model);
  }

  /**
   * Get recent performance data for model selection
   * @param {number} daysBack - Number of days to look back
   * @returns {Array} Recent performance data
   */
  getRecentPerformance(daysBack = 30) {
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    return this.preparedStatements.getRecentPerformance.all(cutoffTime);
  }

  /**
   * Get debate history for a specific category
   * @param {string} category - Category to query
   * @param {number} limit - Number of debates to return
   * @returns {Array} Debate history
   */
  getDebateHistory(category, limit = 50) {
    return this.preparedStatements.getDebateHistory.all(category, limit);
  }

  /**
   * Get performance trends over time
   * @param {string} model - Model name
   * @param {string} category - Category (optional)
   * @param {number} days - Number of days to analyze
   * @returns {Array} Performance trend data
   */
  getPerformanceTrends(model, category = null, days = 90) {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
      .toISOString().split('T')[0];

    let sql = `
      SELECT * FROM performance_trends
      WHERE model = ? AND date >= ?
    `;
    const params = [model, cutoffDate];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY date DESC';

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Get category statistics
   * @returns {Array} Category statistics including debate counts and model performance
   */
  getCategoryStatistics() {
    return this.db.prepare(`
      SELECT
        c.id as category,
        c.name as category_name,
        c.domain,
        COUNT(DISTINCT d.id) as total_debates,
        COUNT(DISTINCT mp.model) as models_used,
        AVG(mp.score) as avg_score,
        AVG(d.total_time_seconds) as avg_time_seconds
      FROM categories c
      LEFT JOIN debates d ON c.id = d.category
      LEFT JOIN model_performance mp ON d.id = mp.debate_id
      GROUP BY c.id, c.name, c.domain
      ORDER BY total_debates DESC, avg_score DESC
    `).all();
  }

  /**
   * Get model comparison data
   * @param {Array} models - List of model names to compare
   * @param {string} category - Category to compare (optional)
   * @returns {Array} Comparison data
   */
  getModelComparison(models, category = null) {
    const placeholders = models.map(() => '?').join(',');
    let sql = `
      SELECT
        model,
        category,
        AVG(score) as avg_score,
        AVG(response_time_seconds) as avg_time,
        AVG(cost) as avg_cost,
        COUNT(*) as debate_count,
        SUM(CASE WHEN error_occurred THEN 1 ELSE 0 END) as error_count
      FROM model_performance mp
      JOIN debates d ON mp.debate_id = d.id
      WHERE model IN (${placeholders})
    `;

    const params = [...models];

    if (category) {
      sql += ' AND d.category = ?';
      params.push(category);
    }

    sql += ' GROUP BY model, category ORDER BY model, category';

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Clean up old data (optional maintenance)
   * @param {number} daysToKeep - Number of days of data to retain
   */
  cleanupOldData(daysToKeep = 365) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    const transaction = this.db.transaction(() => {
      // Delete old debates (cascades to model_performance)
      this.db.prepare('DELETE FROM debates WHERE timestamp < ?').run(cutoffTime);

      // Delete old performance trends
      const cutoffDate = new Date(cutoffTime).toISOString().split('T')[0];
      this.db.prepare('DELETE FROM performance_trends WHERE date < ?').run(cutoffDate);
    });

    transaction();
  }

  /**
   * Get database health metrics
   * @returns {Object} Database health information
   */
  getHealthMetrics() {
    try {
      const stats = {
        totalDebates: this.db.prepare('SELECT COUNT(*) as count FROM debates').get().count,
        totalModelPerformances: this.db.prepare('SELECT COUNT(*) as count FROM model_performance').get().count,
        uniqueModels: this.db.prepare('SELECT COUNT(DISTINCT model) as count FROM model_performance').get().count,
        uniqueCategories: this.db.prepare('SELECT COUNT(DISTINCT category) as count FROM debates').get().count,
        recentDebates: this.db.prepare('SELECT COUNT(*) as count FROM debates WHERE timestamp > ?').get(Date.now() - 24*60*60*1000).count,
        avgDebatesPerDay: null,
        errorRate: null
      };

      // Calculate average debates per day (last 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recentDebatesCount = this.db.prepare('SELECT COUNT(*) as count FROM debates WHERE timestamp > ?').get(thirtyDaysAgo).count;
      stats.avgDebatesPerDay = Math.round(recentDebatesCount / 30 * 10) / 10;

      // Calculate error rate
      const totalPerformances = stats.totalModelPerformances;
      const errorCount = this.db.prepare('SELECT COUNT(*) as count FROM model_performance WHERE error_occurred = 1').get().count;
      stats.errorRate = totalPerformances > 0 ? Math.round((errorCount / totalPerformances) * 100 * 10) / 10 : 0;

      return stats;
    } catch (error) {
      console.error('Error getting health metrics:', error);
      return null;
    }
  }
}

export default DatabaseQueries;