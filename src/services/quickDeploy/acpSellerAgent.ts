/**
 * @fileoverview ACP Seller Agent implementation for Quick Deploy service
 * This service registers as an ACP seller agent to handle AI trading agent deployments
 * 
 * @author Athena AI Team  
 * @license MIT
 */

import AcpClient from '@virtuals-protocol/acp-node';
import { AcpContractClient, AcpJob, AcpJobPhases } from '@virtuals-protocol/acp-node';
import { ethers } from 'ethers';
import { config } from '../../config';
import { Logger } from '../../utils/logger';
import { QuickDeployContract } from './contractUtils';
import { notificationService } from './notificationService';
import { transactionTracker } from './transactionTracker';
import { getKosherCapitalClient } from './kosherCapitalClient';
import {
  QuickDeployServiceRequirement,
  QuickDeployDeliverable,
  ServiceType,
  TransactionStatus,
  DeploymentParams,
  DeploymentResult,
  isQuickDeployRequest,
} from './types';
import {
  ValidationError,
  ProcessingError,
  ErrorFactory,
  ErrorHandler,
  Validators,
} from './errors';
import { RetryUtil } from './retry';
import {
  LOG_PREFIX,
  DEPLOYMENT_CONFIG,
  ENV_KEYS,
} from './constants';



/**
 * ACP Seller Agent for Quick Deploy Service
 */
export class QuickDeployACPAgent {
  /** Logger instance */
  private readonly logger = Logger;
  
  /** ACP Client instance */
  private acpClient: AcpClient | null = null;
  
  /** Contract utilities */
  private readonly contractUtils: QuickDeployContract;
  
  /** Kosher Capital API client */
  private readonly kosherCapitalClient = getKosherCapitalClient();
  
  /** Active jobs mapping */
  private activeJobs: Map<string, AcpJob> = new Map();

  constructor() {
    this.contractUtils = new QuickDeployContract();
    this.logger.info(`${LOG_PREFIX.INIT} QuickDeployACPAgent initialized`);
  }

  /**
   * Initialize the ACP seller agent
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} Initializing ACP seller agent...`);

      // Validate configuration
      this.validateConfiguration();
      
      // Test API connectivity
      const healthCheck = await this.kosherCapitalClient.checkHealth();
      if (healthCheck.success) {
        this.logger.info(
          `${LOG_PREFIX.SUCCESS} Kosher Capital API healthy`,
          healthCheck.data
        );
      } else {
        this.logger.warn(
          `${LOG_PREFIX.WARNING} Kosher Capital API health check failed`
        );
      }

      // Build ACP contract client
      const acpContractClient = await AcpContractClient.build(
        config.whitelistedWalletPrivateKey,
        config.whitelistedWalletEntityId,
        config.sellerAgentWalletAddress,
        config.acpRpcUrl // Optional custom RPC
      );

      // Initialize ACP client with callbacks
      this.acpClient = new AcpClient({
        acpContractClient,
        onNewTask: this.handleNewTask.bind(this),
        onEvaluate: this.handleEvaluate.bind(this),
      });

      // Initialize the client
      await this.acpClient.init();

      this.logger.info(`${LOG_PREFIX.SUCCESS} ACP seller agent initialized successfully`);
      this.logger.info(`${LOG_PREFIX.INFO} Agent wallet: ${config.sellerAgentWalletAddress}`);
      this.logger.info(`${LOG_PREFIX.INFO} Service offering: AI Trading Agent Quick Deployment`);
      this.logger.info(`${LOG_PREFIX.INFO} Price: ${config.servicePrice} USDC per deployment`);

    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Failed to initialize ACP agent:`, error);
      throw error;
    }
  }

  /**
   * Validate required configuration
   */
  private validateConfiguration(): void {
    const required = [
      { key: 'whitelistedWalletPrivateKey', value: config.whitelistedWalletPrivateKey },
      { key: 'whitelistedWalletEntityId', value: config.whitelistedWalletEntityId },
      { key: 'sellerAgentWalletAddress', value: config.sellerAgentWalletAddress },
      { key: 'shekelApiKey', value: process.env[ENV_KEYS.SHEKEL_API_KEY] },
    ];

    for (const { key, value } of required) {
      Validators.assert(
        !!value,
        `Missing required configuration: ${key}`,
        key
      );
    }

    // Validate private key format
    Validators.assert(
      Validators.isValidPrivateKey(config.whitelistedWalletPrivateKey),
      'Invalid private key format',
      'whitelistedWalletPrivateKey'
    );

    // Validate wallet address format
    Validators.assert(
      Validators.isValidAddress(config.sellerAgentWalletAddress),
      'Invalid wallet address format',
      'sellerAgentWalletAddress'
    );
  }

  /**
   * Handle new task callback from ACP
   * This is called when a buyer initiates a job with our agent
   */
  private async handleNewTask(job: AcpJob): Promise<void> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} New task received: ${job.id}`);
      this.logger.info(`${LOG_PREFIX.INFO} Job phase: ${job.phase}`);
      this.logger.info(`${LOG_PREFIX.INFO} Buyer: ${job.buyer}`);
      
      // Store job
      this.activeJobs.set(job.id, job);

      // Handle based on phase
      switch (job.phase) {
        case AcpJobPhases.REQUEST:
          await this.handleRequestPhase(job);
          break;
        
        case AcpJobPhases.NEGOTIATION:
          await this.handleNegotiationPhase(job);
          break;
          
        case AcpJobPhases.TRANSACTION:
          await this.handleTransactionPhase(job);
          break;
          
        default:
          this.logger.warn(`${LOG_PREFIX.WARNING} Unexpected phase: ${job.phase}`);
      }

    } catch (error) {
      const structuredError = ErrorFactory.fromUnknown(error);
      this.logger.error(
        `${LOG_PREFIX.ERROR} Error handling new task:`,
        structuredError.toJSON()
      );
      await this.rejectJob(
        job,
        ErrorHandler.getUserMessage(error)
      );
    }
  }

  /**
   * Handle REQUEST phase - decide whether to accept the job
   */
  private async handleRequestPhase(job: AcpJob): Promise<void> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} Processing REQUEST phase for job ${job.id}`);

      // Parse service requirements
      const requirements = job.serviceRequirement;
      
      // Validate this is a quick deploy request
      if (!isQuickDeployRequest(requirements)) {
        await this.rejectJob(
          job,
          'Invalid service type - only quick-deploy supported'
        );
        return;
      }

      // Create transaction record
      const agentName = requirements.agentName || `ACP-${Date.now()}`;
      const transaction = transactionTracker.createTransaction(
        job.id,
        'pending', // No payment TX yet in ACP flow
        job.buyer,
        agentName
      );
      
      this.logger.info(
        `${LOG_PREFIX.INFO} Transaction created`,
        { transactionId: transaction.id, jobId: job.id }
      );

      // Accept the job
      await this.acceptJob(job, `Quick deployment service available for ${agentName}`);
      
      this.logger.info(`${LOG_PREFIX.SUCCESS} Accepted job ${job.id}`);

    } catch (error) {
      const structuredError = ErrorFactory.fromUnknown(error);
      this.logger.error(
        `${LOG_PREFIX.ERROR} Error in REQUEST phase:`,
        structuredError.toJSON()
      );
      await this.rejectJob(
        job,
        ErrorHandler.getUserMessage(error)
      );
    }
  }

  /**
   * Handle NEGOTIATION phase - agree on terms
   */
  private async handleNegotiationPhase(job: AcpJob): Promise<void> {
    this.logger.info(`${LOG_PREFIX.PROCESSING} Processing NEGOTIATION phase for job ${job.id}`);
    
    // For Quick Deploy, we have fixed terms:
    // - Price: 50 USDC
    // - Delivery: AI trading agent deployment
    // - Timeline: Immediate execution upon payment
    
    // In a more complex scenario, you might negotiate terms here
    // For now, we proceed with standard terms
    
    this.logger.info(`${LOG_PREFIX.INFO} Negotiation complete with standard terms`);
  }

  /**
   * Handle TRANSACTION phase - execute the deployment
   */
  private async handleTransactionPhase(job: AcpJob): Promise<void> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} Processing TRANSACTION phase for job ${job.id}`);
      
      // Update transaction status
      const transaction = transactionTracker.getTransactionByJobId(job.id);
      if (transaction) {
        transactionTracker.updateTransaction(transaction.id, { 
          status: TransactionStatus.PROCESSING 
        });
      }

      // Parse requirements
      const requirements = job.serviceRequirement as QuickDeployServiceRequirement;
      const agentName = requirements.agentName || `ACP-${Date.now()}`;

      // Execute deployment
      const deploymentResult = await this.executeDeployment(job, requirements);

      // Prepare deliverable
      const deliverable: QuickDeployDeliverable = {
        success: deploymentResult.success,
        agentName,
        contractAddress: deploymentResult.fundAddress,
        creationTxHash: deploymentResult.creationTxHash,
        paymentTxHash: deploymentResult.paymentTxHash,
        apiResponse: deploymentResult.apiResponse,
        error: deploymentResult.error,
        timestamp: new Date().toISOString(),
      };

      // Deliver the result
      await this.deliverJob(job, deliverable);

      // Update transaction as completed
      if (transaction) {
        transactionTracker.updateTransaction(transaction.id, {
          status: TransactionStatus.COMPLETED,
          contractAddress: deploymentResult.fundAddress,
          contractCreationTxHash: deploymentResult.creationTxHash,
        });
      }

      // Send notification
      await this.sendCompletionNotification(job, deploymentResult);

      this.logger.info(`${LOG_PREFIX.SUCCESS} Job ${job.id} completed successfully`);

    } catch (error) {
      const structuredError = ErrorFactory.fromUnknown(error);
      this.logger.error(
        `${LOG_PREFIX.ERROR} Error in TRANSACTION phase:`,
        structuredError.toJSON()
      );
      
      // Update transaction as failed
      const transaction = transactionTracker.getTransactionByJobId(job.id);
      if (transaction) {
        transactionTracker.updateTransaction(transaction.id, {
          status: TransactionStatus.FAILED,
          error: structuredError.message,
        });
      }
      
      // Deliver error result
      const errorDeliverable: QuickDeployDeliverable = {
        success: false,
        agentName: 'Unknown',
        error: ErrorHandler.getUserMessage(error),
        timestamp: new Date().toISOString(),
      };
      
      await this.deliverJob(job, errorDeliverable);
    }
  }

  /**
   * Execute the actual deployment
   */
  private async executeDeployment(
    job: AcpJob, 
    requirements: QuickDeployServiceRequirement
  ): Promise<any> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} Executing deployment for ${requirements.agentName}`);

      // Create wallet signer
      const wallet = new ethers.Wallet(
        config.whitelistedWalletPrivateKey,
        this.contractUtils['provider']
      );

      // Execute deployment with retry logic
      const deploymentResult = await RetryUtil.withRetry(
        async () => {
          const params: DeploymentParams = {
            userWallet: job.buyer,
            agentName: requirements.agentName || `ACP-${Date.now()}`,
            aiWallet: requirements.aiWallet || job.buyer,
          };
          
          return await this.contractUtils.deployAgent(params, wallet);
        },
        {
          maxAttempts: 3,
          onRetry: (attempt, error) => {
            this.logger.warn(
              `${LOG_PREFIX.WARNING} Contract deployment retry ${attempt}`,
              { error: error.message }
            );
          },
        }
      );

      // Call Kosher Capital API
      const apiResult = await this.kosherCapitalClient.quickDeploy({
        agentName: requirements.agentName || `ACP-${Date.now()}`,
        contractCreationTxnHash: deploymentResult.creationTxHash!,
        creating_user_wallet_address: job.buyer,
        paymentTxnHash: deploymentResult.paymentTxHash!,
        deploySource: DEPLOYMENT_CONFIG.DEPLOYMENT_SOURCE,
        referralCode: requirements.metadata?.referralCode,
      });
      
      if (!apiResult.success) {
        throw new ProcessingError(
          `Kosher Capital API failed: ${apiResult.error}`,
          job.id,
          'api-call'
        );
      }

      return {
        success: true,
        ...deploymentResult,
        apiResponse: apiResult.data,
      };

    } catch (error) {
      const structuredError = ErrorFactory.fromUnknown(error);
      this.logger.error(
        `${LOG_PREFIX.ERROR} Deployment execution failed:`,
        structuredError.toJSON()
      );
      return {
        success: false,
        error: structuredError.message,
      };
    }
  }



  /**
   * Handle evaluation callback from ACP
   */
  private async handleEvaluate(job: AcpJob): Promise<void> {
    this.logger.info(`${LOG_PREFIX.PROCESSING} Evaluation requested for job ${job.id}`);
    
    // For Quick Deploy, evaluation might check:
    // - Was the agent successfully deployed?
    // - Is the contract address valid?
    // - Did the API registration succeed?
    
    // This would be handled by an evaluator agent in the full ACP flow
  }

  /**
   * Accept a job
   */
  private async acceptJob(job: AcpJob, reason?: string): Promise<void> {
    if (!this.acpClient) throw new Error('ACP client not initialized');
    
    await this.acpClient.respondJob(
      job.id,
      job.memoIds[job.memoIds.length - 1], // Latest memo
      true, // accept
      reason || 'Job accepted'
    );
  }

  /**
   * Reject a job
   */
  private async rejectJob(job: AcpJob, reason: string): Promise<void> {
    if (!this.acpClient) throw new Error('ACP client not initialized');
    
    await this.acpClient.respondJob(
      job.id,
      job.memoIds[job.memoIds.length - 1], // Latest memo
      false, // reject
      reason
    );
    
    // Clean up
    this.activeJobs.delete(job.id);
  }

  /**
   * Deliver job result
   */
  private async deliverJob(job: AcpJob, deliverable: QuickDeployDeliverable): Promise<void> {
    if (!this.acpClient) throw new Error('ACP client not initialized');
    
    await this.acpClient.deliverJob(job.id, deliverable);
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(job: AcpJob, result: any): Promise<void> {
    try {
      const notification = notificationService.createDeploymentNotification(
        job.id,
        {
          success: result.success,
          data: result,
        },
        job.buyer,
        result.paymentTxHash || ''
      );
      
      await notificationService.notifyDeploymentResult(notification);
      
    } catch (error) {
      // Don't fail the job if notification fails
      this.logger.error(
        `${LOG_PREFIX.ERROR} Failed to send notification:`,
        ErrorFactory.fromUnknown(error).toJSON()
      );
    }
  }

  /**
   * Get active jobs
   */
  async getActiveJobs(): Promise<AcpJob[]> {
    if (!this.acpClient) throw new Error('ACP client not initialized');
    
    const jobs = await this.acpClient.getActiveJobs();
    return jobs.data || [];
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(): Promise<AcpJob[]> {
    if (!this.acpClient) throw new Error('ACP client not initialized');
    
    const jobs = await this.acpClient.getCompletedJobs();
    return jobs.data || [];
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    this.logger.info(`${LOG_PREFIX.INFO} Shutting down ACP agent...`);
    
    // Clean up active jobs
    this.activeJobs.clear();
    
    // ACP client cleanup would go here
    this.acpClient = null;
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} ACP agent shutdown complete`);
  }
}
