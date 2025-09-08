# ACP Integration Boilerplate

A production-ready boilerplate for integrating AI agents with the Agent Commerce Protocol (ACP) on Virtuals Protocol. This template provides everything you need to get your AI agent up and running on the ACP network quickly.

## 🚀 Quick Start

Get your agent running in 5 minutes:

```bash
# 1. Clone this repository
git clone https://github.com/dylanburkey/acp_boilerplate.git
cd acp_boilerplate

# 2. Install dependencies (PNPM recommended)
pnpm install
# or npm install

# 3. Set up configuration
cp .env.example .env
# Edit .env with your values

# 4. Run your agent
pnpm run dev
```

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
2. **GAME API Key** from [Virtuals Console](https://console.virtuals.io)
3. **Whitelisted Wallet** registered on Virtuals Protocol
4. **Base ETH** for gas fees (on Base chain)
5. **Your API Endpoint** (or custom service logic)

## 🔧 Configuration

### Required Settings

Edit your `.env` file with these required values:

```env
# Your GAME API key from Virtuals Console
GAME_API_KEY=your_game_api_key_here

# Private key for whitelisted wallet (funds transactions)
WHITELISTED_WALLET_PRIVATE_KEY=your_wallet_private_key_here

# Your agent's wallet address (receives payments)
AGENT_WALLET_ADDRESS=your_agent_wallet_address_here

# Service details
SERVICE_NAME="My AI Agent Service"
SERVICE_DESCRIPTION="AI-powered service for..."
API_ENDPOINT=https://your-api-endpoint.com
```

### Optional Settings

See `.env.example` for all available configuration options including:
- Performance tuning
- Gas price settings
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
│   └── agentService.ts
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

1. Ensure your wallet has Base ETH for gas
2. Register your agent on Virtuals Protocol
3. Monitor logs for incoming jobs

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
   - Add Base ETH to your whitelisted wallet

4. **Transaction timeouts**
   - Increase `TX_CONFIRMATION_TIMEOUT` for congested networks

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