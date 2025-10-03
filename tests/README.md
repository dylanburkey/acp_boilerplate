# ACP Flow Simulation Tests

## Overview

This directory contains tests to simulate the ACP (Agent Commerce Protocol) job flow for the Quick Deploy service without requiring connection to the actual ACP network.

## Test Script: `simulate-acp-flow.ts`

### Purpose

Simulates the complete ACP job lifecycle:
1. **REQUEST** - Job creation and validation
2. **NEGOTIATION** - Terms agreement
3. **TRANSACTION** - Payment, deployment, and API call
4. **EVALUATION** - Deliverable delivery

### Quick Start

```bash
# Run the ACP flow simulation
pnpm test:acp-flow

# Run with verbose logging
pnpm test:acp-flow:verbose
```

### What It Tests

✅ **Job Lifecycle Handlers**
- REQUEST phase validation
- NEGOTIATION phase processing
- TRANSACTION phase execution
- Deliverable formatting

✅ **Payment Flow** (Mocked)
- Simulates payment transaction
- Captures mock payment TX hash
- Validates payment amount

✅ **Contract Deployment** (Mocked)
- Simulates contract creation
- Generates mock contract TX hash
- Tests ephemeral wallet flow

✅ **Kosher Capital API** (REAL)
- Makes actual API call
- Validates request format
- Tests authentication
- Verifies response handling

✅ **Deliverable Format**
- IDeliverable interface compliance
- JSON serialization
- Response structure

### Configuration

The test uses environment variables from your `.env` file:

**Required**:
- `API_ENDPOINT` - Kosher Capital Quick Deploy endpoint
- `API_KEY` - Kosher Capital API key

**Optional**:
- `TEST_BUYER_WALLET` - Buyer address (random if not set)
- `SERVICE_PRICE` - Payment amount (default: 50)
- `MOCK_PAYMENT` - Use mock payment (default: true)
- `SKIP_CONTRACT_DEPLOYMENT` - Skip real deployment (default: true)
- `ACP_RPC_URL` - RPC endpoint (default: Base mainnet)
- `AGENT_WALLET_ADDRESS` - Payment recipient

### Environment Variables for Testing

Create a test-specific configuration:

```bash
# Copy from example
cp .env.example .env

# Or use Quick Deploy example
cp .env.quickdeploy.example .env
```

**Recommended Test Configuration**:
```bash
# Use mock mode to avoid real blockchain transactions
MOCK_PAYMENT=true
SKIP_CONTRACT_DEPLOYMENT=true

# Your real API credentials (from Kosher Capital)
API_ENDPOINT=https://parallax-analytics.onrender.com/api/v1/secure/fundDetails/quick-deploy
API_KEY=your-actual-api-key

# Test wallet (can be random)
TEST_BUYER_WALLET=0x742d35Cc6634C0532925a3b844Bc9e7595f6E123
AGENT_WALLET_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f6E456

# Service config
SERVICE_PRICE=50
DEPLOYMENT_SOURCE=ACP
```

### Expected Output

```
═══════════════════════════════════════
  ACP QUICK DEPLOY FLOW SIMULATION
═══════════════════════════════════════

Configuration:
{
  buyerWallet: '0x...',
  agentName: 'ACP-Test-1696123456789',
  paymentAmount: '50 USDC',
  mockPayment: true,
  apiEndpoint: 'https://parallax-analytics.onrender.com/...'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1: REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Job Created: #12345
   Service Type: quick-deploy
   Agent Name: ACP-Test-1696123456789
   Buyer: 0x...

🔍 Validating service requirements...
✅ Service requirements validated
✅ Job accepted and moved to NEGOTIATION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2: NEGOTIATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Negotiating terms...
   Price: 50 USDC
   Delivery: AI Trading Agent Deployment
   Timeline: Immediate upon payment

✅ Terms agreed, moving to TRANSACTION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3: TRANSACTION (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 STEP 1: Payment Transaction
─────────────────────────────────────
⚠️  Using MOCK payment (no real blockchain transaction)
✅ Mock payment TX: 0x...
   Amount: 50 USDC
   From: 0x...
   To: 0x...

📝 STEP 2: Contract Deployment
─────────────────────────────────────
⚠️  Skipping real contract deployment (simulation mode)
✅ Mock contract creation TX: 0x...
   Factory contract called (simulated)
   Gas wallet created (ephemeral)

🚀 STEP 3: Kosher Capital API Call
─────────────────────────────────────
📡 Calling Kosher Capital Quick Deploy API...

Request Body:
{
  "agentName": "ACP-Test-1696123456789",
  "paymentTxnHash": "0x...",
  "contractCreationTxnHash": "0x...",
  "creating_user_wallet_address": "0x...",
  "deploySource": "ACP"
}

✅ API Response received:
{
  "success": true,
  "contractAddress": "0x...",
  ...
}

📦 STEP 4: Deliver Deliverable
─────────────────────────────────────
📦 Deliverable formatted (IDeliverable compliant):
{
  "type": "text/json",
  "value": "{...}"
}

✅ Deliverable would be sent to buyer via ACP
✅ Transaction marked as completed

═══════════════════════════════════════
  ✅ SIMULATION COMPLETED SUCCESSFULLY
═══════════════════════════════════════
```

### Testing Real API

The test **makes a real API call** to Kosher Capital's Quick Deploy endpoint. This means:

✅ **What's Real**:
- HTTP request to actual API
- Authentication with real API key
- Request/response validation
- Error handling

⚠️ **What's Mocked**:
- Payment transaction (no real USDC transfer)
- Contract deployment (no real blockchain TX)
- Buyer wallet (can be random address)

This allows you to:
1. Test API integration without blockchain costs
2. Verify request/response format
3. Test error handling
4. Validate authentication

### Troubleshooting

**Error: Missing required environment variables**
```bash
# Make sure .env file has API_ENDPOINT and API_KEY
cp .env.quickdeploy.example .env
# Edit .env and add your real API credentials
```

**Error: API call failed: 401 Unauthorized**
```bash
# Check your API_KEY in .env
# Verify it's the correct key from Kosher Capital
```

**Error: API call failed: 400 Bad Request**
```bash
# The API endpoint might have changed
# Verify API_ENDPOINT in .env
# Check the request body format matches API requirements
```

**Want to test with real blockchain transactions?**
```bash
# Set these in .env:
MOCK_PAYMENT=false
SKIP_CONTRACT_DEPLOYMENT=false

# Note: This requires:
# - Real USDC in buyer wallet
# - Gas fees in whitelisted wallet
# - Valid contract addresses
# - Proper network configuration
```

### Next Steps

After successful simulation:

1. ✅ Verify API integration works
2. 🔄 Test with real ACP network
3. 🔄 Deploy to testnet
4. 🔄 Coordinate with Butler team
5. 🔄 Production deployment

## Other Tests

- `test-utils/mockKosherCapital.ts` - Mock Kosher Capital server
- `test-utils/testQuickDeploy.ts` - Integration tests
- `test-utils/testButlerIntegration.ts` - Butler integration tests

## Running All Tests

```bash
# Run all integration tests
pnpm test:integration

# Run specific test
pnpm test:acp-flow
pnpm test:quickdeploy
pnpm test:mock-kc
```

---

**Note**: This simulation tests the code logic and API integration. Full end-to-end testing requires connection to the actual ACP network and real blockchain transactions.
