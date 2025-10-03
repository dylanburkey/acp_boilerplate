# End-to-End (E2E) Testing Guide

This directory contains E2E tests for the **Direct ACP Client integration** with Kosher Capital Quick Deploy.

## Overview

E2E tests verify the direct ACP integration, ensuring:
- ACP Client initialization and configuration
- Job queue functionality
- Quick Deploy service integration
- ACP job lifecycle handling
- Blockchain connectivity (Base network)

## Test Approach

**Current Status:** The E2E test suite was removed during the GameAgent migration. Tests need to be recreated for the direct ACP Client pattern.

### What Needs Testing

✅ **Core Components:**
- ACP Client initialization with direct callbacks
- Job queue management (enqueue, priority, processing)
- Quick Deploy service (payment verification, contract deployment)
- ACP job lifecycle (REQUEST → TRANSACTION → EVALUATION)
- Blockchain connectivity
- Configuration validation

⚠️ **NOT Covered (Requires Live System):**
- Actual job processing with real buyers
- Real USDC payment monitoring
- Contract deployment to production
- Kosher Capital API integration (requires real API)

## Running Tests

### Run All E2E Tests

```bash
pnpm test:e2e
```

### Run with Watch Mode

```bash
pnpm test:e2e:watch
```

### Run with Coverage

```bash
pnpm test:e2e:coverage
```

### Simulate Full ACP Flow (Test Script)

```bash
pnpm test:acp-flow
```

This runs the simulation script in `tests/simulate-acp-flow.ts`.

## Environment Setup

E2E tests require the following environment variables in `.env`:

```bash
# Blockchain Configuration (Base Network)
ACP_RPC_URL=https://mainnet.base.org
ACP_CHAIN_ID=8453
ACP_CONTRACT_ADDRESS=0xC6e864B52203da6593C83fD18E4c1212D088F61F

# Wallet Configuration
WHITELISTED_WALLET_PRIVATE_KEY=0x...
WHITELISTED_WALLET_ENTITY_ID=1
SELLER_AGENT_WALLET_ADDRESS=0x...

# Kosher Capital API Configuration
SHEKEL_API_KEY=sk-...
KOSHER_CAPITAL_API_URL=https://app.kosher.capital/api

# Service Configuration
SERVICE_NAME="Kosher Capital - AI Agent Quick Deploy"
SERVICE_DESCRIPTION="Professional AI trading agent deployment"
SERVICE_PRICE=50

# Contract Addresses (Base Network)
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
FACTORY_CONTRACT_ADDRESS=your_factory_contract_address
```

**Note:** No `GAME_API_KEY` needed - this codebase uses direct ACP Client only.

## Test Architecture

### Direct ACP Client Pattern Testing

```
Test Flow:
1. Initialize AcpContractClient with whitelisted wallet
2. Create AcpClient with onNewTask/onEvaluate callbacks
3. Initialize job queue for sequential processing
4. Test job enqueueing and priority ordering
5. Verify ACP state management
6. Test Quick Deploy service functions
```

## Debugging Tests

### Enable Verbose Logging

```bash
LOG_LEVEL=debug pnpm test:acp-flow
```

### Run Simulation Script

```bash
# Full verbose output
pnpm test:acp-flow:verbose

# With specific environment
SKIP_API_CALL=true pnpm test:acp-flow
```

## Troubleshooting

### Common Issues

**1. "ACP client initialization failed"**
- Verify wallet private key is valid (64 hex characters)
- Check WHITELISTED_WALLET_ENTITY_ID is correct
- Ensure wallet is registered with Virtuals

**2. "Cannot connect to Base network"**
- Check RPC_URL is accessible
- Verify network connectivity
- Try alternative RPC: `https://base.llamarpc.com`

**3. "Configuration validation failed"**
- Ensure all required environment variables are set
- Check `.env` file exists and is properly formatted
- Verify contract addresses are valid

## Adding New Tests

### Template for Direct ACP Client Tests

```typescript
import { describe, test, expect, beforeAll } from '@jest/globals';
import AcpClient, { AcpContractClient, AcpJob } from '@virtuals-protocol/acp-node';
import { config } from '../../src/config';

describe('Direct ACP Client E2E Tests', () => {
  let acpClient: AcpClient;

  beforeAll(async () => {
    const acpContractClient = await AcpContractClient.build(
      config.whitelistedWalletPrivateKey as `0x${string}`,
      config.whitelistedWalletEntityId,
      config.sellerAgentWalletAddress as `0x${string}`,
      config.acpRpcUrl ? { rpcUrl: config.acpRpcUrl } as any : undefined
    );

    acpClient = new AcpClient({
      acpContractClient,
      onNewTask: (job: AcpJob) => {
        // Test job handling
      },
      onEvaluate: (job: AcpJob) => {
        // Test evaluation
      }
    });
  });

  test('should process job lifecycle', async () => {
    // Test implementation
  });
});
```

### Best Practices

1. **Use meaningful test names** - Describe what you're testing
2. **Test the direct ACP Client pattern** - No GameAgent SDK
3. **Mock external dependencies** - Kosher Capital API, blockchain calls
4. **Test job queue behavior** - Priority, retries, sequential processing
5. **Handle timeouts appropriately** - ACP operations can take time

## Architecture Differences

### Direct ACP Client (Current) vs GameAgent (Not Used)

| Aspect | Direct ACP (This Codebase) | GameAgent (Athena) |
|--------|---------------------------|-------------------|
| Test Focus | AcpClient callbacks, job queue | GameAgent, AcpPlugin, functions |
| Dependencies | `@virtuals-protocol/acp-node` only | + GameAgent SDK packages |
| Complexity | Lower | Higher |
| Test Speed | Faster (no LLM calls) | Slower (AI processing) |

**This codebase uses Direct ACP Client** - tests should reflect this architecture.

## Support

For test issues:
1. Check test output for specific errors
2. Review [docs/acp/ACP_ARCHITECTURE_COMPARISON.md](../../docs/acp/ACP_ARCHITECTURE_COMPARISON.md)
3. Verify environment configuration
4. Check Virtuals ACP documentation

---

**Test Status:** Tests need to be recreated for direct ACP Client pattern
**Architecture:** Direct ACP Client (NOT GameAgent)
**Next Steps:** Create comprehensive E2E tests for direct ACP integration
