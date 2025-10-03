/**
 * @fileoverview ACP Seller Agent implementation for Quick Deploy service
 * This service registers as an ACP seller agent to handle AI trading agent deployments
 * 
 * @author Dylan Burkey  
 * @license MIT
 */

import AcpClient from '@virtuals-protocol/acp-node';
import { AcpContractClient, AcpJob, AcpJobPhases } from '@virtuals-protocol/acp-node';
import { ethers } from 'ethers';
import { config } from '../../config';
import { Logger } from '../../utils/logger';
import { createJobQueue, QueueInterface } from '../../utils/jobQueue';
import { ACP_CONFIG, getJobPriority, validateACPConfig } from '../../config/acpConfig';
import { QuickDeployContract } from './contractUtils';
import { notificationService } from './notificationService';
import { transactionTracker } from './transactionTracker';
import { getKosherCapitalClient } from './kosherCapitalClient';
import { paymentMonitor } from './paymentMonitor';
import {
  QuickDeployServiceRequirement,
  QuickDeployDeliverable,
  TransactionStatus,
  DeploymentParams,
  isQuickDeployRequest,
} from './types';
import {
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
 * Type guard to safely check if a memo has a nextPhase property
 */
function hasNextPhase(memo: unknown, expectedPhase: AcpJobPhases): boolean {
  return (
    typeof memo === 'object' &&
    memo !== null &&
    'nextPhase' in memo &&
    (memo as Record<string, unknown>).nextPhase === expectedPhase
  );
}

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
  
  /** Job queue for sequential processing */
  private jobQueue: QueueInterface | null = null;
  
  /** Active jobs mapping */
  private activeJobs: Map<string, AcpJob> = new Map();
  
  /** Processing statistics */
  private stats = {
    jobsReceived: 0,
    jobsAccepted: 0,
    jobsRejected: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
  };

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
      validateACPConfig();
      
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

      // Initialize job queue
      await this.initializeJobQueue();

      // Build ACP contract client
      const acpContractClient = await AcpContractClient.build(
        config.whitelistedWalletPrivateKey as `0x${string}`,
        config.whitelistedWalletEntityId,
        config.sellerAgentWalletAddress as `0x${string}`,
        config.acpRpcUrl ? { rpcUrl: config.acpRpcUrl } as any : undefined
      );

      // Initialize ACP client with callbacks
      this.acpClient = new AcpClient({
        acpContractClient,
        onNewTask: (job: AcpJob) => {
          // Queue jobs for processing to prevent transaction conflicts
          const priority = getJobPriority(job.phase);
          this.logger.debug(
            `${LOG_PREFIX.INFO} New job #${job.id} (${job.phase}) queued with priority ${priority}`
          );
          this.stats.jobsReceived++;
          this.jobQueue!.enqueue(job, priority);
        },
        onEvaluate: async (job: AcpJob) => {
          // For now, automatically approve all deliverables
          try {
            this.logger.info(`${LOG_PREFIX.PROCESSING} Evaluating job #${job.id}`);
            this.logger.info(`${LOG_PREFIX.INFO} Deliverable:`, job.deliverable);
            
            // In a real implementation, you might want to verify the deliverable
            const approved = true;
            const reason = approved 
              ? 'Deliverable meets requirements' 
              : 'Deliverable does not meet requirements';
            
            // Use the evaluate method on the job object if available
            if ('evaluate' in job && typeof job.evaluate === 'function') {
              await (job as any).evaluate(approved, reason);
            } else {
              // Fallback: use ACP client to send evaluation
              this.logger.warn(`${LOG_PREFIX.WARNING} Job.evaluate not available, using fallback`);
            }
          } catch (error) {
            this.logger.error(`${LOG_PREFIX.ERROR} Error evaluating job #${job.id}:`, error);
          }
        },
      });

      // Initialize the client
      await this.acpClient.init();

      this.logger.info(`${LOG_PREFIX.SUCCESS} ACP seller agent initialized successfully`);
      this.logger.info(`${LOG_PREFIX.INFO} Agent wallet: ${config.sellerAgentWalletAddress}`);
      this.logger.info(`${LOG_PREFIX.INFO} Service offering: AI Trading Agent Quick Deployment`);
      this.logger.info(`${LOG_PREFIX.INFO} Price: ${config.servicePrice} USDC per deployment`);
      this.logger.info(`${LOG_PREFIX.INFO} Job queue configuration:`, {
        processingDelay: ACP_CONFIG.jobQueue.processingDelay,
        maxRetries: ACP_CONFIG.jobQueue.maxRetries,
      });

    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Failed to initialize ACP agent:`, error);
      throw error;
    }
  }

  /**
   * Initialize job queue for sequential processing
   */
  private async initializeJobQueue(): Promise<void> {
    const processJob = async (job: AcpJob): Promise<void> => {

      if (
        job.phase === AcpJobPhases.REQUEST &&
        job.memos.find((m) => hasNextPhase(m, AcpJobPhases.NEGOTIATION))
      ) {
        // Handle REQUEST phase
        await this.handleRequestPhase(job);
      } else if (
        job.phase === AcpJobPhases.TRANSACTION &&
        job.memos.find((m) => hasNextPhase(m, AcpJobPhases.EVALUATION))
      ) {
        // Handle TRANSACTION phase
        await this.handleTransactionPhase(job);
      } else if (job.phase === AcpJobPhases.NEGOTIATION) {
        // Handle NEGOTIATION phase
        await this.handleNegotiationPhase(job);
      }
    };

    // Create the job queue
    this.jobQueue = await createJobQueue(
      processJob,
      ACP_CONFIG.jobQueue.processingDelay,
      ACP_CONFIG.jobQueue.maxRetries
    );

    this.logger.info(`${LOG_PREFIX.SUCCESS} Job queue initialized`);
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
   * Handle REQUEST phase - decide whether to accept the job
   */
  private async handleRequestPhase(job: AcpJob): Promise<void> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} Processing REQUEST phase for job ${job.id}`);

      // Store job
      this.activeJobs.set(String(job.id), job);

      // Parse service requirements
      const requirements = job.serviceRequirement;
      
      // Validate this is a quick deploy request
      if (!isQuickDeployRequest(requirements)) {
        await this.rejectJob(
          job,
          'Invalid service type - only quick-deploy supported'
        );
        this.stats.jobsRejected++;
        return;
      }

      // Create transaction record
      const agentName = requirements.agentName || `ACP-${Date.now()}`;
      const buyerAddress = (job as any).buyer || (job as any).providerAddress || 'Unknown';
      const transaction = transactionTracker.createTransaction(
        String(job.id),
        'pending', // No payment TX yet in ACP flow
        buyerAddress,
        agentName
      );
      
      this.logger.info(
        `${LOG_PREFIX.INFO} Transaction created`,
        { transactionId: transaction.id, jobId: job.id }
      );

      // Accept the job
      await this.acceptJob(job, `Quick deployment service available for ${agentName}`);
      
      this.stats.jobsAccepted++;
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
      this.stats.jobsRejected++;
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
      const transaction = transactionTracker.getTransactionByJobId(String(job.id));
      if (transaction) {
        transactionTracker.updateTransaction(String(transaction.id), {
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

      this.stats.jobsCompleted++;
      this.logger.info(`${LOG_PREFIX.SUCCESS} Job ${job.id} completed successfully`);

    } catch (error) {
      const structuredError = ErrorFactory.fromUnknown(error);
      this.logger.error(
        `${LOG_PREFIX.ERROR} Error in TRANSACTION phase:`,
        structuredError.toJSON()
      );

      // Update transaction as failed
      const transaction = transactionTracker.getTransactionByJobId(String(job.id));
      if (transaction) {
        transactionTracker.updateTransaction(String(transaction.id), {
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
      
      this.stats.jobsFailed++;
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

      const buyerAddress = (job as any).buyer || (job as any).providerAddress || 'Unknown';

      // STEP 1: Monitor for payment transaction (50 USDC)
      this.logger.info(`${LOG_PREFIX.PROCESSING} Waiting for payment from ${buyerAddress}...`);
      const paymentTx = await paymentMonitor.monitorPayment(
        buyerAddress,
        config.servicePrice.toString(), // "50"
        {
          timeout: 300000, // 5 minutes
          pollInterval: 3000, // Check every 3 seconds
          confirmations: 1,
        }
      );

      this.logger.info(
        `${LOG_PREFIX.SUCCESS} Payment received! TX: ${paymentTx.hash}`,
        { amount: `${paymentTx.amount} USDC`, block: paymentTx.blockNumber }
      );

      // STEP 2: Create wallet signer for contract deployment
      const wallet = new ethers.Wallet(
        config.whitelistedWalletPrivateKey,
        this.contractUtils['provider']
      );

      // STEP 3: Execute contract deployment with retry logic
      const deploymentResult = await RetryUtil.withRetry(
        async () => {
          const params: DeploymentParams = {
            userWallet: buyerAddress,
            agentName: requirements.agentName || `ACP-${Date.now()}`,
            aiWallet: requirements.aiWallet || buyerAddress,
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

      // STEP 4: Call Kosher Capital API with both transaction hashes
      const apiResult = await this.kosherCapitalClient.quickDeploy({
        agentName: requirements.agentName || `ACP-${Date.now()}`,
        contractCreationTxnHash: deploymentResult.creationTxHash!,
        creating_user_wallet_address: buyerAddress,
        paymentTxnHash: paymentTx.hash, // Use captured payment TX hash
        deploySource: DEPLOYMENT_CONFIG.DEPLOYMENT_SOURCE,
        referralCode: requirements.metadata?.referralCode,
      });
      
      if (!apiResult.success) {
        throw new ProcessingError(
          `Kosher Capital API failed: ${apiResult.error}`,
          String(job.id),
          'api-call'
        );
      }

      return {
        success: true,
        ...deploymentResult,
        paymentTxHash: paymentTx.hash, // Include payment TX hash in result
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
   * Accept a job
   */
  private async acceptJob(job: AcpJob, reason?: string): Promise<void> {
    if (!this.acpClient) throw new Error('ACP client not initialized');

    // Get the latest memo ID
    const memos = job.memos || [];
    const latestMemoId = memos.length > 0 ? (memos[memos.length - 1] as any).id : 0;

    await this.acpClient.respondJob(
      job.id,
      latestMemoId,
      true, // accept
      reason || 'Job accepted'
    );
  }

  /**
   * Reject a job
   */
  private async rejectJob(job: AcpJob, reason: string): Promise<void> {
    if (!this.acpClient) throw new Error('ACP client not initialized');

    // Get the latest memo ID
    const memos = job.memos || [];
    const latestMemoId = memos.length > 0 ? (memos[memos.length - 1] as any).id : 0;

    await this.acpClient.respondJob(
      job.id,
      latestMemoId,
      false, // reject
      reason
    );

    // Clean up
    this.activeJobs.delete(String(job.id));
  }

  /**
   * Deliver job result
   */
  private async deliverJob(job: AcpJob, deliverable: QuickDeployDeliverable): Promise<void> {
    if (!this.acpClient) throw new Error('ACP client not initialized');

    // Format deliverable according to IDeliverable interface
    const formattedDeliverable = {
      type: 'text/json' as const,
      value: JSON.stringify(deliverable),
    };

    await this.acpClient.deliverJob(job.id, formattedDeliverable);
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(job: AcpJob, result: any): Promise<void> {
    try {
      const buyerAddress = (job as any).buyer || (job as any).providerAddress || 'Unknown';
      const notification = notificationService.createDeploymentNotification(
        String(job.id),
        {
          success: result.success,
          data: result,
        },
        buyerAddress,
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
    return jobs || [];
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(): Promise<AcpJob[]> {
    if (!this.acpClient) throw new Error('ACP client not initialized');

    const jobs = await this.acpClient.getCompletedJobs();
    return jobs || [];
  }

  /**
   * Get agent statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      activeJobs: this.activeJobs.size,
      queueStatus: this.jobQueue?.getQueueStatus ? this.jobQueue.getQueueStatus() : null,
    };
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    this.logger.info(`${LOG_PREFIX.INFO} Shutting down ACP agent...`);
    
    // Stop job queue
    if (this.jobQueue && this.jobQueue.stopProcessing) {
      this.jobQueue.stopProcessing();
      this.logger.info(`${LOG_PREFIX.INFO} Job queue stopped`);
    }
    
    // Clean up active jobs
    this.activeJobs.clear();
    
    // ACP client cleanup
    this.acpClient = null;
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} ACP agent shutdown complete`);
    this.logger.info(`${LOG_PREFIX.INFO} Final statistics:`, this.stats);
  }
}
