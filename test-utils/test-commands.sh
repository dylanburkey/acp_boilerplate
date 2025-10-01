#!/bin/bash

# Manual test commands for Quick Deploy service
# Run these after starting the test environment

echo "Quick Deploy Manual Test Commands"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

API_KEY=${API_KEY:-"test-api-key"}
STATUS_API_URL="http://localhost:3001"
MOCK_KC_URL="http://localhost:4000"

echo -e "${BLUE}1. Check Service Health${NC}"
echo "curl http://localhost:4000/health"
echo "curl http://localhost:3001/health"
echo ""

echo -e "${BLUE}2. View All Deployments${NC}"
echo "curl -H \"X-API-Key: $API_KEY\" $STATUS_API_URL/api/deployments"
echo ""

echo -e "${BLUE}3. Get Deployment Statistics${NC}"
echo "curl -H \"X-API-Key: $API_KEY\" $STATUS_API_URL/api/statistics"
echo ""

echo -e "${BLUE}4. Check Notifications Received by Kosher Capital${NC}"
echo "curl $MOCK_KC_URL/test/notifications | jq ."
echo ""

echo -e "${BLUE}5. Check Webhook Events${NC}"
echo "curl $MOCK_KC_URL/test/webhooks | jq ."
echo ""

echo -e "${BLUE}6. View Transaction Log${NC}"
echo "cat test-logs/quick-deploy-transactions.json | jq ."
echo ""

echo -e "${BLUE}7. Get Specific Deployment (replace JOB_ID)${NC}"
echo "curl -H \"X-API-Key: $API_KEY\" $STATUS_API_URL/api/deployments/JOB_ID"
echo ""

echo -e "${BLUE}8. Generate Deployment Report${NC}"
echo "curl -H \"X-API-Key: $API_KEY\" \"$STATUS_API_URL/api/report?startDate=2024-01-01&endDate=2024-12-31\""
echo ""

echo -e "${YELLOW}Run any of these commands to test different aspects of the service${NC}"

# Optional: Actually run a command if provided
if [ "$1" ]; then
    echo -e "\n${GREEN}Running: $@${NC}"
    eval "$@"
fi
