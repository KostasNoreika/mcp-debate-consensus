# 🚀 Quick Installation Guide

## One-Command Setup

Run this single command to set up everything:

```bash
cd /opt/mcp/servers/debate-consensus && \
chmod +x *.sh && \
./activate-proxy.sh && \
./register-mcp.sh
```

This will:
1. ✅ Setup the proxy server
2. ✅ Enable auto-start on system boot
3. ✅ Start the proxy immediately
4. ✅ Register MCP server with Claude
5. ✅ Make k1-k4 aliases work with full Claude CLI features

## Verify Installation

```bash
# Check proxy is running
./proxy-daemon.sh status

# Test models (after sourcing aliases)
source ~/.claude-k-models
k1 "What AI model are you?"
k2 "List files in current directory"
k3 "Show current time"
k4 "What's 2+2?"
```

## Usage

### In Terminal
```bash
source ~/.claude-k-models
k1 /init                    # Claude Opus 4.1 with full MCP
k2 "Debug this code"        # GPT-5 with file access
k3 "Optimize algorithm"     # Qwen 3 Max with tools
k4 "Review project"         # Gemini 2.5 Pro with everything
```

### In Claude CLI
```
Use debate tool to analyze: What's the best database for my project?
```

## Auto-Start

The proxy automatically:
- Starts on system boot
- Restarts if it crashes
- Ensures only one instance runs
- Logs to `/opt/mcp/servers/debate-consensus/logs/proxy.log`

## Manual Control

```bash
./proxy-daemon.sh start     # Start proxy
./proxy-daemon.sh stop      # Stop proxy
./proxy-daemon.sh restart   # Restart proxy
./proxy-daemon.sh status    # Check status
```

## Troubleshooting

If proxy doesn't work:
```bash
# Check logs
tail -f logs/proxy.log

# Restart everything
./proxy-daemon.sh restart

# Re-run setup
./setup-claude-router.sh
./proxy-daemon.sh start
```

## Architecture

```
k1-k4 aliases → Claude CLI → Proxy (localhost:3456) → OpenRouter → Models
                     ↓
                MCP Servers (local)
                     ↓
                File System (local)
```

All MCP features work because we use real Claude CLI!