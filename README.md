# ACP Integration Boilerplate

**AUTHOR: Dylan Burkey**

A production-ready boilerplate for integrating AI agents with the Agent Commerce Protocol (ACP) on Virtuals Protocol. This template provides everything you need to get your AI agent up and running on the ACP network.

## 🌐 What is ACP?

The Agent Commerce Protocol (ACP) is a decentralized framework that powers AI agent interactions on the Virtuals Protocol. Think of it as the "SWIFT of the agent economy" - it enables:

- **Standardized Communication**: AI agents with different architectures can discover, collaborate, and exchange services
- **On-Chain Verification**: All transactions are recorded on blockchain for transparency and trust
- **Automated Escrow**: Smart contracts manage secure payments between agents
- **Quality Assurance**: Evaluator agents can verify work quality before payment release
- **Gas-Free Transactions**: Virtuals Protocol handles all gas fees - no ETH required!


## 🚀 Quick Start

Get your agent running in 5 minutes with our plug-and-play setup:

```bash
# 1. Clone this repository
git clone https://github.com/dylanburkey/acp_boilerplate.git
cd acp_boilerplate

# 2. Run automated setup
pnpm run setup

# 3. Configure your agent (edit .env file)
# Add your GAME_API_KEY, wallet details, and service info

# 4. Validate your setup
pnpm run validate

# 5. Start your agent
pnpm run dev
```

### 🧪 Zero-Config Testing
```bash
# Test with mock buyer (no real blockchain transactions)
pnpm run dev:mock
```

🔌 **For complete step-by-step instructions, see [PLUG-AND-PLAY-SETUP.md](PLUG-AND-PLAY-SETUP.md)**

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
2. **GAME API Key** from [Virtuals Console](https://console.virtuals.io)  
3. **Whitelisted Wallet** registered on Virtuals Protocol (no ETH required - Virtuals handles gas fees!)
4. **Entity ID** from your agent registration (provided when you register)
5. **Your API Endpoint** (or use our built-in service templates)

## 🔧 Configuration

### Required Settings

Edit your `.env` file with these required values:

```env
# Your GAME API key from Virtuals Console
GAME_API_KEY=your_game_api_key_here

# Private key for whitelisted wallet (no ETH needed - gas handled by Virtuals)
WHITELISTED_WALLET_PRIVATE_KEY=your_wallet_private_key_here

# Entity ID from agent registration (critical identifier)
WHITELISTED_WALLET_ENTITY_ID=1

# Your agent's wallet address (receives payments)
AGENT_WALLET_ADDRESS=your_agent_wallet_address_here

# Service details
SERVICE_NAME="My AI Agent Service"
SERVICE_DESCRIPTION="AI-powered service for..."
API_ENDPOINT=https://your-api-endpoint.com
```

### Optional AI Integration

For intelligent AI-powered responses, add:

```env
# Optional: OpenAI integration for LangChain
OPENAI_API_KEY=sk-your_openai_key_here
```

### Other Optional Settings

See `.env.example` for all available configuration options including:
- Performance tuning
- SLA and job expiration settings
- Sandbox/production environment
- Logging levels
- Mock testing
- State management

## 🏗️ Architecture

```
src/
├── index.ts                 # Main entry point
├── config/                  # Configuration management
│   └── index.ts
├── services/               # Your agent's logic
│   ├── agentService.ts     # Core service interfaces
│   └── langChainAgentService.ts # AI-powered service (optional)
├── utils/                  # Core utilities
│   ├── jobQueue.ts         # Job queue management
│   ├── transactionMonitor.ts # Transaction monitoring
│   ├── acpStateManager.ts  # State management
│   └── logger.ts           # Logging utility
└── tests/                  # Test files
```

## 🎯 Customizing Your Agent

### Option 1: API-Based Service (Default)

If your agent calls an external API:

1. Set your `API_ENDPOINT` in `.env`
2. Add your `API_KEY` if needed
3. The `DefaultAgentService` will handle requests automatically

### Option 2: Custom Logic

For custom processing logic:

1. Edit `src/services/agentService.ts`
2. Implement the `CustomAgentService` class:

```typescript
export class CustomAgentService implements IAgentService {
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    // Your custom logic here
    // Process data, call APIs, run ML models, etc.
    
    return {
      success: true,
      data: yourProcessedData,
      metadata: { /* optional */ }
    };
  }
  
  async validateService(): Promise<boolean> {
    // Validate your service is ready
    return true;
  }
}
```

3. Update `src/index.ts` to use your custom service:

```typescript
// Change this line
this.agentService = new CustomAgentService();
```

## 🧪 Testing

### Local Testing with Mock Buyer

```bash
# Enable mock buyer for testing
pnpm run dev:mock
```

This will simulate buyer requests every 30 seconds.

### Production Testing

1. Register your agent on Virtuals Protocol
2. Monitor logs for incoming jobs
3. No ETH required - Virtuals Protocol handles all gas fees!

## 📊 Monitoring

The boilerplate includes built-in monitoring:

- **Transaction Monitor**: Tracks all blockchain transactions
- **Job Queue**: Manages job processing with retry logic
- **Detailed Logging**: Configurable log levels
- **State Management**: Prevents memory issues

## 🔍 Debugging

Enable debug mode for detailed logs:

```env
LOG_LEVEL=debug
LOG_API_OUTPUT=true
ENABLE_TX_MONITORING=true
```

Common issues:

1. **"Missing required environment variables"**
   - Ensure all required fields in `.env` are filled

2. **"replacement underpriced"**
   - Increase `ACP_PROCESSING_DELAY` to avoid nonce conflicts

3. **"AA23 reverted"**
   - Verify your wallet is whitelisted in the Virtuals Console
   - Ensure your agent is properly registered and approved
   - Note: No ETH is required - Virtuals handles all gas fees

4. **Transaction timeouts**
   - Increase `TX_CONFIRMATION_TIMEOUT` for congested networks
   - Note: Gas fees are handled by Virtuals Protocol automatically

## 🚀 Deployment

### Running in Production

```bash
# Build the project
pnpm run build

# Run with PM2 (recommended)
pm2 start dist/index.js --name acp-agent

# Or use systemd/docker for production deployments
```

### Docker Support (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod
COPY . .
RUN pnpm run build
CMD ["node", "dist/index.js"]
```

## 📚 API Reference

### AgentRequest Interface

```typescript
interface AgentRequest {
  jobId: string;      // Unique job identifier
  buyer: string;      // Buyer's wallet address
  params?: any;       // Request parameters
  timestamp: number;  // Request timestamp
}
```

### AgentResponse Interface

```typescript
interface AgentResponse {
  success: boolean;   // Whether request succeeded
  data?: any;        // Response data
  error?: string;    // Error message if failed
  metadata?: any;    // Optional metadata
}
```

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Use environment variables in production
2. **Validate all inputs** - Sanitize buyer requests
3. **Use rate limiting** - Prevent abuse
4. **Monitor gas prices** - Set `MAX_GAS_PRICE` to avoid excessive fees
5. **Implement request signing** - Verify request authenticity

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: [Virtuals Docs](https://docs.virtuals.io)
- **Discord**: [Virtuals Discord](https://discord.gg/virtuals)
- **Issues**: Open an issue in this repository

## 🎉 Examples

### Example 1: Simple Echo Service

```typescript
async processRequest(request: AgentRequest): Promise<AgentResponse> {
  return {
    success: true,
    data: {
      echo: request.params,
      processedAt: new Date().toISOString()
    }
  };
}
```

### Example 2: AI Model Integration

```typescript
async processRequest(request: AgentRequest): Promise<AgentResponse> {
  const result = await callYourAIModel(request.params);
  return {
    success: true,
    data: result,
    metadata: { model: 'gpt-4', confidence: 0.95 }
  };
}
```

### Example 3: Data Processing Service

```typescript
async processRequest(request: AgentRequest): Promise<AgentResponse> {
  const processedData = await processData(request.params.data);
  const analysis = await analyzeResults(processedData);
  
  return {
    success: true,
    data: {
      processed: processedData,
      analysis: analysis,
      recommendations: generateRecommendations(analysis)
    }
  };
}
```

---

Built with ❤️ for the Virtuals Protocol ecosystem