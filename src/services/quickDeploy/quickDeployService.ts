/**
 * @fileoverview Quick Deploy Service for Kosher Capital's AI Trading Agent deployment.
 * This service handles the deployment of trading agents through the ACP protocol.
 * 
 * @author Dylan Burkey
 * @license MIT
 */

import axios, { AxiosError, AxiosResponse } from 'axios';
import { config } from '../../config';
import { Logger } from '../../utils/logger';
import {
  IAgentService,
  AgentRequest,
  AgentResponse,
} from '../agentService';
import { QuickDeployContract } from './contractUtils';

/**
 * Interface for the Quick Deploy request parameters
 * Expected in the AgentRequest.params field
 */
interface QuickDeployParams {
  /** The payment transaction hash from the user */
  paymentTxHash: string;
  /** Optional name for the agent (defaults to ACP-[timestamp]) */
  agentName?: string;
  /** User's wallet address */
  userWallet: string;
}

/**
 * Interface for the Quick Deploy API request body
 */
interface QuickDeployApiRequest {
  /** Name of the agent */
  name: string;
  /** Payment transaction hash */
  paymentTxnHash: string;
  /** Contract creation transaction hash */
  contractCreationTxnHash: string;
  /** Creating user's wallet address */
  creatingUserWallet: string;
}

/**
 * Quick Deploy Service implementation for Kosher Capital.
 * This service processes requests to deploy new AI trading agents.
 *
 * @class QuickDeployService
 * @implements {IAgentService}
 */
export class QuickDeployService implements IAgentService {
  /** Logger instance for this service */
  private readonly logger = Logger;

  /** API endpoint for quick deploy */
  private readonly quickDeployEndpoint: string;

  /** API timeout in milliseconds */
  private readonly apiTimeout = 30000;

  /** Expected service price in USDC */
  private readonly expectedServicePrice = 50;

  /** Contract utilities instance */
  private readonly contractUtils: QuickDeployContract;

  /**
   * Constructor for QuickDeployService
   */
  constructor() {
    // Use the API_ENDPOINT from config, or the full URL from transcript
    this.quickDeployEndpoint = config.apiEndpoint.includes('quick-deploy') 
      ? config.apiEndpoint 
      : 'https://parallax-analytics.onrender.com/api/v1/secure/fundDetails/quick-deploy';
    
    // Initialize contract utilities
    this.contractUtils = new QuickDeployContract();
    
    this.logger.info('QuickDeployService initialized');
    this.logger.info(`Quick Deploy Endpoint: ${this.quickDeployEndpoint}`);
  }

  /**
   * Processes a quick deploy request from a buyer through ACP.
   *
   * This method:
   * 1. Validates the request scope
   * 2. Verifies payment transaction
   * 3. Generates contract creation transaction
   * 4. Calls the quick deploy API
   * 5. Returns deployment details
   *
   * @param {AgentRequest} request - The request from the buyer
   * @returns {Promise<AgentResponse>} The processed response
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing quick deploy request for job ${request.jobId}`);

      // Validate request scope
      if (!this.validateRequestScope(request)) {
        return {
          success: false,
          error: 'Invalid request - not a quick deploy request',
          errorType: 'SCOPE_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: false
          }
        };
      }

      const params = request.params as QuickDeployParams;

      // Validate required parameters
      if (!params.paymentTxHash || !params.userWallet) {
        return {
          success: false,
          error: 'Missing required parameters: paymentTxHash and userWallet are required',
          errorType: 'VALIDATION_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: true
          }
        };
      }

      // Generate agent name if not provided
      const agentName = params.agentName || `ACP-${Date.now()}`;

      // Verify payment transaction (50 USDC)
      const isPaymentValid = await this.contractUtils.verifyPayment(params.paymentTxHash);
      if (!isPaymentValid) {
        return {
          success: false,
          error: 'Invalid payment transaction',
          errorType: 'VALIDATION_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: true
          }
        };
      }

      // Generate contract creation transaction hash
      // According to the transcript, this needs to be generated after payment is received
      const contractTxHash = await this.generateContractTransaction(params);

      // Prepare the API request
      const apiRequest: QuickDeployApiRequest = {
        name: agentName,
        paymentTxnHash: params.paymentTxHash,
        contractCreationTxnHash: contractTxHash,
        creatingUserWallet: params.userWallet,
      };

      this.logger.info(`Calling quick deploy API with request:`, apiRequest);

      // Call the quick deploy API
      const response = await this.callQuickDeployApi(apiRequest);

      // Return successful response
      return {
        success: true,
        data: {
          agentName,
          contractAddress: response.contractAddress,
          deploymentTxHash: response.deploymentTxHash,
          message: 'Trading agent deployed successfully',
          details: response,
        },
        metadata: {
          processedAt: new Date().toISOString(),
          serviceVersion: '1.0.0',
          processingTime: `${Date.now() - startTime}ms`,
          withinScope: true,
          deploymentSource: 'ACP',
        },
      };

    } catch (error) {
      this.logger.error(`Error processing quick deploy for job ${request.jobId}:`, error);

      let errorMessage = 'Failed to deploy trading agent';
      let errorType: AgentResponse['errorType'] = 'PROCESSING_ERROR';

      if (error instanceof AxiosError) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout - deployment took too long';
          errorType = 'TIMEOUT_ERROR';
        } else if (error.response) {
          const statusCode = error.response.status;
          errorMessage = `Deployment API error: ${statusCode} - ${
            error.response.data?.message || error.response.statusText
          }`;
          
          if (statusCode >= 400 && statusCode < 500) {
            errorType = 'VALIDATION_ERROR';
          } else if (statusCode >= 500) {
            errorType = 'SERVICE_ERROR';
          }
        } else if (error.request) {
          errorMessage = 'Deployment API unavailable - no response received';
          errorType = 'SERVICE_ERROR';
        }
      } else if (error instanceof Error) {
        errorMessage = `Deployment failed: ${error.message}`;
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
   * Validates that the quick deploy service is ready.
   *
   * @returns {Promise<boolean>} True if service is ready
   */
  async validateService(): Promise<boolean> {
    try {
      // Validate that we have the required configuration
      if (!config.apiEndpoint) {
        this.logger.error('API_ENDPOINT not configured');
        return false;
      }

      // Check if the API endpoint is reachable
      // Note: According to transcript, the quick-deploy endpoint might not have a health check
      this.logger.info('Quick Deploy service validation successful');
      return true;

    } catch (error) {
      this.logger.error('Quick Deploy service validation failed:', error);
      return false;
    }
  }

  /**
   * Validates if a request is within the service scope.
   * For QuickDeploy, we check if it's a request to deploy a trading agent.
   *
   * @param {AgentRequest} request - The request to validate
   * @returns {boolean} True if request is within scope
   */
  validateRequestScope(request: AgentRequest): boolean {
    // Basic validation
    if (!request.jobId || !request.params) {
      this.logger.warn(`Request validation failed: Missing jobId or params`);
      return false;
    }

    // Check if this is a quick deploy request
    // The request should have specific parameters for quick deploy
    const params = request.params as any;
    
    // Check for required quick deploy parameters
    if (!params.paymentTxHash || !params.userWallet) {
      this.logger.warn(`Request missing required quick deploy parameters`);
      return false;
    }

    // Optionally, check if the request type matches
    if (params.type && params.type !== 'quick-deploy' && params.type !== 'deploy-agent') {
      this.logger.warn(`Request type '${params.type}' not supported by QuickDeploy service`);
      return false;
    }

    return true;
  }

  /**
   * Generates the contract creation transaction hash.
   * According to the transcript, this involves calling a contract after payment is received.
   *
   * @param {QuickDeployParams} params - The deployment parameters
   * @returns {Promise<string>} The contract creation transaction hash
   * @private
   */
  private async generateContractTransaction(params: QuickDeployParams): Promise<string> {
    try {
      this.logger.info(`Generating contract transaction for payment: ${params.paymentTxHash}`);

      // Deploy the agent contract
      const deploymentTxHash = await this.contractUtils.deployAgent({
        paymentTxHash: params.paymentTxHash,
        userWallet: params.userWallet,
        agentName: params.agentName || `ACP-${Date.now()}`,
      });
      
      this.logger.info(`Generated contract transaction hash: ${deploymentTxHash}`);
      return deploymentTxHash;

    } catch (error) {
      this.logger.error('Failed to generate contract transaction:', error);
      throw new Error('Contract creation failed');
    }
  }

  /**
   * Calls the Quick Deploy API with the prepared request.
   *
   * @param {QuickDeployApiRequest} request - The API request payload
   * @returns {Promise<any>} The API response
   * @private
   */
  private async callQuickDeployApi(request: QuickDeployApiRequest): Promise<any> {
    try {
      const response: AxiosResponse = await axios.post(
        this.quickDeployEndpoint,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ACP-Agent/QuickDeploy',
            // Add API key if configured
            ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
          },
          timeout: this.apiTimeout,
        }
      );

      if (config.logApiOutput) {
        this.logger.logApiData('Quick Deploy API response:', response.data);
      }

      return response.data;

    } catch (error) {
      this.logger.error('Quick Deploy API call failed:', error);
      throw error;
    }
  }
}
