# Task 008: Streaming Responses

## Current State (NOW)
- User waits 30-60 seconds seeing nothing
- All models must finish before any output
- No visibility into progress
- Feels slow and unresponsive

## Future State (AFTER)
- See models thinking in real-time
- Progressive output as models respond
- Visual indicators of progress
- Much better user experience

## Implementation

### Streaming Architecture
```javascript
class StreamingDebate {
  async *runStreamingDebate(question, options) {
    // Start all models
    const streams = this.startModelStreams(question);

    // Yield progress updates
    yield { type: 'start', models: this.models };

    // Stream responses as they arrive
    for await (const chunk of this.mergeStreams(streams)) {
      yield {
        type: 'progress',
        model: chunk.model,
        content: chunk.content,
        status: chunk.status
      };
    }

    // Final synthesis
    yield { type: 'synthesizing' };
    const final = await this.synthesize();
    yield { type: 'complete', result: final };
  }
}
```

### MCP Streaming Protocol
```javascript
class MCPStreaming {
  async streamToClient(generator) {
    for await (const chunk of generator) {
      await this.send({
        type: 'stream',
        data: chunk
      });
    }
  }
}
```

### User Interface Updates
```
[00:01] 🚀 Starting debate with 3 models...
[00:02] 🧠 k1 (Claude): Analyzing question...
[00:03] 🧠 k2 (GPT-5): Processing...
[00:03] 🧠 k5 (Grok): Starting fast analysis...

[00:05] ✅ k5 (Grok): [First response appears]
[00:08] ✅ k2 (GPT-5): [Second response appears]
[00:12] ✅ k1 (Claude): [Third response appears]

[00:13] 🔄 Cross-verification in progress...
[00:15] 🎯 Synthesizing consensus...
[00:16] ✅ Complete! Confidence: 92%
```

## Progressive Loading
```javascript
{
  "stages": [
    {
      "stage": "initialization",
      "message": "Selecting optimal models...",
      "progress": 10
    },
    {
      "stage": "analysis",
      "message": "Models analyzing question...",
      "progress": 30,
      "models": {
        "k1": "thinking",
        "k2": "thinking",
        "k5": "complete"
      }
    },
    {
      "stage": "verification",
      "message": "Cross-checking responses...",
      "progress": 70
    },
    {
      "stage": "synthesis",
      "message": "Building consensus...",
      "progress": 90
    },
    {
      "stage": "complete",
      "progress": 100,
      "result": "..."
    }
  ]
}
```

## Benefits
- **Better UX** - users see progress
- **Faster perceived speed** - early feedback
- **Debugging** - see which model is slow
- **Engagement** - users stay engaged