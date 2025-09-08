/**
 * @fileoverview Agent service implementations for processing ACP job requests.
 * Provides both a default API-based service and a customizable service template.
 *
 * @author ACP Integration Boilerplate
 * @license MIT
 */

import axios, {AxiosError, AxiosResponse} from 'axios';
import {config} from '../config';
import {Logger} from '../utils/logger';

/**
 * Agent Service Interface that all service implementations must follow.
 *
 * Implement this interface to define custom agent functionality.
 * The service processes requests from buyers and returns appropriate responses.
 *
 * @interface IAgentService
 */
export interface IAgentService {
  /**
   * Processes a request from a buyer through the ACP network.
   *
   * This method should:
   * 1. Validate the incoming request
   * 2. Perform the requested service
   * 3. Return a properly formatted response
   *
   * @param {AgentRequest} request - The request data from the buyer
   * @returns {Promise<AgentResponse>} The response to send back to the buyer
   */
  processRequest(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Validates that the service is ready to accept requests.
   *
   * This method can check:
   * - API endpoint availability
   * - Required resources or models are loaded
   * - Configuration is valid
   *
   * @returns {Promise<boolean>} True if the service is ready, false otherwise
   */
  validateService(): Promise<boolean>;
}

/**
 * Structure of requests received from buyers through ACP.
 *
 * @interface AgentRequest
 */
export interface AgentRequest {
  /** Unique identifier for the job */
  jobId: string;

  /** Wallet address of the buyer requesting the service */
  buyer: string;

  /** Custom parameters provided by the buyer */
  params?: Record<string, any>;

  /** Unix timestamp when the request was created */
  timestamp: number;
}

/**
 * Structure of responses sent back to buyers through ACP.
 *
 * @interface AgentResponse
 */
export interface AgentResponse {
  /** Whether the request was processed successfully */
  success: boolean;

  /** The result data to return to the buyer (only if success is true) */
  data?: any;

  /** Error message explaining failure (only if success is false) */
  error?: string;

  /** Additional metadata about the processing */
  metadata?: Record<string, any>;
}

/**
 * Default implementation of the Agent Service that forwards requests to an external API.
 *
 * This implementation is suitable for agents that:
 * - Process requests through an existing API endpoint
 * - Need a simple pass-through to external services
 * - Want to leverage existing backend infrastructure
 *
 * Configuration is loaded from environment variables:
 * - API_ENDPOINT: The URL to forward requests to
 * - API_KEY: Optional authentication key for the API
 *
 * @class DefaultAgentService
 * @implements {IAgentService}
 */
export class DefaultAgentService implements IAgentService {
  /** Logger instance for this service */
  private readonly logger = Logger;

  /** Axios timeout for API calls in milliseconds */
  private readonly apiTimeout = 30000;

  /**
   * Processes a request by forwarding it to the configured API endpoint.
   *
   * The method:
   * 1. Constructs a request payload with job details
   * 2. Sends POST request to the configured API endpoint
   * 3. Handles response and errors appropriately
   * 4. Returns formatted response for ACP delivery
   *
   * @param {AgentRequest} request - The request from the buyer
   * @returns {Promise<AgentResponse>} The processed response
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logger.info(`Processing request for job ${request.jobId}`);

      // Validate required configuration
      if (!config.apiEndpoint) {
        throw new Error('API_ENDPOINT not configured');
      }

      // Construct the request payload
      const payload = {
        jobId: request.jobId,
        buyer: request.buyer,
        ...request.params,
      };

      // Log the outgoing request if API output logging is enabled
      if (config.logApiOutput) {
        this.logger.logApiData('Sending request to API:', payload);
      }

      // Make the API request with appropriate headers and timeout
      const response: AxiosResponse = await axios.post(
        config.apiEndpoint,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            // Add authorization header if API key is configured
            ...(config.apiKey ? {'Authorization': `Bearer ${config.apiKey}`} : {}),
          },
          timeout: this.apiTimeout,
        }
      );

      // Log the API response if output logging is enabled
      if (config.logApiOutput) {
        this.logger.logApiData('API response received:', response.data);
      }

      this.logger.info(`Request processed successfully for job ${request.jobId}`);

      // Return successful response with API data
      return {
        success: true,
        data: response.data,
        metadata: {
          processedAt: new Date().toISOString(),
          serviceVersion: '1.0.0',
          statusCode: response.status,
        },
      };
    } catch (error) {
      // Handle and log errors appropriately
      this.logger.error(`Error processing request for job ${request.jobId}:`, error);

      // Extract meaningful error message
      let errorMessage = 'Unknown error occurred';
      if (error instanceof AxiosError) {
        // Handle axios-specific errors
        if (error.response) {
          // Server responded with error status
          errorMessage = `API error: ${error.response.status} - ${
            error.response.data?.message || error.response.statusText
          }`;
        } else if (error.request) {
          // Request was made but no response received
          errorMessage = 'API request failed: No response received';
        } else {
          // Error in request setup
          errorMessage = `API request setup error: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Return error response
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validates that the API endpoint is reachable and healthy.
   *
   * Attempts to call a health check endpoint to verify:
   * - Network connectivity to the API
   * - API is running and responsive
   * - Authentication (if configured) is working
   *
   * @returns {Promise<boolean>} True if validation succeeds, false otherwise
   */
  async validateService(): Promise<boolean> {
    try {
      // Only validate HTTP/HTTPS endpoints
      if (!config.apiEndpoint.startsWith('http')) {
        this.logger.warn('API endpoint does not start with http/https, skipping validation');
        return true;
      }

      // Attempt to reach a health endpoint
      // Many APIs provide /health or /status endpoints
      const healthUrl = new URL(config.apiEndpoint);
      healthUrl.pathname = healthUrl.pathname.replace(/\/$/, '') + '/health';

      const response = await axios.get(healthUrl.toString(), {
        timeout: 5000,
        validateStatus: () => true, // Accept any status code
        headers: config.apiKey ? {'Authorization': `Bearer ${config.apiKey}`} : {},
      });

      // Consider the service valid if we get any response
      const isValid = response.status < 500;

      if (isValid) {
        this.logger.info('Service validation successful');
      } else {
        this.logger.warn(`Service validation warning: API returned status ${response.status}`);
      }

      return isValid;
    } catch (error) {
      // Log validation failure but don't throw
      // This allows the service to start even if validation fails
      this.logger.warn('Service validation failed:', error);
      return false;
    }
  }
}

/**
 * Custom Agent Service template for implementing your own agent logic.
 *
 * Extend or modify this class to:
 * - Process data locally without external APIs
 * - Implement complex business logic
 * - Integrate with databases or ML models
 * - Perform multi-step operations
 *
 * Example use cases:
 * - AI model inference
 * - Data transformation and analysis
 * - Content generation
 * - Web3 interactions
 *
 * @class CustomAgentService
 * @implements {IAgentService}
 */
export class CustomAgentService implements IAgentService {
  /** Logger instance for this service */
  private readonly logger = Logger;

  /**
   * Processes requests with custom logic.
   *
   * This is a template method that you should replace with your actual
   * implementation. Current implementation is a simple echo service
   * for demonstration purposes.
   *
   * @param {AgentRequest} request - The request from the buyer
   * @returns {Promise<AgentResponse>} The processed response
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logger.info(`Processing custom request for job ${request.jobId}`);

      // ================================================================
      // IMPLEMENT YOUR CUSTOM LOGIC HERE
      // ================================================================
      
      // Example: Validate required parameters
      if (!request.params) {
        return {
          success: false,
          error: 'No parameters provided',
        };
      }

      // Example: Process based on request type
      const requestType = request.params.type;
      let result: any;

      switch (requestType) {
        case 'echo':
          // Simple echo service
          result = {
            message: `Echo: ${request.params.message || 'No message'}`,
            buyer: request.buyer,
          };
          break;

        case 'analyze':
          // Example data analysis
          result = await this.analyzeData(request.params.data);
          break;

        case 'generate':
          // Example content generation
          result = await this.generateContent(request.params);
          break;

        default:
          // Default behavior - echo the request
          result = {
            message: `Processed request from ${request.buyer}`,
            requestParams: request.params,
            timestamp: new Date().toISOString(),
          };
      }

      // Return successful response
      return {
        success: true,
        data: result,
        metadata: {
          processedAt: new Date().toISOString(),
          serviceVersion: '1.0.0',
          processingType: requestType || 'default',
        },
      };
    } catch (error) {
      // Handle errors gracefully
      this.logger.error(`Error in custom service for job ${request.jobId}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Example method for data analysis operations.
   *
   * Replace this with your actual data processing logic.
   *
   * @param {any} data - The data to analyze
   * @returns {Promise<any>} Analysis results
   * @private
   */
  private async analyzeData(data: any): Promise<any> {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Example analysis
    if (Array.isArray(data)) {
      return {
        count: data.length,
        summary: `Analyzed ${data.length} items`,
        firstItem: data[0],
        lastItem: data[data.length - 1],
      };
    }

    return {
      type: typeof data,
      value: data,
      analysis: 'Basic analysis completed',
    };
  }

  /**
   * Example method for content generation.
   *
   * Replace this with your actual generation logic.
   *
   * @param {Record<string, any>} params - Generation parameters
   * @returns {Promise<any>} Generated content
   * @private
   */
  private async generateContent(params: Record<string, any>): Promise<any> {
    // Simulate async generation
    await new Promise(resolve => setTimeout(resolve, 200));

    const {prompt, style, length} = params;

    return {
      generated: true,
      content: `Generated content based on: ${prompt || 'no prompt'}`,
      style: style || 'default',
      length: length || 'medium',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validates that the custom service is ready.
   *
   * Implement checks for:
   * - Required resources are available
   * - Connections to databases or services
   * - Models or data files are loaded
   *
   * @returns {Promise<boolean>} True if service is ready
   */
  async validateService(): Promise<boolean> {
    try {
      // Add your validation logic here
      // Examples:
      // - Check database connection
      // - Verify ML model is loaded
      // - Ensure required files exist
      // - Test external service connectivity

      this.logger.info('Custom service validation successful');
      return true;
    } catch (error) {
      this.logger.error('Custom service validation failed:', error);
      return false;
    }
  }
}