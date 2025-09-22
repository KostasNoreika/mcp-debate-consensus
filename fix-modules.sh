#!/bin/bash

echo "Fixing module exports to ES6..."

# Fix security.js
if grep -q "module.exports" src/security.js 2>/dev/null; then
  echo "Fixing src/security.js..."
  sed -i '' 's/module\.exports = { Security };/export { Security };/g' src/security.js
fi

# Fix improved-semantic-scoring.js
if grep -q "module.exports" src/improved-semantic-scoring.js 2>/dev/null; then
  echo "Fixing src/improved-semantic-scoring.js..."
  sed -i '' 's/module\.exports = { ImprovedSemanticScoring };/export { ImprovedSemanticScoring };/g' src/improved-semantic-scoring.js
fi

# Fix config.js
if grep -q "module.exports" src/config.js 2>/dev/null; then
  echo "Fixing src/config.js..."
  sed -i '' 's/module\.exports = {/export default {/g' src/config.js
fi

echo "Module fixes complete!"