# Quick Deploy ACP Integration

This is the Quick Deploy service implementation for Kosher Capital's AI Trading Agent deployment on the ACP (Agent Commerce Protocol) network.

## Overview

The Quick Deploy service allows users to deploy AI trading agents through the ACP network by:
1. Accepting payment (50 USDC)
2. Creating the necessary contracts
3. Deploying the trading agent
4. Returning deployment details to the user

## Architecture

```
Butler (User Request) → ACP Network → Quick Deploy Service
                                            ↓
                                    Payment Verification
                                            ↓
                                    Contract Creation
                                            ↓
                                    Agent Deployment
                                            ↓
                                    [Notification to Kosher Capital]
                                            ↓
                                    Response to User
```

## Key Components

### 1. QuickDeployService (`src/services/quickDeploy/quickDeployService.ts`)
- Main service that handles ACP job processing
- Validates payment transactions
- Coordinates with contract utilities
- Calls Kosher Capital's Quick Deploy API

### 2. QuickDeployContract (`src/services/quickDeploy/contractUtils.ts`)
- Handles blockchain interactions
- Generates gas wallets
- Deploys agent contracts
- Verifies payments

### 3. Quick Deploy Integration (`src/quickDeploy.ts`)
- Modified ACP integration specifically for quick deploy
- Filters jobs to only process quick deploy requests
- Manages job lifecycle and retries

### 4. NotificationService (`src/services/quickDeploy/notificationService.ts`)
- Sends deployment results back to Kosher Capital
- Handles webhook notifications with retry logic
- Supports multiple authentication methods

### 5. TransactionTracker (`src/services/quickDeploy/transactionTracker.ts`)
- Maintains persistent record of all deployments
- Tracks transaction status and history
- Provides reporting and statistics

### 6. Status API (`src/services/quickDeploy/statusApi.ts`)
- REST API for checking deployment status
- Endpoints for statistics and reporting
- Real-time deployment monitoring

## Setup

1. **Copy environment file:**
   ```bash
   cp .env.quickdeploy.example .env
   ```

2. **Configure environment variables:**
   - `GAME_API_KEY`: Your GAME API key from Virtuals Console
   - `WHITELISTED_WALLET_PRIVATE_KEY`: Your whitelisted wallet private key
   - `AGENT_WALLET_ADDRESS`: Your agent's wallet address
   - `API_KEY`: API key for Kosher Capital's API
   - `FACTORY_CONTRACT_ADDRESS`: Contract address for agent deployment
   - `KOSHER_CAPITAL_CALLBACK_URL`: URL for sending deployment notifications
   - `KOSHER_CAPITAL_CALLBACK_TOKEN`: Authentication token for callbacks
   - `STATUS_API_ENABLED`: Set to `true` to enable monitoring API

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

4. **Build the project:**
   ```bash
   pnpm build
   ```

## Running the Service

### Development Mode
```bash
# Run with TypeScript directly
pnpm tsx src/quickDeploy.ts

# Or with compiled JavaScript
pnpm build && node dist/quickDeploy.js
```

### Production Mode
```bash
NODE_ENV=production node dist/quickDeploy.js
```

## API Integration

The service integrates with Kosher Capital's API endpoint:
```
https://parallax-analytics.onrender.com/api/v1/secure/fundDetails/quick-deploy
```

### Request Format
```json
{
  "name": "ACP-1234567890",
  "paymentTxnHash": "0x...",
  "contractCreationTxnHash": "0x...",
  "creatingUserWallet": "0x..."
}
```

### Expected Response
The API should return deployment details including:
- Contract address
- Deployment transaction hash
- Agent configuration

## Job Processing Flow

1. **Job Reception**: ACP network sends a new job with payment details
2. **Validation**: Service validates it's a quick deploy request
3. **Payment Verification**: Verify 50 USDC payment on-chain
4. **Contract Creation**: Generate gas wallet and deploy contracts
5. **API Call**: Send deployment request to Kosher Capital's API
6. **Response Delivery**: Return deployment details through ACP

## Notification & Callbacks

The service sends deployment results back to Kosher Capital through HTTP callbacks:

### Notification Payload
```json
{
  "jobId": "acp-job-123",
  "status": "success",
  "agentName": "ACP-1234567890",
  "paymentTxHash": "0x...",
  "contractCreationTxHash": "0x...",
  "contractAddress": "0x...",
  "userWallet": "0x...",
  "timestamp": "2024-01-01T00:00:00Z",
  "deploymentSource": "ACP"
}
```

### Status API Endpoints

When `STATUS_API_ENABLED=true`, the following endpoints are available:

- `GET /health` - Health check
- `GET /api/deployments/:jobId` - Get deployment status by job ID
- `GET /api/deployments` - List all deployments (with pagination)
- `GET /api/statistics` - Get deployment statistics
- `GET /api/report` - Generate deployment report
- `POST /api/deployments/:jobId/retry` - Retry failed deployment

All API endpoints require authentication via `X-API-Key` header.

## Testing

### Mock Testing
Enable mock buyer for local testing without real transactions:
```bash
ENABLE_MOCK_BUYER=true pnpm tsx src/quickDeploy.ts
```

### Unit Tests
```bash
pnpm test
```

### Test Status API
```bash
curl http://localhost:3000/health
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/deployments
```

## Important Notes

1. **Factory Contract**: Don't use the new factory address (as mentioned in transcript)
2. **Gas Wallet**: Generated temporarily for each deployment, keys are not stored
3. **Payment**: Expects exactly 50 USDC per deployment
4. **Deployment Source**: All deployments are tagged with "ACP" for tracking

## Error Handling

The service handles various error scenarios:
- Invalid payment transactions
- Contract deployment failures
- API timeouts
- Network issues

Failed jobs are retried up to 3 times with exponential backoff.

### Transaction States
- `pending` - Initial state, waiting to be processed
- `processing` - Currently being processed
- `completed` - Successfully deployed
- `failed` - Deployment failed after all retries

## Transaction Logging

All deployments are logged to disk for audit and reconciliation:
- Location: `./logs/quick-deploy-transactions.json`
- Format: JSON array of transaction records
- Retention: Configurable via environment variables

## Security Considerations

- Never share the API endpoint or keys publicly
- Validate all payment transactions on-chain
- Don't store gas wallet private keys
- Use environment variables for sensitive data

## Support

For issues or questions:
1. Check logs in development mode (`LOG_LEVEL=debug`)
2. Verify environment configuration
3. Ensure wallet is whitelisted on Virtuals Protocol
4. Contact Kosher Capital team for API issues

## License

MIT
