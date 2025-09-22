/**
 * Database Schema and Initialization
 * SQLite database schema for performance tracking with 70+ universal categories
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Universal performance tracking categories covering all domains
 */
export const PERFORMANCE_CATEGORIES = {
  // Technical & Engineering (15)
  'software-development': 'Software Development & Programming',
  'system-architecture': 'System Architecture & Design',
  'database-design': 'Database Design & Optimization',
  'api-development': 'API Development & Integration',
  'security-implementation': 'Security Implementation',
  'performance-optimization': 'Performance Optimization',
  'devops-automation': 'DevOps & Automation',
  'cloud-infrastructure': 'Cloud Infrastructure',
  'mobile-development': 'Mobile Development',
  'web-development': 'Web Development',
  'machine-learning': 'Machine Learning & AI',
  'data-engineering': 'Data Engineering',
  'network-administration': 'Network Administration',
  'cybersecurity': 'Cybersecurity',
  'blockchain-technology': 'Blockchain Technology',

  // Business & Strategy (10)
  'business-strategy': 'Business Strategy & Planning',
  'financial-analysis': 'Financial Analysis',
  'market-research': 'Market Research & Analysis',
  'project-management': 'Project Management',
  'risk-management': 'Risk Management',
  'supply-chain': 'Supply Chain Management',
  'human-resources': 'Human Resources',
  'sales-marketing': 'Sales & Marketing',
  'customer-service': 'Customer Service',
  'operations-management': 'Operations Management',

  // Creative & Content (10)
  'content-creation': 'Content Creation & Writing',
  'graphic-design': 'Graphic Design',
  'video-production': 'Video Production',
  'creative-writing': 'Creative Writing',
  'copywriting': 'Copywriting & Marketing Copy',
  'social-media': 'Social Media Content',
  'brand-development': 'Brand Development',
  'ui-ux-design': 'UI/UX Design',
  'photography': 'Photography',
  'music-production': 'Music Production',

  // Science & Research (10)
  'scientific-research': 'Scientific Research',
  'data-analysis': 'Data Analysis & Statistics',
  'medical-research': 'Medical Research',
  'environmental-science': 'Environmental Science',
  'physics-engineering': 'Physics & Engineering',
  'chemistry-research': 'Chemistry Research',
  'biology-research': 'Biology Research',
  'psychology-research': 'Psychology Research',
  'social-science': 'Social Science Research',
  'academic-writing': 'Academic Writing',

  // Education & Learning (8)
  'curriculum-development': 'Curriculum Development',
  'educational-content': 'Educational Content Creation',
  'training-development': 'Training Development',
  'language-learning': 'Language Learning',
  'skills-assessment': 'Skills Assessment',
  'e-learning': 'E-Learning Solutions',
  'instructional-design': 'Instructional Design',
  'knowledge-management': 'Knowledge Management',

  // Communication & Language (8)
  'translation': 'Translation Services',
  'technical-writing': 'Technical Writing',
  'presentation-design': 'Presentation Design',
  'public-speaking': 'Public Speaking',
  'intercultural-communication': 'Intercultural Communication',
  'conflict-resolution': 'Conflict Resolution',
  'negotiation': 'Negotiation',
  'stakeholder-communication': 'Stakeholder Communication',

  // Legal & Compliance (7)
  'legal-research': 'Legal Research',
  'contract-analysis': 'Contract Analysis',
  'compliance-management': 'Compliance Management',
  'intellectual-property': 'Intellectual Property',
  'regulatory-affairs': 'Regulatory Affairs',
  'legal-writing': 'Legal Writing',
  'policy-development': 'Policy Development',

  // Healthcare & Wellness (6)
  'healthcare-consulting': 'Healthcare Consulting',
  'medical-diagnosis': 'Medical Diagnosis Support',
  'wellness-planning': 'Wellness Planning',
  'mental-health': 'Mental Health Support',
  'nutrition-planning': 'Nutrition Planning',
  'fitness-coaching': 'Fitness Coaching',

  // Personal & Lifestyle (6)
  'personal-finance': 'Personal Finance',
  'career-counseling': 'Career Counseling',
  'life-coaching': 'Life Coaching',
  'event-planning': 'Event Planning',
  'travel-planning': 'Travel Planning',
  'relationship-advice': 'Relationship Advice',

  // Analysis & Problem-Solving (10)
  'critical-thinking': 'Critical Thinking',
  'problem-solving': 'Problem Solving',
  'decision-making': 'Decision Making',
  'process-improvement': 'Process Improvement',
  'root-cause-analysis': 'Root Cause Analysis',
  'strategic-planning': 'Strategic Planning',
  'competitive-analysis': 'Competitive Analysis',
  'feasibility-studies': 'Feasibility Studies',
  'trend-analysis': 'Trend Analysis',
  'scenario-planning': 'Scenario Planning'
};

/**
 * Database Schema Definition
 */
export class DatabaseSchema {
  constructor(dbPath = null) {
    // Default path is in the project's data directory
    this.dbPath = dbPath || path.join(__dirname, '..', '..', 'data', 'performance.db');
    this.db = null;
  }

  /**
   * Async wrapper for database run method
   */
  runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  /**
   * Async wrapper for database get method
   */
  getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Async wrapper for database all method
   */
  allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Initialize database and create tables
   */
  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await import('fs/promises').then(fs => fs.mkdir(dataDir, { recursive: true }));

      // Open database
      this.db = new sqlite3.Database(this.dbPath);

      // Enable foreign keys
      await this.runAsync('PRAGMA foreign_keys = ON');

      // Create tables
      await this.createTables();

      // Initialize with categories
      await this.initializeCategories();

      console.log(`📊 Performance tracking database initialized: ${this.dbPath}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create all required tables
   */
  async createTables() {
    // Debates table - stores main debate information
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS debates (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        category TEXT NOT NULL,
        question TEXT NOT NULL,
        complexity TEXT CHECK(complexity IN ('low', 'medium', 'high')) DEFAULT 'medium',
        models_used TEXT NOT NULL, -- JSON array of model names
        winner TEXT,
        consensus_score REAL,
        user_feedback INTEGER CHECK(user_feedback BETWEEN 1 AND 5),
        project_path TEXT,
        total_time_seconds INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Model performance table - stores individual model performance per debate
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS model_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debate_id TEXT NOT NULL,
        model TEXT NOT NULL,
        score REAL,
        response_time_seconds REAL,
        tokens_used INTEGER,
        cost REAL,
        error_occurred BOOLEAN DEFAULT FALSE,
        error_message TEXT,
        proposal_length INTEGER,
        improvements_provided BOOLEAN DEFAULT FALSE,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY(debate_id) REFERENCES debates(id) ON DELETE CASCADE
      )
    `);

    // Category profiles table - aggregated statistics per model per category
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS category_profiles (
        category TEXT NOT NULL,
        model TEXT NOT NULL,
        win_rate REAL DEFAULT 0.0,
        avg_score REAL DEFAULT 0.0,
        avg_time_seconds REAL DEFAULT 0.0,
        avg_cost REAL DEFAULT 0.0,
        total_debates INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        total_errors INTEGER DEFAULT 0,
        last_updated INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY(category, model)
      )
    `);

    // Categories table - master list of all categories
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        domain TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Performance trends table - time-based performance tracking
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS performance_trends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL, -- YYYY-MM-DD format
        avg_score REAL,
        debates_count INTEGER,
        win_rate REAL,
        avg_cost REAL,
        avg_time_seconds REAL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes for better query performance
    await this.createIndexes();
  }

  /**
   * Create database indexes for optimal query performance
   */
  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_debates_timestamp ON debates(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_debates_category ON debates(category)',
      'CREATE INDEX IF NOT EXISTS idx_debates_winner ON debates(winner)',
      'CREATE INDEX IF NOT EXISTS idx_model_performance_debate_id ON model_performance(debate_id)',
      'CREATE INDEX IF NOT EXISTS idx_model_performance_model ON model_performance(model)',
      'CREATE INDEX IF NOT EXISTS idx_category_profiles_model ON category_profiles(model)',
      'CREATE INDEX IF NOT EXISTS idx_category_profiles_category ON category_profiles(category)',
      'CREATE INDEX IF NOT EXISTS idx_performance_trends_model_date ON performance_trends(model, date)',
      'CREATE INDEX IF NOT EXISTS idx_performance_trends_category_date ON performance_trends(category, date)'
    ];

    for (const sql of indexes) {
      try {
        await this.runAsync(sql);
      } catch (error) {
        console.warn(`Warning: Could not create index: ${error.message}`);
      }
    }
  }

  /**
   * Initialize categories table with predefined categories
   */
  async initializeCategories() {
    // Group categories by domain
    const domains = {
      'technical': Object.entries(PERFORMANCE_CATEGORIES).slice(0, 15),
      'business': Object.entries(PERFORMANCE_CATEGORIES).slice(15, 25),
      'creative': Object.entries(PERFORMANCE_CATEGORIES).slice(25, 35),
      'science': Object.entries(PERFORMANCE_CATEGORIES).slice(35, 45),
      'education': Object.entries(PERFORMANCE_CATEGORIES).slice(45, 53),
      'communication': Object.entries(PERFORMANCE_CATEGORIES).slice(53, 61),
      'legal': Object.entries(PERFORMANCE_CATEGORIES).slice(61, 68),
      'healthcare': Object.entries(PERFORMANCE_CATEGORIES).slice(68, 74),
      'personal': Object.entries(PERFORMANCE_CATEGORIES).slice(74, 80),
      'analysis': Object.entries(PERFORMANCE_CATEGORIES).slice(80)
    };

    // Insert categories using async operations
    for (const [domain, categories] of Object.entries(domains)) {
      for (const [id, name] of categories) {
        try {
          await this.runAsync(
            'INSERT OR IGNORE INTO categories (id, name, description, domain) VALUES (?, ?, ?, ?)',
            [id, name, `${name} tasks and challenges`, domain]
          );
        } catch (error) {
          console.warn(`Warning: Could not insert category ${id}:`, error.message);
        }
      }
    }
  }

  /**
   * Get database instance
   */
  getDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!this.db) return null;

    try {
      const [totalDebates, totalModels, totalCategories, dbSize] = await Promise.all([
        this.getAsync('SELECT COUNT(*) as count FROM debates').then(row => row?.count || 0),
        this.getAsync('SELECT COUNT(DISTINCT model) as count FROM model_performance').then(row => row?.count || 0),
        this.getAsync('SELECT COUNT(*) as count FROM categories').then(row => row?.count || 0),
        this.getAsync('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').then(row => row?.size || 0)
      ]);

      return {
        totalDebates,
        totalModels,
        totalCategories,
        dbSize
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }
}

export default DatabaseSchema;