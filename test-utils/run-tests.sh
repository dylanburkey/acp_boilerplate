#!/bin/bash

# Quick Deploy Test Runner
# This script sets up and runs a complete test of the Quick Deploy service

set -e

COLORS_RESET='\033[0m'
COLORS_GREEN='\033[0;32m'
COLORS_YELLOW='\033[0;33m'
COLORS_BLUE='\033[0;34m'
COLORS_RED='\033[0;31m'

echo -e "${COLORS_BLUE}🚀 Quick Deploy Test Runner${COLORS_RESET}"
echo "This will start all necessary services for testing"
echo ""

# Check if .env.test exists
if [ ! -f .env.test ]; then
    echo -e "${COLORS_YELLOW}Creating .env.test from template...${COLORS_RESET}"
    cp .env.quickdeploy.example .env.test
    echo "Please update .env.test with your test values if needed"
fi

# Copy test environment
echo -e "${COLORS_YELLOW}Setting up test environment...${COLORS_RESET}"
cp .env.test .env

# Create test directories
mkdir -p test-logs

# Function to cleanup on exit
cleanup() {
    echo -e "\n${COLORS_YELLOW}Cleaning up...${COLORS_RESET}"
    # Kill all background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    exit 0
}

trap cleanup EXIT INT TERM

# Start Mock Kosher Capital server
echo -e "\n${COLORS_GREEN}Starting Mock Kosher Capital server...${COLORS_RESET}"
pnpm tsx test-utils/mockKosherCapital.ts &
MOCK_KC_PID=$!

# Wait for Mock KC to start
sleep 3

# Start Quick Deploy service
echo -e "\n${COLORS_GREEN}Starting Quick Deploy service...${COLORS_RESET}"
ENABLE_MOCK_BUYER=true pnpm quickdeploy &
QUICKDEPLOY_PID=$!

# Wait for services to initialize
echo -e "\n${COLORS_YELLOW}Waiting for services to initialize...${COLORS_RESET}"
sleep 5

# Run tests
echo -e "\n${COLORS_GREEN}Running integration tests...${COLORS_RESET}"
pnpm tsx test-utils/testQuickDeploy.ts

echo -e "\n${COLORS_BLUE}Test Results:${COLORS_RESET}"
echo "1. Check Mock KC notifications: http://localhost:4000/test/notifications"
echo "2. Check Status API: http://localhost:3001/api/deployments"
echo "3. View logs in test-logs/quick-deploy-transactions.json"

echo -e "\n${COLORS_GREEN}Services are running. Press Ctrl+C to stop.${COLORS_RESET}"

# Keep services running
wait
