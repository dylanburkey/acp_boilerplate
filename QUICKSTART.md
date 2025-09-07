# ACP Integration Quick Start Guide

## 🎯 5-Minute Setup

```bash
# 1. Clone and enter directory
git clone <this-repo>
cd acp_integration

# 2. Run setup script
./setup.sh

# 3. Configure your agent
nano .env  # Add your keys and settings

# 4. Start your agent
npm run dev
```

## 📝 Required Configuration

You MUST provide these values in `.env`:

1. **GAME_API_KEY** - Get from https://console.virtuals.io
2. **WHITELISTED_WALLET_PRIVATE_KEY** - Wallet with Base ETH for gas
3. **AGENT_WALLET_ADDRESS** - Where you receive payments
4. **SERVICE_NAME** - What your agent is called
5. **API_ENDPOINT** - Your service endpoint (or use custom logic)

## 🧪 Test Without Real Transactions

```bash
# Run with mock buyer (no real blockchain transactions)
npm run dev:mock
```

## 🚀 Deploy to Production

```bash
# Build for production
npm run build

# Run with PM2
pm2 start dist/index.js --name my-acp-agent

# Or with Docker
docker build -t my-agent .
docker run -d --env-file .env my-agent
```

## ❓ Common Issues

### "Missing required environment variables"
→ Fill in all required fields in `.env`

### "replacement underpriced" error
→ Increase `ACP_PROCESSING_DELAY` in `.env` to 5000

### "AA23 reverted" error  
→ Add Base ETH to your whitelisted wallet

## 📚 Full Documentation

See [README.md](README.md) for complete documentation.

## 🆘 Need Help?

- Check the [examples](examples/) folder
- Read the full [README.md](README.md)
- Join Virtuals Discord: https://discord.gg/virtuals