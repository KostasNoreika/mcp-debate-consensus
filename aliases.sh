#!/bin/bash

# Debate Consensus Model Aliases
# These aliases launch different AI models for consensus building

# Claude Opus 4.1 - Architecture & Planning
alias dc-claude='echo "🏗️ Claude Opus 4.1 - Architecture Focus" && /Users/kostasnoreika/.claude/local/claude'

# GPT-5 Pro via OpenRouter - Testing & Debugging
alias dc-gpt5='echo "🧪 GPT-5 Pro - Testing Focus" && curl -s -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"openai/gpt-5-chat\", \"messages\": [{\"role\": \"user\", \"content\": \"$1\"}]}" | jq -r ".choices[0].message.content"'

# Qwen 3 Max via OpenRouter - Algorithms
alias dc-qwen='echo "⚡ Qwen 3 Max - Algorithm Focus" && curl -s -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"qwen/qwen3-max\", \"messages\": [{\"role\": \"user\", \"content\": \"$1\"}]}" | jq -r ".choices[0].message.content"'

# Gemini 2.5 Pro via OpenRouter - Integration
alias dc-gemini='echo "🔮 Gemini 2.5 Pro - Integration Focus" && curl -s -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"google/gemini-2.5-pro\", \"messages\": [{\"role\": \"user\", \"content\": \"$1\"}]}" | jq -r ".choices[0].message.content"'

# Run consensus debate with all models
dc-debate() {
  local question="$1"
  echo "🎯 Starting Multi-Model Consensus Debate"
  echo "Question: $question"
  echo "=" 
  
  # Get responses from all models
  echo "Collecting perspectives..."
  
  local claude_response=$(dc-claude "$question - Focus on architecture and system design")
  local gpt5_response=$(dc-gpt5 "$question - Focus on testing and debugging")
  local qwen_response=$(dc-qwen "$question - Focus on algorithms and optimization")
  local gemini_response=$(dc-gemini "$question - Focus on integration and completeness")
  
  echo ""
  echo "📊 Synthesis:"
  echo "Claude (Architecture): ${claude_response:0:100}..."
  echo "GPT-5 (Testing): ${gpt5_response:0:100}..."
  echo "Qwen (Algorithms): ${qwen_response:0:100}..."
  echo "Gemini (Integration): ${gemini_response:0:100}..."
}

echo "✅ Debate Consensus aliases loaded!"
echo "Available commands:"
echo "  dc-claude   - Claude Opus 4.1 for architecture"
echo "  dc-gpt5     - GPT-5 Pro for testing"
echo "  dc-qwen     - Qwen 3 Max for algorithms"
echo "  dc-gemini   - Gemini 2.5 Pro for integration"
echo "  dc-debate   - Run full consensus debate"