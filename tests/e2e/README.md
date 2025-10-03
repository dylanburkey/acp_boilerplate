# End-to-End (E2E) Testing Guide

This directory contains comprehensive end-to-end tests for the ACP Quick Deploy integration.

## Overview

E2E tests verify the complete integration flow from configuration to deployment, ensuring all components work together correctly.

## Test Suites

### 1. ACP Flow Tests (`acp-flow.e2e.test.ts`)

Tests the complete ACP job lifecycle:

- **Configuration Validation**: Verifies wallet, RPC, and API configuration
- **Wallet Connectivity**: Tests wallet connections and balances
- **Contract Connectivity**: Validates USDC and Factory contract connections
- **ACP Job Simulation**: Simulates REQUEST, NEGOTIATION, and TRANSACTION phases
- **Payment Monitoring**: Tests USDC contract interface and block queries
- **Integration Readiness**: Verifies all services are properly configured
- **Error Handling**: Tests error scenarios and graceful degradation

### 2. Quick Deploy Tests (`quick-deploy.e2e.test.ts`)

Tests the Kosher Capital Quick Deploy service:

- **API Connectivity**: Validates Kosher Capital API connection and authentication
- **Contract Deployment**: Tests deployment parameter validation
- **Payment Processing**: Verifies USDC payment calculations and transactions
- **Deployment Flow**: Simulates complete deployment from payment to API call
- **Transaction Tracking**: Tests transaction record creation and status updates
- **Deliverable Formatting**: Validates IDeliverable format for ACP
- **Error Scenarios**: Tests timeout, invalid data, and failure handling
- **Integration Health**: Verifies all service components are configured

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

### Run Specific Test Suite
```bash
# ACP Flow tests only
pnpm test:e2e -- acp-flow

# Quick Deploy tests only
pnpm test:e2e -- quick-deploy
```

## Environment Setup

E2E tests require the following environment variables in `.env`:

```bash
# Blockchain Configuration
RPC_URL=https://mainnet.base.org
CHAIN_ID=8453

# Wallet Configuration
WHITELISTED_WALLET_PRIVATE_KEY=0x...
SELLER_AGENT_WALLET_ADDRESS=0x...
WHITELISTED_WALLET_ENTITY_ID=entity-...

# API Configuration
SHEKEL_API_KEY=sk-...
KOSHER_CAPITAL_API_URL=https://app.kosher.capital/api

# Service Configuration
SERVICE_NAME="Quick Deploy ACP"
SERVICE_DESCRIPTION="Deploy AI agents via ACP"
SERVICE_PRICE=50
```

## Test Configuration

E2E tests are configured in `jest.config.js`:

- **Test Environment**: Node.js
- **Test Timeout**: 120 seconds (2 minutes)
- **Setup File**: `tests/e2e/setup.ts`
- **Test Pattern**: `**/*.e2e.test.ts`
- **Run Mode**: Sequential (`--runInBand`)

## Test Utilities

The `setup.ts` file provides global test utilities:

```typescript
global.testUtils = {
  sleep: (ms: number) => Promise<void>,
  mockAddresses: {
    buyer: string,
    agent: string,
    usdc: string,
  },
  mockTxHashes: {
    payment: string,
    creation: string,
  },
};
```

### Usage Example

```typescript
test('should wait for confirmation', async () => {
  await global.testUtils.sleep(1000); // Wait 1 second

  const mockPayment = {
    from: global.testUtils.mockAddresses.buyer,
    to: global.testUtils.mockAddresses.agent,
  };

  expect(mockPayment.from).toBeTruthy();
});
```

## Test Categories

### 1. Configuration Tests
- Validate environment variables
- Check wallet configuration
- Verify API keys and endpoints

### 2. Connectivity Tests
- Test RPC provider connection
- Validate contract interfaces
- Check API endpoint availability

### 3. Simulation Tests
- Simulate ACP job phases
- Mock payment transactions
- Test deployment flow

### 4. Integration Tests
- Verify component interactions
- Test error propagation
- Validate data flow

### 5. Error Tests
- Handle network failures
- Test invalid input
- Verify error messages

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use setup/teardown for cleanup
- Don't rely on test execution order

### 2. Mock External Services
- Use mock data for blockchain queries when possible
- Simulate API responses for testing
- Avoid real transactions in tests

### 3. Clear Assertions
- Test one concept per test
- Use descriptive test names
- Provide helpful error messages

### 4. Timeout Management
- Set appropriate timeouts for async operations
- Use `jest.setTimeout()` for long-running tests
- Fail fast on unrecoverable errors

## Debugging Tests

### View Detailed Output
```bash
pnpm test:e2e -- --verbose
```

### Run Single Test
```bash
pnpm test:e2e -- -t "should connect to Kosher Capital API"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --config jest.config.js --runInBand
```

## Common Issues

### 1. RPC Connection Errors
- **Issue**: Tests fail to connect to RPC endpoint
- **Solution**: Verify `RPC_URL` in `.env` is correct
- **Alternative**: Use local test RPC or fork

### 2. Timeout Errors
- **Issue**: Tests timeout waiting for async operations
- **Solution**: Increase `testTimeout` in `jest.config.js`
- **Alternative**: Mock slow operations

### 3. API Authentication Errors
- **Issue**: Kosher Capital API returns 401/403
- **Solution**: Check `SHEKEL_API_KEY` is valid
- **Alternative**: Use mock API responses

### 4. Missing Environment Variables
- **Issue**: Tests fail with "undefined" errors
- **Solution**: Copy `.env.example` to `.env`
- **Alternative**: Use `.env.test` for test-specific config

## Coverage Reports

After running tests with coverage:

```bash
pnpm test:e2e:coverage
```

View the coverage report at:
- Console: Shows summary in terminal
- HTML: `coverage/lcov-report/index.html`
- JSON: `coverage/coverage-final.json`

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:e2e
        env:
          RPC_URL: ${{ secrets.RPC_URL }}
          SHEKEL_API_KEY: ${{ secrets.SHEKEL_API_KEY }}
```

## Continuous Improvement

### Adding New Tests

1. Create test file: `*.e2e.test.ts`
2. Import test utilities: `import { describe, test, expect } from '@jest/globals'`
3. Use global utilities: `global.testUtils`
4. Follow naming convention: `describe('Feature Name', () => { ... })`

### Test Maintenance

- Update tests when features change
- Keep mock data current
- Review and update timeout values
- Monitor test execution time
- Remove obsolete tests

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ACP Protocol Docs](https://docs.virtuals.io/)
- [Kosher Capital API](https://app.kosher.capital/api/docs)
- [Ethers.js v6 Docs](https://docs.ethers.org/v6/)
