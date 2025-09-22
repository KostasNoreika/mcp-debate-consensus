# Task 002: Performance Tracking Database

## Current State (NOW)
- No tracking of model performance
- No learning from past debates
- No data about which models excel where
- Every debate starts from zero knowledge

## Future State (AFTER)
- SQLite database tracking every debate
- 70+ universal categories (not just programming)
- Tracks: winner, scores, response times, token usage
- Builds model profiles over time
- Enables data-driven decisions

## Implementation

### Database Schema
```sql
CREATE TABLE debates (
  id TEXT PRIMARY KEY,
  timestamp INTEGER,
  category TEXT,
  question TEXT,
  complexity TEXT,
  models_used TEXT,
  winner TEXT,
  consensus_score REAL,
  user_feedback INTEGER
);

CREATE TABLE model_performance (
  debate_id TEXT,
  model TEXT,
  score REAL,
  response_time REAL,
  tokens_used INTEGER,
  cost REAL,
  FOREIGN KEY(debate_id) REFERENCES debates(id)
);

CREATE TABLE category_profiles (
  category TEXT,
  model TEXT,
  win_rate REAL,
  avg_score REAL,
  avg_time REAL,
  total_debates INTEGER,
  PRIMARY KEY(category, model)
);
```

### Tracking Module
```javascript
class PerformanceTracker {
  async recordDebate(result) {
    // Save to database
    await db.run(`
      INSERT INTO debates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, Date.now(), category, question, ...]);

    // Update model profiles
    await this.updateProfiles(result);

    // Detect patterns
    await this.analyzePatterns(result);
  }
}
```

## Categories (70+ types)
- Technical & Engineering (15)
- Business & Strategy (10)
- Creative & Content (10)
- Science & Research (10)
- Education & Learning (8)
- Communication & Language (8)
- Legal & Compliance (7)
- Healthcare & Wellness (6)
- Personal & Lifestyle (6)
- Analysis & Problem-Solving (10)

## Benefits
- Learn which models excel at what
- Optimize model selection over time
- Reduce costs by 30-50%
- Provide confidence metrics
- Enable continuous improvement