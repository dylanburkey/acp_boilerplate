# Testing the Kosher Capital ACP Implementation

## Overview

This guide provides comprehensive instructions for testing the Kosher Capital Quick Deploy service as an ACP seller agent. The service allows users to deploy AI trading agents through the Virtuals Protocol ACP ecosystem.

## Prerequisites

1. **Environment Setup**
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd acp_integration
   
   # Install dependencies
   pnpm install
   
   # Copy environment file
   cp .env.quickdeploy.example .env
   ```

2. **Required Environment Variables**
   ```bash
   # Core ACP Configuration
   WHITELISTED_WALLET_PRIVATE_KEY=your-private-key-without-0x
   WHITELISTED_WALLET_ENTITY_ID=your-entity-id
   SELLER_AGENT_WALLET_ADDRESS=0x...
   GAME_API_KEY=your-game-api-key
   
   # Kosher Capital API
   SHEKEL_API_KEY=your-kosher-capital-api-key
   
   # Network Configuration
   ACP_RPC_URL=https://base.llamarpc.com
   SERVICE_PRICE=50
   
   # Optional
   STATUS_API_ENABLED=true
   STATUS_API_PORT=3001
   LOG_LEVEL=info
   ```

3. **Wallet Requirements**
   - Whitelisted wallet must have ETH for gas fees
   - Seller agent wallet should be registered on ACP platform
   - Test buyer wallet needs 50+ USDC for deployments

## Testing Phases

### Phase 1: Unit Tests

Run the unit test suite to verify individual components:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/services/quickDeploy/__tests__/acpSellerAgent.test.ts

# Run with coverage
pnpm test --coverage
```

### Phase 2: Local Integration Testing

1. **Start the ACP Seller Agent**
   ```bash
   pnpm quickdeploy
   ```
   
   Expected output:
   ```
   🚀 Starting Quick Deploy ACP Seller Agent...
   ✅ Environment validation passed
   ✅ Kosher Capital API healthy
   ✅ ACP seller agent initialized successfully
   📋 Agent wallet: 0x...
   📋 Service offering: AI Trading Agent Quick Deployment
   📋 Price: 50 USDC per deployment
   ✅ Quick Deploy ACP Seller Agent is running
   🔄 Waiting for job requests from ACP network...
   ```

2. **Monitor Status API** (if enabled)
   ```bash
   # Check agent status
   curl http://localhost:3001/api/status
   
   # Check specific deployment
   curl http://localhost:3001/api/deployments/{transactionId}
   
   # Check job status
   curl http://localhost:3001/api/jobs/{jobId}
   ```

### Phase 3: ACP Sandbox Testing

1. **Register Your Agent**
   - Go to https://app.virtuals.io/acp/join
   - Register your seller agent with:
     - Service Name: "Quick Deploy - AI Trading Agent"
     - Description: "Deploy AI trading agents instantly"
     - Price: 50 USDC
     - Category: Trading/DeFi

2. **Create Test Buyer Agent**
   - Register a second agent as a buyer
   - Fund it with test USDC on Base network

3. **Test Job Flow**
   ```typescript
   // Example buyer agent code
   const acpClient = new AcpClient({...});
   
   // Search for our service
   const agents = await acpClient.browseAgents("quick deploy");
   const quickDeployAgent = agents.find(a => 
     a.walletAddress === process.env.SELLER_AGENT_WALLET_ADDRESS
   );
   
   // Initiate job
   const jobId = await acpClient.initiateJob(
     quickDeployAgent.walletAddress,
     {
       type: 'quick-deploy',
       agentName: 'Test-Agent-001',
       aiWallet: buyerWallet,
       metadata: {
         referralCode: 'TEST'
       }
     },
     Date.now() + 3600000, // 1 hour expiry
   );
   ```

### Phase 4: End-to-End Testing

1. **Monitor Job Phases**
   
   The job will progress through phases:
   - **REQUEST**: Agent validates and accepts the job
   - **NEGOTIATION**: Terms confirmed (50 USDC fixed)
   - **TRANSACTION**: Deployment executed, deliverable sent
   - **EVALUATION**: Buyer confirms receipt

2. **Verify Deployment**
   
   Check that all transactions completed:
   - Personal fund creation on factory contract
   - USDC payment to Kosher Capital
   - Trading enabled on fund contract
   - API registration successful

3. **Check Deliverable**
   ```json
   {
     "success": true,
     "agentName": "ACP-Test-Agent-001",
     "contractAddress": "0x...",
     "creationTxHash": "0x...",
     "paymentTxHash": "0x...",
     "apiResponse": {...},
     "timestamp": "2025-10-01T..."
   }
   ```

## Testing Scenarios

### Scenario 1: Happy Path
1. Buyer initiates job with valid parameters
2. Seller accepts job
3. Deployment completes successfully
4. Deliverable sent to buyer
5. Buyer evaluates positively

### Scenario 2: Insufficient Funds
1. Test with buyer having < 50 USDC
2. Verify proper error handling
3. Check job rejection with clear message

### Scenario 3: Network Issues
1. Simulate RPC failures
2. Verify retry mechanisms work
3. Check circuit breaker activation

### Scenario 4: API Failures
1. Use invalid API key
2. Verify graceful degradation
3. Check error reporting in deliverable

## Debugging Tools

### 1. Enhanced Logging
```bash
# Enable debug logging
LOG_LEVEL=debug pnpm quickdeploy

# Enable transaction monitoring
ENABLE_TX_MONITORING=true LOG_TX_DETAILS=true pnpm quickdeploy
```

### 2. Transaction Tracking
```typescript
// Check transaction status
const tx = transactionTracker.getTransactionByJobId(jobId);
console.log({
  status: tx.status,
  contractAddress: tx.contractAddress,
  hashes: {
    creation: tx.contractCreationTxHash,
    payment: tx.paymentTxHash
  }
});
```

### 3. Event Monitoring
The service monitors blockchain events:
- `PersonalFundCreated` - Contract deployment
- `Transfer` - USDC payments
- `TradingStatusChanged` - Trading enablement

## Common Issues and Solutions

### Issue 1: "Missing required environment variables"
**Solution**: Ensure all required variables are set in `.env`

### Issue 2: "Invalid private key format"
**Solution**: Remove '0x' prefix from private key

### Issue 3: "Insufficient USDC balance"
**Solution**: Fund wallet with 50+ USDC on Base network

### Issue 4: "Circuit breaker open"
**Solution**: Wait for reset timeout or manually reset:
```typescript
kosherCapitalClient.circuitBreaker.reset();
```

### Issue 5: Job stuck in phase
**Solution**: Check logs for specific error, may need to:
- Verify wallet has gas
- Check API connectivity
- Ensure contract addresses are correct

## Performance Testing

### Load Testing
```bash
# Run concurrent job simulations
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/test/simulate-job &
done
```

### Monitoring Metrics
- Job processing time
- Transaction confirmation times
- API response latencies
- Memory usage over time

## Production Readiness Checklist

- [ ] All environment variables configured
- [ ] Wallets funded with ETH and USDC
- [ ] Agent registered on ACP platform
- [ ] API keys validated
- [ ] Error handling tested
- [ ] Monitoring configured
- [ ] Backup RPC endpoints ready
- [ ] Circuit breakers tested
- [ ] Rate limits configured
- [ ] Logs properly structured

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Verify configuration matches requirements
3. Test individual components in isolation
4. Contact Kosher Capital support for API issues
5. Join Virtuals Protocol Discord for ACP help
