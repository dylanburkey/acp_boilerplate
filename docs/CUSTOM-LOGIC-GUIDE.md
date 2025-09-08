# 🛠️ Custom Logic Implementation Guide

**How to add your own business logic to your ACP agent**

This guide shows you exactly how to customize your agent's behavior, whether you're a beginner or experienced developer.

## 🎯 Understanding Service Types

Your agent can work in four different ways:

### 1. **API Service** (Pass-Through)
- Forwards requests to your existing web service
- Simplest option if you already have an API
- No custom code needed

### 2. **Custom Logic Service** (Most Flexible)
- Your business logic runs directly in the agent
- Complete control over processing
- Best for unique requirements

### 3. **AI Service** (LangChain Integration)
- Uses OpenAI for intelligent responses
- Great for content, analysis, conversation
- Minimal setup required

### 4. **Example Services** (Learning/Testing)
- Pre-built math and data analysis
- Good for understanding the patterns
- Easy to modify and extend

## 📁 File Structure Overview

```
src/
├── index.ts                    # Main agent (you rarely modify this)
├── config/index.ts            # Configuration (environment variables)
├── services/                  # YOUR BUSINESS LOGIC GOES HERE
│   ├── agentService.ts        # Interface and default services
│   ├── langChainAgentService.ts # AI-powered service
│   └── yourCustomService.ts   # YOUR CUSTOM SERVICE
└── utils/                     # Helper functions (rarely modified)
```

**Key Point:** You'll mainly work in the `services/` folder.

## 🚀 Quick Start: Modify Existing Service

The easiest way to add custom logic is to modify the `CustomAgentService` class.

### Step 1: Open the File
Open `src/services/agentService.ts` and find the `CustomAgentService` class (around line 270).

### Step 2: Modify the Processing Logic
Find this section:
```typescript
// TODO: Implement your custom business logic here
// This is where you would add your agent's specific functionality
```

Replace the example code with your logic:

```typescript
// Example: Text Analysis Service
const text = request.params.text || '';
const analysisType = request.params.analysisType || 'basic';

let result: any;

switch (analysisType) {
  case 'sentiment':
    result = await this.analyzeSentiment(text);
    break;
  
  case 'keywords':
    result = await this.extractKeywords(text);
    break;
    
  case 'summary':
    result = await this.summarizeText(text);
    break;
    
  default:
    result = {
      error: 'Unsupported analysis type',
      supportedTypes: ['sentiment', 'keywords', 'summary']
    };
}
```

### Step 3: Add Your Helper Methods
Add your custom methods at the bottom of the class:

```typescript
/**
 * Analyzes sentiment of text
 */
private async analyzeSentiment(text: string): Promise<any> {
  // Your sentiment analysis logic here
  const words = text.toLowerCase().split(' ');
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love'];
  const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'worst'];
  
  const positiveCount = words.filter(w => positiveWords.includes(w)).length;
  const negativeCount = words.filter(w => negativeWords.includes(w)).length;
  
  let sentiment = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  if (negativeCount > positiveCount) sentiment = 'negative';
  
  return {
    sentiment,
    confidence: Math.abs(positiveCount - negativeCount) / words.length,
    positiveWords: positiveCount,
    negativeWords: negativeCount,
    totalWords: words.length
  };
}
```

## 🏗️ Create Your Own Service Class

For more complex logic, create your own service class:

### Step 1: Create New File
Create `src/services/myBusinessService.ts`:

```typescript
/**
 * My Custom Business Service
 * Replace this with your actual business logic
 */

import { IAgentService, AgentRequest, AgentResponse } from './agentService';
import { config } from '../config';
import { Logger } from '../utils/logger';

export class MyBusinessService implements IAgentService {
  private readonly logger = Logger;

  /**
   * Main processing method - this is where your business logic goes
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing custom business request for job ${request.jobId}`);

      // Validate request scope first
      if (!this.validateRequestScope(request)) {
        return {
          success: false,
          error: 'Request outside service scope',
          errorType: 'SCOPE_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: false
          }
        };
      }

      // Extract parameters
      const params = request.params || {};
      const requestType = params.type || 'default';

      // YOUR BUSINESS LOGIC STARTS HERE
      let result: any;

      switch (requestType) {
        case 'invoice-analysis':
          result = await this.analyzeInvoice(params);
          break;
          
        case 'customer-segmentation':
          result = await this.segmentCustomers(params);
          break;
          
        case 'price-optimization':
          result = await this.optimizePricing(params);
          break;
          
        default:
          return {
            success: false,
            error: `Unsupported request type: ${requestType}`,
            errorType: 'VALIDATION_ERROR'
          };
      }

      // Return success response
      return {
        success: true,
        data: result,
        metadata: {
          processingTime: `${Date.now() - startTime}ms`,
          serviceVersion: '1.0.0',
          requestType: requestType,
          withinScope: true
        }
      };

    } catch (error) {
      this.logger.error(`Error processing business request:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'PROCESSING_ERROR',
        metadata: {
          processingTime: `${Date.now() - startTime}ms`
        }
      };
    }
  }

  /**
   * Validate that requests are within your service scope
   */
  validateRequestScope(request: AgentRequest): boolean {
    // Basic validation
    if (!request.jobId || !request.params) {
      return false;
    }

    // Define what types of requests you accept
    const allowedTypes = [
      'invoice-analysis',
      'customer-segmentation', 
      'price-optimization'
    ];

    const requestType = request.params.type;
    if (requestType && !allowedTypes.includes(requestType)) {
      this.logger.warn(`Unsupported request type: ${requestType}`);
      return false;
    }

    // Add more validation as needed
    // Example: Check file size limits, data format, etc.

    return true;
  }

  /**
   * Check if service is ready
   */
  async validateService(): Promise<boolean> {
    try {
      // Add any startup checks here
      // Example: Check database connection, API keys, etc.
      
      this.logger.info('Custom business service validation successful');
      return true;
    } catch (error) {
      this.logger.error('Service validation failed:', error);
      return false;
    }
  }

  // YOUR CUSTOM BUSINESS METHODS GO HERE

  /**
   * Example: Analyze invoice data
   */
  private async analyzeInvoice(params: any): Promise<any> {
    const { invoiceData, analysisType } = params;
    
    // Validate input
    if (!invoiceData) {
      throw new Error('Invoice data is required');
    }

    // Your invoice analysis logic
    const analysis = {
      totalAmount: this.calculateTotal(invoiceData.items || []),
      itemCount: invoiceData.items?.length || 0,
      dueDate: invoiceData.dueDate,
      status: this.determineInvoiceStatus(invoiceData),
      recommendations: this.generateInvoiceRecommendations(invoiceData)
    };

    return {
      analysis,
      processedAt: new Date().toISOString(),
      invoiceId: invoiceData.id || 'unknown'
    };
  }

  /**
   * Example: Customer segmentation
   */
  private async segmentCustomers(params: any): Promise<any> {
    const { customers, segmentationType } = params;
    
    if (!Array.isArray(customers)) {
      throw new Error('Customer data must be an array');
    }

    // Your segmentation logic
    const segments = {
      highValue: customers.filter(c => c.totalSpent > 1000),
      medium: customers.filter(c => c.totalSpent > 100 && c.totalSpent <= 1000),
      lowValue: customers.filter(c => c.totalSpent <= 100),
      recent: customers.filter(c => new Date(c.lastPurchase) > new Date('2024-01-01'))
    };

    return {
      segments,
      summary: {
        total: customers.length,
        highValue: segments.highValue.length,
        medium: segments.medium.length,
        lowValue: segments.lowValue.length,
        recent: segments.recent.length
      },
      recommendations: this.generateSegmentRecommendations(segments)
    };
  }

  /**
   * Example: Price optimization
   */
  private async optimizePricing(params: any): Promise<any> {
    const { products, marketData, strategy } = params;
    
    // Your pricing logic
    const optimizedPricing = products.map((product: any) => ({
      ...product,
      recommendedPrice: this.calculateOptimalPrice(product, marketData),
      priceChange: this.calculatePriceChange(product),
      reasoning: this.generatePricingReasoning(product, marketData)
    }));

    return {
      optimizedProducts: optimizedPricing,
      summary: {
        totalProducts: products.length,
        averagePriceIncrease: this.calculateAveragePriceChange(optimizedPricing),
        estimatedRevenueImpact: this.estimateRevenueImpact(optimizedPricing)
      },
      strategy: strategy || 'profit-maximization'
    };
  }

  // Helper methods for your business logic
  private calculateTotal(items: any[]): number {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  private determineInvoiceStatus(invoice: any): string {
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    
    if (invoice.paid) return 'paid';
    if (dueDate < today) return 'overdue';
    if (dueDate.getTime() - today.getTime() < 7 * 24 * 60 * 60 * 1000) return 'due-soon';
    return 'current';
  }

  private generateInvoiceRecommendations(invoice: any): string[] {
    const recommendations: string[] = [];
    
    if (this.determineInvoiceStatus(invoice) === 'overdue') {
      recommendations.push('Send payment reminder to customer');
    }
    
    if (invoice.items && invoice.items.length > 10) {
      recommendations.push('Consider consolidating line items for clarity');
    }
    
    return recommendations;
  }

  private generateSegmentRecommendations(segments: any): string[] {
    const recommendations: string[] = [];
    
    if (segments.highValue.length > 0) {
      recommendations.push('Create VIP program for high-value customers');
    }
    
    if (segments.lowValue.length > segments.highValue.length * 3) {
      recommendations.push('Focus on converting low-value to medium-value customers');
    }
    
    return recommendations;
  }

  private calculateOptimalPrice(product: any, marketData: any): number {
    // Simplified pricing algorithm
    const basePrice = product.currentPrice || 0;
    const demandMultiplier = marketData.demand || 1;
    const competitorAvg = marketData.averageCompetitorPrice || basePrice;
    
    return Math.round(basePrice * demandMultiplier * 0.9 + competitorAvg * 0.1);
  }

  private calculatePriceChange(product: any): number {
    const current = product.currentPrice || 0;
    const recommended = product.recommendedPrice || current;
    return ((recommended - current) / current) * 100;
  }

  private generatePricingReasoning(product: any, marketData: any): string {
    // Generate explanation for pricing decision
    return `Based on market demand of ${marketData.demand || 1}x and competitor analysis`;
  }

  private calculateAveragePriceChange(products: any[]): number {
    const changes = products.map(p => this.calculatePriceChange(p));
    return changes.reduce((sum, change) => sum + change, 0) / changes.length;
  }

  private estimateRevenueImpact(products: any[]): number {
    // Simplified revenue impact calculation
    return products.reduce((sum, p) => sum + (p.recommendedPrice - p.currentPrice) * p.expectedVolume, 0);
  }
}
```

### Step 2: Update Main Agent
Open `src/index.ts` and find this line (around line 82):
```typescript
this.agentService = new DefaultAgentService();
```

Replace it with:
```typescript
import { MyBusinessService } from './services/myBusinessService';
// ...
this.agentService = new MyBusinessService();
```

## 🤖 Working with Different Data Types

### Processing Text Data
```typescript
private async processText(text: string, operation: string): Promise<any> {
  switch (operation) {
    case 'word-count':
      return { words: text.split(' ').length };
      
    case 'character-count':
      return { characters: text.length };
      
    case 'extract-emails':
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      return { emails: text.match(emailRegex) || [] };
      
    default:
      throw new Error(`Unsupported text operation: ${operation}`);
  }
}
```

### Processing Numerical Data
```typescript
private async processNumbers(data: number[], operation: string): Promise<any> {
  switch (operation) {
    case 'statistics':
      return {
        count: data.length,
        sum: data.reduce((a, b) => a + b, 0),
        average: data.reduce((a, b) => a + b, 0) / data.length,
        min: Math.min(...data),
        max: Math.max(...data),
        median: this.calculateMedian(data)
      };
      
    case 'sort':
      return { sorted: [...data].sort((a, b) => a - b) };
      
    default:
      throw new Error(`Unsupported number operation: ${operation}`);
  }
}

private calculateMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}
```

### Processing File Data
```typescript
private async processFile(fileData: any, operation: string): Promise<any> {
  // Assuming fileData contains base64 encoded file content
  const { content, filename, mimeType } = fileData;
  
  switch (operation) {
    case 'analyze-csv':
      return await this.analyzeCsvData(content);
      
    case 'extract-text':
      return await this.extractTextFromFile(content, mimeType);
      
    case 'validate-format':
      return { valid: this.validateFileFormat(filename, mimeType) };
      
    default:
      throw new Error(`Unsupported file operation: ${operation}`);
  }
}

private async analyzeCsvData(csvContent: string): Promise<any> {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  const dataRows = lines.slice(1).filter(line => line.trim());
  
  return {
    headers,
    rowCount: dataRows.length,
    columnCount: headers.length,
    sample: dataRows.slice(0, 3), // First 3 rows as sample
    summary: `CSV file with ${dataRows.length} rows and ${headers.length} columns`
  };
}
```

## 🔌 Integrating External APIs

### HTTP API Integration
```typescript
import axios from 'axios';

private async callExternalAPI(data: any): Promise<any> {
  try {
    const response = await axios.post('https://api.example.com/process', {
      data: data,
      apiKey: process.env.EXTERNAL_API_KEY
    }, {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ACP-Agent/1.0'
      }
    });
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.request) {
        throw new Error('API request failed - no response received');
      }
    }
    throw error;
  }
}
```

### Database Integration
```typescript
// Example with a simple database query
private async queryDatabase(query: string, params: any[]): Promise<any> {
  // This is pseudocode - replace with your actual database library
  try {
    const connection = await this.getDatabaseConnection();
    const result = await connection.query(query, params);
    return result;
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
}

private async getDatabaseConnection(): Promise<any> {
  // Return your database connection
  // Could be MySQL, PostgreSQL, MongoDB, etc.
}
```

## 📊 Error Handling Best Practices

### Comprehensive Error Handling
```typescript
async processRequest(request: AgentRequest): Promise<AgentResponse> {
  const startTime = Date.now();
  
  try {
    // Validate input
    const validation = this.validateInput(request.params);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        errorType: 'VALIDATION_ERROR',
        metadata: {
          processingTime: `${Date.now() - startTime}ms`,
          validationErrors: validation.errors
        }
      };
    }
    
    // Process with timeout
    const result = await Promise.race([
      this.performProcessing(request.params),
      this.timeoutPromise(30000) // 30 second timeout
    ]);
    
    return {
      success: true,
      data: result,
      metadata: {
        processingTime: `${Date.now() - startTime}ms`
      }
    };
    
  } catch (error) {
    return this.handleError(error, startTime);
  }
}

private validateInput(params: any): { valid: boolean; error?: string; errors?: string[] } {
  const errors: string[] = [];
  
  if (!params) {
    return { valid: false, error: 'No parameters provided' };
  }
  
  // Add your specific validations
  if (!params.requiredField) {
    errors.push('requiredField is missing');
  }
  
  if (params.numericField && isNaN(params.numericField)) {
    errors.push('numericField must be a number');
  }
  
  if (errors.length > 0) {
    return { 
      valid: false, 
      error: `Validation failed: ${errors.join(', ')}`,
      errors 
    };
  }
  
  return { valid: true };
}

private timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Processing timeout')), ms);
  });
}

private handleError(error: any, startTime: number): AgentResponse {
  let errorType: AgentResponse['errorType'] = 'PROCESSING_ERROR';
  let errorMessage = 'Unknown error occurred';
  
  if (error instanceof Error) {
    errorMessage = error.message;
    
    if (error.message.includes('timeout')) {
      errorType = 'TIMEOUT_ERROR';
    } else if (error.message.includes('validation')) {
      errorType = 'VALIDATION_ERROR';
    } else if (error.message.includes('API') || error.message.includes('service')) {
      errorType = 'SERVICE_ERROR';
    }
  }
  
  this.logger.error('Processing error:', error);
  
  return {
    success: false,
    error: errorMessage,
    errorType,
    metadata: {
      processingTime: `${Date.now() - startTime}ms`,
      errorDetails: error instanceof Error ? error.stack : undefined
    }
  };
}
```

## 🧪 Testing Your Custom Logic

### Unit Testing
Create `tests/myBusinessService.test.ts`:

```typescript
import { MyBusinessService } from '../src/services/myBusinessService';
import { AgentRequest } from '../src/services/agentService';

describe('MyBusinessService', () => {
  let service: MyBusinessService;
  
  beforeEach(() => {
    service = new MyBusinessService();
  });
  
  test('should process invoice analysis request', async () => {
    const request: AgentRequest = {
      jobId: 'test-123',
      buyer: '0xtest',
      timestamp: Date.now(),
      params: {
        type: 'invoice-analysis',
        invoiceData: {
          id: 'inv-001',
          items: [
            { price: 100, quantity: 2 },
            { price: 50, quantity: 1 }
          ],
          dueDate: '2024-12-31'
        }
      }
    };
    
    const response = await service.processRequest(request);
    
    expect(response.success).toBe(true);
    expect(response.data.analysis.totalAmount).toBe(250);
  });
  
  test('should validate request scope correctly', () => {
    const validRequest: AgentRequest = {
      jobId: 'test-123',
      buyer: '0xtest', 
      timestamp: Date.now(),
      params: { type: 'invoice-analysis' }
    };
    
    expect(service.validateRequestScope(validRequest)).toBe(true);
    
    const invalidRequest: AgentRequest = {
      jobId: 'test-123',
      buyer: '0xtest',
      timestamp: Date.now(), 
      params: { type: 'unsupported-type' }
    };
    
    expect(service.validateRequestScope(invalidRequest)).toBe(false);
  });
});
```

### Manual Testing
```typescript
// Create a test script: scripts/test-service.ts
import { MyBusinessService } from '../src/services/myBusinessService';

async function testService() {
  const service = new MyBusinessService();
  
  const testRequest = {
    jobId: 'test-001',
    buyer: '0xtest',
    timestamp: Date.now(),
    params: {
      type: 'invoice-analysis',
      invoiceData: {
        id: 'test-invoice',
        items: [{ price: 100, quantity: 1 }],
        dueDate: '2024-12-31'
      }
    }
  };
  
  console.log('Testing service...');
  const response = await service.processRequest(testRequest);
  console.log('Response:', JSON.stringify(response, null, 2));
}

testService().catch(console.error);
```

Run with: `npx tsx scripts/test-service.ts`

## 🚀 Deployment and Monitoring

### Environment Variables
Add any custom configuration to `.env`:

```env
# Your custom service configuration
MY_SERVICE_API_KEY=your_api_key
DATABASE_URL=your_database_url
EXTERNAL_API_ENDPOINT=https://api.example.com
MAX_FILE_SIZE=10485760  # 10MB in bytes
PROCESSING_TIMEOUT=30000 # 30 seconds
```

Access in your code:
```typescript
const apiKey = process.env.MY_SERVICE_API_KEY;
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '5242880'); // 5MB default
```

### Logging
```typescript
// Log important events
this.logger.info('Processing started', { jobId: request.jobId, type: request.params.type });
this.logger.debug('Detailed processing info', { data: sanitizedData });
this.logger.warn('Unusual condition detected', { condition: 'high-load' });
this.logger.error('Processing failed', { error: error.message, jobId: request.jobId });
```

### Performance Monitoring
```typescript
private async processWithMetrics(params: any): Promise<any> {
  const startTime = Date.now();
  let operation = 'unknown';
  
  try {
    operation = params.type || 'default';
    const result = await this.performProcessing(params);
    
    // Log success metrics
    this.logger.info('Processing completed', {
      operation,
      duration: Date.now() - startTime,
      success: true
    });
    
    return result;
  } catch (error) {
    // Log failure metrics
    this.logger.error('Processing failed', {
      operation,
      duration: Date.now() - startTime,
      success: false,
      error: error.message
    });
    
    throw error;
  }
}
```

## 📝 Documentation for Your Service

Create `docs/MY-SERVICE-GUIDE.md`:

```markdown
# My Business Service Guide

## Overview
This service provides [describe what your service does].

## Supported Operations
- `invoice-analysis`: Analyzes invoice data and provides insights
- `customer-segmentation`: Segments customers based on behavior
- `price-optimization`: Optimizes product pricing

## Input Format
```json
{
  "type": "invoice-analysis",
  "invoiceData": {
    "id": "inv-001",
    "items": [
      { "price": 100, "quantity": 2 }
    ],
    "dueDate": "2024-12-31"
  }
}
```

## Output Format
```json
{
  "analysis": {
    "totalAmount": 200,
    "itemCount": 1,
    "status": "current"
  },
  "recommendations": ["..."]
}
```

## Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `PROCESSING_ERROR`: Processing logic error
- `TIMEOUT_ERROR`: Processing took too long
- `SERVICE_ERROR`: External service error

## Limitations
- Maximum file size: 10MB
- Processing timeout: 30 seconds
- Supported file types: CSV, JSON, TXT
```

## 🔄 Continuous Improvement

### Collect Feedback
```typescript
private async logJobMetrics(jobId: string, success: boolean, duration: number, error?: string) {
  // Log to your analytics system
  const metrics = {
    jobId,
    success,
    duration,
    error,
    timestamp: new Date().toISOString(),
    serviceVersion: '1.0.0'
  };
  
  // Send to analytics service or log file
  this.logger.info('Job metrics', metrics);
}
```

### A/B Testing
```typescript
private async processWithABTest(params: any): Promise<any> {
  // Simple A/B testing
  const useNewAlgorithm = Math.random() < 0.5; // 50/50 split
  
  if (useNewAlgorithm) {
    this.logger.info('Using new algorithm', { jobId: params.jobId });
    return await this.processWithNewAlgorithm(params);
  } else {
    this.logger.info('Using old algorithm', { jobId: params.jobId });
    return await this.processWithOldAlgorithm(params);
  }
}
```

### Performance Optimization
```typescript
// Cache expensive operations
private cache = new Map<string, any>();

private async processWithCache(key: string, processor: () => Promise<any>): Promise<any> {
  if (this.cache.has(key)) {
    this.logger.debug('Cache hit', { key });
    return this.cache.get(key);
  }
  
  const result = await processor();
  this.cache.set(key, result);
  
  // Cleanup old cache entries
  if (this.cache.size > 1000) {
    const firstKey = this.cache.keys().next().value;
    this.cache.delete(firstKey);
  }
  
  return result;
}
```

## 🎯 Next Steps

1. **Choose Your Approach**: API, Custom Logic, AI, or Example service
2. **Implement Core Logic**: Start with one operation and expand
3. **Add Error Handling**: Handle edge cases gracefully
4. **Test Thoroughly**: Use both unit tests and manual testing
5. **Deploy and Monitor**: Watch for errors and performance issues
6. **Iterate and Improve**: Based on real usage patterns

Remember: Start simple and add complexity gradually. A working simple service is better than a complex broken one!

Need help? Check the other documentation files or ask in the community Discord.