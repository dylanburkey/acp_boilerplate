# Quick Deploy Testing Guide

This guide walks you through testing the Quick Deploy service end-to-end, including deployment notifications to Kosher Capital.

## Prerequisites

- Node.js 20+
- pnpm installed
- All dependencies installed (`pnpm install`)

## Testing Setup

### 1. Prepare Test Environment

```bash
# Copy test environment configuration
cp .env.test .env

# Create test logs directory
mkdir -p test-logs
```

### 2. Start Mock Kosher Capital Server

This simulates Kosher Capital's API endpoints:

```bash
# In terminal 1
pnpm tsx test-utils/mockKosherCapital.ts
```

You should see:
```
[MOCK KC] Mock Kosher Capital server listening on port 4000
[MOCK KC] Quick Deploy API: http://localhost:4000/api/v1/secure/fundDetails/quick-deploy
[MOCK KC] Deployment Callbacks: http://localhost:4000/webhooks/acp/deployment
```

### 3. Start Quick Deploy Service

```bash
# In terminal 2
pnpm quickdeploy

# Or with more verbose logging
LOG_LEVEL=debug pnpm quickdeploy
```

You should see:
```
🚀 Initializing Quick Deploy ACP Integration...
✅ Quick Deploy ACP Integration initialized successfully
Status API listening on port 3001
🔄 Starting Quick Deploy main loop...
```

### 4. Run Test Script

```bash
# In terminal 3
pnpm tsx test-utils/testQuickDeploy.ts
```

## Testing Scenarios

### Scenario 1: Automatic Testing with Mock Buyer

With `ENABLE_MOCK_BUYER=true` in your `.env`, the service automatically creates test jobs every 30 seconds.

Watch the logs to see:
1. Mock job creation
2. Payment verification (simulated)
3. Contract deployment (simulated)
4. API call to Mock KC server
5. Notification sent back
6. Transaction recorded

### Scenario 2: Manual Job Testing

Create a specific test job:

```bash
pnpm tsx test-utils/testQuickDeploy.ts --manual
```

This generates test job data you can use to manually trigger the service.

### Scenario 3: Test with Real ACP Network

**⚠️ Warning: This uses real blockchain transactions!**

1. Update `.env` with real values:
   ```
   GAME_API_KEY=your-real-game-api-key
   WHITELISTED_WALLET_PRIVATE_KEY=your-real-private-key
   ENVIRONMENT=sandbox
   ```

2. Ensure you have:
   - Registered wallet on Virtuals Protocol
   - Test USDC tokens
   - Access to ACP sandbox

3. Create a real job through Butler or ACP interface

## Monitoring & Verification

### 1. Check Status API

```bash
# Health check
curl http://localhost:3001/health

# List all deployments
curl -H "X-API-Key: test-api-key" http://localhost:3001/api/deployments

# Get specific deployment
curl -H "X-API-Key: test-api-key" http://localhost:3001/api/deployments/{jobId}

# Get statistics
curl -H "X-API-Key: test-api-key" http://localhost:3001/api/statistics
```

### 2. Check Mock KC Notifications

```bash
# View received notifications
curl http://localhost:4000/test/notifications

# View webhook events
curl http://localhost:4000/test/webhooks

# Check Mock KC health
curl http://localhost:4000/health
```

### 3. Check Transaction Logs

```bash
# View transaction log file
cat test-logs/quick-deploy-transactions.json | jq .
```

## Expected Flow

1. **Job Creation**
   - Job appears in Quick Deploy service logs
   - Status: `pending`

2. **Processing**
   - Payment verification (mock always returns true)
   - Contract deployment simulation
   - Status: `processing`

3. **API Call**
   - Mock KC receives quick-deploy API call
   - Returns mock contract address

4. **Completion**
   - Status: `completed`
   - Contract address saved

5. **Notification**
   - Callback sent to Mock KC webhook endpoint
   - Includes all deployment details
   - Webhook event sent

6. **Verification**
   - Check Status API shows completed deployment
   - Mock KC shows received notification
   - Transaction log updated

## Troubleshooting

### Service Won't Start
- Check if ports 3001 and 4000 are available
- Verify `.env` file exists and is configured
- Check logs for missing dependencies

### No Jobs Processing
- Verify `ENABLE_MOCK_BUYER=true` in `.env`
- Check if service is receiving jobs in logs
- Ensure Mock KC server is running

### Notifications Not Sent
- Check `KOSHER_CAPITAL_CALLBACK_URL` in `.env`
- Verify Mock KC server is running on port 4000
- Check logs for notification errors

### Payment Verification Fails
- In test mode, payment verification is mocked
- For real testing, ensure valid transaction hash
- Check if USDC contract address is correct

## Integration Testing Checklist

- [ ] Mock KC server starts successfully
- [ ] Quick Deploy service initializes
- [ ] Status API is accessible
- [ ] Mock buyer creates test jobs
- [ ] Jobs are processed successfully
- [ ] Deployments complete with contract address
- [ ] Notifications sent to Mock KC
- [ ] Webhook events received
- [ ] Transaction logs created
- [ ] Status API shows correct data
- [ ] Can retry failed deployments

## Production Testing

Before going to production:

1. Test with real ACP sandbox environment
2. Verify real payment transactions
3. Test with actual Kosher Capital endpoints
4. Ensure proper error handling
5. Verify retry mechanisms work
6. Test with network interruptions
7. Validate all authentication methods

## Clean Up

After testing:

```bash
# Stop all services (Ctrl+C in each terminal)

# Clear test logs
rm -rf test-logs

# Reset environment
cp .env.quickdeploy.example .env
```
