# Quick Deploy ACP Service

## Overview

The Quick Deploy service is an ACP (Agent Commerce Protocol) seller agent that provides AI trading agent deployment services through the Virtuals Protocol ecosystem. Users interact with this service through Butler (the ACP frontend UI) to deploy trading agents on the Kosher Capital platform.

## Architecture

This service implements the ACP seller agent pattern:
- **Butler** = Frontend UI where users interact
- **ACP** = The protocol that handles agent commerce
- **Our Service** = A seller agent offering quick deployment services
- **Payment** = Handled by ACP's escrow system

## Key Components

### Core Services

- **`acpSellerAgent.ts`** - Main ACP seller agent implementation
- **`contractUtils.ts`** - Blockchain contract interactions
- **`kosherCapitalClient.ts`** - Kosher Capital API client
- **`notificationService.ts`** - Webhook notification service
- **`transactionTracker.ts`** - Transaction state management
- **`eventMonitor.ts`** - Blockchain event monitoring
- **`statusApi.ts`** - REST API for status queries

### Supporting Modules

- **`types.ts`** - TypeScript type definitions
- **`errors.ts`** - Custom error classes and handling
- **`retry.ts`** - Retry logic and resilience patterns
- **`constants.ts`** - Configuration values and constants

## How It Works

1. **User requests deployment through Butler UI**
2. **ACP creates a job and routes it to our seller agent**
3. **Our agent processes the job through phases:**
   - REQUEST: Validate and accept the job
   - NEGOTIATION: Agree on terms (50 USDC fixed price)
   - TRANSACTION: Execute deployment and deliver results
4. **Deployment involves:**
   - Creating personal fund contract
   - Processing payment
   - Enabling trading
   - Registering with Kosher Capital API
5. **Results delivered back through ACP to Butler**

## Configuration

### Environment Variables

```bash
# Required
SHEKEL_API_KEY=your-kosher-capital-api-key
WHITELISTED_WALLET_PRIVATE_KEY=your-private-key
WHITELISTED_WALLET_ENTITY_ID=your-entity-id
SELLER_AGENT_WALLET_ADDRESS=0x...

# Optional
ACP_RPC_URL=custom-rpc-url
SERVICE_PRICE=50
```

### Contract Addresses (Base Network)

- Factory: `0x0fE1eBa3e809CD0Fc34b6a3666754B7A042c169a`
- USDC: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
- Payment Recipient: `0x48597AfA1c4e7530CA8889bA9291494757FEABD2`

## Usage

### Initialize the ACP Agent

```typescript
import { QuickDeployACPAgent } from './quickDeploy';

const agent = new QuickDeployACPAgent();
await agent.initialize();

// Agent is now ready to receive jobs from ACP
```

### Direct API Usage (for testing)

```typescript
import { getKosherCapitalClient } from './quickDeploy';

const client = getKosherCapitalClient();
const result = await client.quickDeploy({
  agentName: 'ACP-Agent-123',
  contractCreationTxnHash: '0x...',
  creating_user_wallet_address: '0x...',
  paymentTxnHash: '0x...',
  deploySource: 'ACP',
});
```

## Testing

```bash
# Run unit tests
npm test -- src/services/quickDeploy/__tests__

# Test with ACP sandbox
# 1. Register your agent at https://app.virtuals.io/acp/join
# 2. Set up test agents (buyer and seller)
# 3. Run your seller agent
# 4. Initiate test jobs from buyer agent
```

## Error Handling

The service uses structured error handling with custom error classes:
- `ValidationError` - Input validation failures
- `ProcessingError` - Job processing issues
- `ServiceError` - External service failures
- `ContractError` - Blockchain operation failures
- `APIError` - API call failures

All errors are properly typed and include relevant context for debugging.

## Deployment Checklist

1. ✅ Set up environment variables
2. ✅ Register agent on ACP platform
3. ✅ Whitelist developer wallet
4. ✅ Fund wallet with ETH for gas
5. ✅ Test in sandbox environment
6. ✅ Graduate to production when ready

## Support

For issues or questions:
- Check the [troubleshooting guide](../../docs/troubleshooting.md)
- Review [ACP documentation](https://whitepaper.virtuals.io/info-hub/agent-commerce-protocol-acp-guide)
- Contact the Kosher Capital team
