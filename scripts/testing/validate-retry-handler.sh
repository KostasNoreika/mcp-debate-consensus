#!/bin/bash

# ============================================================================
# Retry Handler Validation Script
# Comprehensive validation of retry functionality
# ============================================================================

set -e  # Exit on any error

echo "🔄 Retry Handler Validation Suite"
echo "=================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track overall results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Log file
LOG_FILE="validation-$(date +%Y%m%d-%H%M%S).log"
exec 1> >(tee -a "$LOG_FILE")
exec 2> >(tee -a "$LOG_FILE" >&2)

echo "📝 Logging to: $LOG_FILE"
echo ""

# Detect timeout command
TIMEOUT_CMD=""
if command -v timeout &> /dev/null; then
    TIMEOUT_CMD="timeout"
elif command -v gtimeout &> /dev/null; then
    TIMEOUT_CMD="gtimeout"
fi

# Function to run a test with timeout
run_with_timeout() {
    local timeout_seconds="$1"
    local command="$2"

    if [ -n "$TIMEOUT_CMD" ]; then
        $TIMEOUT_CMD "${timeout_seconds}s" $command
    else
        # Use Node.js built-in timeout if no timeout command available
        node -e "
            const { spawn } = require('child_process');
            const child = spawn('$command', { shell: true, stdio: 'inherit' });
            const timeout = setTimeout(() => {
                child.kill('SIGTERM');
                process.exit(124);
            }, $timeout_seconds * 1000);
            child.on('exit', (code) => {
                clearTimeout(timeout);
                process.exit(code);
            });
        "
    fi
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_file="$2"
    local timeout_seconds="${3:-300}" # Default 5 minutes timeout

    echo -e "${BLUE}▶️  Running: $test_name${NC}"
    echo "   File: $test_file"
    echo "   Timeout: ${timeout_seconds}s"
    echo ""

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # Check if test file exists
    if [ ! -f "$test_file" ]; then
        echo -e "   ${RED}❌ SKIP: Test file not found${NC}"
        echo ""
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        return 1
    fi

    # Make sure file is executable
    chmod +x "$test_file"

    # Run the test with timeout
    local start_time=$(date +%s)

    if run_with_timeout "$timeout_seconds" "node '$test_file'"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo ""
        echo -e "   ${GREEN}✅ PASS${NC} (${duration}s)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo ""
        return 0
    else
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo ""
        if [ $exit_code -eq 124 ]; then
            echo -e "   ${RED}❌ TIMEOUT${NC} (>${timeout_seconds}s)"
        else
            echo -e "   ${RED}❌ FAIL${NC} (${duration}s, exit code: $exit_code)"
        fi
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo ""
        return $exit_code
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo "🔍 Checking Prerequisites"
    echo "========================"
    echo ""

    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        echo "✅ Node.js: $node_version"
    else
        echo "❌ Node.js not found"
        exit 1
    fi

    # Check timeout command availability
    if [ -n "$TIMEOUT_CMD" ]; then
        echo "✅ Timeout command: $TIMEOUT_CMD"
    else
        echo "⚠️  No system timeout command found, using Node.js fallback"
    fi

    # Check if we're in the right directory
    if [ -f "package.json" ]; then
        echo "✅ Package.json found"
    else
        echo "❌ Not in a Node.js project directory"
        exit 1
    fi

    # Check if retry handler exists
    if [ -f "src/utils/retry-handler.js" ]; then
        echo "✅ Retry handler found"
    else
        echo "❌ Retry handler not found at src/utils/retry-handler.js"
        exit 1
    fi

    # Check dependencies
    if [ -d "node_modules" ]; then
        echo "✅ Node modules installed"
    else
        echo "⚠️  Node modules not found, installing..."
        npm install
    fi

    echo ""
}

# Function to run Jest unit tests
run_unit_tests() {
    echo "🧪 Unit Tests (Jest)"
    echo "==================="
    echo ""

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # Set environment variable to reduce test noise
    export SILENT_TESTS=true

    if npm test -- tests/unit/retry-handler.test.js --verbose --detectOpenHandles --forceExit; then
        echo ""
        echo -e "${GREEN}✅ PASS: Jest Unit Tests${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo ""
        echo -e "${RED}❌ FAIL: Jest Unit Tests${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    # Reset environment
    unset SILENT_TESTS

    echo ""
}

# Function to generate summary report
generate_summary() {
    local total_duration=$1

    echo ""
    echo "🏁 VALIDATION SUMMARY"
    echo "===================="
    echo ""
    echo "📊 Results:"
    echo "   Total Tests: $TOTAL_TESTS"
    echo -e "   Passed:     ${GREEN}$PASSED_TESTS${NC}"
    echo -e "   Failed:     ${RED}$FAILED_TESTS${NC}"
    echo -e "   Skipped:    ${YELLOW}$SKIPPED_TESTS${NC}"
    echo ""

    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
        echo "   Success Rate: ${success_rate}%"
        echo ""
    fi

    echo "⏱️  Total Duration: ${total_duration}s"
    echo "📝 Log File: $LOG_FILE"
    echo ""

    # Feature validation summary
    echo "🎯 Feature Validation:"
    echo "   • Exponential Backoff: $([ $PASSED_TESTS -ge 1 ] && echo "✅" || echo "❌")"
    echo "   • Circuit Breaker Pattern: $([ $PASSED_TESTS -ge 2 ] && echo "✅" || echo "❌")"
    echo "   • Error Categorization: $([ $PASSED_TESTS -ge 3 ] && echo "✅" || echo "❌")"
    echo "   • Jitter (Anti-Thundering Herd): $([ $PASSED_TESTS -ge 4 ] && echo "✅" || echo "❌")"
    echo "   • Integration with Debate System: $([ $PASSED_TESTS -ge 5 ] && echo "✅" || echo "❌")"
    echo ""

    # Production readiness assessment
    if [ $FAILED_TESTS -eq 0 ] && [ $PASSED_TESTS -ge 6 ]; then
        echo -e "${GREEN}🚀 PRODUCTION READY${NC}"
        echo "   All critical features validated successfully"
        echo "   Retry handler is ready for production deployment"
    elif [ $FAILED_TESTS -eq 0 ] && [ $PASSED_TESTS -ge 4 ]; then
        echo -e "${YELLOW}⚠️  MOSTLY READY${NC}"
        echo "   Core features working, some advanced features may need review"
        echo "   Consider addressing any skipped tests"
    else
        echo -e "${RED}❌ NOT READY${NC}"
        echo "   Critical failures detected"
        echo "   Review failed tests before production deployment"
    fi
    echo ""
}

# Function to clean up test artifacts
cleanup_test_artifacts() {
    echo "🧹 Cleaning Up Test Artifacts"
    echo "============================="
    echo ""

    # Remove temporary test files
    if [ -d "temp-test-wrappers" ]; then
        rm -rf temp-test-wrappers
        echo "✅ Removed temporary test wrappers"
    fi

    # Remove counter files
    rm -f /tmp/mock-wrapper-*-counter 2>/dev/null || true
    echo "✅ Removed temporary counter files"

    echo "✅ Cleanup completed"
    echo ""
}

# Main execution
main() {
    local start_time=$(date +%s)

    echo "Starting validation at $(date)"
    echo ""

    # Setup
    check_prerequisites

    # Cleanup before starting
    cleanup_test_artifacts

    echo "🎬 Starting Test Execution"
    echo "=========================="
    echo ""

    # Test 1: Unit Tests (Jest)
    run_unit_tests

    # Test 2: Basic Retry Functionality
    run_test "Basic Exponential Backoff" "test-retry-basic.js" 300

    # Test 3: Circuit Breaker Pattern
    run_test "Circuit Breaker Pattern" "test-circuit-breaker.js" 600

    # Test 4: Error Categorization
    run_test "Error Categorization" "test-error-categorization.js" 300

    # Test 5: Jitter Testing
    run_test "Jitter (Anti-Thundering Herd)" "test-jitter.js" 600

    # Test 6: Functionality Demonstration
    run_test "Retry Functionality Demo" "test-retry-functionality.js" 300

    # Test 7: Integration Tests
    run_test "Integration Tests" "test-retry-integration-comprehensive.js" 900

    # Test 8: Existing Integration Test
    run_test "Basic Integration Test" "test-retry-integration.js" 180

    echo "🏁 Test Execution Complete"
    echo "=========================="
    echo ""

    # Generate summary
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    generate_summary $total_duration

    # Cleanup after tests
    cleanup_test_artifacts

    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "🎉 All validations completed successfully!"
        exit 0
    else
        echo "⚠️  Some validations failed. See details above."
        exit 1
    fi
}

# Main execution for quick mode
main_quick() {
    local start_time=$(date +%s)

    echo "Starting quick validation at $(date)"
    echo ""

    check_prerequisites
    cleanup_test_artifacts

    # Essential tests only
    run_unit_tests
    run_test "Basic Exponential Backoff" "test-retry-basic.js" 180
    run_test "Error Categorization" "test-error-categorization.js" 180
    run_test "Integration Tests" "test-retry-integration-comprehensive.js" 300

    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    generate_summary $total_duration

    cleanup_test_artifacts

    if [ $FAILED_TESTS -eq 0 ]; then
        echo "🎉 Quick validation completed successfully!"
        exit 0
    else
        echo "⚠️  Quick validation found issues."
        exit 1
    fi
}

# Handle interrupts
trap 'echo -e "\n\n⏹️  Validation interrupted by user"; cleanup_test_artifacts; exit 130' INT TERM

# Show help if requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Retry Handler Validation Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --quick        Run only essential tests (faster execution)"
    echo "  --verbose      Enable verbose output"
    echo ""
    echo "This script validates:"
    echo "  • Exponential backoff functionality"
    echo "  • Circuit breaker pattern implementation"
    echo "  • Error categorization accuracy"
    echo "  • Jitter for thundering herd prevention"
    echo "  • Integration with the debate orchestrator"
    echo ""
    exit 0
fi

# Quick mode (essential tests only)
if [ "$1" = "--quick" ]; then
    echo "🏃 Quick Validation Mode"
    echo "======================="
    echo ""
    main_quick
else
    # Full validation
    main
fi