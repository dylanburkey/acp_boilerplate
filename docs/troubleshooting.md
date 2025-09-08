# Troubleshooting Guide

This guide helps you diagnose and fix common issues with your ACP agent.

## Common Issues

### Startup Errors

#### "Missing required environment variables"

**Problem**: The agent won't start and shows missing environment variables.

**Solution**:
1. Check that `.env` file exists: `ls -la .env`
2. Ensure all required variables are set:
   ```bash
   cat .env | grep -E "GAME_API_KEY|WHITELISTED_WALLET|AGENT_WALLET|SERVICE_NAME|SERVICE_DESCRIPTION|API_ENDPOINT"
   ```
3. No quotes needed around values unless they contain spaces
4. Run setup script: `pnpm run setup`

#### "Invalid private key"

**Problem**: Error about private key format.

**Solution**:
- Ensure private key starts with `0x`
- Should be exactly 66 characters (including 0x)
- Example format: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`
- Never share or commit private keys!

#### "Cannot connect to RPC endpoint"

**Problem**: Connection to Base chain fails.

**Solution**:
1. Try alternative RPC URLs:
   ```env
   ACP_RPC_URL=https://mainnet.base.org
   # or
   ACP_RPC_URL=https://base.gateway.tenderly.co
   ```
2. Check internet connection
3. Verify RPC URL is accessible: `curl https://base.llamarpc.com`

### Transaction Errors

#### "replacement transaction underpriced"

**Problem**: Transaction fails with nonce or gas price issues.

**Solution**:
1. Increase processing delay to avoid nonce conflicts:
   ```env
   ACP_PROCESSING_DELAY=5000  # 5 seconds
   ```
2. Increase gas price multiplier:
   ```env
   GAS_PRICE_MULTIPLIER=1.5
   ```
3. Clear pending transactions in wallet

#### "AA23 reverted" or transaction errors

**Problem**: Transaction fails on-chain.

**Solution**:
1. Verify wallet is properly whitelisted on Virtuals Console
2. Check that your GAME API key is valid and active
3. Ensure you're using the correct network configuration
4. **Note**: You don't need ETH - Virtuals handles gas fees automatically!

#### "Transaction timeout"

**Problem**: Transactions take too long to confirm.

**Solution**:
1. Increase timeout:
   ```env
   TX_CONFIRMATION_TIMEOUT=120000  # 2 minutes
   ```
2. Check Base network status at [status.base.org](https://status.base.org)
3. Increase gas price during congestion:
   ```env
   MAX_GAS_PRICE=200
   ```

### Job Processing Issues

#### Jobs not being picked up

**Problem**: Agent is running but not processing jobs.

**Debugging Steps**:
1. Enable debug logging:
   ```env
   LOG_LEVEL=debug
   ```
2. Check ACP state is being received:
   - Look for "📥 New job added to queue" in logs
3. Verify wallet is whitelisted on Virtuals Console
4. Check job queue status in logs

#### Jobs failing repeatedly

**Problem**: Jobs are retried but keep failing.

**Solution**:
1. Check your service logic for errors
2. Enable API output logging:
   ```env
   LOG_API_OUTPUT=true
   ```
3. Test your API endpoint directly:
   ```bash
   curl -X POST https://your-api.com/endpoint \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```
4. Reduce retry attempts to fail faster:
   ```env
   ACP_MAX_RETRIES=1
   ```

#### Memory issues with large state

**Problem**: Agent uses too much memory over time.

**Solution**:
1. Reduce job history:
   ```env
   KEEP_COMPLETED_JOBS=2
   KEEP_CANCELLED_JOBS=2
   ```
2. Restart agent periodically
3. Monitor memory usage:
   ```bash
   # Check Node.js memory
   node -e "console.log(process.memoryUsage())"
   ```

### API Integration Issues

#### "ECONNREFUSED" or "ETIMEDOUT"

**Problem**: Cannot connect to your API endpoint.

**Solution**:
1. Verify API is running and accessible
2. Check firewall/security group rules
3. Test with curl:
   ```bash
   curl -I https://your-api.com/endpoint
   ```
4. For local development, use ngrok or similar:
   ```bash
   ngrok http 3000
   # Use the ngrok URL in API_ENDPOINT
   ```

#### API returns unexpected format

**Problem**: Agent can't parse API response.

**Solution**:
1. Enable API output logging to see actual response
2. Ensure API returns JSON
3. Check response structure matches expected format:
   ```json
   {
     "result": "your data",
     "metadata": {}
   }
   ```

### Mock Testing Issues

#### Mock buyer not creating jobs

**Problem**: Running with `dev:mock` but no test jobs appear.

**Solution**:
1. Verify mock buyer is enabled:
   ```env
   ENABLE_MOCK_BUYER=true
   ```
2. Check mock interval (default 30 seconds):
   ```env
   MOCK_BUYER_INTERVAL=10000  # 10 seconds for faster testing
   ```
3. Look for "🧪 Mock job created" in logs

## Debugging Tools

### Enable Verbose Logging

```env
# Maximum debugging information
LOG_LEVEL=debug
LOG_API_OUTPUT=true
ENABLE_TX_MONITORING=true
```

### Monitor Logs in Real-time

```bash
# If using PM2
pm2 logs acp-agent --lines 100

# Direct output
pnpm run dev 2>&1 | tee debug.log

# Filter for errors
pnpm run dev 2>&1 | grep -E "ERROR|WARN"
```

### Check Agent State

Add this debug endpoint to your service:

```typescript
// In your custom service
async getDebugInfo(): Promise<any> {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    jobsProcessed: this.jobCounter,
    lastError: this.lastError,
    timestamp: new Date().toISOString()
  };
}
```

### Test Individual Components

```typescript
// test-connection.ts
import { ethers } from 'ethers';
import { config } from './src/config';

async function testConnection() {
  try {
    const provider = new ethers.JsonRpcProvider(config.acpRpcUrl);
    const blockNumber = await provider.getBlockNumber();
    console.log('Connected! Block:', blockNumber);
    
    const wallet = new ethers.Wallet(config.whitelistedWalletPrivateKey, provider);
    const balance = await wallet.getBalance();
    console.log('Wallet balance:', ethers.formatEther(balance), 'ETH');
  } catch (error) {
    console.error('Connection failed:', error);
  }
}

testConnection();
```

Run with: `tsx test-connection.ts`

## Performance Optimization

### Slow Response Times

1. **Reduce processing delay** for faster polling:
   ```env
   ACP_PROCESSING_DELAY=1000  # 1 second
   ```

2. **Optimize your service logic**:
   - Add caching for repeated operations
   - Use connection pooling for databases
   - Implement request batching

3. **Monitor performance**:
   ```typescript
   const startTime = Date.now();
   // ... your logic ...
   Logger.info(`Processing took ${Date.now() - startTime}ms`);
   ```

### Transaction Performance

1. **Batch operations** when possible for efficiency
2. **Optimize timing** - process during off-peak hours if not time-sensitive
3. **Note**: Gas costs are handled by Virtuals Protocol, not your wallet

## Getting Help

### Check Logs First

Most issues can be diagnosed from logs:
```bash
# Show last 50 lines
tail -n 50 debug.log

# Search for specific job
grep "job-id-123" debug.log

# Find all errors
grep "ERROR" debug.log
```

### Community Support

- **Discord**: [Virtuals Discord](https://discord.gg/virtuals) - #dev-support channel
- **GitHub Issues**: [Report bugs](https://github.com/dylanburkey/acp_boilerplate/issues)
- **Documentation**: Check `/docs` folder for detailed guides

### Reporting Issues

When reporting issues, include:
1. Error messages from logs
2. Your configuration (without sensitive data)
3. Steps to reproduce
4. Node.js version: `node --version`
5. Package versions: `pnpm list`

## Emergency Recovery

### Agent Stuck/Frozen

1. **Kill the process**:
   ```bash
   # Find process
   ps aux | grep node
   # Kill it
   kill -9 [PID]
   ```

2. **Clear state and restart**:
   ```bash
   # Remove any lock files
   rm -f *.lock
   # Restart
   pnpm run dev
   ```

### Wallet Compromised

1. **Immediately**:
   - Revoke access on Virtuals Console
   - Generate new wallet
   
2. **Update configuration**:
   - New private key in `.env`
   - Update agent wallet address
   - Re-whitelist new wallet on Virtuals Console
   
3. **Note**: Since Virtuals handles gas, compromised wallets don't risk ETH loss

### Complete Reset

```bash
# Backup your .env
cp .env .env.backup

# Clean install
rm -rf node_modules
rm -f pnpm-lock.yaml
pnpm install

# Restore config
cp .env.backup .env

# Start fresh
pnpm run dev
```

## Prevention Tips

1. **Test thoroughly** in mock mode before production
2. **Monitor wallet balances** and set up alerts
3. **Keep logs** for debugging (rotate to prevent disk fill)
4. **Use version control** for configuration changes
5. **Document custom changes** for future reference
6. **Regular backups** of working configurations
7. **Stay updated** with Virtuals Protocol changes