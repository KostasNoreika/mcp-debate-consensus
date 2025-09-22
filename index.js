import { ClaudeCliDebate } from './src/claude-cli-debate.js';
import { IterativeDebateOrchestrator } from './src/iterative-debate-orchestrator.js';
import { DebateHistory } from './src/history.js';
import { Security } from './src/security.js';
import { StreamHandler } from './src/streaming/stream-handler.js';
import { ProgressTracker } from './src/streaming/progress-tracker.js';
import { spawn } from 'child_process';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create dynamic imports for MCP SDK since it uses ES modules
let Server, StdioServerTransport, ListToolsRequestSchema, CallToolRequestSchema;

async function initializeMCPModules() {
  try {
    const serverModule = await import('@modelcontextprotocol/sdk/server/index.js');
    const stdioModule = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const typesModule = await import('@modelcontextprotocol/sdk/types.js');
    
    Server = serverModule.Server;
    StdioServerTransport = stdioModule.StdioServerTransport;
    ListToolsRequestSchema = typesModule.ListToolsRequestSchema;
    CallToolRequestSchema = typesModule.CallToolRequestSchema;
  } catch (error) {
    throw new Error('Failed to load MCP SDK: ' + error.message);
  }
}

class DebateConsensusMCP {
    constructor() {
        this.server = null;
        // Use Claude CLI debate with full MCP tool access
        this.debate = new ClaudeCliDebate();
        this.iterativeDebate = new IterativeDebateOrchestrator();
        this.history = new DebateHistory();
        this.security = new Security();
        // Initialize streaming components
        this.streamHandler = new StreamHandler();
        this.progressTracker = new ProgressTracker({ verbose: true });
        this.initialized = false;
        this.proxyProcess = null;
        this.PROXY_PORT = 3456;
    }

    async initialize() {
        if (this.initialized) return;
        
        await initializeMCPModules();
        
        // Start proxy server if not running
        await this.ensureProxyServerRunning();
        
        this.server = new Server(
            { name: 'debate-consensus', version: '1.0.0' },
            { capabilities: { tools: {} } }
        );
        
        this.setupTools();
        this.initialized = true;
    }
    
    setupTools() {
        // Set up tools/list handler  
        this.server.setRequestHandler(ListToolsRequestSchema, async (request) => ({
            tools: [
                {
                    name: 'debate',
                    description: 'AUTOMATICALLY use when: complex technical questions, architecture design, debugging stubborn issues, optimization advice, technology choices, security analysis, or "debate this". Features: (1) INTELLIGENT MODEL SELECTION v2.0 - Gemini analyzes your question to auto-select optimal 3-5 models from 5 experts for 50% cost reduction, (2) PARALLEL INSTANCE SUPPORT - Use syntax like "k1:2,k2,k3:3" for multiple instances with different seeds/temperatures for enhanced consensus, (3) Full MCP tool access for all models. Best for: critical decisions, stubborn bugs, high-stakes technical choices.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            question: {
                                type: 'string',
                                description: 'The problem to solve or analyze'
                            },
                            projectPath: {
                                type: 'string',
                                description: 'Project path to analyze (optional, defaults to current)'
                            },
                            modelConfig: {
                                type: 'string',
                                description: 'Manual model configuration (optional). Format: "k1:2,k2,k3:3" where k1:2 means 2 parallel instances of Claude Opus, k2 means 1 instance of GPT-5, k3:3 means 3 instances of Qwen. Available models: k1=Claude Opus (architecture), k2=GPT-5 (testing), k3=Qwen (algorithms), k4=Gemini (integration), k5=Grok (fast reasoning). Omit for intelligent auto-selection.'
                            }
                        },
                        required: ['question']
                    }
                },
                {
                    name: 'debate_history',
                    description: 'Get recent completed debates',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: { type: 'number' }
                        }
                    }
                },
                {
                    name: 'streaming_debate',
                    description: 'Run a debate with REAL-TIME STREAMING for better UX. Shows live progress: models thinking, completion status, progressive results. Same intelligent model selection and full MCP tool access as regular debate, but with streaming updates for better perceived performance.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            question: {
                                type: 'string',
                                description: 'The problem to solve or analyze'
                            },
                            projectPath: {
                                type: 'string',
                                description: 'Project path to analyze (optional, defaults to current)'
                            },
                            streamChunkSize: {
                                type: 'number',
                                description: 'Size of streaming chunks for progressive display (default: 500)'
                            }
                        },
                        required: ['question']
                    }
                },
                {
                    name: 'iterative_debate',
                    description: 'Run an iterative multi-LLM debate with INTELLIGENT MODEL SELECTION v2.0 and consensus building (Gemini selects optimal models, then they see all responses and iterate until agreement)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            question: {
                                type: 'string',
                                description: 'The problem to solve or analyze'
                            },
                            projectPath: {
                                type: 'string',
                                description: 'Project path to analyze (optional, defaults to current)'
                            },
                            maxIterations: {
                                type: 'number',
                                description: 'Maximum debate iterations (default: 5)'
                            },
                            consensusThreshold: {
                                type: 'number',
                                description: 'Consensus threshold percentage for early exit (default: 90)'
                            }
                        },
                        required: ['question']
                    }
                },
                {
                    name: 'confidence_analysis',
                    description: 'Analyze confidence metrics for a completed debate or evaluate confidence factors for any AI consensus output. Provides detailed scoring with factors like model agreement, verification status, historical accuracy, and actionable recommendations.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            historyId: {
                                type: 'string',
                                description: 'ID of a completed debate to analyze (optional)'
                            },
                            question: {
                                type: 'string',
                                description: 'The original question/problem (required if no historyId)'
                            },
                            proposals: {
                                type: 'object',
                                description: 'Model responses to analyze for confidence (optional - will fetch from history if historyId provided)'
                            }
                        }
                    }
                }
            ]
        }));
        
        // Set up tools/call handler
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            
            if (name === 'debate') {
                try {
                    // Security validation
                    const sanitizedQuestion = this.security.validateQuestion(args.question);
                    const validatedPath = await this.security.validateProjectPath(args.projectPath);
                    this.security.checkRateLimit('debate', 5, 300000); // 5 debates per 5 minutes
                    
                    console.error('Starting synchronous debate for:', sanitizedQuestion);

                    // Log model configuration if provided
                    if (args.modelConfig) {
                        console.error('Using model configuration:', args.modelConfig);
                    }

                    // Run debate synchronously and wait for completion
                    const result = await this.debate.runDebate(
                        sanitizedQuestion,
                        validatedPath,
                        args.modelConfig
                    );
                    
                    // Save to history
                    const historyId = await this.history.save({
                        question: args.question,
                        ...result
                    });
                    
                    return {
                        content: [{
                            type: 'text',
                            text: this.formatResponse(args.question, result, historyId)
                        }]
                    };
                    
                } catch (error) {
                    console.error('Debate error:', error);
                    return {
                        content: [{
                            type: 'text',
                            text: `Error running debate: ${error.message}\n\nMake sure you have:\n1. Set OPENROUTER_API_KEY in .env\n2. Run: ./setup-aliases.sh\n3. Source: source ~/.claude-models`
                        }]
                    };
                }
            }

            if (name === 'streaming_debate') {
                try {
                    // Security validation
                    const sanitizedQuestion = this.security.validateQuestion(args.question);
                    const validatedPath = await this.security.validateProjectPath(args.projectPath);
                    this.security.checkRateLimit('streaming_debate', 3, 300000); // 3 streaming debates per 5 minutes

                    console.error('Starting streaming debate for:', sanitizedQuestion);

                    // Configure stream handler
                    if (args.streamChunkSize) {
                        this.streamHandler.chunkSize = args.streamChunkSize;
                    }

                    // Initialize progress tracker with debate configuration
                    this.progressTracker.initialize({
                        totalModels: this.debate.models.length,
                        models: this.debate.models
                    });

                    // Collect streaming results
                    let streamingResults = '';
                    let finalResult = null;
                    let modelUpdates = [];
                    let stageUpdates = [];

                    try {
                        // Stream the debate process
                        for await (const update of this.streamHandler.streamDebate(this.debate, sanitizedQuestion, validatedPath)) {
                            switch (update.type) {
                                case 'stage':
                                    stageUpdates.push({
                                        stage: update.stage,
                                        message: update.message,
                                        progress: update.progress,
                                        timestamp: update.timestamp
                                    });

                                    streamingResults += `\n[${this.formatTimestamp(update.timestamp)}] 🔄 ${update.message} (${update.progress}%)\n`;

                                    if (update.models) {
                                        const modelStatus = Object.entries(update.models)
                                            .map(([alias, status]) => `${alias}: ${status}`)
                                            .join(', ');
                                        streamingResults += `   Models: ${modelStatus}\n`;
                                    }
                                    break;

                                case 'model_selection':
                                    streamingResults += `\n📊 **Intelligent Model Selection:**\n`;
                                    streamingResults += `   Category: ${update.analysis.category}\n`;
                                    streamingResults += `   Complexity: ${update.analysis.complexity}/${update.analysis.criticality}\n`;
                                    streamingResults += `   Selected: ${update.selectedModels.map(m => m.name).join(', ')}\n`;
                                    streamingResults += `   Cost reduction: ${update.analysis.costReduction}%\n`;
                                    streamingResults += `   Speed gain: ${update.analysis.speedGain}\n`;
                                    streamingResults += `   Reasoning: ${update.analysis.reasoning}\n\n`;
                                    break;

                                case 'model_complete':
                                    modelUpdates.push(update);
                                    streamingResults += `[${this.formatTimestamp(update.timestamp)}] ✅ ${update.model.name} completed (${update.duration}ms)\n`;
                                    if (update.result) {
                                        streamingResults += `   Preview: ${update.result.substring(0, 200)}...\n\n`;
                                    }
                                    break;

                                case 'model_error':
                                    streamingResults += `[${this.formatTimestamp(update.timestamp)}] ❌ ${update.model.name} failed: ${update.error}\n\n`;
                                    break;

                                case 'warning':
                                    streamingResults += `[${this.formatTimestamp(update.timestamp)}] ⚠️ ${update.message}\n\n`;
                                    break;

                                case 'error':
                                    streamingResults += `[${this.formatTimestamp(update.timestamp)}] 🚫 Error: ${update.message}\n\n`;
                                    break;

                                default:
                                    // Log other update types for debugging
                                    if (update.stage === 'complete') {
                                        streamingResults += `[${this.formatTimestamp(update.timestamp)}] 🎉 ${update.message}\n\n`;
                                    }
                            }
                        }

                        // After streaming completes, run the actual debate to get final result
                        console.error('Streaming complete, running final debate...');
                        finalResult = await this.debate.runDebate(sanitizedQuestion, validatedPath);

                    } catch (streamError) {
                        console.error('Streaming error:', streamError);
                        streamingResults += `\n🚫 Streaming failed: ${streamError.message}\n`;
                        streamingResults += `Falling back to standard debate...\n\n`;

                        // Fallback to regular debate
                        finalResult = await this.debate.runDebate(sanitizedQuestion, validatedPath);
                    }

                    // Save to history
                    const historyId = await this.history.save({
                        question: args.question,
                        type: 'streaming',
                        streamingLog: streamingResults,
                        modelUpdates,
                        stageUpdates,
                        ...finalResult
                    });

                    // Format comprehensive response
                    const response = `✅ Streaming Debate Complete!\n\n` +
                                   `**Question:** ${args.question}\n` +
                                   `**History ID:** ${historyId}\n` +
                                   `**Winner:** ${finalResult.winner}\n` +
                                   `**Score:** ${(typeof finalResult.score === 'number') ? finalResult.score.toFixed(2) :
                                             (finalResult.score && typeof finalResult.score.total === 'number') ? finalResult.score.total.toFixed(2) : 'N/A'}\n` +
                                   `**Contributors:** ${finalResult.contributors.join(', ')}\n\n` +
                                   `## Streaming Progress Log\n\n${streamingResults}\n` +
                                   `## Final Solution\n\n${finalResult.solution}\n\n` +
                                   `---\n*Real-time streaming debate with intelligent model selection*`;

                    return {
                        content: [{
                            type: 'text',
                            text: response
                        }]
                    };

                } catch (error) {
                    console.error('Streaming debate error:', error);
                    return {
                        content: [{
                            type: 'text',
                            text: `Error running streaming debate: ${error.message}\n\nFalling back to regular debate functionality.`
                        }]
                    };
                }
            }

            if (name === 'iterative_debate') {
                try {
                    // Security validation
                    const sanitizedQuestion = this.security.validateQuestion(args.question);
                    const validatedPath = await this.security.validateProjectPath(args.projectPath);
                    this.security.checkRateLimit('iterative_debate', 3, 600000); // 3 iterative debates per 10 minutes
                    
                    console.error('Starting iterative debate for:', sanitizedQuestion);
                    
                    // Configure iteration settings if provided
                    if (args.maxIterations) {
                        this.iterativeDebate.maxIterations = args.maxIterations;
                    }
                    if (args.consensusThreshold) {
                        this.iterativeDebate.consensusThreshold = args.consensusThreshold;
                    }
                    
                    // Run iterative debate
                    const result = await this.iterativeDebate.runIterativeDebate(
                        sanitizedQuestion,
                        validatedPath
                    );
                    
                    // Save to history
                    const historyId = await this.history.save({
                        question: args.question,
                        type: 'iterative',
                        ...result
                    });
                    
                    return {
                        content: [{
                            type: 'text',
                            text: `✅ Iterative Debate Complete!\n\n` +
                                  `**Question:** ${args.question}\n` +
                                  `**History ID:** ${historyId}\n` +
                                  `**Iterations:** ${result.iterations}\n` +
                                  `**Final Consensus:** ${result.finalConsensus}%\n` +
                                  `**Consensus Evolution:** ${result.debateHistory.consensusTrend.join('% → ')}%\n\n` +
                                  `## Solution\n\n${result.solution}`
                        }]
                    };
                    
                } catch (error) {
                    console.error('Iterative debate error:', error);
                    return {
                        content: [{
                            type: 'text',
                            text: `Error running iterative debate: ${error.message}`
                        }]
                    };
                }
            }

            if (name === 'confidence_analysis') {
                try {
                    let debateData = null;

                    // If historyId is provided, fetch the debate from history
                    if (args.historyId) {
                        const historicalDebate = await this.history.get(args.historyId);
                        if (!historicalDebate) {
                            return {
                                content: [{
                                    type: 'text',
                                    text: `❌ No debate found with ID: ${args.historyId}`
                                }]
                            };
                        }

                        debateData = {
                            question: historicalDebate.question,
                            proposals: historicalDebate.proposals,
                            responses: historicalDebate.proposals,
                            winner: historicalDebate.winner,
                            score: historicalDebate.score,
                            improvements: historicalDebate.improvements || {},
                            solution: historicalDebate.solution,
                            toolsUsed: historicalDebate.toolsUsed,
                            verificationScore: historicalDebate.confidence?.factors?.verification_passed / 100
                        };
                    } else if (args.question) {
                        // Direct analysis of provided data
                        debateData = {
                            question: args.question,
                            proposals: args.proposals || {},
                            responses: args.proposals || {},
                            winner: 'Unknown',
                            score: 0.5,
                            improvements: {},
                            solution: 'Direct confidence analysis',
                            toolsUsed: false
                        };
                    } else {
                        return {
                            content: [{
                                type: 'text',
                                text: '❌ Either historyId or question must be provided for confidence analysis'
                            }]
                        };
                    }

                    // Calculate confidence using the scorer
                    const confidence = await this.debate.confidenceScorer.calculateConfidence(debateData);

                    // Format detailed confidence report
                    let response = `📊 **Confidence Analysis Results**\n\n`;

                    if (args.historyId) {
                        response += `**Debate ID:** ${args.historyId}\n`;
                    }
                    response += `**Question:** ${debateData.question}\n\n`;

                    response += `## Overall Confidence Score\n`;
                    response += `**${confidence.score}%** - ${confidence.level}\n\n`;

                    response += `## Factor Breakdown\n`;
                    response += `- **Model Agreement:** ${confidence.factors.model_agreement}% (weight: ${confidence.weights.model_agreement}%)\n`;
                    response += `- **Verification Status:** ${confidence.factors.verification_passed}% (weight: ${confidence.weights.verification_passed}%)\n`;
                    response += `- **Historical Accuracy:** ${confidence.factors.historical_accuracy}% (weight: ${confidence.weights.historical_accuracy}%)\n`;
                    response += `- **Response Consistency:** ${confidence.factors.response_consistency}% (weight: ${confidence.weights.response_consistency}%)\n\n`;

                    response += `## Analysis Summary\n`;
                    response += `${confidence.analysis.summary}\n\n`;

                    if (confidence.analysis.strengths.length > 0) {
                        response += `## Strengths ✅\n`;
                        confidence.analysis.strengths.forEach(strength => {
                            response += `- ${strength}\n`;
                        });
                        response += '\n';
                    }

                    if (confidence.analysis.concerns.length > 0) {
                        response += `## Concerns ⚠️\n`;
                        confidence.analysis.concerns.forEach(concern => {
                            response += `- ${concern}\n`;
                        });
                        response += '\n';
                    }

                    if (confidence.analysis.suggestions.length > 0) {
                        response += `## Suggestions 💡\n`;
                        confidence.analysis.suggestions.forEach(suggestion => {
                            response += `- ${suggestion}\n`;
                        });
                        response += '\n';
                    }

                    response += `## Recommendation\n`;
                    response += `${confidence.recommendation}\n\n`;

                    response += `## Confidence Thresholds Reference\n`;
                    Object.entries(confidence.thresholds).forEach(([level, threshold]) => {
                        const icon = confidence.score >= threshold.min && confidence.score <= threshold.max ? '👈 **YOUR LEVEL**' : '';
                        response += `- **${threshold.min}-${threshold.max}%:** ${level.replace('_', ' ').toUpperCase()} - ${threshold.action} (${threshold.review} review) ${icon}\n`;
                    });

                    response += `\n---\n*Confidence scoring system analyzing ${Object.keys(debateData.proposals || {}).length} model responses*`;

                    return {
                        content: [{
                            type: 'text',
                            text: response
                        }]
                    };

                } catch (error) {
                    console.error('Confidence analysis error:', error);
                    return {
                        content: [{
                            type: 'text',
                            text: `Error analyzing confidence: ${error.message}`
                        }]
                    };
                }
            }

            if (name === 'debate_history') {
                const debates = await this.history.list(args.limit || 10);
                
                if (debates.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: 'No debates found.'
                        }]
                    };
                }
                
                const response = debates.map(d => {
                    const displayScore = (typeof d.score === 'number') ? d.score.toFixed(2) : 
                                         (d.score && typeof d.score.total === 'number') ? d.score.total.toFixed(2) : 'N/A';
                    return `[${new Date(d.timestamp).toISOString()}] ${d.id}\n` +
                           `Q: ${d.question}\nWinner: ${d.winner} (${displayScore})`;
                }).join('\n\n');
                
                return {
                    content: [{
                        type: 'text',
                        text: response
                    }]
                };
            }
        });
    }
    
    /**
     * Check if proxy server is running and start it if needed
     */
    async ensureProxyServerRunning() {
        try {
            // Check if proxy is already running
            await axios.get(`http://localhost:${this.PROXY_PORT}/health`, { timeout: 2000 });
            console.error(`✅ K-Proxy server already running on port ${this.PROXY_PORT}`);
            return;
        } catch (error) {
            // Proxy not running, start it
            console.error(`🚀 Starting k-proxy server on port ${this.PROXY_PORT}...`);
            await this.startProxyServer();
        }
    }
    
    /**
     * Start the k-proxy server as a child process
     */
    async startProxyServer() {
        return new Promise((resolve, reject) => {
            const proxyScript = path.join(__dirname, 'k-proxy-server.js');
            
            this.proxyProcess = spawn('node', [proxyScript], {
                cwd: __dirname,
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });
            
            let startupOutput = '';
            let errorOutput = '';
            
            // Capture startup output
            this.proxyProcess.stdout.on('data', (data) => {
                startupOutput += data.toString();
                console.error('[K-PROXY]', data.toString().trim());
                
                // Check for successful startup indicators
                if (startupOutput.includes('proxy running on http://localhost')) {
                    console.error('✅ K-Proxy server started successfully');
                    resolve();
                }
            });
            
            this.proxyProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.error('[K-PROXY ERROR]', data.toString().trim());
            });
            
            this.proxyProcess.on('error', (error) => {
                console.error('❌ Failed to start k-proxy server:', error.message);
                reject(new Error(`Failed to start k-proxy server: ${error.message}`));
            });
            
            this.proxyProcess.on('exit', (code, signal) => {
                if (code !== 0 && code !== null) {
                    console.error(`❌ K-Proxy server exited with code ${code}`);
                    console.error('Error output:', errorOutput);
                    reject(new Error(`K-Proxy server failed to start (exit code: ${code})`));
                }
            });
            
            // Timeout after 10 seconds if not started
            setTimeout(() => {
                if (!startupOutput.includes('proxy running on http://localhost')) {
                    console.error('❌ K-Proxy server startup timeout');
                    if (this.proxyProcess) {
                        this.proxyProcess.kill();
                    }
                    reject(new Error('K-Proxy server startup timeout'));
                }
            }, 10000);
        });
    }
    
    /**
     * Cleanup proxy process on shutdown
     */
    cleanup() {
        if (this.proxyProcess) {
            console.error('🛑 Stopping k-proxy server...');
            this.proxyProcess.kill();
            this.proxyProcess = null;
        }
    }
    
    formatResponse(question, result, historyId) {
        // Prepare response with explanation about the question
        const solution = result.solution || 'No solution generated';

        // Build configuration info
        let configInfo = [];
        if (result.selectionMethod) {
            configInfo.push(`Selection: ${result.selectionMethod}`);
        }
        if (result.modelConfiguration && result.modelConfiguration !== 'auto') {
            configInfo.push(`Config: ${result.modelConfiguration}`);
        }
        if (result.parallelInstances) {
            configInfo.push('Parallel instances enabled');
        }
        if (result.confidence) {
            configInfo.push(`Confidence: ${result.confidence.score}% (${result.confidence.level})`);
        }

        const configText = configInfo.length > 0 ? ` (${configInfo.join(', ')})` : '';

        // Create a clean response focusing on the question
        let response = `✅ Debate Complete!${configText}

**Question:** ${question}
**History ID:** ${historyId}
**Winner:** ${result.winner}
**Score:** ${(typeof result.score === 'number') ? result.score.toFixed(2) :
             (result.score && typeof result.score.total === 'number') ? result.score.total.toFixed(2) : 'N/A'}
**Contributors:** ${result.contributors.join(', ')}`;

        // Add confidence information if available
        if (result.confidence) {
            response += `
**Confidence:** ${result.confidence.score}% (${result.confidence.level})`;
            if (result.confidence.recommendation) {
                response += `
**Recommendation:** ${result.confidence.recommendation}`;
            }
        }

        response += `

## Solution

${solution}

---
*Multi-model consensus with enhanced AI expert selection*`;

        return response;
    }

    /**
     * Format timestamp for streaming logs
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    async run() {
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            this.cleanup();
            process.exit(0);
        });
        
        process.on('SIGTERM', () => {
            this.cleanup();
            process.exit(0);
        });
        
        await this.initialize();
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Debate Consensus MCP Server started');
    }
}

// For testing, we need to handle the async nature differently
// We'll create a factory function that returns a promise
async function createDebateConsensusMCP() {
    const instance = new DebateConsensusMCP();
    await instance.initialize();
    return instance;
}

// Create test-compatible class that uses synchronous mocked modules
class DebateConsensusMCPTest {
            constructor() {
                // In test environment, we expect mocked modules
                const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
                
                this.server = new Server(
                    { name: 'debate-consensus', version: '1.0.0' },
                    { capabilities: { tools: {} } }
                );
                
                this.debate = new SimpleDebate();
                this.history = new DebateHistory();
                this.setupTools();
            }

            setupTools() {
                this.server.setRequestHandler('tools/list', async () => ({
                    tools: [
                        {
                            name: 'debate',
                            description: 'Run multi-LLM consensus debate',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    question: { 
                                        type: 'string',
                                        description: 'The problem to solve'
                                    }
                                },
                                required: ['question']
                            }
                        },
                        {
                            name: 'debate_history',
                            description: 'Get recent debates',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    limit: { type: 'number' }
                                }
                            }
                        }
                    ]
                }));
                
                this.server.setRequestHandler('tools/call', async (request) => {
                    const { name, arguments: args } = request.params;
                    
                    if (name === 'debate') {
                        const result = await this.debate.runDebate(
                            args.question,
                            args.projectPath || process.cwd()
                        );
                        
                        const id = await this.history.save({
                            question: args.question,
                            ...result
                        });
                        
                        return {
                            content: [{
                                type: 'text',
                                text: `✅ Debate Complete!\n\n**Question:** ${args.question}\n**History ID:** ${id}\n**Winner:** ${result.winner}\n**Score:** ${(typeof result.score === 'number') ? result.score.toFixed(2) : (result.score && typeof result.score.total === 'number') ? result.score.total.toFixed(2) : 'N/A'}\n**Contributors:** ${result.contributors.join(', ')}\n\n## Solution\n\n${result.solution}\n\n---\n*Multi-model consensus reached using k1-k4 models*`
                            }]
                        };
                    }
                    
                    if (name === 'debate_history') {
                        const debates = await this.history.list(args.limit || 10);
                        return {
                            content: [{
                                type: 'text',
                                text: debates.map(d => 
                                    `[${new Date(d.timestamp).toISOString()}] ${d.id}\n` +
                                    `Q: ${d.question}\nWinner: ${d.winner} (${(typeof d.score === 'number') ? d.score.toFixed(2) : (d.score && typeof d.score.total === 'number') ? d.score.total.toFixed(2) : 'N/A'})`
                                ).join('\n\n')
                            }]
                        };
                    }
                });
            }
            
            async run() {
                const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
                const transport = new StdioServerTransport();
                await this.server.connect(transport);
                console.error('Debate Consensus MCP Server started');
            }
        }

// Export both for different use cases
export {
    DebateConsensusMCP,
    DebateConsensusMCPTest,
    createDebateConsensusMCP
};

// Direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    async function main() {
        const server = new DebateConsensusMCP();
        await server.run();
    }
    main().catch(console.error);
}