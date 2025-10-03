# Kosher Capital Quick Deploy - Deployment Guide

## Server Requirements

This application is **server-agnostic** and can run on any Node.js server without cloud-specific dependencies.

### Minimum Requirements

- **Node.js**: v18.0.0 or higher
- **Memory**: 512MB minimum, 1GB recommended
- **Storage**: 1GB for application and logs
- **Network**: Stable internet connection for blockchain RPC and API calls

### Supported Platforms

✅ **Any Node.js Environment:**
- Traditional VPS (DigitalOcean, Linode, etc.)
- Dedicated servers
- Docker containers
- Kubernetes clusters
- AWS EC2, Google Compute Engine, Azure VMs
- Heroku, Railway, Render
- Self-hosted on-premises servers

❌ **NOT Required:**
- Cloudflare Workers (not used)
- Cloudflare Durable Objects (not used)
- Serverless-specific platforms

## Quick Start Deployment

### 1. Clone and Install

```bash
git clone <your-repo>
cd acp_integration
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual values
```

**Required Variables:**
```bash
# GameAgent API Key from Virtuals Console
GAME_API_KEY=your_game_api_key_here

# Wallet Configuration
WHITELISTED_WALLET_PRIVATE_KEY=0xyour_private_key_here
WHITELISTED_WALLET_ENTITY_ID=1
SELLER_AGENT_WALLET_ADDRESS=0xYourSellerAgentWalletAddress

# Service Configuration
SERVICE_NAME="Kosher Capital - AI Agent Quick Deploy"
SERVICE_DESCRIPTION="Professional AI trading agent deployment"
SERVICE_PRICE=50

# Kosher Capital API
SHEKEL_API_KEY=your_shekel_api_key_here
KOSHER_CAPITAL_API_URL=https://app.kosher.capital/api

# Blockchain Configuration (Base Network)
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

### 3. Build and Run

```bash
# Development mode
pnpm dev

# Production build
pnpm build
pnpm start
```

## Deployment Platforms

### Traditional VPS (Recommended for Simplicity)

**DigitalOcean Droplet / Linode / Vultr:**

```bash
# 1. SSH into your server
ssh root@your-server-ip

# 2. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 3. Install pnpm
npm install -g pnpm

# 4. Clone your repository
git clone <your-repo>
cd acp_integration

# 5. Install dependencies
pnpm install

# 6. Configure environment
nano .env
# Paste your configuration

# 7. Build
pnpm build

# 8. Run with process manager (PM2)
npm install -g pm2
pm2 start dist/quickDeployAgent.js --name kosher-capital-agent
pm2 save
pm2 startup
```

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Expose port (if using status API)
EXPOSE 3000

# Start the agent
CMD ["node", "dist/quickDeployAgent.js"]
```

**Build and Run:**
```bash
# Build image
docker build -t kosher-capital-agent .

# Run container
docker run -d \
  --name kosher-capital-agent \
  --env-file .env \
  --restart unless-stopped \
  kosher-capital-agent
```

**Docker Compose:**
```yaml
version: '3.8'

services:
  kosher-capital-agent:
    build: .
    container_name: kosher-capital-agent
    env_file: .env
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Kubernetes Deployment

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kosher-capital-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kosher-capital-agent
  template:
    metadata:
      labels:
        app: kosher-capital-agent
    spec:
      containers:
      - name: agent
        image: your-registry/kosher-capital-agent:latest
        envFrom:
        - secretRef:
            name: kosher-capital-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### Platform-as-a-Service

**Railway:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Render:**
```bash
# Use Render dashboard to connect your GitHub repo
# Set build command: pnpm install && pnpm build
# Set start command: node dist/quickDeployAgent.js
# Add environment variables in dashboard
```

**Heroku:**
```bash
# Install Heroku CLI
heroku create kosher-capital-agent
git push heroku main
heroku config:set GAME_API_KEY=your_key
# ... set all other env vars
```

## Process Management

### PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start agent
pm2 start dist/quickDeployAgent.js --name kosher-capital

# Monitor
pm2 logs kosher-capital
pm2 monit

# Auto-restart on server reboot
pm2 startup
pm2 save

# Restart agent
pm2 restart kosher-capital

# Stop agent
pm2 stop kosher-capital
```

### Systemd Service

**Create `/etc/systemd/system/kosher-capital.service`:**
```ini
[Unit]
Description=Kosher Capital Quick Deploy Agent
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/home/nodeuser/acp_integration
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/quickDeployAgent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable kosher-capital
sudo systemctl start kosher-capital
sudo systemctl status kosher-capital
```

## Monitoring & Logging

### Application Logs

```bash
# PM2 logs
pm2 logs kosher-capital

# Systemd logs
journalctl -u kosher-capital -f

# Docker logs
docker logs -f kosher-capital-agent
```

### Health Checks

The agent exposes health information through logs. Monitor for:

```
✅ "🚀 KOSHER CAPITAL QUICK DEPLOY AGENT REGISTERED AS SELLER"
✅ "[JobQueue] Initializing in-memory job queue"
✅ "[ACP] New job #X queued"
❌ "Failed to initialize ACP integration"
❌ "Error processing job"
```

### Monitoring Tools

**Recommended:**
- **PM2 Plus**: Built-in monitoring for PM2
- **Prometheus + Grafana**: Metrics and dashboards
- **Sentry**: Error tracking
- **DataDog**: Full observability

## Scaling Considerations

### Single Instance (Current)

The application uses an **in-memory job queue**, which means:
- ✅ Simple deployment
- ✅ Works on any server
- ✅ No external dependencies
- ⚠️ Jobs are lost on restart (in-flight jobs)
- ⚠️ Cannot scale horizontally (multiple instances would conflict)

**Best for:**
- Development
- Low to moderate job volume
- Simple infrastructure

### Future Scaling Options

If you need to scale beyond a single instance:

1. **Redis-based Queue** (recommended for scaling)
   - Replace in-memory queue with Redis
   - Multiple agent instances can share queue
   - Jobs persist across restarts

2. **Database-backed Queue**
   - PostgreSQL or MongoDB for job persistence
   - Better for complex workflows

3. **Message Queue (RabbitMQ, SQS)**
   - Enterprise-grade job processing
   - Advanced routing and retry logic

**Note:** The current architecture uses in-memory queues intentionally for simplicity. Scaling would require updating `src/utils/jobQueue.ts` to use external storage.

## Security Best Practices

### Environment Variables

```bash
# NEVER commit .env to git
echo ".env" >> .gitignore

# Use restricted file permissions
chmod 600 .env
```

### Wallet Security

```bash
# Store private keys in secure vault
# - AWS Secrets Manager
# - HashiCorp Vault
# - Environment-specific secrets

# Rotate keys periodically
# Monitor wallet for unauthorized transactions
```

### Network Security

```bash
# Use firewall to restrict access
ufw allow 22/tcp    # SSH only
ufw enable

# Use HTTPS for API endpoints
# Implement rate limiting
# Use API key authentication
```

## Troubleshooting

### Agent Won't Start

```bash
# Check environment variables
cat .env

# Check TypeScript compilation
pnpm typecheck

# Check for port conflicts
lsof -i :3000

# Check logs
pm2 logs kosher-capital --lines 100
```

### Jobs Not Processing

```bash
# Check ACP client connection
# Verify GAME_API_KEY is valid
# Check wallet has proper permissions
# Verify network connectivity to Base RPC
```

### Payment Monitoring Fails

```bash
# Verify USDC contract address
# Check RPC endpoint is responding
# Ensure wallet addresses are correct
# Verify buyer sent payment to correct address
```

## Backup & Recovery

### Configuration Backup

```bash
# Backup .env (encrypted)
gpg -c .env
# Store .env.gpg securely

# Backup wallet private key separately
# Use hardware wallet or key management service
```

### Disaster Recovery

```bash
# 1. Deploy new server
# 2. Install dependencies
# 3. Restore .env from backup
# 4. Build and start agent
# 5. Monitor for proper initialization
```

## Performance Tuning

### Node.js Options

```bash
# Increase heap size for large state
NODE_OPTIONS="--max-old-space-size=2048" node dist/quickDeployAgent.js

# Enable source maps for debugging
NODE_OPTIONS="--enable-source-maps" node dist/quickDeployAgent.js
```

### Queue Configuration

Edit `.env`:
```bash
ACP_PROCESSING_DELAY=3000  # Delay between jobs (ms)
ACP_MAX_RETRIES=3          # Max retry attempts
```

## Support

For deployment issues:
1. Check logs for error messages
2. Review [docs/INDEX.md](./INDEX.md) for troubleshooting guides
3. Verify all environment variables are set correctly
4. Test with LOCAL_TEST_ONLY=true first

---

**Remember:** This codebase is server-agnostic and requires no cloud-specific services. It will run on any Node.js server with network access to Base blockchain and Kosher Capital API.
