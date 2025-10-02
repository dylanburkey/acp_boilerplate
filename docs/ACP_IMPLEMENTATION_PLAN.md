# ACP Implementation Plan for Kosher Capital Quick Deploy

## Executive Summary

This document outlines the implementation plan for integrating Kosher Capital's Quick Deploy service with the Agent Commerce Protocol (ACP). The service will act as an **ACP Seller Agent** that enables users to request AI trading agent deployments through Butler or other ACP buyer agents.

## Understanding ACP

### Core Concepts

**Agent Commerce Protocol (ACP)** is a decentralized marketplace protocol that enables AI agents to:
- Discover and transact with other agents
- Use smart contract escrow for secure transactions
- Follow standardized interaction patterns

### Job Lifecycle (Key Phases)

```
REQUEST → NEGOTIATION → TRANSACTION → EVALUATION → COMPLETED
```

1. **REQUEST**: Buyer initiates job with service requirements
2. **NEGOTIATION**: Seller accepts/rejects the job
3. **TRANSACTION**: Payment is made, service is delivered
4. **EVALUATION**: Buyer evaluates the deliverable
5. **COMPLETED**: Job is finalized

### ACP Node SDK Key Methods

- `acpClient.init()` - Initialize the ACP client
- `respondJob(jobId, memoId, accept, reason)` - Accept or reject a job
- `deliverJob(jobId, deliverable)` - Deliver the completed service
- Callbacks:
  - `onNewTask(job)` - Handle new job requests
  - `onEvaluate(job)` - Handle evaluation phase

## Service Overview

### What We're Building

**Service**: Quick Deploy - AI Trading Agent Deployment
**Role**: ACP Seller Agent
**Price**: 50 USDC
**Buyer**: Butler (or other ACP agents)

### Core Flow

```
User → Butler → [ACP] → Quick Deploy Agent → Kosher Capital API → Deployed Agent
```

1. User asks Butler: "Create me a Shekel agent"
2. Butler discovers Quick Deploy service via ACP
3. Butler initiates job with Quick Deploy agent
4. Butler pays 50 USDC (ACP handles escrow)
5. Quick Deploy agent:
   - Captures payment TX hash
   - Generates contract creation TX
   - Calls Kosher Capital API
   - Returns deployment details
6. Butler receives agent contract address

## Critical Implementation Details

### 1. Payment Transaction Hash Challenge

**Problem**: Need to capture the payment TX hash from the ACP payment phase.

**Solution Options**:
1. **Monitor blockchain** - Listen for USDC transfer events to our wallet
2. **ACP event hooks** - Use ACP callbacks to capture payment details
3. **Wait for confirmation** - Only proceed after payment is confirmed on-chain

**Recommended Approach**:
```typescript
// In TRANSACTION phase handler
const paymentTxHash = await monitorPaymentTransaction(job);
```

### 2. Contract Creation Transaction

**After payment received**, we must:

1. Generate ephemeral wallet for gas:
```typescript
const gasWallet = ethers.Wallet.createRandom();
// Fund with minimal ETH for gas
// DO NOT store private keys
```

2. Call Kosher Capital's factory contract:
```typescript
// Use ORIGINAL factory address (not new one)
const factoryContract = new ethers.Contract(
  FACTORY_ADDRESS, // Provided by Kosher Capital
  FACTORY_ABI,
  gasWallet
);

const tx = await factoryContract.deployAgent(...params);
const contractCreationTxHash = tx.hash;
```

3. Wait for confirmation
4. Get deployed contract address from transaction receipt

### 3. Quick Deploy API Call

**Endpoint Structure**:
```typescript
interface QuickDeployRequest {
  agentName: string;                      // "ACP-{timestamp}" or custom
  paymentTxnHash: string;                 // From step 1
  contractCreationTxnHash: string;        // From step 2
  creating_user_wallet_address: string;   // Buyer's wallet
  deploySource: "ACP";                    // For tracking
  referralCode?: string;                  // Optional
}
```

### 4. Deliverable Format

**ACP requires specific deliverable format**:
```typescript
const deliverable = {
  type: 'text/json' as const,
  value: JSON.stringify({
    success: true,
    agentName: "ACP-123456789",
    contractAddress: "0x...",
    creationTxHash: "0x...",
    paymentTxHash: "0x...",
    timestamp: new Date().toISOString()
  })
};

await acpClient.deliverJob(job.id, deliverable);
```

## Implementation Steps

### Phase 1: ACP Integration Setup

- [x] Create ACP configuration
- [x] Set up job queue system (from Athena reference)
- [x] Implement job phase handlers
- [ ] Test ACP connection and registration

### Phase 2: Payment Monitoring

- [ ] Implement blockchain payment monitoring
- [ ] Create payment verification system
- [ ] Add payment TX hash capture logic
- [ ] Test with testnet USDC

### Phase 3: Contract Deployment

- [ ] Implement ephemeral wallet generation
- [ ] Add factory contract integration
- [ ] Create contract deployment logic
- [ ] Add transaction monitoring
- [ ] Test contract creation flow

### Phase 4: API Integration

- [ ] Connect to Kosher Capital Quick Deploy API
- [ ] Implement full request flow
- [ ] Add error handling and retries
- [ ] Create notification system

### Phase 5: ACP Job Flow

- [ ] Implement REQUEST phase handler (validation)
- [ ] Implement NEGOTIATION phase (auto-accept if valid)
- [ ] Implement TRANSACTION phase (deployment)
- [ ] Implement deliverable formatting
- [ ] Test end-to-end with Butler

### Phase 6: Testing & Deployment

- [ ] Unit tests for each component
- [ ] Integration tests with mock ACP
- [ ] Testnet testing with real Butler
- [ ] Mainnet deployment
- [ ] Monitoring and analytics

## Code Structure

```
src/
├── services/
│   └── quickDeploy/
│       ├── acpSellerAgent.ts       # Main ACP agent logic ✅
│       ├── contractUtils.ts         # Contract deployment ✅
│       ├── kosherCapitalClient.ts   # API client ✅
│       ├── paymentMonitor.ts        # Payment TX monitoring 🚧
│       ├── transactionTracker.ts    # Track job state ✅
│       └── types.ts                 # Type definitions ✅
├── utils/
│   ├── jobQueue.ts                  # Job processing queue ✅
│   └── acpStateManager.ts           # ACP state management 🚧
└── quickDeploy.ts                   # Entry point ✅
```

## Environment Variables Required

```bash
# ACP Configuration
GAME_API_KEY=                        # From Virtuals Protocol
WHITELISTED_WALLET_PRIVATE_KEY=      # Wallet for gas fees
WHITELISTED_WALLET_ENTITY_ID=        # Entity ID
AGENT_WALLET_ADDRESS=                # Payment recipient
SERVICE_NAME="Launch a trading agent"
SERVICE_DESCRIPTION="Quick deployment of an AI trading agent"

# Kosher Capital API
API_ENDPOINT=                        # Quick Deploy endpoint
API_KEY=                             # Private API key

# Contract Addresses
FACTORY_CONTRACT_ADDRESS=            # Original factory (not new one)
USDC_CONTRACT_ADDRESS=               # Base USDC address
PAYMENT_RECIPIENT_ADDRESS=           # Where to receive USDC

# Service Settings
SERVICE_PRICE=50                     # USDC
DEPLOYMENT_SOURCE=ACP                # For analytics
```

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Payment TX not captured | High | Implement robust blockchain monitoring |
| Contract deployment fails | High | Add retry logic with exponential backoff |
| ACP phase transition errors | Medium | Comprehensive error handling per phase |
| Butler can't find service | High | Proper service registration and metadata |
| Gas wallet funding | Medium | Automated gas wallet top-up system |

## Success Criteria

1. ✅ Service successfully registers on ACP network
2. ⏳ Butler can discover and initiate jobs
3. ⏳ Payment transactions are captured 100% of the time
4. ⏳ Contract deployments succeed >95% of the time
5. ⏳ Deliverables are properly formatted and accepted
6. ⏳ Full job lifecycle completes in <5 minutes

## Next Steps

1. **Immediate**: Fix remaining TypeScript errors
2. **Short-term**: Implement payment monitoring system
3. **Medium-term**: Complete contract deployment integration
4. **Long-term**: Deploy to testnet and coordinate with Butler team

## References

- [ACP Node SDK](https://github.com/Virtual-Protocol/acp-node)
- [ACP Whitepaper](https://whitepaper.virtuals.io/about-virtuals/agent-commerce-protocol)
- [Athena Implementation](../athena-ai-game-sdk-typescript/)
- Kosher Capital Quick Launch Documentation (private)

---

**Status**: 🚧 In Progress
**Last Updated**: 2025-10-01
**Author**: Dylan Burkey
