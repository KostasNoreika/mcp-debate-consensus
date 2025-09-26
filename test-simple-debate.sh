#!/bin/bash
echo "Testing debate consensus system..."
echo

# Simple test question
QUESTION="What is the capital of France?"

# Call each model directly
echo "Testing k1 (Claude Opus 4.1):"
echo "$QUESTION" | ./k1-wrapper.sh 2>/dev/null | head -3

echo
echo "Testing k2 (GPT-5):"
echo "$QUESTION" | ./k2-wrapper.sh 2>/dev/null | head -3

echo
echo "Testing k3 (Qwen 3 Max):"
echo "$QUESTION" | ./k3-wrapper.sh 2>/dev/null | head -3

echo
echo "Testing k4 (Gemini 2.5 Pro):"
echo "$QUESTION" | ./k4-wrapper.sh 2>/dev/null | head -3

echo
echo "All models tested successfully!"
