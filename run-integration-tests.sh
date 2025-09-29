#!/bin/bash

# =============================================================================
# Integration Test Runner for Debate Consensus System
# =============================================================================
#
# This script runs comprehensive integration tests for the debate-consensus
# system including complete workflow, parallel execution, error recovery,
# security features, and performance testing.
#
# Usage:
#   ./run-integration-tests.sh [--quick] [--verbose] [--test=name]
#
# Options:
#   --quick     Run only essential tests (faster execution)
#   --verbose   Enable verbose logging output
#   --test=name Run only specific test (debate-flow, parallel, error, security, performance)
#   --help      Show this help message
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
INTEGRATION_LOG="$LOG_DIR/integration-test-run-$TIMESTAMP.log"

# Test configuration
QUICK_MODE=false
VERBOSE_MODE=false
SPECIFIC_TEST=""
PARALLEL_SAFE=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "============================================================================="
    echo "$1"
    echo "============================================================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️ $1${NC}"
}

log_command() {
    local cmd="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Executing: $cmd" >> "$INTEGRATION_LOG"
    if [[ "$VERBOSE_MODE" == "true" ]]; then
        echo -e "${PURPLE}🔧 $cmd${NC}"
    fi
}

# =============================================================================
# Test Prerequisites
# =============================================================================

check_prerequisites() {
    print_header "CHECKING PREREQUISITES"

    # Check Node.js version
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    local node_version=$(node -v)
    print_info "Node.js version: $node_version"

    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found. Please run from the project root directory."
        exit 1
    fi

    # Check if required files exist
    local required_files=(
        "src/claude-cli-debate.js"
        "src/security.js"
        "src/utils/retry-handler.js"
        "k-proxy-server.js"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Required file not found: $file"
            exit 1
        fi
    done

    # Create logs directory
    mkdir -p "$LOG_DIR"

    # Check environment variables
    if [[ -f ".env" ]]; then
        print_info "Environment file found: .env"
    else
        print_warning "No .env file found - using defaults"
    fi

    print_success "Prerequisites check completed"
}

# =============================================================================
# System Health Check
# =============================================================================

system_health_check() {
    print_header "SYSTEM HEALTH CHECK"

    # Check if proxy servers are running
    print_info "Checking proxy server status..."

    local proxy_running=false
    for port in 3457 3458 3459 3460 3461; do
        if nc -z localhost $port 2>/dev/null; then
            print_info "Proxy server running on port $port"
            proxy_running=true
        fi
    done

    if [[ "$proxy_running" == "false" ]]; then
        print_warning "No proxy servers detected - starting k-proxy-server..."
        log_command "node k-proxy-server.js &"
        node k-proxy-server.js > "$LOG_DIR/proxy-server-$TIMESTAMP.log" 2>&1 &
        local proxy_pid=$!
        echo $proxy_pid > "$LOG_DIR/proxy-server.pid"

        # Wait for proxy server to start
        sleep 5

        if nc -z localhost 3457 2>/dev/null; then
            print_success "Proxy server started successfully"
        else
            print_error "Failed to start proxy server"
            exit 1
        fi
    fi

    # Run health check
    if [[ -f "health-check.js" ]]; then
        print_info "Running system health check..."
        log_command "node health-check.js"

        if node health-check.js >> "$INTEGRATION_LOG" 2>&1; then
            print_success "System health check passed"
        else
            print_warning "System health check had warnings (continuing anyway)"
        fi
    fi

    print_success "System health check completed"
}

# =============================================================================
# Individual Test Runners
# =============================================================================

run_debate_flow_test() {
    print_header "COMPLETE DEBATE FLOW TEST"

    local start_time=$(date +%s)
    log_command "node test-complete-debate-flow.js"

    if node test-complete-debate-flow.js >> "$INTEGRATION_LOG" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Complete debate flow test passed (${duration}s)"
        return 0
    else
        print_error "Complete debate flow test failed"
        return 1
    fi
}

run_parallel_models_test() {
    print_header "PARALLEL MODELS EXECUTION TEST"

    local start_time=$(date +%s)
    log_command "node test-parallel-models.js"

    if node test-parallel-models.js >> "$INTEGRATION_LOG" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Parallel models test passed (${duration}s)"
        return 0
    else
        print_error "Parallel models test failed"
        return 1
    fi
}

run_error_recovery_test() {
    print_header "ERROR RECOVERY & RETRY TEST"

    local start_time=$(date +%s)
    log_command "node test-error-recovery.js"

    if node test-error-recovery.js >> "$INTEGRATION_LOG" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Error recovery test passed (${duration}s)"
        return 0
    else
        print_error "Error recovery test failed"
        return 1
    fi
}

run_security_integration_test() {
    print_header "SECURITY INTEGRATION TEST"

    local start_time=$(date +%s)
    log_command "node test-security-integration.js"

    if node test-security-integration.js >> "$INTEGRATION_LOG" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Security integration test passed (${duration}s)"
        return 0
    else
        print_error "Security integration test failed"
        return 1
    fi
}

run_performance_test() {
    print_header "PERFORMANCE TEST (100 requests, 10 concurrent)"

    local start_time=$(date +%s)
    log_command "node test-performance.js"

    if [[ "$QUICK_MODE" == "true" ]]; then
        print_warning "Skipping performance test in quick mode"
        return 0
    fi

    if node test-performance.js >> "$INTEGRATION_LOG" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "Performance test passed (${duration}s)"
        return 0
    else
        print_error "Performance test failed"
        return 1
    fi
}

# =============================================================================
# Test Execution
# =============================================================================

run_all_tests() {
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local test_start_time=$(date +%s)

    # Define test suite
    local tests=(
        "run_debate_flow_test|Complete Debate Flow"
        "run_parallel_models_test|Parallel Models Execution"
        "run_error_recovery_test|Error Recovery & Retry"
        "run_security_integration_test|Security Integration"
    )

    # Add performance test if not in quick mode
    if [[ "$QUICK_MODE" != "true" ]]; then
        tests+=("run_performance_test|Performance Testing")
    fi

    # Run specific test if requested
    if [[ -n "$SPECIFIC_TEST" ]]; then
        case "$SPECIFIC_TEST" in
            "debate-flow"|"debate"|"flow")
                tests=("run_debate_flow_test|Complete Debate Flow")
                ;;
            "parallel"|"models")
                tests=("run_parallel_models_test|Parallel Models Execution")
                ;;
            "error"|"recovery"|"retry")
                tests=("run_error_recovery_test|Error Recovery & Retry")
                ;;
            "security")
                tests=("run_security_integration_test|Security Integration")
                ;;
            "performance"|"perf")
                tests=("run_performance_test|Performance Testing")
                ;;
            *)
                print_error "Unknown test: $SPECIFIC_TEST"
                print_info "Available tests: debate-flow, parallel, error, security, performance"
                exit 1
                ;;
        esac
    fi

    # Execute tests
    for test_entry in "${tests[@]}"; do
        IFS='|' read -r test_func test_name <<< "$test_entry"

        total_tests=$((total_tests + 1))

        echo ""
        print_info "Running test $total_tests: $test_name"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting: $test_name" >> "$INTEGRATION_LOG"

        if $test_func; then
            passed_tests=$((passed_tests + 1))
            echo "$(date '+%Y-%m-%d %H:%M:%S') - PASSED: $test_name" >> "$INTEGRATION_LOG"
        else
            failed_tests=$((failed_tests + 1))
            echo "$(date '+%Y-%m-%d %H:%M:%S') - FAILED: $test_name" >> "$INTEGRATION_LOG"

            if [[ "$VERBOSE_MODE" == "true" ]]; then
                echo ""
                print_warning "Showing last 20 lines of log for failed test:"
                tail -20 "$INTEGRATION_LOG"
            fi
        fi
    done

    # Generate summary report
    local test_end_time=$(date +%s)
    local total_duration=$((test_end_time - test_start_time))

    print_header "INTEGRATION TEST SUMMARY"

    echo "Test Execution Summary:"
    echo "  📊 Total Tests: $total_tests"
    echo "  ✅ Passed: $passed_tests"
    echo "  ❌ Failed: $failed_tests"
    echo "  📈 Success Rate: $(( (passed_tests * 100) / total_tests ))%"
    echo "  ⏱️  Total Duration: ${total_duration}s"
    echo "  📁 Full Log: $INTEGRATION_LOG"

    # List individual test results
    echo ""
    echo "Individual Test Results:"
    grep -E "(PASSED|FAILED):" "$INTEGRATION_LOG" | while read -r line; do
        if [[ "$line" == *"PASSED"* ]]; then
            echo -e "  ${GREEN}✅ ${line#*- }${NC}"
        else
            echo -e "  ${RED}❌ ${line#*- }${NC}"
        fi
    done

    # Show test artifacts
    echo ""
    print_info "Test artifacts generated:"
    find "$LOG_DIR" -name "*test-*" -type f -newer "$LOG_DIR" 2>/dev/null | head -10 | while read -r file; do
        echo "  📄 $(basename "$file")"
    done

    # Exit with appropriate code
    if [[ $failed_tests -gt 0 ]]; then
        echo ""
        print_error "$failed_tests test(s) failed. See log for details: $INTEGRATION_LOG"
        return 1
    else
        echo ""
        print_success "All integration tests passed! 🎉"
        return 0
    fi
}

# =============================================================================
# Cleanup
# =============================================================================

cleanup() {
    print_info "Cleaning up test environment..."

    # Stop proxy server if we started it
    if [[ -f "$LOG_DIR/proxy-server.pid" ]]; then
        local proxy_pid=$(cat "$LOG_DIR/proxy-server.pid")
        if kill -0 "$proxy_pid" 2>/dev/null; then
            print_info "Stopping proxy server (PID: $proxy_pid)"
            kill "$proxy_pid"
        fi
        rm -f "$LOG_DIR/proxy-server.pid"
    fi

    # Compress logs if they're large
    if [[ -f "$INTEGRATION_LOG" ]] && [[ $(stat -f%z "$INTEGRATION_LOG" 2>/dev/null || stat -c%s "$INTEGRATION_LOG" 2>/dev/null) -gt 1048576 ]]; then
        print_info "Compressing large log file..."
        gzip "$INTEGRATION_LOG"
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

show_help() {
    echo "Integration Test Runner for Debate Consensus System"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --quick          Run only essential tests (faster execution)"
    echo "  --verbose        Enable verbose logging output"
    echo "  --test=name      Run only specific test"
    echo "                   Available: debate-flow, parallel, error, security, performance"
    echo "  --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run all tests"
    echo "  $0 --quick                   # Run essential tests only"
    echo "  $0 --test=security           # Run only security tests"
    echo "  $0 --verbose --test=parallel # Run parallel tests with verbose output"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --verbose)
            VERBOSE_MODE=true
            shift
            ;;
        --test=*)
            SPECIFIC_TEST="${1#*=}"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set up signal handlers for cleanup
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

# Main execution
main() {
    print_header "DEBATE CONSENSUS INTEGRATION TEST RUNNER"

    echo "Configuration:"
    echo "  📂 Working Directory: $SCRIPT_DIR"
    echo "  📋 Quick Mode: $QUICK_MODE"
    echo "  📝 Verbose Mode: $VERBOSE_MODE"
    echo "  🎯 Specific Test: ${SPECIFIC_TEST:-'All tests'}"
    echo "  📊 Log File: $INTEGRATION_LOG"
    echo ""

    # Initialize log file
    echo "Integration Test Run Started: $(date)" > "$INTEGRATION_LOG"
    echo "Configuration: Quick=$QUICK_MODE, Verbose=$VERBOSE_MODE, Test=$SPECIFIC_TEST" >> "$INTEGRATION_LOG"
    echo "" >> "$INTEGRATION_LOG"

    # Execute test pipeline
    check_prerequisites
    system_health_check

    if run_all_tests; then
        print_success "Integration test run completed successfully!"
        exit 0
    else
        print_error "Integration test run failed!"
        exit 1
    fi
}

# Run main function
main "$@"