import axios from 'axios';
import { config } from '../config';
import { Logger } from '../utils/logger';

/**
 * Agent Service Interface
 * Implement this interface to define your agent's functionality
 */
export interface IAgentService {
  /**
   * Process a request from a buyer
   * @param request The request data from the buyer
   * @returns The response to send back to the buyer
   */
  processRequest(request: AgentRequest): Promise<AgentResponse>;
  
  /**
   * Validate that the service is ready
   * @returns True if the service is ready to accept requests
   */
  validateService(): Promise<boolean>;
}

/**
 * Request structure from buyers
 */
export interface AgentRequest {
  jobId: string;
  buyer: string;
  params?: Record<string, any>;
  timestamp: number;
}

/**
 * Response structure to buyers
 */
export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Default implementation of the Agent Service
 * This calls your configured API endpoint
 */
export class DefaultAgentService implements IAgentService {
  private logger = Logger;
  
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logger.info(`Processing request for job ${request.jobId}`);
      
      // Call your API endpoint
      const response = await axios.post(
        config.apiEndpoint,
        {
          jobId: request.jobId,
          buyer: request.buyer,
          ...request.params
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
          },
          timeout: 30000
        }
      );
      
      this.logger.info(`Request processed successfully for job ${request.jobId}`);
      
      return {
        success: true,
        data: response.data,
        metadata: {
          processedAt: new Date().toISOString(),
          serviceVersion: '1.0.0'
        }
      };
    } catch (error) {
      this.logger.error(`Error processing request for job ${request.jobId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  async validateService(): Promise<boolean> {
    try {
      // Optionally validate that your API endpoint is reachable
      if (config.apiEndpoint.startsWith('http')) {
        const response = await axios.get(config.apiEndpoint + '/health', {
          timeout: 5000,
          validateStatus: () => true
        });
        return response.status < 500;
      }
      return true;
    } catch (error) {
      this.logger.warn('Service validation failed:', error);
      return false;
    }
  }
}

/**
 * Custom Agent Service Example
 * Extend this class to implement your own logic
 */
export class CustomAgentService implements IAgentService {
  private logger = Logger;
  
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logger.info(`Processing custom request for job ${request.jobId}`);
      
      // Implement your custom logic here
      // Example: Process data, call APIs, run ML models, etc.
      
      // For demonstration, we'll just echo the request
      const result = {
        message: `Processed request from ${request.buyer}`,
        requestParams: request.params,
        timestamp: new Date().toISOString()
      };
      
      return {
        success: true,
        data: result,
        metadata: {
          processedAt: new Date().toISOString(),
          serviceVersion: '1.0.0'
        }
      };
    } catch (error) {
      this.logger.error(`Error in custom service for job ${request.jobId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  async validateService(): Promise<boolean> {
    // Implement your validation logic
    return true;
  }
}