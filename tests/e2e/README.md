# End-to-End (E2E) Testing Guide

This directory contains comprehensive end-to-end tests for the **GameAgent + ACP Plugin integration** with Kosher Capital Quick Deploy.

## Overview

E2E tests verify the complete GameAgent integration with the ACP network, ensuring:
- GameAgent initialization and configuration
- ACP Plugin integration
- Quick Deploy function registration
- ACP job lifecycle handling
- Blockchain connectivity (Base network)

## Test Suites

### 1. GameAgent ACP Integration Tests (`gameagent-acp.e2e.test.ts`) ✅ CURRENT

Tests the **NEW** GameAgent + ACP Plugin implementation:

- **ACP Client Initialization**: Verifies AcpClient and AcpPlugin setup
- **GameAgent Creation**: Tests GameAgent initialization with ACP worker
- **Quick Deploy Function**: Validates function registration and structure
- **ACP Job Retrieval**: Tests getActiveJobs() and getCompletedJobs()
- **ACP State Management**: Verifies state filtering and reduction
- **Blockchain Connectivity**: Tests connection to Base network
- **Configuration Validation**: Ensures all required env vars are set
- **Job Phase Handling**: Verifies REQUEST/NEGOTIATION/TRANSACTION/EVALUATION phases

**This is the PRIMARY test suite** for the GameAgent architecture.

### 2. Legacy Tests ❌ REMOVED

The old E2E tests from the **direct ACP Client implementation** have been removed:

- ~~`legacy-acp-flow.e2e.test.ts`~~ - Old ACP flow without GameAgent (removed)
- ~~`legacy-quick-deploy.e2e.test.ts`~~ - Old Quick Deploy service tests (removed)

These tests referenced the old architecture (`src/index.ts`, `src/quickDeploy.ts`) which is no longer used.

## Running Tests

### Run All E2E Tests (GameAgent Only)

```bash
pnpm test:e2e
```

This runs **only** the GameAgent tests (`gameagent-acp.e2e.test.ts`).

### Run with Watch Mode

```bash
pnpm test:e2e:watch
```

### Run with Coverage

```bash
pnpm test:e2e:coverage
```

### Run Specific Test Suite

```bash
# GameAgent ACP tests
pnpm test:e2e -- gameagent-acp

# Run only specific describe block
pnpm test:e2e -- -t "ACP Client Initialization"
```

## Environment Setup

E2E tests require the following environment variables in `.env`:

```bash
# GameAgent Configuration
GAME_API_KEY=your_game_api_key_from_virtuals_console

# Blockchain Configuration (Base Network)
ACP_RPC_URL=https://mainnet.base.org
ACP_CHAIN_ID=8453

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

**OR** use a test-specific environment file:

```bash
cp .env.test.example .env.test
# Edit .env.test with test values
```

The test setup will automatically load `.env.test` if it exists.

## Test Architecture

### GameAgent Pattern Testing

```
Test Flow:
1. Initialize AcpContractClient with whitelisted wallet
2. Create AcpClient with onNewTask/onEvaluate callbacks
3. Initialize AcpPlugin with AcpClient
4. Create GameAgent with ACP worker and functions
5. Register quickDeployAgent function
6. Test ACP state retrieval and filtering
7. Verify job handling capabilities
```

### What Tests Cover

✅ **Covered:**
- GameAgent initialization
- ACP Plugin setup
- Function registration (quickDeployAgent)
- ACP state access
- Job retrieval (active/completed)
- Blockchain connectivity
- Configuration validation
- Job phase constants

⚠️ **NOT Covered (Requires Live Jobs):**
- Actual job processing with real buyers
- AI decision making (accept/reject)
- Payment monitoring with real USDC transfers
- Contract deployment execution
- Kosher Capital API integration (requires real API)

### Mock vs Integration Tests

**Current Tests:** Integration tests that verify setup and connectivity
**Future Tests:** Add mocked job scenarios for full lifecycle testing

## Test Results

### Expected Output

```
GameAgent ACP Integration E2E Tests
  ✓ should initialize ACP client successfully
  ✓ should initialize ACP plugin successfully
  ✓ should get ACP state
  ✓ should create GameAgent with ACP Plugin
  ✓ should initialize GameAgent
  ✓ should register Quick Deploy function
  ✓ should have correct function arguments
  ✓ should have executable handler
  ✓ should get active jobs
  ✓ should get completed jobs
  ✓ should get reduced state
  ✓ should access jobs in state
  ✓ should connect to Base network
  ✓ should have valid whitelisted wallet
  ✓ should have valid seller agent wallet
  ✓ should have valid GameAgent API key
  ✓ should have valid service configuration
  ✓ should have valid Kosher Capital API configuration
  ✓ should understand REQUEST phase
  ✓ should understand NEGOTIATION phase
  ✓ should understand TRANSACTION phase
  ✓ should understand EVALUATION phase

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/e2e'],
  testMatch: ['**/*.e2e.test.ts'],  // Only .test.ts files
  testTimeout: 120000,
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.ts'],
};
```

Only files matching `**/*.e2e.test.ts` are run.

### Global Test Utilities

Available via `global.testUtils` in all tests:

```typescript
global.testUtils.sleep(ms)           // Sleep utility
global.testUtils.mockAddresses       // Mock blockchain addresses
global.testUtils.mockTxHashes        // Mock transaction hashes
```

## Debugging Tests

### Enable Verbose Logging

```bash
LOG_LEVEL=debug pnpm test:e2e
```

### Run Single Test

```bash
pnpm test:e2e -- -t "should initialize GameAgent"
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --config jest.config.js --runInBand
```

Then connect Chrome DevTools to debug.

## Troubleshooting

### Common Issues

**1. "GAME_API_KEY not defined"**
- Ensure `.env` has `GAME_API_KEY` set
- Get API key from Virtuals Console: https://console.virtuals.io

**2. "ACP client initialization failed"**
- Verify wallet private key is valid (64 hex characters)
- Check WHITELISTED_WALLET_ENTITY_ID is correct
- Ensure wallet is registered with Virtuals

**3. "Cannot connect to Base network"**
- Check RPC_URL is accessible
- Verify network connectivity
- Try alternative RPC: `https://base.llamarpc.com`

**4. "GameAgent initialization timeout"**
- Increase test timeout in jest.config.js
- Check GAME_API_KEY is valid
- Verify network connectivity

### Test Environment vs Production

**Test Environment:**
- Uses `.env.test` if available
- May skip API calls that require real services
- Mock data for certain scenarios
- Shorter timeouts

**Production:**
- Uses `.env`
- Real API calls
- Real blockchain transactions
- Full timeouts

## Adding New Tests

### Template for New Test Suite

```typescript
import { describe, test, expect, beforeAll } from '@jest/globals';
import { GameAgent } from '@virtuals-protocol/game';
import AcpPlugin from '@virtuals-protocol/game-acp-plugin';

describe('New Feature E2E Tests', () => {
  let acpPlugin: AcpPlugin;
  let agent: GameAgent;

  beforeAll(async () => {
    // Setup
  });

  test('should test new feature', async () => {
    // Test implementation
  });
});
```

### Best Practices

1. **Use meaningful test names** - Describe what you're testing
2. **Group related tests** - Use describe blocks
3. **Clean up resources** - Use afterAll for cleanup
4. **Handle timeouts** - Set appropriate timeouts for async operations
5. **Test both success and failure** - Cover edge cases
6. **Document assumptions** - Comment non-obvious test logic

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - name: Run E2E Tests
        env:
          GAME_API_KEY: ${{ secrets.GAME_API_KEY }}
          WHITELISTED_WALLET_PRIVATE_KEY: ${{ secrets.WALLET_PRIVATE_KEY }}
          # ... other secrets
        run: pnpm test:e2e
```

## Migration from Legacy Architecture

The old E2E tests have been removed. If you need to reference the old architecture:

1. Check `src/index.ts` - Old direct ACP Client implementation (legacy, not used)
2. Check `src/quickDeploy.ts` - Old QuickDeployACPAgent (legacy, not used)

The old tests tested the direct ACP Client pattern without GameAgent, which is no longer the production architecture.

## Support

For test issues:
1. Check test output for specific errors
2. Review [docs/acp/GAMEAGENT_MIGRATION_COMPLETE.md](../../docs/acp/GAMEAGENT_MIGRATION_COMPLETE.md)
3. Verify environment configuration
4. Check GameAgent SDK documentation

---

**Current Test Coverage:** GameAgent + ACP Plugin integration
**Architecture:** Standard Virtuals Protocol pattern
**Status:** ✅ Production Ready
