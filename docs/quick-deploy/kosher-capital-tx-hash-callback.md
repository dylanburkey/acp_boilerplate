# TX Hash Callback Integration Summary

## Overview
The Quick Deploy service now automatically captures and sends transaction hashes back to Kosher Capital without manual intervention. This enhancement streamlines the deployment process and eliminates delays.

## Key Components

### 1. Transaction Monitor (`transactionMonitor.ts`)
- Monitors blockchain events in real-time
- Captures TX hashes as transactions are mined
- Automatically triggers callbacks when transactions are confirmed

### 2. Pre-caching System
- Agent names are pre-generated with "ACP" prefix during job acceptance
- Deployment parameters are cached for faster execution
- Nonce and gas estimates are prepared in advance

### 3. Webhook Callbacks
- Automatic HTTP callbacks to Kosher Capital endpoints
- Configurable retry logic with exponential backoff
- Circuit breaker pattern for fault tolerance

## Configuration

### Required Environment Variables
```bash
# Kosher Capital webhook endpoint
KOSHER_CAPITAL_WEBHOOK_URL=https://api.koshercapital.com/webhooks/deployment

# Authentication
SHEKEL_API_KEY=your-api-key
WEBHOOK_SECRET=your-webhook-secret
```

### Optional Configuration
```bash
# Callback timing (milliseconds after confirmation)
WEBHOOK_CALLBACK_DELAY=2000

# Retry configuration
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_RETRY_DELAY_MS=1000

# Status updates endpoint
STATUS_WEBHOOK_URL=https://api.koshercapital.com/webhooks/status
```

## Webhook Payload Format

### Deployment Success Callback
```json
{
  "event": "deployment.success",
  "jobId": "job-123",
  "userWallet": "0x1234567890123456789012345678901234567890",
  "fundAddress": "0xabcdef1234567890123456789012345678901234",
  "transactions": {
    "creationTxHash": "0x...",
    "paymentTxHash": "0x...",
    "enableTradingTxHash": "0x..."
  },
  "agentName": "ACP-TradingBot-1234",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "metadata": {
    "deploySource": "ACP",
    "referralCode": "REF123"
  }
}
```

### Status Update Callback
```json
{
  "event": "deployment.status",
  "jobId": "job-123",
  "status": "processing",
  "phase": "payment_processing",
  "progress": 33,
  "message": "Processing USDC payment...",
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

## Integration Flow

```
1. User requests deployment via Butler UI
   ↓
2. ACP creates job and routes to Quick Deploy Agent
   ↓
3. Agent accepts job and pre-caches deployment data
   - Pre-generates agent name: "ACP-{name}-{timestamp}"
   - Caches wallet nonce and gas estimates
   ↓
4. Transaction Monitor starts watching blockchain
   - Filters for PersonalFundCreated events
   - Filters for USDC Transfer events
   ↓
5. Agent executes 3-transaction deployment
   - Create Personal Fund → TX hash captured automatically
   - Transfer USDC Payment → TX hash captured automatically
   - Enable Trading → TX hash captured automatically
   ↓
6. After confirmations, webhook callback sent
   - All TX hashes included in single callback
   - Retry logic ensures delivery
   ↓
7. Kosher Capital API receives complete deployment data
```

## Benefits

1. **Elimination of Manual Steps**: No need to manually copy/paste TX hashes
2. **Reduced Latency**: TX hashes sent immediately after confirmation
3. **Improved Reliability**: Automatic retry and circuit breaker patterns
4. **Better User Experience**: Faster end-to-end deployment time
5. **Enhanced Tracking**: Complete audit trail of all transactions

## Testing Webhooks

### Using webhook.site for testing:
```bash
# Set test webhook URL
export KOSHER_CAPITAL_WEBHOOK_URL=https://webhook.site/your-unique-url

# Run the service
npm run quickdeploy

# Monitor webhooks at webhook.site
```

### Using ngrok for local testing:
```bash
# Start local webhook receiver
npm run webhook:receiver

# In another terminal, expose local port
ngrok http 3002

# Set ngrok URL
export KOSHER_CAPITAL_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/webhook
```

## Error Handling

The system handles various failure scenarios:

1. **Webhook Delivery Failure**
   - Automatic retry with exponential backoff
   - Maximum 3 attempts by default
   - Failed webhooks logged for manual review

2. **Blockchain Event Missing**
   - Timeout after 60 seconds
   - Fallback to manual TX hash entry
   - Alert sent to monitoring system

3. **Circuit Breaker Activation**
   - After 5 consecutive failures
   - Prevents cascade failures
   - Auto-recovery after 60 seconds

## Monitoring

### Check webhook delivery status:
```bash
curl http://localhost:3001/api/webhooks/status
```

### View recent webhook attempts:
```bash
curl http://localhost:3001/api/webhooks/history?limit=10
```

### Monitor circuit breaker status:
```bash
curl http://localhost:3001/api/monitor/circuit-breaker
```

## Next Steps for Kosher Capital

1. **Implement Webhook Endpoint**
   - Accept POST requests at the configured URL
   - Validate webhook secret in headers
   - Process deployment data

2. **Handle Webhook Events**
   - Store TX hashes in database
   - Update agent deployment status
   - Trigger any downstream processes

3. **Respond to Webhooks**
   - Return 200 OK for successful processing
   - Return 4xx for client errors (won't retry)
   - Return 5xx for server errors (will retry)

4. **Optional: Implement Status Endpoint**
   - Receive real-time deployment progress
   - Update UI with current status
   - Handle any deployment issues

## Support

For integration support:
- Check webhook logs in the Quick Deploy service
- Verify webhook URL and authentication
- Test with webhook.site first
- Contact the Athena AI team for assistance

---

This enhancement significantly improves the deployment flow by automating the TX hash capture and callback process, resulting in faster and more reliable agent deployments.
