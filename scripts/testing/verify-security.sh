#!/bin/bash

# Security Verification Script
# Comprehensive security testing for the debate-consensus project

set -e

echo "🛡️  Security Verification for Debate-Consensus Project"
echo "======================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/mcp/servers/debate-consensus"
LOG_DIR="$PROJECT_DIR/logs"
SECURITY_LOG="$LOG_DIR/security-verification-$(date +%Y%m%d-%H%M%S).log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

echo "📁 Project Directory: $PROJECT_DIR"
echo "📝 Security Log: $SECURITY_LOG"

# Function to log and display messages
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo -e "[$timestamp] [$level] $message" | tee -a "$SECURITY_LOG"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is open
check_port() {
    local port=$1
    local host=${2:-localhost}

    if nc -z "$host" "$port" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Pre-flight checks
echo -e "\n${BLUE}🔍 Pre-flight Security Checks${NC}"
echo "================================"

cd "$PROJECT_DIR" || exit 1

log_message "INFO" "Starting security verification"

# Check if Node.js is available
if ! command_exists node; then
    log_message "ERROR" "Node.js is not installed or not in PATH"
    exit 1
fi

NODE_VERSION=$(node --version)
log_message "INFO" "Node.js version: $NODE_VERSION"

# Check if npm is available
if ! command_exists npm; then
    log_message "ERROR" "npm is not installed or not in PATH"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    log_message "WARN" "Node modules not found, installing dependencies..."
    npm install
fi

# Check environment configuration
echo -e "\n${PURPLE}⚙️  Environment Configuration${NC}"
echo "================================="

if [ -f ".env" ]; then
    log_message "INFO" ".env file found"

    # Check for security-related environment variables
    if grep -q "OPENROUTER_API_KEY" .env; then
        log_message "INFO" "OPENROUTER_API_KEY is configured"
    else
        log_message "WARN" "OPENROUTER_API_KEY not found in .env"
    fi

    if grep -q "HMAC_SECRET" .env; then
        log_message "INFO" "HMAC_SECRET is configured"
    else
        log_message "WARN" "HMAC_SECRET not found in .env (will use auto-generated)"
    fi

    if grep -q "ENABLE_REQUEST_SIGNING" .env; then
        SIGNING_STATUS=$(grep "ENABLE_REQUEST_SIGNING" .env | cut -d'=' -f2)
        log_message "INFO" "Request signing configuration: $SIGNING_STATUS"
    else
        log_message "INFO" "Request signing using default configuration"
    fi
else
    log_message "WARN" ".env file not found, using defaults"
fi

# Check if proxy server is running
echo -e "\n${CYAN}🌐 Proxy Server Status${NC}"
echo "======================"

PROXY_RUNNING=false
PROXY_PORTS=(3457 3458 3459 3460 3463 3464)

for port in "${PROXY_PORTS[@]}"; do
    if check_port "$port"; then
        log_message "INFO" "Proxy server running on port $port"
        PROXY_RUNNING=true
    else
        log_message "WARN" "No proxy server on port $port"
    fi
done

if [ "$PROXY_RUNNING" = false ]; then
    log_message "INFO" "Starting proxy server..."
    node k-proxy-server.js &
    PROXY_PID=$!

    # Wait for proxy to start
    echo "⏳ Waiting for proxy server to start..."
    sleep 10

    # Check if proxy started successfully
    if check_port 3457; then
        log_message "INFO" "Proxy server started successfully (PID: $PROXY_PID)"
        STARTED_PROXY=true
    else
        log_message "ERROR" "Failed to start proxy server"
        exit 1
    fi
else
    STARTED_PROXY=false
    log_message "INFO" "Using existing proxy server"
fi

# Function to run a security test
run_security_test() {
    local test_name=$1
    local test_script=$2
    local test_description=$3

    echo -e "\n${GREEN}🧪 Running: $test_name${NC}"
    echo "$(printf '=%.0s' {1..50})"
    echo "$test_description"
    echo ""

    log_message "INFO" "Starting test: $test_name"

    if [ -f "$test_script" ]; then
        if node "$test_script" 2>&1 | tee -a "$SECURITY_LOG"; then
            log_message "PASS" "$test_name completed successfully"
            return 0
        else
            log_message "FAIL" "$test_name failed"
            return 1
        fi
    else
        log_message "ERROR" "Test script not found: $test_script"
        return 1
    fi
}

# Security Test Suite
echo -e "\n${YELLOW}🛡️  Security Test Suite${NC}"
echo "========================"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test 1: HMAC Signature Validation
if run_security_test "HMAC Signature Validation" "test-security-client.js" "Tests HMAC-SHA256 request signing, signature validation, and anti-tampering measures"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 2: Rate Limiting
if run_security_test "Rate Limiting" "test-rate-limiting.js" "Tests request rate limiting per IP address and time windows"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 3: Replay Protection
if run_security_test "Replay Protection" "test-replay-protection.js" "Tests nonce-based replay attack protection and request uniqueness"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 4: Timestamp Validation
if run_security_test "Timestamp Validation" "test-timestamp-validation.js" "Tests timestamp-based request freshness validation"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Test 5: Input Validation (using existing security test)
if [ -f "test-security.js" ]; then
    if run_security_test "Input Validation" "test-security.js" "Tests input sanitization and malicious content detection"; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
fi

# Security Headers Test
echo -e "\n${BLUE}🔒 Testing Security Headers${NC}"
echo "============================"

log_message "INFO" "Testing security headers"

SECURITY_HEADERS=(
    "X-Content-Type-Options"
    "X-Frame-Options"
    "X-XSS-Protection"
    "Strict-Transport-Security"
    "Referrer-Policy"
    "Content-Security-Policy"
)

HEADERS_OK=true

for header in "${SECURITY_HEADERS[@]}"; do
    if curl -s -I "http://localhost:3457/health" | grep -i "$header" > /dev/null; then
        echo "✅ $header: Present"
        log_message "PASS" "Security header present: $header"
    else
        echo "❌ $header: Missing"
        log_message "FAIL" "Security header missing: $header"
        HEADERS_OK=false
    fi
done

if [ "$HEADERS_OK" = true ]; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Security Status Endpoint Test
echo -e "\n${PURPLE}📊 Security Status Endpoint${NC}"
echo "============================"

log_message "INFO" "Testing security status endpoint"

if curl -s "http://localhost:3457/security/status" | jq . > /dev/null 2>&1; then
    echo "✅ Security status endpoint is accessible"

    # Extract security configuration
    SECURITY_STATUS=$(curl -s "http://localhost:3457/security/status")

    echo "Security Configuration:"
    echo "$SECURITY_STATUS" | jq '.security' 2>/dev/null || echo "Could not parse security status"

    log_message "PASS" "Security status endpoint test passed"
    ((PASSED_TESTS++))
else
    echo "❌ Security status endpoint is not accessible or returning invalid JSON"
    log_message "FAIL" "Security status endpoint test failed"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Vulnerability Scan (Basic)
echo -e "\n${RED}🔍 Basic Vulnerability Scan${NC}"
echo "============================"

log_message "INFO" "Running basic vulnerability scan"

# Check for common security issues
VULN_COUNT=0

# Check for exposed sensitive files
SENSITIVE_FILES=(".env" "config.json" "secrets.json" "private.key")

for file in "${SENSITIVE_FILES[@]}"; do
    if curl -s -f "http://localhost:3457/$file" > /dev/null 2>&1; then
        echo "⚠️  Sensitive file exposed: $file"
        log_message "VULN" "Sensitive file exposed: $file"
        ((VULN_COUNT++))
    fi
done

# Check for directory traversal
if curl -s "http://localhost:3457/../../../etc/passwd" | grep "root:" > /dev/null 2>&1; then
    echo "⚠️  Directory traversal vulnerability detected"
    log_message "VULN" "Directory traversal vulnerability"
    ((VULN_COUNT++))
fi

# Check for SQL injection in parameters (basic)
SQL_PAYLOADS=("1' OR '1'='1" "1; DROP TABLE users--" "' UNION SELECT * FROM users--")

for payload in "${SQL_PAYLOADS[@]}"; do
    if curl -s "http://localhost:3457/health?test=$payload" | grep -i "sql\|error\|exception" > /dev/null 2>&1; then
        echo "⚠️  Potential SQL injection vulnerability with payload: $payload"
        log_message "VULN" "Potential SQL injection: $payload"
        ((VULN_COUNT++))
    fi
done

if [ $VULN_COUNT -eq 0 ]; then
    echo "✅ No basic vulnerabilities detected"
    log_message "PASS" "Basic vulnerability scan passed"
    ((PASSED_TESTS++))
else
    echo "❌ $VULN_COUNT potential vulnerabilities detected"
    log_message "FAIL" "Basic vulnerability scan found issues"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Generate Security Report
echo -e "\n${CYAN}📋 Security Verification Report${NC}"
echo "==============================="

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

echo "Test Summary:"
echo "- Total Tests: $TOTAL_TESTS"
echo "- Passed: $PASSED_TESTS"
echo "- Failed: $FAILED_TESTS"
echo "- Success Rate: $SUCCESS_RATE%"

log_message "SUMMARY" "Security verification completed - $PASSED_TESTS/$TOTAL_TESTS tests passed ($SUCCESS_RATE%)"

# Create security report file
SECURITY_REPORT="$LOG_DIR/security-report-$(date +%Y%m%d-%H%M%S).json"

cat > "$SECURITY_REPORT" << EOF
{
  "securityVerification": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "projectPath": "$PROJECT_DIR",
    "testSummary": {
      "totalTests": $TOTAL_TESTS,
      "passedTests": $PASSED_TESTS,
      "failedTests": $FAILED_TESTS,
      "successRate": $SUCCESS_RATE
    },
    "environment": {
      "nodeVersion": "$NODE_VERSION",
      "proxyRunning": $PROXY_RUNNING,
      "requestSigningEnabled": true
    },
    "recommendations": [
      "Enable all security features in production",
      "Regularly update dependencies for security patches",
      "Monitor security logs for suspicious activity",
      "Implement additional rate limiting if needed",
      "Consider adding IP whitelisting for sensitive operations"
    ]
  }
}
EOF

echo ""
echo "📄 Detailed security report saved to: $SECURITY_REPORT"
echo "📝 Complete security log saved to: $SECURITY_LOG"

# Cleanup
if [ "$STARTED_PROXY" = true ] && [ -n "$PROXY_PID" ]; then
    echo ""
    log_message "INFO" "Stopping proxy server (PID: $PROXY_PID)"
    kill $PROXY_PID 2>/dev/null || true
fi

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All security tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some security tests failed. Review the logs for details.${NC}"
    exit 1
fi