#!/usr/bin/env node

/**
 * @fileoverview Main entry point for Kosher Capital's Quick Deploy ACP integration.
 * This version is specifically configured for the quick deploy service.
 *
 * @author Athena AI Team
 * @license MIT
 */

import AcpClient, {
  AcpContractClient,
  AcpJob,
  baseAcpConfig,
} from '@virtuals-protocol/acp-node';

import { JobQueue } from './utils/simpleJobQueue';
import { TransactionMonitor } from './utils/transactionMonitorInstance';
import { SlaManager } from './utils/slaManager';
import { QuickDeployService } from './services/quickDeploy';
import { config } from './config';
import { Logger } from './utils/logger';

/**
 * Quick Deploy ACP Integration Class
 */
class QuickDeployAcpIntegration {
  /** Main ACP client for blockchain interactions */
  private acpClient!: AcpClient;

  /** Contract client for managing session keys and gas-free transactions */
  private acpContractClient!: AcpContractClient;

  /** Queue for managing job processing order and retries */
  private jobQueue!: JobQueue;

  /** Monitor for tracking transaction status and errors */
  private txMonitor!: TransactionMonitor;

  /** SLA manager for handling job expiration and lifecycle states */
  private slaManager!: SlaManager;

  /** Quick Deploy service implementation */
  private agentService: QuickDeployService;

  /** Flag to control the main processing loop */
  private isRunning = false;

  /**
   * Constructs a new Quick Deploy ACP Integration instance.
   *
   * @constructor
   */
  constructor() {
    // Initialize Quick Deploy service
    this.agentService = new QuickDeployService();
  }

  /**
   * Initializes all components required for ACP integration.
   *
   * @returns {Promise<void>} Resolves when initialization is complete
   * @throws {Error} If initialization fails, the process exits with code 1
   */
  async initialize(): Promise<void> {
    try {
      Logger.info('🚀 Initializing Quick Deploy ACP Integration...');
      Logger.info(`Service: ${config.serviceName}`);
      Logger.info(`Description: ${config.serviceDescription}`);

      // Validate that the agent service is ready to process requests
      const isValid = await this.agentService.validateService();
      if (!isValid) {
        Logger.warn('Service validation failed - continuing anyway');
      }

      // Initialize ACP Contract Client for gas-free transactions
      Logger.info('Initializing ACP Contract Client...');
      const networkConfig = baseAcpConfig; // Base mainnet
      
      this.acpContractClient = await AcpContractClient.build(
        config.whitelistedWalletPrivateKey as `0x${string}`,
        config.whitelistedWalletEntityId,
        config.agentWalletAddress as `0x${string}`,
        networkConfig
      );

      // Initialize the main ACP Client with event callbacks
      this.acpClient = new AcpClient({
        acpContractClient: this.acpContractClient,
        onNewTask: (job: AcpJob) => this.handleNewJob(job),
        onEvaluate: (job: AcpJob) => this.handleEvaluate(job),
      });

      // Initialize the client to establish blockchain connections
      await this.acpClient.init();

      // Initialize utility services
      this.jobQueue = new JobQueue();
      this.txMonitor = new TransactionMonitor();
      this.slaManager = new SlaManager();

      Logger.info('✅ Quick Deploy ACP Integration initialized successfully');
      this.isRunning = true;

      // Start the main processing loop
      await this.start();
    } catch (error) {
      Logger.error('Failed to initialize Quick Deploy ACP integration:', error);
      process.exit(1);
    }
  }

  /**
   * Handles new job notifications from the ACP network.
   *
   * @param {AcpJob} job - The job object from the ACP network
   * @private
   */
  private handleNewJob(job: AcpJob): void {
    Logger.info(`📥 New quick deploy job received: ${job.id}`);

    // Extract job parameters to validate it's a quick deploy request
    const jobParams = job as any;
    
    // Only accept jobs that match our service scope
    if (!this.isQuickDeployJob(jobParams)) {
      Logger.warn(`Job ${job.id} is not a quick deploy request, ignoring`);
      return;
    }

    // Add the job to our processing queue with additional metadata
    this.jobQueue.addJob({
      id: String(job.id),
      buyer: (job as any).buyer || job.providerAddress || 'Unknown',
      phase: String(job.phase),
      priority: 10, // Default priority for new jobs
      timestamp: Date.now(),
      retryCount: 0,
      params: job, // Store full job object for processing
    });
    
    // Add to SLA tracking for expiration monitoring
    this.slaManager.addJob(String(job.id));
  }

  /**
   * Checks if a job is a quick deploy request.
   *
   * @param {any} job - The job to check
   * @returns {boolean} True if it's a quick deploy job
   * @private
   */
  private isQuickDeployJob(job: any): boolean {
    // Check if the job has the required parameters for quick deploy
    if (!job.params) return false;
    
    // Check for quick deploy specific parameters
    const hasPaymentHash = !!job.params.paymentTxHash;
    const hasUserWallet = !!job.params.userWallet;
    
    // Check if the service description matches
    const isQuickDeploy = job.serviceDescription?.toLowerCase().includes('deploy') ||
                         job.serviceDescription?.toLowerCase().includes('trading agent') ||
                         job.params.type === 'quick-deploy';
    
    return hasPaymentHash && hasUserWallet && isQuickDeploy;
  }

  /**
   * Handles job evaluation requests from the ACP network.
   *
   * @param {AcpJob} job - The job requiring evaluation
   * @private
   */
  private handleEvaluate(job: AcpJob): void {
    Logger.info(`📊 Job evaluation requested: ${job.id}`);
    // Quick deploy doesn't require evaluation - agents are deployed automatically
  }

  /**
   * Main processing loop for the agent.
   *
   * @returns {Promise<void>} Runs indefinitely until shutdown
   * @private
   */
  private async start(): Promise<void> {
    Logger.info('🔄 Starting Quick Deploy main loop...');

    // Fetch any existing active jobs on startup
    await this.fetchActiveJobs();

    // Main processing loop - runs until shutdown
    while (this.isRunning) {
      try {
        // Periodically fetch new jobs from the network
        if (Date.now() % 10000 < config.acpProcessingDelay) {
          await this.fetchActiveJobs();
        }

        // Check for expired jobs first
        const expiredJobs = this.slaManager.checkExpiredJobs();
        if (expiredJobs.length > 0) {
          Logger.warn(`Found ${expiredJobs.length} expired jobs, removing from queue`);
          expiredJobs.forEach(jobId => this.jobQueue.removeJob(jobId));
        }
        
        // Process the next job in the queue
        const nextJob = this.jobQueue.getNextJob();
        if (nextJob) {
          await this.processJob(nextJob);
        }

        // Sleep before next iteration
        await this.sleep(config.acpProcessingDelay);
      } catch (error) {
        Logger.error('Error in main loop:', error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * Fetches active jobs from the ACP network.
   *
   * @returns {Promise<void>}
   * @private
   */
  private async fetchActiveJobs(): Promise<void> {
    try {
      const activeJobs = await this.acpClient.getActiveJobs();
      Logger.info(`Found ${activeJobs.length} active jobs`);

      // Add any jobs we haven't seen before to the queue
      for (const job of activeJobs) {
        if (!this.jobQueue.isQueued(String(job.id)) && this.isQuickDeployJob(job)) {
          this.handleNewJob(job);
        }
      }
    } catch (error) {
      Logger.error('Error fetching active jobs:', error);
    }
  }

  /**
   * Processes a single quick deploy job from the queue.
   *
   * @param {any} job - The queued job to process
   * @returns {Promise<void>}
   * @private
   */
  private async processJob(job: any): Promise<void> {
    try {
      Logger.info(`⚙️ Processing quick deploy job ${job.id}`);

      // Extract the full ACP job data
      const acpJob = job.params as AcpJob;

      // Prepare request parameters for the quick deploy service
      const quickDeployParams = {
        paymentTxHash: acpJob.params?.paymentTxHash || '',
        userWallet: acpJob.params?.userWallet || job.buyer,
        agentName: acpJob.params?.agentName,
      };

      // Call the quick deploy service to process the request
      const response = await this.agentService.processRequest({
        jobId: job.id,
        buyer: job.buyer,
        params: quickDeployParams,
        timestamp: job.timestamp,
      });

      if (response.success) {
        // Deliver successful result to the blockchain
        await this.deliverJob(acpJob, response.data);
        this.jobQueue.markCompleted(job.id);
        this.slaManager.markCompleted(job.id);
        Logger.info(`✅ Quick deploy job ${job.id} completed successfully`);
      } else {
        // Handle job failure by sending rejection
        await this.rejectJob(acpJob, response.error || 'Deployment failed');
        this.jobQueue.markFailed(job.id);
        this.slaManager.markRejected(job.id, response.error);
        Logger.error(`❌ Quick deploy job ${job.id} failed: ${response.error}`);
      }
    } catch (error) {
      Logger.error(`Error processing quick deploy job ${job.id}:`, error);
      this.jobQueue.markFailed(job.id);

      // Implement retry logic
      if (job.retryCount < config.acpMaxRetries) {
        job.retryCount++;
        job.priority -= 5;
        this.slaManager.incrementRetry(job.id);
        this.jobQueue.addJob(job);
        Logger.info(`🔄 Job ${job.id} queued for retry (attempt ${job.retryCount})`);
      } else {
        this.slaManager.markRejected(job.id, 'Max retries exceeded');
      }
    }
  }

  /**
   * Delivers job results to the ACP network.
   *
   * @param {AcpJob} job - The job being completed
   * @param {any} result - The result data to deliver
   * @returns {Promise<void>}
   * @private
   */
  private async deliverJob(job: AcpJob, result: any): Promise<void> {
    try {
      // Format the deliverable with deployment details
      const deliverable = {
        type: 'text/json',
        value: JSON.stringify({
          success: true,
          agentName: result.agentName,
          contractAddress: result.contractAddress,
          deploymentTxHash: result.deploymentTxHash,
          message: result.message,
          details: result.details,
          timestamp: new Date().toISOString(),
        }),
      };

      // Submit the deliverable on-chain
      const tx = await this.acpClient.deliverJob(job.id, deliverable);

      // Monitor transaction if monitoring is enabled
      if (config.enableTxMonitoring) {
        await this.txMonitor.monitorTransaction(
          { hash: tx, wait: async () => ({ status: 1 }) },
          'deliver',
          String(job.id)
        );
      }

      Logger.info(`✅ Quick deploy job ${job.id} delivered on-chain`);
    } catch (error) {
      Logger.error(`Failed to deliver job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Rejects a job with a specified reason.
   *
   * @param {AcpJob} job - The job being rejected
   * @param {string} reason - Human-readable rejection reason
   * @returns {Promise<void>}
   * @private
   */
  private async rejectJob(job: AcpJob, reason: string): Promise<void> {
    try {
      const message = {
        type: 'rejection' as any,
        data: {
          reason,
          timestamp: Date.now(),
        },
      };

      const tx = await this.acpClient.sendMessage(
        job.id,
        message,
        'REJECTED' as any
      );

      if (config.enableTxMonitoring) {
        await this.txMonitor.monitorTransaction(
          { hash: tx, wait: async () => ({ status: 1 }) },
          'reject',
          String(job.id)
        );
      }

      Logger.info(`❌ Quick deploy job ${job.id} rejected on-chain`);
    } catch (error) {
      Logger.error(`Failed to reject job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Helper function to sleep for a specified duration.
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Performs graceful shutdown of the agent.
   *
   * @returns {Promise<void>}
   */
  async shutdown(): Promise<void> {
    Logger.info('🛑 Shutting down Quick Deploy ACP integration...');
    this.isRunning = false;

    // Print transaction summary
    if (this.txMonitor) {
      this.txMonitor.printSummary();
    }
    
    // Print SLA statistics
    if (this.slaManager) {
      const stats = this.slaManager.getStatistics();
      Logger.info(`SLA Summary - Active: ${stats.activeJobs}, Environment: ${stats.environment}`);
      if (stats.environment === 'sandbox') {
        Logger.info(`Graduation progress: ${stats.sandboxProgress}/10 transactions`);
        if (stats.graduationReady) {
          Logger.info('🎓 Ready for graduation! Contact Virtuals team for manual review.');
        }
      }
      this.slaManager.shutdown();
    }

    Logger.info('👋 Shutdown complete');
    process.exit(0);
  }
}

/**
 * Main entry point for the application.
 *
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const integration = new QuickDeployAcpIntegration();

  // Handle shutdown signals for graceful termination
  process.on('SIGINT', () => integration.shutdown());
  process.on('SIGTERM', () => integration.shutdown());

  // Handle uncaught errors to prevent silent failures
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Initialize and start the agent
  await integration.initialize();
}

// Run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    Logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { QuickDeployAcpIntegration };
