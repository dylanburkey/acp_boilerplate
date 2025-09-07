/**
 * Simple Agent Example
 * 
 * This example shows how to create a basic agent that:
 * 1. Accepts requests from buyers
 * 2. Processes them with custom logic
 * 3. Returns results through ACP
 */

import { IAgentService, AgentRequest, AgentResponse } from '../src/services/agentService';

/**
 * Example: Math Service Agent
 * Performs mathematical operations requested by buyers
 */
export class MathAgentService implements IAgentService {
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { operation, a, b } = request.params || {};
      
      if (!operation || a === undefined || b === undefined) {
        return {
          success: false,
          error: 'Missing required parameters: operation, a, b'
        };
      }
      
      let result: number;
      
      switch (operation) {
        case 'add':
          result = a + b;
          break;
        case 'subtract':
          result = a - b;
          break;
        case 'multiply':
          result = a * b;
          break;
        case 'divide':
          if (b === 0) {
            return {
              success: false,
              error: 'Division by zero'
            };
          }
          result = a / b;
          break;
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`
          };
      }
      
      return {
        success: true,
        data: {
          operation,
          a,
          b,
          result,
          processedAt: new Date().toISOString()
        },
        metadata: {
          agentVersion: '1.0.0',
          processingTime: '1ms'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async validateService(): Promise<boolean> {
    // Service is always ready for math operations
    return true;
  }
}

/**
 * Example: Data Analysis Agent
 * Analyzes data provided by buyers
 */
export class DataAnalysisAgentService implements IAgentService {
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { data, analysisType } = request.params || {};
      
      if (!data || !Array.isArray(data)) {
        return {
          success: false,
          error: 'Data must be an array'
        };
      }
      
      const analysis: any = {
        count: data.length,
        sum: data.reduce((a, b) => a + b, 0),
        average: data.reduce((a, b) => a + b, 0) / data.length,
        min: Math.min(...data),
        max: Math.max(...data),
      };
      
      if (analysisType === 'detailed') {
        analysis.median = this.calculateMedian(data);
        analysis.standardDeviation = this.calculateStdDev(data);
      }
      
      return {
        success: true,
        data: {
          originalData: data,
          analysis,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }
  
  private calculateStdDev(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  async validateService(): Promise<boolean> {
    return true;
  }
}

/**
 * To use these examples:
 * 
 * 1. Import in src/index.ts:
 *    import { MathAgentService } from '../examples/simple-agent';
 * 
 * 2. Replace the service initialization:
 *    this.agentService = new MathAgentService();
 * 
 * 3. Run your agent:
 *    npm run dev
 */