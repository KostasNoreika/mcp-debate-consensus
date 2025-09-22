# Streaming Responses System

This directory contains the streaming response implementation for the debate-consensus MCP server, providing real-time progress updates and better user experience during long-running debates.

## Overview

The streaming system consists of two main components:

1. **StreamHandler** - Manages streaming responses for debate processes
2. **ProgressTracker** - Tracks and reports progress with real-time status updates

## Components

### StreamHandler (`stream-handler.js`)

The `StreamHandler` class provides streaming capabilities for debate operations using async generators:

```javascript
import { StreamHandler } from './src/streaming/stream-handler.js';

const streamHandler = new StreamHandler();

// Stream a debate process
for await (const update of streamHandler.streamDebate(debate, question, projectPath)) {
  console.log('Update:', update);
}
```

**Key Features:**
- **Async Generator Pattern**: Uses `async function*` for efficient streaming
- **Real-time Updates**: Emits progress as models think and complete
- **Intelligent Integration**: Works with intelligent model selection
- **Error Handling**: Graceful degradation if streaming fails
- **Progressive Loading**: Stream text content in configurable chunks

**Stream Update Types:**
- `stage` - Stage transitions (initialization, analysis, synthesis, etc.)
- `model_selection` - Intelligent model selection results
- `model_complete` - Individual model completion with preview
- `model_error` - Model failure notifications
- `warning` - Non-fatal warnings
- `error` - Critical errors

### ProgressTracker (`progress-tracker.js`)

The `ProgressTracker` class provides enhanced progress tracking with detailed metrics:

```javascript
import { ProgressTracker } from './src/streaming/progress-tracker.js';

const tracker = new ProgressTracker({ verbose: true });

// Initialize with debate configuration
tracker.initialize({
  totalModels: 5,
  models: [/* model configs */]
});

// Track stage progression
tracker.startStage('analysis');
tracker.updateModelStatus('k1', 'running');
tracker.updateModelStatus('k1', 'completed', { responseLength: 1500 });
tracker.complete();
```

**Key Features:**
- **Stage Management**: Track predefined debate stages with timing
- **Model Tracking**: Monitor individual model status and performance
- **Performance Metrics**: Calculate response times, completion rates
- **Event Emission**: Real-time events for external monitoring
- **Comprehensive Logging**: Detailed progress summaries

**Tracked Stages:**
1. `initialization` - System startup (0-10%)
2. `model_selection` - Intelligent model selection (10-25%)
3. `analysis` - Model analysis phase (25-60%)
4. `evaluation` - Proposal evaluation (60-70%)
5. `improvements` - Collaborative improvements (70-85%)
6. `synthesis` - Consensus building (85-95%)
7. `finalization` - Final result preparation (95-100%)
8. `complete` - Process completion (100%)

## Integration with MCP Server

The streaming system is integrated into the main MCP server through the `streaming_debate` tool:

```javascript
// In index.js
import { StreamHandler } from './src/streaming/stream-handler.js';
import { ProgressTracker } from './src/streaming/progress-tracker.js';

class DebateConsensusMCP {
  constructor() {
    this.streamHandler = new StreamHandler();
    this.progressTracker = new ProgressTracker({ verbose: true });
  }
}
```

## Usage Examples

### Basic Streaming Debate

```bash
# Use the streaming_debate tool via MCP
{
  "tool": "streaming_debate",
  "arguments": {
    "question": "How can I optimize my database queries?",
    "projectPath": "/path/to/project",
    "streamChunkSize": 500
  }
}
```

### Real-time Progress Monitoring

The streaming system provides real-time updates like:

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

## Technical Details

### Stream Processing Flow

1. **Initialization** - Set up stream handlers and progress tracking
2. **Model Selection** - Stream intelligent model selection analysis
3. **Parallel Execution** - Monitor models running in parallel
4. **Progressive Updates** - Emit updates as models complete
5. **Real-time Display** - Show progress indicators and partial results
6. **Final Synthesis** - Stream consensus building process

### Performance Benefits

- **Better UX**: Users see progress instead of waiting
- **Perceived Speed**: Early feedback makes system feel faster
- **Debugging**: Identify slow or failing models in real-time
- **Engagement**: Keep users engaged during long operations

### Error Handling

The streaming system includes comprehensive error handling:

- **Graceful Degradation**: Falls back to regular debate if streaming fails
- **Individual Model Failures**: Continue streaming even if some models fail
- **Network Issues**: Handle connection problems gracefully
- **Resource Limits**: Manage memory and connection usage

## Configuration

### Environment Variables

```bash
# Progress tracking
DEBATE_PROGRESS_ENABLED=true
DEBATE_PROGRESS_VERBOSE=true
DEBATE_PROGRESS_INTERVAL=30000

# Streaming settings
STREAM_CHUNK_SIZE=500
STREAM_BUFFER_DELAY=50
```

### Stream Handler Options

```javascript
const streamHandler = new StreamHandler({
  bufferDelay: 50,      // ms between buffer flushes
  chunkSize: 500        // characters per chunk
});
```

### Progress Tracker Options

```javascript
const tracker = new ProgressTracker({
  verbose: true,        // Enable detailed logging
  updateInterval: 1000  // Heartbeat interval in ms
});
```

## Testing

Run the test suite to verify streaming functionality:

```bash
node test-streaming.js
```

The test suite covers:
- Progress tracker stage management
- Stream handler debate simulation
- Text streaming with chunks
- Error handling and recovery

## Future Enhancements

Potential improvements for the streaming system:

1. **WebSocket Support**: Real-time browser updates
2. **Stream Multiplexing**: Multiple concurrent streams
3. **Adaptive Chunking**: Dynamic chunk sizes based on content
4. **Compression**: Compress stream data for efficiency
5. **Replay Capability**: Record and replay streams for debugging

## API Reference

### StreamHandler Methods

- `streamDebate(debate, question, projectPath)` - Stream entire debate process
- `streamModelAnalysis(debate, question, projectPath, models)` - Stream model analysis
- `streamSingleModel(debate, model, question, projectPath)` - Stream individual model
- `streamText(text, options)` - Stream text content in chunks
- `mergeStreams(...streams)` - Merge multiple async generators

### ProgressTracker Methods

- `initialize(config)` - Initialize with debate configuration
- `startStage(stageName, customProgress)` - Start a new stage
- `updateModelStatus(alias, status, data)` - Update model status
- `getProgressStatus()` - Get comprehensive progress information
- `complete()` - Mark process as complete
- `cleanup()` - Clean up resources

### Event Types

Both components emit events for external monitoring:

- `initialized` - System initialized
- `stage_started` - New stage began
- `stage_completed` - Stage finished
- `model_status_updated` - Model status changed
- `progress_updated` - Progress percentage changed
- `heartbeat` - Periodic status update
- `completed` - Process finished
- `error` - Error occurred