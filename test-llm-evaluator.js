#!/usr/bin/env node

/**
 * Test the new LLM-based semantic evaluator
 */

const { LLMSemanticEvaluator } = require('./src/llm-semantic-evaluator');

async function test() {
  console.log('🧪 Testing LLM Semantic Evaluator\n');
  
  const evaluator = new LLMSemanticEvaluator();
  
  // Test question
  const question = "How can I optimize database queries in a Node.js application?";
  
  // Simulated responses from different models
  const responses = {
    "Model A": `To optimize database queries in Node.js:

1. Use connection pooling to reuse database connections
2. Implement query caching with Redis for frequently accessed data
3. Use indexes on columns used in WHERE clauses
4. Batch multiple queries when possible
5. Use prepared statements to prevent SQL injection and improve performance

\`\`\`javascript
// Example with connection pooling
const pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb'
});
\`\`\``,

    "Model B": `Database optimization strategies:

- Profile slow queries using EXPLAIN
- Denormalize data where appropriate
- Use pagination instead of fetching all records
- Consider using an ORM like Sequelize or TypeORM for query optimization
- Monitor database performance metrics

Best practice is to measure performance before and after optimization.`,

    "Model C": `For query optimization, you should look at your database structure first. Make sure tables are properly indexed. Also consider using stored procedures for complex operations. NoSQL databases like MongoDB might be better for certain use cases.`,

    "Model D": `Key optimization techniques:

1. **Query Analysis**: Use database profiling tools to identify bottlenecks
2. **Indexing Strategy**: Create composite indexes for multi-column queries
3. **Query Rewriting**: Optimize JOIN operations and subqueries
4. **Caching Layer**: Implement Redis or Memcached
5. **Database Sharding**: Distribute data across multiple servers for scale

\`\`\`sql
-- Example of optimized query with proper indexing
CREATE INDEX idx_user_email ON users(email);
SELECT * FROM users WHERE email = ? LIMIT 1;
\`\`\`

Additionally, use database-specific features like PostgreSQL's EXPLAIN ANALYZE or MySQL's slow query log to continuously monitor and improve performance.`
  };
  
  try {
    // Run the evaluation
    const evaluation = await evaluator.evaluateResponses(question, responses);
    
    // Display results
    console.log(evaluator.formatEvaluationSummary(evaluation));
    
    // Show raw evaluation for debugging
    console.log('\n📝 Raw Evaluation JSON:');
    console.log(JSON.stringify(evaluation, null, 2));
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
test().catch(console.error);