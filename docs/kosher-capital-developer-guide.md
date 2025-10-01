# Kosher Capital Integration - Developer Guide

## Architecture Overview

The Kosher Capital integration follows a modular architecture that makes it easy to extend and customize.

### Core Modules

```
src/services/quickDeploy/
├── constants.ts           # All configuration constants
├── contractUtils.ts       # Blockchain interaction logic
├── quickDeployService.ts  # Main service implementation
├── notificationService.ts # Webhook & callback handling
├── transactionTracker.ts  # Transaction state management
├── statusApi.ts          # REST API for monitoring
└── index.ts              # Service exports
```

## Module Responsibilities

### 1. **constants.ts** - Configuration Hub
All hardcoded values are centralized here for easy maintenance:

```typescript
export const CONTRACT_ADDRESSES = {
  FACTORY: '0x0fE1eBa3e809CD0Fc34b6a3666754B7A042c169a',
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  // ...
} as const;

export const API_CONFIG = {
  QUICK_DEPLOY_ENDPOINT: 'https://parallax-analytics.onrender.com/...',
  TIMEOUT_MS: 30000,
  // ...
} as const;
```

### 2. **contractUtils.ts** - Blockchain Logic
Handles all on-chain interactions:

```typescript
export class QuickDeployContract {
  // Deploy agent with 3 transactions
  async deployAgent(params: DeploymentParams): Promise<DeploymentResult> {
    // 1. Create Personal Fund
    const fundAddress = await this.createPersonalFund(params, signer);
    
    // 2. Make USDC Payment
    const paymentTxHash = await this.makePayment(params, signer);
    
    // 3. Enable Trading
    const enableTradingTxHash = await this.enableTrading(fundAddress, signer);
    
    return { fundAddress, creationTxHash, paymentTxHash, enableTradingTxHash };
  }
}
```

### 3. **quickDeployService.ts** - Business Logic
Implements the IAgentService interface for ACP:

```typescript
export class QuickDeployService implements IAgentService {
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    // 1. Validate request
    // 2. Execute deployment or verify payment
    // 3. Call Kosher Capital API
    // 4. Return response
  }
}
```

### 4. **notificationService.ts** - External Communication
Manages callbacks and webhooks:

```typescript
export class KosherCapitalNotificationService {
  // Send deployment result to KC
  async notifyDeploymentResult(notification: DeploymentNotification): Promise<boolean>
  
  // Send webhook events
  async sendWebhookEvent(event: string, data: any): Promise<void>
}
```

### 5. **transactionTracker.ts** - State Management
Tracks all deployments:

```typescript
export class TransactionTracker {
  createTransaction(jobId: string, ...): TransactionRecord
  updateTransaction(id: string, updates: Partial<TransactionRecord>): void
  getTransactionByJobId(jobId: string): TransactionRecord | undefined
}
```

### 6. **statusApi.ts** - Monitoring API
REST API for deployment monitoring:

```typescript
// Endpoints
GET  /health                    # Health check
GET  /api/deployments/:jobId    # Get specific deployment
GET  /api/deployments          # List all deployments
GET  /api/statistics           # Deployment statistics
POST /api/deployments/:jobId/retry  # Retry failed deployment
```

## Extending the Integration

### Adding New Features

#### 1. Custom Deployment Parameters
To add new deployment parameters:

```typescript
// 1. Update interfaces in quickDeployService.ts
interface QuickDeployParams {
  // ... existing params
  customFee?: number;  // New parameter
  referralCode?: string;
}

// 2. Handle in deployment logic
if (params.customFee) {
  paymentAmount = ethers.parseUnits(params.customFee.toString(), 6);
}

// 3. Pass to KC API
const apiRequest: QuickDeployApiRequest = {
  // ... existing fields
  referralCode: params.referralCode,
};
```

#### 2. Additional Contract Calls
To add new contract interactions:

```typescript
// In contractUtils.ts
private async customContractCall(params: any): Promise<string> {
  const contract = new ethers.Contract(
    CUSTOM_CONTRACT_ADDRESS,
    CUSTOM_ABI,
    signer
  );
  
  const tx = await contract.customMethod(params);
  const receipt = await tx.wait();
  
  return tx.hash;
}
```

#### 3. New API Endpoints
To add new status API endpoints:

```typescript
// In statusApi.ts
app.get('/api/deployments/analytics', (req, res) => {
  const analytics = this.transactionTracker.getAnalytics();
  res.json({ success: true, data: analytics });
});
```

### Custom Notification Handlers

To add custom notification logic:

```typescript
// Create custom notification handler
export class CustomNotificationHandler {
  async handleDeploymentSuccess(deployment: DeploymentResult): Promise<void> {
    // Send to custom endpoint
    await axios.post('https://your-api.com/webhook', {
      event: 'deployment.success',
      data: deployment
    });
    
    // Send email notification
    await this.sendEmailNotification(deployment);
    
    // Update external database
    await this.updateExternalDb(deployment);
  }
}

// Integrate in quickDeployService.ts
if (deploymentResult.success) {
  await customHandler.handleDeploymentSuccess(deploymentResult);
}
```

### Testing Extensions

#### 1. Unit Tests
```typescript
// tests/quickDeploy/contractUtils.test.ts
describe('QuickDeployContract', () => {
  it('should deploy agent successfully', async () => {
    const mockSigner = createMockSigner();
    const params: DeploymentParams = {
      userWallet: '0x123...',
      agentName: 'TestAgent'
    };
    
    const result = await contractUtils.deployAgent(params, mockSigner);
    
    expect(result.fundAddress).toBeDefined();
    expect(result.paymentTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
});
```

#### 2. Integration Tests
```typescript
// test-utils/integrationTest.ts
async function testFullDeploymentFlow() {
  // 1. Start mock services
  const mockKC = await startMockKosherCapital();
  
  // 2. Create test request
  const request: AgentRequest = {
    jobId: 'test-job-1',
    params: {
      userWallet: TEST_WALLET,
      agentName: 'IntegrationTest'
    }
  };
  
  // 3. Process request
  const response = await quickDeployService.processRequest(request);
  
  // 4. Verify results
  expect(response.success).toBe(true);
  expect(mockKC.receivedRequests).toHaveLength(1);
}
```

## Best Practices

### 1. Error Handling
Always use typed errors and provide context:

```typescript
try {
  const result = await deployAgent(params);
} catch (error) {
  logger.error(`${LOG_PREFIX.ERROR} Deployment failed:`, {
    jobId: request.jobId,
    userWallet: params.userWallet,
    error: error.message,
    stack: error.stack
  });
  
  throw new DeploymentError(
    'Failed to deploy agent',
    ERROR_TYPES.PROCESSING_ERROR,
    { originalError: error }
  );
}
```

### 2. Configuration Management
Use environment variables with validation:

```typescript
// config/validation.ts
export function validateConfig() {
  const required = [
    'SHEKEL_API_KEY',
    'GAME_API_KEY',
    'WHITELISTED_WALLET_PRIVATE_KEY'
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  
  // Validate format
  if (!process.env.WHITELISTED_WALLET_PRIVATE_KEY.startsWith('0x')) {
    throw new Error('Invalid private key format');
  }
}
```

### 3. Logging Standards
Use consistent logging with context:

```typescript
logger.info(`${LOG_PREFIX.PROCESSING} Starting deployment`, {
  jobId: request.jobId,
  agentName: params.agentName,
  userWallet: params.userWallet,
  timestamp: new Date().toISOString()
});
```

### 4. Type Safety
Always define interfaces for external APIs:

```typescript
// types/kosherCapital.ts
export interface KosherCapitalApiResponse {
  success: boolean;
  data?: {
    deploymentId: string;
    status: 'active' | 'pending';
    message?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
```

## Deployment Considerations

### 1. Environment Setup
```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_MOCK_BUYER=true

# Production
NODE_ENV=production
LOG_LEVEL=info
ENABLE_MOCK_BUYER=false
```

### 2. Monitoring
- Use Status API for real-time monitoring
- Set up alerts for failed deployments
- Monitor gas prices for optimization
- Track API response times

### 3. Security
- Rotate API keys regularly
- Use separate wallets for different environments
- Implement rate limiting
- Audit transaction logs regularly

## Troubleshooting Development Issues

### Common Development Problems

1. **TypeScript Compilation Errors**
```bash
# Clean and rebuild
pnpm clean
pnpm build
```

2. **Module Resolution Issues**
```bash
# Clear node_modules and reinstall
rm -rf node_modules
pnpm install
```

3. **Test Failures**
```bash
# Run specific test with debugging
LOG_LEVEL=debug pnpm test quickDeploy
```

### Debugging Tips

1. **Enable Verbose Logging**
```typescript
// In your code
logger.debug('Detailed state', { 
  fullRequest: JSON.stringify(request, null, 2),
  internalState: this.getInternalState()
});
```

2. **Use Transaction Tracker**
```typescript
// Check transaction state
const tx = transactionTracker.getTransactionByJobId(jobId);
console.log('Transaction state:', tx);
```

3. **Monitor Blockchain Events**
```typescript
// Listen for events
factory.on('PersonalFundCreated', (fundAddress, owner, isTokenFund) => {
  console.log('Fund created:', { fundAddress, owner, isTokenFund });
});
```

## Contributing

When contributing to the Kosher Capital integration:

1. **Follow the established patterns**
   - Use constants from `constants.ts`
   - Add proper TypeScript types
   - Include comprehensive error handling

2. **Write tests**
   - Unit tests for new functions
   - Integration tests for new flows
   - Update existing tests if behavior changes

3. **Document changes**
   - Update this guide for architectural changes
   - Add JSDoc comments for new functions
   - Update configuration examples

4. **Submit PR with**
   - Clear description of changes
   - Test results
   - Any new configuration requirements

---

For more details, see the [main integration documentation](./kosher-capital-integration.md).
