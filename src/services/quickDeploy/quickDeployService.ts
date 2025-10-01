/**
 * @fileoverview Quick Deploy Service for Kosher Capital's AI Trading Agent deployment.
 * This service handles the deployment of trading agents through the ACP protocol.
 * Updated to work with the actual contract deployment flow.
 * 
 * @author Athena AI Team
 * @license MIT
 */

import axios, { AxiosError, AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import { config } from '../../config';
import { Logger } from '../../utils/logger';
import {
  IAgentService,
  AgentRequest,
  AgentResponse,
} from '../agentService';
import { QuickDeployContract, DeploymentResult } from './contractUtils';
import { notificationService } from './notificationService';
import { transactionTracker } from './transactionTracker';

/**
 * Interface for the Quick Deploy request parameters
 * Expected in the AgentRequest.params field
 */
interface QuickDeployParams {
  /** The payment transaction hash from the user */
  paymentTxHash?: string;
  /** Agent name for the deployment */
  agentName?: string;
  /** User's wallet address */
  userWallet: string;
  /** Whether to execute on-chain deployment (true) or just call API (false) */
  executeOnChain?: boolean;
  /** AI wallet address (defaults to user wallet) */
  aiWallet?: string;
}

/**
 * Interface for the Quick Deploy API request body
 * Based on the documentation from Shekel team
 */
interface QuickDeployApiRequest {
  /** Display name for the agent and fund */
  agentName: string;
  /** EVM transaction hash for fund contract creation */
  contractCreationTxnHash: string;
  /** EVM address of the user creating the fund */
  creating_user_wallet_address: string;
  /** Payment transaction hash if applicable */
  paymentTxnHash?: string;
  /** Referral code to attribute */
  referralCode?: string;
  /** Deployment source tag (defaults to UI) */
  deploySource?: string;
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
  
  /** API key from Shekel team */
  private readonly apiKey: string;

  /**
   * Constructor for QuickDeployService
   */
  constructor() {
    // Use the actual endpoint from documentation
    this.quickDeployEndpoint = 'https://parallax-analytics.onrender.com/api/v1/secure/fundDetails/quick-deploy';
    
    // Use the provided API key
    this.apiKey = process.env.SHEKEL_API_KEY || '656a58ea4149df4dc24ae733fcd7efce665d99303379d4db1945e3a79fa9d635';
    
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
   * 2. Either executes on-chain deployment or uses existing transaction
   * 3. Calls the quick deploy API
   * 4. Returns deployment details
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
      if (!params.userWallet) {
        return {
          success: false,
          error: 'Missing required parameter: userWallet',
          errorType: 'VALIDATION_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: true
          }
        };
      }

      // Generate agent name if not provided
      const agentName = params.agentName || `ACP-${Date.now()}`;

      // Create transaction record
      const transaction = transactionTracker.createTransaction(
        request.jobId,
        params.paymentTxHash || 'pending',
        params.userWallet,
        agentName
      );

      // Update transaction status
      transactionTracker.updateTransaction(transaction.id, { status: 'processing' });

      let contractCreationTxHash: string;
      let fundAddress: string | undefined;
      let paymentTxHash: string | undefined;

      // Check if we should execute on-chain deployment
      if (params.executeOnChain !== false && !params.paymentTxHash) {
        // Execute the full 3-transaction deployment flow
        this.logger.info('Executing on-chain deployment...');
        
        try {
          // Create a signer (in production, this would be the user's signer)
          // For ACP integration, we need to handle this differently
          const wallet = new ethers.Wallet(
            config.whitelistedWalletPrivateKey,
            this.contractUtils['provider']
          );
          
          // Execute deployment
          const deploymentResult: DeploymentResult = await this.contractUtils.deployAgent(
            {
              userWallet: params.userWallet,
              agentName,
              aiWallet: params.aiWallet,
            },
            wallet
          );
          
          contractCreationTxHash = deploymentResult.creationTxHash;
          fundAddress = deploymentResult.fundAddress;
          paymentTxHash = deploymentResult.paymentTxHash;
          
          // Update transaction with all hashes
          transactionTracker.updateTransaction(transaction.id, {
            contractCreationTxHash,
            contractAddress: fundAddress,
            paymentTxHash,
          });
          
        } catch (deployError) {
          this.logger.error('On-chain deployment failed:', deployError);
          transactionTracker.updateTransaction(transaction.id, {
            status: 'failed',
            error: 'On-chain deployment failed',
          });
          
          return {
            success: false,
            error: 'Failed to deploy contracts on-chain',
            errorType: 'PROCESSING_ERROR',
            metadata: {
              processingTime: `${Date.now() - startTime}ms`,
              withinScope: true
            }
          };
        }
        
      } else if (params.paymentTxHash) {
        // Use provided payment hash and verify it
        this.logger.info('Using provided payment transaction hash');
        
        const isPaymentValid = await this.contractUtils.verifyPayment(params.paymentTxHash);
        if (!isPaymentValid) {
          transactionTracker.updateTransaction(transaction.id, {
            status: 'failed',
            error: 'Invalid payment transaction',
          });
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
        
        // For API-only mode, we need the contract creation hash
        // This would typically come from monitoring the blockchain
        contractCreationTxHash = await this.findContractCreationTx(params.userWallet);
        paymentTxHash = params.paymentTxHash;
      } else {
        return {
          success: false,
          error: 'Either executeOnChain must be true or paymentTxHash must be provided',
          errorType: 'VALIDATION_ERROR',
          metadata: {
            processingTime: `${Date.now() - startTime}ms`,
            withinScope: true
          }
        };
      }

      // Prepare the API request using actual schema from documentation
      const apiRequest: QuickDeployApiRequest = {
        agentName,
        contractCreationTxnHash: contractCreationTxHash,
        creating_user_wallet_address: params.userWallet,
        paymentTxnHash: paymentTxHash,
        deploySource: 'ACP', // Tag as ACP deployment
      };

      this.logger.info(`Calling quick deploy API with request:`, apiRequest);

      // Call the quick deploy API
      const response = await this.callQuickDeployApi(apiRequest);

      // Prepare the response
      const successResponse = {
        success: true,
        data: {
          agentName,
          contractAddress: fundAddress || response.fundAddress,
          deploymentTxHash: contractCreationTxHash,
          paymentTxHash,
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

      // Update transaction as completed
      transactionTracker.updateTransaction(transaction.id, {
        status: 'completed',
        contractAddress: fundAddress || response.fundAddress,
        contractCreationTxHash: contractCreationTxHash,
      });

      // Send notification back to Kosher Capital
      try {
        const notification = notificationService.createDeploymentNotification(
          request.jobId,
          successResponse,
          params.userWallet,
          paymentTxHash || ''
        );
        await notificationService.notifyDeploymentResult(notification);
        
        // Update notification status
        transactionTracker.updateTransaction(transaction.id, {
          notificationSent: true,
        });
        
        // Send webhook event for tracking
        await notificationService.sendWebhookEvent('agent.deployed', {
          jobId: request.jobId,
          agentName,
          contractAddress: fundAddress || response.fundAddress,
        });
      } catch (notificationError) {
        // Log but don't fail the deployment if notification fails
        this.logger.error('Failed to send deployment notification:', notificationError);
      }

      return successResponse;

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

      const errorResponse = {
        success: false,
        error: errorMessage,
        errorType,
        metadata: {
          processingTime: `${Date.now() - startTime}ms`,
          withinScope: true
        }
      };

      // Update transaction as failed
      const failedTransaction = transactionTracker.getTransactionByJobId(request.jobId);
      if (failedTransaction) {
        transactionTracker.updateTransaction(failedTransaction.id, {
          status: 'failed',
          error: errorMessage,
        });
      }

      // Send failure notification
      try {
        const notification = notificationService.createDeploymentNotification(
          request.jobId,
          errorResponse,
          request.params?.userWallet || request.buyer,
          request.params?.paymentTxHash || ''
        );
        await notificationService.notifyDeploymentResult(notification);
        
        // Send webhook event for tracking
        await notificationService.sendWebhookEvent('agent.deployment.failed', {
          jobId: request.jobId,
          error: errorMessage,
          errorType,
        });
      } catch (notificationError) {
        this.logger.error('Failed to send error notification:', notificationError);
      }

      return errorResponse;
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
      if (!this.apiKey) {
        this.logger.error('Shekel API key not configured');
        return false;
      }

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
    const params = request.params as any;
    
    // Check for required quick deploy parameters
    if (!params.userWallet) {
      this.logger.warn(`Request missing required userWallet parameter`);
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
   * Finds the contract creation transaction for a user
   * This is a simplified version - in production you'd want more robust tracking
   * 
   * @param {string} userWallet - User's wallet address
   * @returns {Promise<string>} Contract creation transaction hash
   * @private
   */
  private async findContractCreationTx(userWallet: string): Promise<string> {
    try {
      // In a real implementation, you would:
      // 1. Monitor PersonalFundCreated events from the factory
      // 2. Track transaction hashes by user
      // 3. Use a database or indexer
      
      // For now, generate a placeholder
      const mockHash = `0x${ethers.keccak256(ethers.toUtf8Bytes(userWallet + Date.now())).slice(2)}`;
      this.logger.info(`Using mock contract creation tx: ${mockHash}`);
      return mockHash;
      
    } catch (error) {
      this.logger.error('Failed to find contract creation tx:', error);
      throw new Error('Could not find contract creation transaction');
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
            'x-api-key': this.apiKey,
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
