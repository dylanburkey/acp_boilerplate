# 🔌 Plug-and-Play Setup Guide

This guide ensures you can deploy your ACP agent in minutes with our automated setup process.

## 📋 Prerequisites Checklist

Before starting, gather these items:

- [ ] **Node.js v18+** installed
- [ ] **PNPM** installed (`npm install -g pnpm`)
- [ ] **GAME API Key** from [Virtuals Console](https://console.virtuals.io)
- [ ] **Whitelisted Wallet** private key (registered on Virtuals)
- [ ] **Entity ID** from your agent registration
- [ ] **Agent Wallet Address** for receiving payments
- [ ] **Service Description** (clear and specific)
- [ ] **API Endpoint** (or plan to use built-in templates)

## 🚀 One-Command Setup

```bash
# Clone and set up everything
git clone https://github.com/dylanburkey/acp_boilerplate.git
cd acp_boilerplate
pnpm run setup
```

## 🔧 Configuration (2 minutes)

Edit the `.env` file that was created:

```env
# REQUIRED - Get from Virtuals Console
GAME_API_KEY=your_actual_api_key_here

# REQUIRED - Your whitelisted wallet (starts with 0x)
WHITELISTED_WALLET_PRIVATE_KEY=0x1234567890abcdef...
WHITELISTED_WALLET_ENTITY_ID=1

# REQUIRED - Your payment wallet (starts with 0x) 
AGENT_WALLET_ADDRESS=0xYourPaymentWallet...

# REQUIRED - Your service details
SERVICE_NAME="My Amazing AI Agent"
SERVICE_DESCRIPTION="Provides data analysis and insights for e-commerce businesses. Processes CSV data and generates actionable reports with visualizations."
API_ENDPOINT=https://your-api.com/process
```

### 🤖 Optional AI Features

For intelligent AI-powered responses:

```env
# Optional - For LangChain AI integration
OPENAI_API_KEY=sk-your_openai_key_here
```

## ✅ Validation (30 seconds)

```bash
# Validate everything is configured correctly
pnpm run validate
```

This checks:
- All required environment variables
- Dependency installation
- TypeScript compilation
- Build process
- Configuration formats

## 🧪 Testing (1 minute)

```bash
# Test with mock buyer (no real transactions)
pnpm run dev:mock
```

You should see:
- Agent starting successfully
- Mock jobs being created and processed
- Graduation progress tracking

## 🌐 Production Deployment

```bash
# Start your live agent
pnpm run dev
```

## 📊 Monitoring

Watch for these success indicators:

1. **Startup Success**:
   ```
   ✅ ACP Integration initialized successfully
   🔄 Starting main loop...
   ```

2. **Job Processing**:
   ```
   📥 New job received: job_123
   ⚙️ Processing job job_123
   ✅ Job job_123 completed successfully
   ```

3. **Graduation Progress** (sandbox):
   ```
   Sandbox graduation progress: 3/10 successful transactions
   ```

## 🔧 Service Templates

Choose your agent type by editing `src/index.ts`:

### 1. API-Based Service (Default)
```typescript
import { DefaultAgentService } from './services/agentService';
this.agentService = new DefaultAgentService();
```

### 2. Custom Logic Service
```typescript
import { CustomAgentService } from './services/agentService';
this.agentService = new CustomAgentService();
```

### 3. AI-Powered Service
```typescript
import { LangChainAgentService } from './services/langChainAgentService';
this.agentService = new LangChainAgentService();
```

### 4. Example Services
```typescript
import { MathAgentService, DataAnalysisAgentService } from '../examples/simple-agent';
this.agentService = new MathAgentService(); // or DataAnalysisAgentService
```

## 🎯 Service Description Best Practices

Your `SERVICE_DESCRIPTION` should be specific:

❌ **Too Vague**: "AI assistant for general tasks"
✅ **Good**: "Data analysis service that processes CSV files up to 10MB and generates statistical reports with charts for marketing teams"

❌ **Too Broad**: "Helps with business needs"  
✅ **Good**: "E-commerce product description generator that creates SEO-optimized descriptions for online stores using product specifications"

## 🚨 Common Issues & Fixes

### Validation Errors

**Missing API Key**:
```bash
❌ Missing or placeholder values for: GAME_API_KEY
```
→ Get your real API key from Virtuals Console

**Wallet Format**:
```bash
⚠️ WHITELISTED_WALLET_PRIVATE_KEY should start with 0x
```
→ Add `0x` prefix to your private key

**Entity ID**:
```bash
❌ WHITELISTED_WALLET_ENTITY_ID must be a number
```
→ Use the numeric Entity ID from your agent registration

### Runtime Errors

**"AA23 reverted"**:
- Verify wallet is whitelisted in Virtuals Console
- Ensure Entity ID matches your registration
- No ETH needed - Virtuals handles gas fees

**"Service validation failed"**:
- Check your API_ENDPOINT is reachable
- Verify API_KEY if required
- Test endpoint manually first

**No jobs received**:
- Verify you're registered as a service provider
- Check your service description matches buyer needs
- Use mock mode first: `pnpm run dev:mock`

## 📚 Next Steps

1. **Test Thoroughly**: Use mock mode to verify your logic
2. **Monitor Performance**: Watch processing times and success rates
3. **Graduate**: Complete 10 successful sandbox transactions
4. **Scale Up**: Move to production environment
5. **Optimize**: Use SLA metrics to improve performance

## 🆘 Need Help?

- Check [Troubleshooting Guide](docs/troubleshooting.md)
- Review [Business Description Templates](docs/business-description-templates.md)
- Join [Virtuals Discord](https://discord.gg/virtuals)
- Read [ACP Overview](docs/ACP-OVERVIEW.md)

---

🎉 **You're ready to go!** Your ACP agent should be processing jobs and earning from the AI agent economy.