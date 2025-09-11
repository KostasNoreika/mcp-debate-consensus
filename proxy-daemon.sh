#!/bin/bash

# Daemon script for Claude Router Proxy
# Ensures only one instance runs and auto-restarts if needed

PROXY_DIR="/opt/mcp/servers/debate-consensus/claude-router"
PID_FILE="/tmp/claude-router-proxy.pid"
LOG_FILE="/opt/mcp/servers/debate-consensus/logs/proxy.log"

# Create logs directory
mkdir -p "$(dirname "$LOG_FILE")"

# Function to check if proxy is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to start proxy
start_proxy() {
    if is_running; then
        echo "Proxy already running (PID: $(cat $PID_FILE))"
        return 0
    fi
    
    echo "Starting Claude Router Proxy..."
    
    # Setup if needed
    if [ ! -d "$PROXY_DIR" ]; then
        echo "First time setup..."
        /opt/mcp/servers/debate-consensus/setup-claude-router.sh
    fi
    
    # Start proxy in background
    cd "$PROXY_DIR"
    nohup node proxy.js >> "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    
    sleep 2
    
    if is_running; then
        echo "✅ Proxy started successfully (PID: $PID)"
        echo "   Logs: $LOG_FILE"
        return 0
    else
        echo "❌ Failed to start proxy"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Function to stop proxy
stop_proxy() {
    if ! is_running; then
        echo "Proxy is not running"
        return 0
    fi
    
    PID=$(cat "$PID_FILE")
    echo "Stopping proxy (PID: $PID)..."
    kill "$PID"
    
    # Wait for process to stop
    for i in {1..10}; do
        if ! ps -p "$PID" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    
    # Force kill if still running
    if ps -p "$PID" > /dev/null 2>&1; then
        kill -9 "$PID"
    fi
    
    rm -f "$PID_FILE"
    echo "✅ Proxy stopped"
}

# Function to restart proxy
restart_proxy() {
    stop_proxy
    sleep 1
    start_proxy
}

# Function to check status
status_proxy() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        echo "✅ Proxy is running (PID: $PID)"
        echo "   URL: http://localhost:3456"
        
        # Check health
        if curl -s http://localhost:3456/health > /dev/null 2>&1; then
            echo "   Health: OK"
        else
            echo "   Health: Not responding"
        fi
    else
        echo "❌ Proxy is not running"
    fi
}

# Main command
case "$1" in
    start)
        start_proxy
        ;;
    stop)
        stop_proxy
        ;;
    restart)
        restart_proxy
        ;;
    status)
        status_proxy
        ;;
    ensure)
        # Used by auto-start - starts only if not running
        if ! is_running; then
            start_proxy
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|ensure}"
        echo
        echo "  start   - Start the proxy"
        echo "  stop    - Stop the proxy"
        echo "  restart - Restart the proxy"
        echo "  status  - Check proxy status"
        echo "  ensure  - Start only if not running (for auto-start)"
        exit 1
        ;;
esac