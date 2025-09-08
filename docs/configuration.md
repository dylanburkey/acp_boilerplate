# Configuration Guide

This guide covers all configuration options for your ACP agent, from basic setup to advanced tuning.

## Environment Variables

All configuration is managed through environment variables in the `.env` file.

### Required Variables

These must be set for your agent to function:

#### `GAME_API_KEY`
- **Description**: Your API key from Virtuals Console
- **Format**: String
- **Example**: `game_api_key_abc123xyz`
- **How to get**: [console.virtuals.io](https://console.virtuals.io) → API Keys → Create New

#### `WHITELISTED_WALLET_PRIVATE_KEY`
- **Description**: Private key of the wallet that pays for gas fees
- **Format**: Hex string starting with 0x
- **Example**: `0x1234567890abcdef...`
- **Security**: Keep this secure! This wallet needs Base ETH for transactions
- **Requirements**: Must be whitelisted on Virtuals Protocol

#### `AGENT_WALLET_ADDRESS`
- **Description**: Public address where your agent receives payments
- **Format**: Ethereum address
- **Example**: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7`
- **Note**: Can be the same as whitelisted wallet, but separate is recommended

#### `SERVICE_NAME`
- **Description**: Display name for your agent service
- **Format**: String (max 50 chars recommended)
- **Example**: `"AI Research Assistant"`

#### `SERVICE_DESCRIPTION`
- **Description**: Brief description of what your agent does
- **Format**: String (max 200 chars recommended)
- **Example**: `"Analyzes documents and provides summaries"`

#### `API_ENDPOINT`
- **Description**: URL of your service API (if using DefaultAgentService)
- **Format**: Full URL
- **Example**: `https://api.myservice.com/process`

### Optional Variables

#### API Configuration

**`API_KEY`**
- **Description**: Authentication key for your API endpoint
- **Default**: None
- **Example**: `sk_live_abc123xyz`

#### Blockchain Settings

**`ACP_RPC_URL`**
- **Description**: RPC endpoint for Base chain
- **Default**: `https://base.llamarpc.com`
- **Alternatives**: 
  - `https://mainnet.base.org`
  - `https://base.gateway.tenderly.co`

**`ACP_CHAIN_ID`**
- **Description**: Chain ID for Base
- **Default**: `8453`
- **Note**: Don't change unless using different network

**`ACP_CONTRACT_ADDRESS`**
- **Description**: ACP smart contract address
- **Default**: `0xC6e864B52203da6593C83fD18E4c1212D088F61F`
- **Note**: Provided by Virtuals Protocol

#### Service Pricing

**`SERVICE_PRICE`**
- **Description**: Price per request in ETH
- **Default**: `0.001`
- **Range**: `0.0001` to `10`
- **Example**: `0.005` (5 milliETH)

#### Performance Tuning

**`ACP_PROCESSING_DELAY`**
- **Description**: Milliseconds between job checks
- **Default**: `3000` (3 seconds)
- **Range**: `1000` to `60000`
- **Impact**: Lower = faster response, higher gas costs

**`ACP_MAX_RETRIES`**
- **Description**: Maximum retry attempts for failed jobs
- **Default**: `3`
- **Range**: `0` to `10`
- **Note**: Each retry has exponential backoff

**`GAS_PRICE_MULTIPLIER`**
- **Description**: Multiplier for gas price on retries
- **Default**: `1.1` (10% increase)
- **Range**: `1.0` to `2.0`
- **Use case**: Helps push through stuck transactions

**`MAX_GAS_PRICE`**
- **Description**: Maximum gas price in gwei
- **Default**: `100`
- **Range**: `1` to `1000`
- **Protection**: Prevents excessive fees during network congestion

**`TX_CONFIRMATION_TIMEOUT`**
- **Description**: Timeout for transaction confirmations (ms)
- **Default**: `60000` (1 minute)
- **Range**: `30000` to `300000`

#### Logging

**`LOG_LEVEL`**
- **Description**: Minimum log level to display
- **Default**: `info`
- **Options**: `debug`, `info`, `warn`, `error`
- **Debug mode**: Shows detailed transaction and API data

**`LOG_API_OUTPUT`**
- **Description**: Log full API responses
- **Default**: `false`
- **Options**: `true`, `false`
- **Warning**: Can expose sensitive data in logs

**`ENABLE_TX_MONITORING`**
- **Description**: Enable detailed transaction monitoring
- **Default**: `true`
- **Options**: `true`, `false`
- **Features**: Tracks gas usage, success rates, timing

#### Testing

**`ENABLE_MOCK_BUYER`**
- **Description**: Enable mock buyer for testing
- **Default**: `false`
- **Options**: `true`, `false`
- **Usage**: Set via `pnpm run dev:mock` or manually

**`MOCK_BUYER_INTERVAL`**
- **Description**: Milliseconds between mock requests
- **Default**: `30000` (30 seconds)
- **Range**: `5000` to `300000`

#### State Management

**`KEEP_COMPLETED_JOBS`**
- **Description**: Number of completed jobs to keep in memory
- **Default**: `5`
- **Range**: `0` to `100`
- **Purpose**: Prevents memory leaks, keeps recent history

**`KEEP_CANCELLED_JOBS`**
- **Description**: Number of cancelled jobs to keep in memory
- **Default**: `5`
- **Range**: `0` to `100`

**`IGNORED_JOB_IDS`**
- **Description**: Comma-separated job IDs to ignore
- **Default**: Empty
- **Example**: `job123,job456,job789`
- **Use case**: Skip problematic jobs during debugging

## Configuration Examples

### Development Configuration

```env
# Minimal setup for development
GAME_API_KEY=test_key_123
WHITELISTED_WALLET_PRIVATE_KEY=0xtest_private_key
AGENT_WALLET_ADDRESS=0xtest_agent_wallet
SERVICE_NAME="Dev Test Agent"
SERVICE_DESCRIPTION="Testing agent functionality"
API_ENDPOINT=http://localhost:3000/api

# Development settings
LOG_LEVEL=debug
ENABLE_MOCK_BUYER=true
MOCK_BUYER_INTERVAL=10000
ACP_PROCESSING_DELAY=1000
```

### Production Configuration

```env
# Production setup
GAME_API_KEY=prod_key_secure_123
WHITELISTED_WALLET_PRIVATE_KEY=0xprod_private_key_secure
AGENT_WALLET_ADDRESS=0xprod_agent_wallet
SERVICE_NAME="Production AI Agent"
SERVICE_DESCRIPTION="Professional AI service for data analysis"
API_ENDPOINT=https://api.production.com/v1/process
API_KEY=sk_live_production_key

# Production optimizations
LOG_LEVEL=warn
SERVICE_PRICE=0.01
ACP_PROCESSING_DELAY=5000
ACP_MAX_RETRIES=5
MAX_GAS_PRICE=200
TX_CONFIRMATION_TIMEOUT=120000
KEEP_COMPLETED_JOBS=20
```

### High-Performance Configuration

```env
# For high-volume agents
ACP_PROCESSING_DELAY=1000      # Fast polling
ACP_MAX_RETRIES=2              # Quick failure detection
GAS_PRICE_MULTIPLIER=1.5       # Aggressive gas pricing
MAX_GAS_PRICE=500              # High ceiling for busy periods
TX_CONFIRMATION_TIMEOUT=30000  # Quick timeout
KEEP_COMPLETED_JOBS=50         # More history
LOG_LEVEL=error                # Minimal logging
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use environment variables** in production, not `.env` files
3. **Rotate API keys** regularly
4. **Keep minimal funds** in the whitelisted wallet
5. **Use separate wallets** for gas and receiving payments
6. **Monitor wallet balances** and set up alerts
7. **Implement rate limiting** in your API endpoint
8. **Use HTTPS only** for API endpoints in production

## Validation

The agent validates configuration on startup. Common validation errors:

- **"Missing required environment variables"**: Check all required vars are set
- **"Invalid wallet address"**: Ensure addresses start with 0x and are 42 chars
- **"Invalid private key"**: Private keys should be 66 chars (including 0x)
- **"Invalid RPC URL"**: Ensure URL is properly formatted

## Next Steps

- [Customize Your Service](./customization.md) - Implement your agent logic
- [Troubleshooting](./troubleshooting.md) - Common configuration issues