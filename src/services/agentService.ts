/**
 * @fileoverview Agent service implementations for processing ACP job requests.
 * Provides both a default API-based service and a customizable service template.
 *
 * @author Dylan Burkey
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
  
  /**
   * Validates if a request matches the agent's service scope.
   * Helps prevent "mission drift" by ensuring requests align with agent capabilities.
   * 
   * @param {AgentRequest} request - The request to validate
   * @returns {boolean} True if request is within scope, false otherwise
   */
  validateRequestScope(request: AgentRequest): boolean;
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
  
  /** Error type for better error handling and debugging */
  errorType?: 'VALIDATION_ERROR' | 'PROCESSING_ERROR' | 'SCOPE_ERROR' | 'SERVICE_ERROR' | 'TIMEOUT_ERROR';

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
   * 1. Validates request scope to prevent mission drift
   * 2. Constructs a request payload with job details
   * 3. Sends POST request to the configured API endpoint
   * 4. Handles response and errors appropriately
   * 5. Returns formatted response for ACP delivery
   *
   * @param {AgentRequest} request - The request from the buyer
   * @returns {Promise<AgentResponse>} The processed response
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing request for job ${request.jobId}`);

      // First validate request scope to prevent mission drift
      if (!this.validateRequestScope(request)) {
        return {
          success: false,
          error: 'Request outside service scope - agent cannot process this type of request',
          errorType: 'SCOPE_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: false
          }
        };
      }

      // Validate required configuration
      if (!config.apiEndpoint) {
        return {
          success: false,
          error: 'API_ENDPOINT not configured',
          errorType: 'SERVICE_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: true
          }
        };
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

      // Make the API request with improved error handling
      const response: AxiosResponse = await axios.post(
        config.apiEndpoint,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `ACP-Agent/${config.serviceName}`,
            // Add authorization header if API key is configured
            ...(config.apiKey ? {'Authorization': `Bearer ${config.apiKey}`} : {}),
          },
          timeout: this.apiTimeout,
          validateStatus: (status) => status < 500 // Don't reject on client errors
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
          processingTime: `${Date.now() - startTime}ms`,
          withinScope: true
        },
      };
    } catch (error) {
      // Handle and log errors appropriately
      this.logger.error(`Error processing request for job ${request.jobId}:`, error);

      // Handle different types of errors with proper categorization
      let errorMessage = 'Unknown error occurred';
      let errorType: AgentResponse['errorType'] = 'PROCESSING_ERROR';
      
      if (error instanceof AxiosError) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout - API took too long to respond';
          errorType = 'TIMEOUT_ERROR';
        } else if (error.response) {
          // Server responded with error status
          const statusCode = error.response.status;
          errorMessage = `API error: ${statusCode} - ${
            error.response.data?.message || error.response.statusText
          }`;
          
          if (statusCode >= 400 && statusCode < 500) {
            errorType = 'VALIDATION_ERROR';
          } else if (statusCode >= 500) {
            errorType = 'SERVICE_ERROR';
          }
        } else if (error.request) {
          // Request was made but no response received
          errorMessage = 'API request failed: No response received - service may be unavailable';
          errorType = 'SERVICE_ERROR';
        } else {
          // Error in request setup
          errorMessage = `API request setup error: ${error.message}`;
          errorType = 'PROCESSING_ERROR';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        errorType = 'PROCESSING_ERROR';
      }

      // Return error response with type and metadata
      return {
        success: false,
        error: errorMessage,
        errorType,
        metadata: {
          processingTime: `${Date.now() - startTime}ms`,
          withinScope: true
        }
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
  
  /**
   * Validates if a request is within the agent's service scope.
   * Override this method in subclasses to implement custom scoping logic.
   *
   * This is crucial for preventing "mission drift" where agents process
   * requests outside their intended capabilities or service description.
   *
   * @param {AgentRequest} request - The request to validate
   * @returns {boolean} True if request is within scope, false otherwise
   */
  validateRequestScope(request: AgentRequest): boolean {
    // Basic validation - ensure request has required fields
    if (!request.jobId || !request.params) {
      this.logger.warn(`Request validation failed: Missing jobId or params for job ${request.jobId}`);
      return false;
    }

    // Add custom scope validation logic here based on your service capabilities
    // Example implementations:
    //
    // 1. Validate request type:
    // const requestType = request.params.type;
    // const allowedTypes = ['text-generation', 'data-analysis', 'translation'];
    // if (requestType && !allowedTypes.includes(requestType)) {
    //   this.logger.warn(`Request type '${requestType}' not supported by ${config.serviceName}`);
    //   return false;
    // }
    //
    // 2. Validate service category:
    // const category = request.params.category;
    // if (category && !config.serviceDescription.toLowerCase().includes(category.toLowerCase())) {
    //   this.logger.warn(`Request category '${category}' outside service scope`);
    //   return false;
    // }
    //
    // 3. Validate complexity or resource requirements:
    // const complexity = request.params.complexity || 'medium';
    // const maxComplexity = process.env.MAX_COMPLEXITY || 'high';
    // if (this.isComplexityTooHigh(complexity, maxComplexity)) {
    //   this.logger.warn(`Request complexity '${complexity}' exceeds agent capability`);
    //   return false;
    // }

    // Default: accept all requests (implement custom logic above for production use)
    return true;
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
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing custom request for job ${request.jobId}`);

      // First validate request scope to prevent mission drift
      if (!this.validateRequestScope(request)) {
        return {
          success: false,
          error: 'Request outside service scope - agent cannot process this type of request',
          errorType: 'SCOPE_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: false
          }
        };
      }

      // ================================================================
      // IMPLEMENT YOUR CUSTOM LOGIC HERE
      // ================================================================
      
      // Example: Validate required parameters
      if (!request.params) {
        return {
          success: false,
          error: 'No parameters provided',
          errorType: 'VALIDATION_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: true
          }
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
          processingTime: `${Date.now() - startTime}ms`,
          withinScope: true
        },
      };
    } catch (error) {
      // Handle errors gracefully with proper categorization
      this.logger.error(`Error in custom service for job ${request.jobId}:`, error);

      let errorType: AgentResponse['errorType'] = 'PROCESSING_ERROR';
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Categorize different types of errors
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          errorType = 'TIMEOUT_ERROR';
        } else if (error.message.includes('validation') || error.message.includes('invalid')) {
          errorType = 'VALIDATION_ERROR';
        } else if (error.message.includes('service') || error.message.includes('connection')) {
          errorType = 'SERVICE_ERROR';
        }
      }

      return {
        success: false,
        error: errorMessage,
        errorType,
        metadata: {
          processingTime: `${Date.now() - startTime}ms`,
          withinScope: true
        }
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
  
  /**
   * Validates if a request is within the agent's service scope.
   * Implement custom scoping logic specific to your agent's capabilities.
   *
   * This is crucial for preventing "mission drift" where agents process
   * requests outside their intended capabilities or service description.
   *
   * @param {AgentRequest} request - The request to validate
   * @returns {boolean} True if request is within scope, false otherwise
   */
  validateRequestScope(request: AgentRequest): boolean {
    // Basic validation - ensure request has required fields
    if (!request.jobId || !request.params) {
      this.logger.warn(`Request validation failed: Missing jobId or params for job ${request.jobId}`);
      return false;
    }

    // Example scope validation for the demo service:
    const requestType = request.params.type;
    
    // Only accept these specific request types for the demo service
    const allowedTypes = ['echo', 'analyze', 'generate'];
    
    if (requestType && !allowedTypes.includes(requestType)) {
      this.logger.warn(`Request type '${requestType}' not supported by custom agent service`);
      this.logger.info(`Supported types: ${allowedTypes.join(', ')}`);
      return false;
    }

    // Additional validation examples (customize for your agent):
    //
    // 1. Validate complexity limits:
    // const complexity = request.params.complexity || 'medium';
    // if (complexity === 'ultra-high') {
    //   this.logger.warn(`Request complexity '${complexity}' exceeds agent capability`);
    //   return false;
    // }
    //
    // 2. Validate data size limits:
    // const dataSize = request.params.data?.length || 0;
    // if (dataSize > 10000) {
    //   this.logger.warn(`Request data size ${dataSize} exceeds limit`);
    //   return false;
    // }
    //
    // 3. Validate service category alignment:
    // const category = request.params.category;
    // if (category && !config.serviceDescription.toLowerCase().includes(category.toLowerCase())) {
    //   this.logger.warn(`Request category '${category}' outside service scope`);
    //   return false;
    // }

    return true;
  }
}