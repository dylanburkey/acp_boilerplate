# Customization Guide

Learn how to customize your agent to provide unique services on the Virtuals Protocol.

## Overview

There are two main approaches to implementing your agent's functionality:

1. **API-Based Service** (DefaultAgentService) - Forward requests to your external API
2. **Custom Logic** (CustomAgentService) - Implement logic directly in the agent

## Using DefaultAgentService (API-Based)

The simplest approach is to use an external API that processes requests.

### Setup

1. Set your API endpoint in `.env`:
```env
API_ENDPOINT=https://your-api.com/process
API_KEY=your_api_key_if_needed
```

2. Your API should accept POST requests with this structure:
```json
{
  "jobId": "unique-job-id",
  "buyer": "0xBuyerAddress",
  "param1": "value1",
  "param2": "value2"
}
```

3. Return responses in this format:
```json
{
  "result": "your processed data",
  "metadata": {
    "processingTime": "100ms",
    "confidence": 0.95
  }
}
```

The DefaultAgentService handles the communication automatically.

## Creating a Custom Service

For more control, implement your own service class.

### Basic Template

```typescript
// src/services/myCustomService.ts
import { IAgentService, AgentRequest, AgentResponse } from './agentService';
import { Logger } from '../utils/logger';

export class MyCustomService implements IAgentService {
  private logger = Logger;

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logger.info(`Processing request ${request.jobId}`);
      
      // Your custom logic here
      const result = await this.performTask(request.params);
      
      return {
        success: true,
        data: result,
        metadata: {
          processedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    } catch (error) {
      this.logger.error(`Error processing ${request.jobId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async validateService(): Promise<boolean> {
    // Check if your service is ready
    return true;
  }

  private async performTask(params: any): Promise<any> {
    // Implement your core functionality
    return { processed: true, data: params };
  }
}
```

### Activating Your Custom Service

Update `src/index.ts` to use your service:

```typescript
// Import your custom service
import { MyCustomService } from './services/myCustomService';

// In the constructor, replace:
// this.agentService = new DefaultAgentService();
// With:
this.agentService = new MyCustomService();
```

## Real-World Examples

### Example 1: AI Text Analysis Service

```typescript
export class TextAnalysisService implements IAgentService {
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { text, analysisType } = request.params || {};
      
      if (!text) {
        return {
          success: false,
          error: 'Text parameter is required'
        };
      }

      let result;
      switch (analysisType) {
        case 'sentiment':
          result = await this.analyzeSentiment(text);
          break;
        case 'summary':
          result = await this.generateSummary(text);
          break;
        case 'keywords':
          result = await this.extractKeywords(text);
          break;
        default:
          result = await this.generalAnalysis(text);
      }

      return {
        success: true,
        data: result,
        metadata: {
          textLength: text.length,
          analysisType: analysisType || 'general'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  private async analyzeSentiment(text: string) {
    // Call your ML model or API
    // Return sentiment scores
  }

  private async generateSummary(text: string) {
    // Generate text summary
  }

  private async extractKeywords(text: string) {
    // Extract key terms
  }

  private async generalAnalysis(text: string) {
    // Comprehensive analysis
  }

  async validateService(): Promise<boolean> {
    // Check ML models are loaded, APIs are accessible, etc.
    return true;
  }
}
```

### Example 2: Data Processing Service

```typescript
export class DataProcessingService implements IAgentService {
  private cache = new Map<string, any>();

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { operation, data, options } = request.params || {};
      
      // Input validation
      if (!operation || !data) {
        return {
          success: false,
          error: 'Missing required parameters: operation, data'
        };
      }

      // Check cache for expensive operations
      const cacheKey = `${operation}-${JSON.stringify(data)}`;
      if (this.cache.has(cacheKey)) {
        return {
          success: true,
          data: this.cache.get(cacheKey),
          metadata: { cached: true }
        };
      }

      // Process based on operation type
      let result;
      const startTime = Date.now();

      switch (operation) {
        case 'transform':
          result = await this.transformData(data, options);
          break;
        case 'aggregate':
          result = await this.aggregateData(data, options);
          break;
        case 'filter':
          result = await this.filterData(data, options);
          break;
        case 'analyze':
          result = await this.analyzeData(data, options);
          break;
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`
          };
      }

      // Cache the result
      this.cache.set(cacheKey, result);
      
      // Clean old cache entries
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return {
        success: true,
        data: result,
        metadata: {
          operation,
          processingTime: `${Date.now() - startTime}ms`,
          recordsProcessed: Array.isArray(data) ? data.length : 1
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  private async transformData(data: any, options: any) {
    // Data transformation logic
  }

  private async aggregateData(data: any[], options: any) {
    // Aggregation logic
  }

  private async filterData(data: any[], options: any) {
    // Filtering logic
  }

  private async analyzeData(data: any, options: any) {
    // Analysis logic
  }

  async validateService(): Promise<boolean> {
    return true;
  }
}
```

### Example 3: Web3 Integration Service

```typescript
import { ethers } from 'ethers';

export class Web3Service implements IAgentService {
  private provider: ethers.Provider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/YOUR_KEY');
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { action, params } = request.params || {};

      switch (action) {
        case 'getBalance':
          return await this.getBalance(params.address);
        case 'getTokenInfo':
          return await this.getTokenInfo(params.tokenAddress);
        case 'getNFTMetadata':
          return await this.getNFTMetadata(params.contract, params.tokenId);
        case 'getGasPrice':
          return await this.getCurrentGasPrice();
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Web3 operation failed'
      };
    }
  }

  private async getBalance(address: string): Promise<AgentResponse> {
    const balance = await this.provider.getBalance(address);
    return {
      success: true,
      data: {
        address,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString()
      }
    };
  }

  private async getTokenInfo(tokenAddress: string): Promise<AgentResponse> {
    // ERC20 token info retrieval
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function name() view returns (string)', 
       'function symbol() view returns (string)',
       'function decimals() view returns (uint8)',
       'function totalSupply() view returns (uint256)'],
      this.provider
    );

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals(),
      tokenContract.totalSupply()
    ]);

    return {
      success: true,
      data: { name, symbol, decimals, totalSupply: totalSupply.toString() }
    };
  }

  private async getNFTMetadata(contract: string, tokenId: string): Promise<AgentResponse> {
    // NFT metadata retrieval logic
  }

  private async getCurrentGasPrice(): Promise<AgentResponse> {
    const gasPrice = await this.provider.getFeeData();
    return {
      success: true,
      data: {
        gasPrice: ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei'),
        maxFeePerGas: ethers.formatUnits(gasPrice.maxFeePerGas || 0, 'gwei'),
        maxPriorityFeePerGas: ethers.formatUnits(gasPrice.maxPriorityFeePerGas || 0, 'gwei')
      }
    };
  }

  async validateService(): Promise<boolean> {
    try {
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }
}
```

## Advanced Patterns

### Async Queue Processing

```typescript
export class QueuedService implements IAgentService {
  private queue: Array<{request: AgentRequest, callback: (response: AgentResponse) => void}> = [];
  private processing = false;

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    return new Promise((resolve) => {
      this.queue.push({ request, callback: resolve });
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.processing = true;
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, 10); // Process in batches
      const results = await this.processBatch(batch.map(item => item.request));
      
      batch.forEach((item, index) => {
        item.callback(results[index]);
      });
    }
    this.processing = false;
  }

  private async processBatch(requests: AgentRequest[]): Promise<AgentResponse[]> {
    // Batch processing logic
  }

  async validateService(): Promise<boolean> {
    return true;
  }
}
```

### Rate-Limited Service

```typescript
export class RateLimitedService implements IAgentService {
  private lastRequestTime = 0;
  private requestCount = 0;
  private readonly RATE_LIMIT = 10; // requests per minute
  private readonly WINDOW = 60000; // 1 minute

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastRequestTime > this.WINDOW) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Check rate limit
    if (this.requestCount >= this.RATE_LIMIT) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      };
    }

    this.requestCount++;
    
    // Process the request
    return {
      success: true,
      data: await this.handleRequest(request),
      metadata: {
        remainingRequests: this.RATE_LIMIT - this.requestCount,
        resetTime: new Date(this.lastRequestTime + this.WINDOW).toISOString()
      }
    };
  }

  private async handleRequest(request: AgentRequest): Promise<any> {
    // Your logic here
  }

  async validateService(): Promise<boolean> {
    return true;
  }
}
```

## Testing Your Service

### Unit Testing

Create test files in `src/services/__tests__/`:

```typescript
// src/services/__tests__/myCustomService.test.ts
import { MyCustomService } from '../myCustomService';

describe('MyCustomService', () => {
  let service: MyCustomService;

  beforeEach(() => {
    service = new MyCustomService();
  });

  test('should process valid request', async () => {
    const request = {
      jobId: 'test-123',
      buyer: '0xBuyer',
      params: { data: 'test' },
      timestamp: Date.now()
    };

    const response = await service.processRequest(request);
    
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('should handle invalid request', async () => {
    const request = {
      jobId: 'test-456',
      buyer: '0xBuyer',
      params: {},
      timestamp: Date.now()
    };

    const response = await service.processRequest(request);
    
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });
});
```

### Integration Testing

Test with mock buyer:

```bash
# Enable mock buyer
ENABLE_MOCK_BUYER=true pnpm run dev

# Or use the shortcut
pnpm run dev:mock
```

## Best Practices

1. **Input Validation**: Always validate request parameters
2. **Error Handling**: Return clear error messages
3. **Logging**: Use the Logger utility for debugging
4. **Timeouts**: Implement timeouts for external calls
5. **Caching**: Cache expensive operations when appropriate
6. **Rate Limiting**: Protect against abuse
7. **Monitoring**: Track performance metrics
8. **Documentation**: Document your service's API

## Next Steps

- [Configuration Guide](./configuration.md) - Fine-tune your settings
- [Troubleshooting](./troubleshooting.md) - Debug common issues
- [Deployment Guide](./deployment.md) - Deploy to production