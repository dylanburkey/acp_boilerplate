# Kosher Capital Quick Deploy Service

This service integrates with Kosher Capital's infrastructure to enable AI trading agent deployment through the Agent Communication Protocol (ACP).

## Overview

The Quick Deploy service handles the complete deployment flow:
1. **Contract Deployment**: Creates personal fund contracts on Base network
2. **Payment Processing**: Handles 50 USDC payments
3. **API Integration**: Registers agents with Kosher Capital
4. **Status Tracking**: Provides real-time deployment monitoring

## Documentation

- **[Full Documentation](../../docs/kosher-capital-index.md)** - Complete integration guide
- **[Quick Reference](../../docs/kosher-capital-quick-reference.md)** - 5-minute setup
- **[Visual Guide](../../docs/kosher-capital-visual-flow-guide.md)** - Flow diagrams
- **[Developer Guide](../../docs/kosher-capital-developer-guide.md)** - Architecture details

## Module Structure

```
quickDeploy/
├── constants.ts           # Configuration constants
├── contractUtils.ts       # Blockchain interactions
├── quickDeployService.ts  # Main service logic
├── notificationService.ts # Webhook handling
├── transactionTracker.ts  # State management
├── statusApi.ts          # REST API
└── index.ts              # Exports
```

## Quick Start

```bash
# Configure environment
cp .env.quickdeploy.example .env
# Add your SHEKEL_API_KEY

# Run service
pnpm quickdeploy

# Test deployment
pnpm tsx test-utils/testQuickDeploy.ts
```

## Key Features

- **Modular Architecture**: Easy to extend and customize
- **Type-Safe**: Full TypeScript implementation  
- **Error Handling**: Comprehensive retry logic
- **Real-time Monitoring**: Status API and webhooks
- **Transaction Tracking**: Complete audit trail

## Configuration

Required environment variables:
- `SHEKEL_API_KEY` - From Kosher Capital
- `GAME_API_KEY` - GAME protocol key
- `WHITELISTED_WALLET_PRIVATE_KEY` - Deployment wallet

See [.env.quickdeploy.example](../../.env.quickdeploy.example) for full configuration.

## API Endpoints

Status API runs on port 3001:
- `GET /health` - Health check
- `GET /api/deployments/:jobId` - Get deployment status
- `GET /api/deployments` - List all deployments
- `GET /api/statistics` - Deployment statistics

## Testing

```bash
# Unit tests
pnpm test quickDeploy

# Integration tests
pnpm tsx test-utils/mockKosherCapital.ts  # Terminal 1
pnpm quickdeploy                          # Terminal 2
pnpm tsx test-utils/testQuickDeploy.ts    # Terminal 3
```

## Support

- Check [troubleshooting guide](../../docs/kosher-capital-integration.md#troubleshooting)
- Enable debug logs: `LOG_LEVEL=debug pnpm quickdeploy`
- Review transaction logs in `./test-logs/`

---

**Maintained by**: Athena AI Team  
**Last Updated**: October 2025
