#!/usr/bin/env node

import { ethers } from 'ethers';
import { AcpClient } from '@virtuals-protocol/acp-node';
import { AcpPlugin } from '@virtuals-protocol/game-acp-plugin';
import { JobQueue } from './utils/jobQueue';
import { TransactionMonitor } from './utils/transactionMonitor';
import { AcpStateManager } from './utils/acpStateManager';
import { DefaultAgentService, CustomAgentService } from './services/agentService';
import { config } from './config';
import { Logger } from './utils/logger';

/**
 * Main ACP Integration Class
 */
class AcpIntegration {
  private acpPlugin!: AcpPlugin;
  private jobQueue!: JobQueue;
  private txMonitor!: TransactionMonitor;
  private stateManager!: AcpStateManager;
  private agentService: DefaultAgentService | CustomAgentService;
  private isRunning = false;

  constructor() {
    // Initialize your agent service
    // Use DefaultAgentService for API-based services
    // Use CustomAgentService for custom logic
    this.agentService = new DefaultAgentService();
  }

  /**
   * Initialize the ACP integration
   */
  async initialize() {
    try {
      Logger.info('🚀 Initializing ACP Integration...');
      Logger.info(`Service: ${config.serviceName}`);
      Logger.info(`Description: ${config.serviceDescription}`);

      // Validate service
      const isValid = await this.agentService.validateService();
      if (!isValid) {
        Logger.warn('Service validation failed - continuing anyway');
      }

      // Initialize ACP client
      const wallet = new ethers.Wallet(config.whitelistedWalletPrivateKey);
      const provider = new ethers.JsonRpcProvider(config.acpRpcUrl);
      const signer = wallet.connect(provider);

      const acpClient = new AcpClient({
        contractAddress: config.acpContractAddress,
        signer,
        defaultJobAddress: config.agentWalletAddress,
      });

      // Initialize ACP plugin
      this.acpPlugin = new AcpPlugin({
        apiKey: config.gameApiKey,
        acpClient,
      });

      // Initialize utilities
      this.jobQueue = new JobQueue();
      this.txMonitor = new TransactionMonitor();
      this.stateManager = new AcpStateManager();

      // Register service provision function
      this.registerServiceProvision();

      Logger.info('✅ ACP Integration initialized successfully');
      this.isRunning = true;

      // Start the main loop
      await this.start();
    } catch (error) {
      Logger.error('Failed to initialize ACP integration:', error);
      process.exit(1);
    }
  }

  /**
   * Register the service provision function with ACP
   */
  private registerServiceProvision() {
    this.acpPlugin.registerFunction(
      'provide_service',
      async () => {
        return {
          name: config.serviceName,
          description: config.serviceDescription,
          price: config.servicePrice,
          available: true,
        };
      },
      {
        priceInEth: config.servicePrice,
        description: config.serviceDescription,
      }
    );

    Logger.info(`📝 Registered service: ${config.serviceName}`);
  }

  /**
   * Main loop to process ACP jobs
   */
  private async start() {
    Logger.info('🔄 Starting main loop...');

    // Set up mock buyer if enabled
    if (config.enableMockBuyer) {
      this.setupMockBuyer();
    }

    // Main processing loop
    while (this.isRunning) {
      try {
        await this.processNextJob();
        await this.sleep(config.acpProcessingDelay);
      } catch (error) {
        Logger.error('Error in main loop:', error);
        await this.sleep(5000);
      }
    }
  }

  /**
   * Process the next job from the queue
   */
  private async processNextJob() {
    // Get state from ACP
    const rawState = await this.acpPlugin.getState();
    
    // Filter and manage state
    const state = this.stateManager.filterState(rawState);
    
    // Check for new jobs
    const pendingJobs = state.jobs?.filter(job => 
      job.status === 'pending' && 
      !this.jobQueue.isQueued(job.id)
    ) || [];

    // Add new jobs to queue
    for (const job of pendingJobs) {
      this.jobQueue.addJob({
        id: job.id,
        buyer: job.buyer,
        phase: 'request',
        priority: 10,
        timestamp: Date.now(),
        retryCount: 0,
      });
      Logger.info(`📥 New job added to queue: ${job.id}`);
    }

    // Process next job in queue
    const nextJob = this.jobQueue.getNextJob();
    if (nextJob) {
      await this.processJob(nextJob);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: any) {
    try {
      Logger.info(`⚙️ Processing job ${job.id} (phase: ${job.phase})`);

      // Call the agent service
      const response = await this.agentService.processRequest({
        jobId: job.id,
        buyer: job.buyer,
        params: job.params,
        timestamp: job.timestamp,
      });

      if (response.success) {
        // Accept the job
        await this.acceptJob(job.id, response.data);
        this.jobQueue.markCompleted(job.id);
        Logger.info(`✅ Job ${job.id} completed successfully`);
      } else {
        // Reject the job
        await this.rejectJob(job.id, response.error || 'Service error');
        this.jobQueue.markFailed(job.id);
        Logger.error(`❌ Job ${job.id} failed: ${response.error}`);
      }
    } catch (error) {
      Logger.error(`Error processing job ${job.id}:`, error);
      this.jobQueue.markFailed(job.id);
      
      // Retry if under max retries
      if (job.retryCount < config.acpMaxRetries) {
        job.retryCount++;
        job.priority -= 5; // Lower priority for retries
        this.jobQueue.addJob(job);
        Logger.info(`🔄 Job ${job.id} queued for retry (attempt ${job.retryCount})`);
      }
    }
  }

  /**
   * Accept a job and deliver the result
   */
  private async acceptJob(jobId: string, result: any) {
    try {
      const tx = await this.acpPlugin.acpClient.acceptJob(jobId, result);
      
      if (config.enableTxMonitoring) {
        await this.txMonitor.monitorTransaction(tx, 'accept', jobId);
      }
      
      await tx.wait();
      Logger.info(`✅ Job ${jobId} accepted on-chain`);
    } catch (error) {
      Logger.error(`Failed to accept job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Reject a job with a reason
   */
  private async rejectJob(jobId: string, reason: string) {
    try {
      const tx = await this.acpPlugin.acpClient.rejectJob(jobId, reason);
      
      if (config.enableTxMonitoring) {
        await this.txMonitor.monitorTransaction(tx, 'reject', jobId);
      }
      
      await tx.wait();
      Logger.info(`❌ Job ${jobId} rejected on-chain`);
    } catch (error) {
      Logger.error(`Failed to reject job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Set up mock buyer for testing
   */
  private setupMockBuyer() {
    Logger.info('🧪 Mock buyer enabled for testing');
    
    setInterval(async () => {
      try {
        // Create a mock job request
        const mockJob = {
          id: `mock-${Date.now()}`,
          buyer: '0xMockBuyer',
          params: {
            test: true,
            timestamp: Date.now(),
          },
          phase: 'request',
          priority: 5,
          timestamp: Date.now(),
          retryCount: 0,
        };
        
        this.jobQueue.addJob(mockJob);
        Logger.info(`🧪 Mock job created: ${mockJob.id}`);
      } catch (error) {
        Logger.error('Error creating mock job:', error);
      }
    }, config.mockBuyerInterval);
  }

  /**
   * Helper function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    Logger.info('🛑 Shutting down ACP integration...');
    this.isRunning = false;
    
    // Clean up resources
    if (this.txMonitor) {
      this.txMonitor.printSummary();
    }
    
    Logger.info('👋 Shutdown complete');
    process.exit(0);
  }
}

// Main entry point
async function main() {
  const integration = new AcpIntegration();
  
  // Handle shutdown signals
  process.on('SIGINT', () => integration.shutdown());
  process.on('SIGTERM', () => integration.shutdown());
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
  
  // Initialize and start
  await integration.initialize();
}

// Run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    Logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { AcpIntegration };