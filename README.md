# AI Expert Consensus v2 - MCP Server

**A revolutionary approach to AI problem-solving through intelligent multi-model consensus with advanced learning, caching, and confidence scoring capabilities.**

🆕 **Version 2.0** - Major upgrade with 9 groundbreaking features for production-ready AI consensus!

## 🎯 Why This Matters

Traditional single-model AI approaches have inherent limitations - biases, knowledge gaps, and singular perspectives. This MCP server solves these issues by orchestrating multiple state-of-the-art LLMs in structured debates, where each model brings unique expertise and has **full access to development tools** through Claude CLI integration.

### Key Differentiators

- **🧠 Intelligent Model Selection**: Gemini-powered coordinator automatically selects optimal models based on question analysis
- **📊 Performance Tracking**: SQLite-based tracking across 70+ universal categories (not just programming)
- **⚡ Parallel Processing**: Support for multiple instances per model (e.g., `k1:2,k2:3` for parallel analysis)
- **🔒 Cross-Verification**: Adversarial testing for critical scenarios (security, finance, legal)
- **📈 Learning System**: Continuous improvement through pattern analysis and outcome tracking
- **💯 Confidence Scoring**: 0-100% scores with detailed breakdowns and recommendations
- **💰 Smart Caching**: 90% cost reduction on repeated questions with intelligent invalidation
- **📡 Real-time Streaming**: Progressive updates showing debate progress and interim results
- **🎯 Quality Presets**: Rapid/Balanced/Maximum modes for speed vs quality trade-offs
- **🔧 Full MCP Access**: Each model can read files, execute commands, search codebases, and more

## 🆕 Version 2.0 Features

### 1. Intelligent Model Selection (Gemini Coordinator)
- Automatically analyzes questions and selects 3-5 optimal models
- 70+ universal categories covering all domains
- Dynamic complexity scoring for optimal resource allocation

### 2. Performance Tracking Database
- SQLite-based tracking with comprehensive metrics
- Learns from past debates to improve future performance
- Detailed analytics per model and category

### 3. Parallel Instance Support
- Run multiple instances of the same model: `k1:2,k2,k3:3`
- Increases diversity of perspectives
- Reduces single-point-of-failure risks

### 4. Cross-Verification System
- Detects high-risk scenarios (security, finance, legal)
- Engages adversarial models for thorough testing
- Ensures robust solutions for critical applications

### 5. Continuous Learning System
- Pattern recognition across debates
- Improves model selection over time
- Adapts to user preferences and domain specifics

### 6. Confidence Scoring (0-100%)
- Multi-factor confidence analysis
- Clear recommendations based on confidence levels
- Helps users understand when to trust results

### 7. Smart Caching System
- 90% cost reduction on repeated questions
- Intelligent invalidation based on context changes
- Memory-efficient LRU eviction

### 8. Real-time Streaming
- Progressive updates during debate
- See interim results and model progress
- Better user experience for long-running debates

### 9. Quality Presets
- **Rapid (3-5s)**: Single fast model for quick answers
- **Balanced (30-60s)**: 3 models for thorough analysis
- **Maximum (2-5min)**: 5 models with verification for critical decisions

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/KostasNoreika/mcp-debate-consensus.git
cd mcp-debate-consensus && npm install

# 2. Configure API key (REQUIRED!)
cp .env.example .env
# Edit .env and add your OpenRouter API key

# 3. Run automated setup
node install.js

# 4. Start the proxy server (REQUIRED before using!)
node k-proxy-server.js &

# 5. Run health check
node health-check.js

# 6. Test the system
node test-debate.js "What's the best architecture for a real-time chat app?"
```

⚠️ **Important**: You MUST have an OpenRouter API key and configure it in `.env` file before using the system!

## 🏗️ Architecture

### How It Works

```mermaid
graph TD
    A[User Question] --> B[MCP Server]
    B --> C[Claude CLI Orchestrator]
    C --> D1[k1: Claude Opus 4.1<br/>Architecture Expert]
    C --> D2[k2: GPT-5<br/>Testing Expert]
    C --> D3[k3: Qwen 3 Max<br/>Algorithm Expert]
    C --> D4[k4: Gemini 2.5 Pro<br/>Integration Expert]
    C --> D5[k5: Grok 4 Fast<br/>Fast Reasoning Expert]

    D1 --> E[MCP Tools Access]
    D2 --> E
    D3 --> E
    D4 --> E
    D5 --> E
    
    E --> F[File Operations]
    E --> G[Bash Commands]
    E --> H[Code Search]
    E --> I[Git/Docker/Web]
    
    D1 --> J[Round 1: Independent Analysis]
    D2 --> J
    D3 --> J
    D4 --> J
    
    J --> K[Semantic Scoring]
    K --> L[Best Proposal Selection]
    L --> M[Round 2: Collaborative Improvement]
    M --> N[Final Consensus Solution]
```

### Core Components

1. **MCP Server (`index.js`)**
   - Implements Model Context Protocol specification
   - Handles tool registration and request routing
   - Manages security and rate limiting

2. **Claude CLI Orchestrator (`src/claude-cli-debate.js`)**
   - Spawns actual Claude CLI processes for each model
   - Manages inter-model communication
   - Coordinates debate rounds and synthesis

3. **Proxy Server (`k-proxy-server.js`)**
   - Routes k1-k4 aliases to different models via OpenRouter
   - Enables model diversity while using Claude CLI interface
   - Handles API authentication and request forwarding

4. **Security Layer (`src/security.js`)**
   - Input validation and sanitization
   - API key protection
   - Rate limiting
   - Path traversal prevention

## 💡 Real-World Benefits

### For Development Teams

- **Better Architecture Decisions**: Multiple expert perspectives ensure robust system design
- **Comprehensive Testing**: Testing expert (k2) ensures quality and coverage
- **Optimized Algorithms**: Algorithm specialist (k3) identifies performance improvements
- **Seamless Integration**: Integration expert (k4) ensures compatibility

### For Complex Problems

- **Reduced Bias**: Multiple models counteract individual model biases
- **Higher Accuracy**: Consensus approach reduces errors
- **Complete Solutions**: Each model can explore the actual codebase
- **Practical Implementation**: Models provide working code, not just theory

### Example Use Cases

1. **System Architecture Design**
   ```bash
   node test-debate.js "Design a scalable microservices architecture for an e-commerce platform"
   ```

2. **Code Review and Optimization**
   ```bash
   node test-debate.js "Review and optimize the performance of our React application"
   ```

3. **Security Analysis**
   ```bash
   node test-debate.js "Analyze security vulnerabilities in our authentication system"
   ```

4. **Technology Selection**
   ```bash
   node test-debate.js "Choose the best database for our real-time analytics platform"
   ```

## 🛠️ Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenRouter API key from [OpenRouter](https://openrouter.ai/keys)

### Automated Setup

```bash
# Run the interactive installer
node install.js
```

The installer will:
- ✅ Check system requirements
- ✅ Install dependencies
- ✅ Configure environment
- ✅ Set up Claude CLI paths
- ✅ Create configuration directories
- ✅ Test API connection
- ✅ Verify proxy servers

### Manual Setup

<details>
<summary>Click for manual setup instructions</summary>

1. **Install dependencies:**
   ```bash
   npm install
   cd claude-router && npm install && cd ..
   ```

2. **Configure API key (required locally):**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenRouter API key
   # This file is git-ignored for security
   ```

3. **Install Claude CLI (optional but recommended):**
   ```bash
   npm install -g @anthropic/claude-cli
   ```

4. **Start proxy server:**
   ```bash
   node k-proxy-server.js
   ```

5. **Run health check:**
   ```bash
   node health-check.js
   ```

</details>

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
OPENROUTER_API_KEY=your_api_key_here
CLAUDE_CLI_PATH=/path/to/claude   # Optional: override auto-detection
PROXY_PORT=3456                   # Optional: base port for proxy servers
DEBATE_TIMEOUT=1800000            # Optional: max debate time (30 min default)
MIN_MODELS_REQUIRED=2             # Optional: minimum models for consensus
```

#### Claude CLI Auto-Detection

The system **automatically finds** Claude CLI without any configuration:

1. **Global command**: `claude` (if available in PATH)  
2. **Local installation**: `$HOME/.claude/local/claude`
3. **System installation**: `/usr/local/bin/claude`

**No setup required** - just install Claude CLI and it will be found automatically.

**Optional override** (only if auto-detection fails):

```bash
export CLAUDE_CLI_PATH="/custom/path/to/claude"
# or add to .env file
echo "CLAUDE_CLI_PATH=/custom/path/to/claude" >> .env
```

### MCP Integration

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "debate-consensus": {
      "command": "node",
      "args": ["/path/to/mcp-debate-consensus/index.js"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 📊 How Scoring Works

The semantic scoring algorithm evaluates each proposal:

- **Relevance (40%)**: How well the answer addresses the question
- **Novelty (20%)**: Unique insights and creative approaches  
- **Quality (20%)**: Technical accuracy and completeness
- **Coherence (20%)**: Logical structure and clarity

## 🧪 Testing

```bash
# Run health check
node health-check.js

# Test basic functionality
npm test

# Test debate with custom question
node test-debate.js "Your question here"

# Run comprehensive test suite
npm run test:all
```

## 🔒 Security Features

- **Input Validation**: All inputs sanitized and validated
- **API Key Protection**: Keys never exposed in logs or outputs
- **Rate Limiting**: Prevents abuse and excessive API usage
- **Path Restrictions**: Prevents access to system directories
- **Secure Communication**: All model communication encrypted

## 🚦 Health Monitoring

The built-in health check verifies:

- ✅ Node.js version compatibility
- ✅ All dependencies installed
- ✅ Environment properly configured
- ✅ Proxy servers running
- ✅ Claude CLI available
- ✅ API connection working

Run: `node health-check.js`

## 📈 Performance

- **Parallel Processing**: Models analyze independently in Round 1
- **Efficient Caching**: Responses cached to reduce API calls
- **Timeout Management**: Configurable timeouts prevent hanging
- **Resource Optimization**: Automatic cleanup of old logs

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/KostasNoreika/mcp-debate-consensus.git

# Create feature branch
git checkout -b feature/your-feature

# Install dev dependencies
npm install --include=dev

# Run tests
npm test

# Submit PR
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on [Model Context Protocol (MCP)](https://github.com/anthropics/mcp) by Anthropic
- Powered by [OpenRouter](https://openrouter.ai) for unified model access
- Inspired by ensemble learning and wisdom of crowds principles

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/KostasNoreika/mcp-debate-consensus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/KostasNoreika/mcp-debate-consensus/discussions)
- **Documentation**: [Wiki](https://github.com/KostasNoreika/mcp-debate-consensus/wiki)

## 🚀 Roadmap

- [ ] Web UI for easier interaction
- [ ] Support for more models
- [ ] Custom expertise configuration
- [ ] Debate history analytics
- [ ] Plugin system for extensions
- [ ] Cloud deployment options

---

**⭐ If you find this project useful, please star it on GitHub!**