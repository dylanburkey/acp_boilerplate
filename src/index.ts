#!/usr/bin/env node

/**
 * @fileoverview Main entry point for the ACP (Agent Commerce Protocol) integration.
 * This file initializes and manages an AI agent that can process jobs through
 * the Virtuals Protocol network, handling job lifecycle from receipt to delivery.
 *
 * @author ACP Integration Boilerplate
 * @license MIT
 */

import AcpClient, {
  AcpContractClient,
  AcpJob,
  baseAcpConfig,
} from '@virtuals-protocol/acp-node';
// import AcpPlugin from '@virtuals-protocol/game-acp-plugin'; // Uncomment if using ACP Plugin for state management

import {JobQueue} from './utils/simpleJobQueue';
import {TransactionMonitor} from './utils/transactionMonitorInstance';
// import AcpStateManager from './utils/acpStateManagerWrapper'; // Uncomment if using state filtering
import {
  DefaultAgentService,
  CustomAgentService,
} from './services/agentService';
import {config} from './config';
import {Logger} from './utils/logger';

/**
 * Main ACP Integration Class that manages the AI agent's lifecycle.
 *
 * This class handles:
 * - Initialization of ACP clients and blockchain connections
 * - Job queue management and processing
 * - Transaction monitoring and error handling
 * - Agent service orchestration
 *
 * @class AcpIntegration
 */
class AcpIntegration {

  /** Main ACP client for blockchain interactions */
  private acpClient!: AcpClient;

  /** Contract client for managing session keys and gas-free transactions */
  private acpContractClient!: AcpContractClient;

  /** Queue for managing job processing order and retries */
  private jobQueue!: JobQueue;

  /** Monitor for tracking transaction status and errors */
  private txMonitor!: TransactionMonitor;


  /** Service implementation for processing agent requests */
  private agentService: DefaultAgentService | CustomAgentService;

  /** Flag to control the main processing loop */
  private isRunning = false;

  /** Session key ID for gas-free transaction management */
  private readonly sessionEntityKeyId = 1;

  /**
   * Constructs a new ACP Integration instance.
   * Initializes the agent service based on configuration.
   *
   * To use a custom service implementation:
   * 1. Import your custom service class
   * 2. Replace DefaultAgentService with your implementation
   *
   * @constructor
   */
  constructor() {
    // Initialize your agent service
    // Use DefaultAgentService for API-based services
    // Use CustomAgentService for custom logic
    this.agentService = new DefaultAgentService();
  }

  /**
   * Initializes all components required for ACP integration.
   *
   * This method performs the following initialization steps:
   * 1. Validates the agent service
   * 2. Builds the ACP contract client with session keys
   * 3. Initializes the main ACP client with callbacks
   * 4. Sets up the ACP plugin for additional functionality
   * 5. Initializes utility services (queue, monitor, state manager)
   *
   * @returns {Promise<void>} Resolves when initialization is complete
   * @throws {Error} If initialization fails, the process exits with code 1
   */
  async initialize(): Promise<void> {
    try {
      Logger.info('🚀 Initializing ACP Integration...');
      Logger.info(`Service: ${config.serviceName}`);
      Logger.info(`Description: ${config.serviceDescription}`);

      // Validate that the agent service is ready to process requests
      const isValid = await this.agentService.validateService();
      if (!isValid) {
        Logger.warn('Service validation failed - continuing anyway');
      }

      // Initialize ACP Contract Client for gas-free transactions
      // The contract client manages session keys which allow the agent
      // to perform transactions without holding ETH for gas
      Logger.info('Initializing ACP Contract Client...');
      this.acpContractClient = await AcpContractClient.build(
        config.whitelistedWalletPrivateKey as `0x${string}`,
        this.sessionEntityKeyId,
        config.agentWalletAddress as `0x${string}`,
        baseAcpConfig // Use base chain configuration
      );

      // Initialize the main ACP Client with event callbacks
      // This client handles communication with the ACP network
      this.acpClient = new AcpClient({
        acpContractClient: this.acpContractClient,
        onNewTask: (job: AcpJob) => this.handleNewJob(job),
        onEvaluate: (job: AcpJob) => this.handleEvaluate(job),
      });

      // Initialize the client to establish blockchain connections
      await this.acpClient.init();

      // Initialize ACP Plugin for additional game-specific functions (if needed)
      // Uncomment the following to use the ACP Plugin for state management:
      // const acpPlugin = new AcpPlugin({
      //   apiKey: config.gameApiKey,
      //   acpClient: this.acpClient,
      // });

      // Initialize utility services
      this.jobQueue = new JobQueue();
      this.txMonitor = new TransactionMonitor();
      // Uncomment if using state filtering:
      // const stateManager = new AcpStateManager();

      Logger.info('✅ ACP Integration initialized successfully');
      this.isRunning = true;

      // Start the main processing loop
      await this.start();
    } catch (error) {
      Logger.error('Failed to initialize ACP integration:', error);
      process.exit(1);
    }
  }

  /**
   * Handles new job notifications from the ACP network.
   *
   * This callback is triggered when a new job is created on-chain.
   * The job is added to the processing queue with appropriate metadata.
   *
   * @param {AcpJob} job - The job object from the ACP network
   * @private
   */
  private handleNewJob(job: AcpJob): void {
    Logger.info(`📥 New job received: ${job.id}`);

    // Add the job to our processing queue with additional metadata
    this.jobQueue.addJob({
      id: String(job.id),
      // Extract buyer address from job, fallback to provider if not available
      buyer: (job as any).buyer || job.providerAddress || 'Unknown',
      phase: String(job.phase),
      priority: 10, // Default priority for new jobs
      timestamp: Date.now(),
      retryCount: 0,
      params: job, // Store full job object for processing
    });
  }

  /**
   * Handles job evaluation requests from the ACP network.
   *
   * This callback is triggered when an evaluator agent needs to verify
   * the quality of work performed. Implement custom evaluation logic here.
   *
   * @param {AcpJob} job - The job requiring evaluation
   * @private
   */
  private handleEvaluate(job: AcpJob): void {
    Logger.info(`📊 Job evaluation requested: ${job.id}`);
    // TODO: Implement evaluation logic if your agent acts as an evaluator
    // This could include checking deliverable quality, format validation, etc.
  }

  /**
   * Main processing loop for the agent.
   *
   * This method:
   * 1. Sets up mock buyer for testing (if enabled)
   * 2. Fetches initial active jobs from the network
   * 3. Continuously processes jobs from the queue
   * 4. Periodically refreshes the job list
   *
   * @returns {Promise<void>} Runs indefinitely until shutdown
   * @private
   */
  private async start(): Promise<void> {
    Logger.info('🔄 Starting main loop...');

    // Set up mock buyer for local testing without real transactions
    if (config.enableMockBuyer) {
      this.setupMockBuyer();
    }

    // Fetch any existing active jobs on startup
    await this.fetchActiveJobs();

    // Main processing loop - runs until shutdown
    while (this.isRunning) {
      try {
        // Periodically fetch new jobs from the network
        // This ensures we don't miss jobs even if callbacks fail
        if (Date.now() % 10000 < config.acpProcessingDelay) {
          await this.fetchActiveJobs();
        }

        // Process the next job in the queue
        const nextJob = this.jobQueue.getNextJob();
        if (nextJob) {
          await this.processJob(nextJob);
        }

        // Sleep before next iteration to prevent CPU spinning
        await this.sleep(config.acpProcessingDelay);
      } catch (error) {
        Logger.error('Error in main loop:', error);
        // On error, wait longer before retrying
        await this.sleep(5000);
      }
    }
  }

  /**
   * Fetches active jobs from the ACP network.
   *
   * This method queries the blockchain for jobs assigned to this agent
   * and adds any new jobs to the processing queue. If the state manager
   * is available, it can be used to filter the state to prevent memory issues.
   *
   * @returns {Promise<void>}
   * @private
   */
  private async fetchActiveJobs(): Promise<void> {
    try {
      // Option 1: Get jobs directly from ACP client
      const activeJobs = await this.acpClient.getActiveJobs();
      
      // Option 2: Use ACP Plugin to get state if additional filtering is needed
      // Uncomment the following imports at the top of the file and initialization in constructor:
      // import AcpPlugin from '@virtuals-protocol/game-acp-plugin';
      // import AcpStateManager from './utils/acpStateManagerWrapper';
      // Then uncomment and use:
      // const acpPlugin = new AcpPlugin({apiKey: config.gameApiKey, acpClient: this.acpClient});
      // const stateManager = new AcpStateManager();
      // const state = await acpPlugin.getAcpState();
      // const filteredState = stateManager.filterState(state);
      // const activeJobs = filteredState.jobs?.filter(job => job.status === 'active') || [];
      
      Logger.info(`Found ${activeJobs.length} active jobs`);

      // Add any jobs we haven't seen before to the queue
      for (const job of activeJobs) {
        if (!this.jobQueue.isQueued(String(job.id))) {
          this.handleNewJob(job);
        }
      }
    } catch (error) {
      Logger.error('Error fetching active jobs:', error);
    }
  }

  /**
   * Processes a single job from the queue.
   *
   * This method:
   * 1. Extracts job data and calls the agent service
   * 2. Delivers successful results to the blockchain
   * 3. Handles failures with rejection messages
   * 4. Manages retry logic for transient failures
   *
   * @param {any} job - The queued job to process
   * @returns {Promise<void>}
   * @private
   */
  private async processJob(job: any): Promise<void> {
    try {
      Logger.info(`⚙️ Processing job ${job.id} (phase: ${job.phase})`);

      // Extract the full ACP job data
      const acpJob = job.params as AcpJob;

      // Call the agent service to process the request
      const response = await this.agentService.processRequest({
        jobId: job.id,
        buyer: job.buyer,
        params: acpJob,
        timestamp: job.timestamp,
      });

      if (response.success) {
        // Deliver successful result to the blockchain
        await this.deliverJob(acpJob, response.data);
        this.jobQueue.markCompleted(job.id);
        Logger.info(`✅ Job ${job.id} completed successfully`);
      } else {
        // Handle job failure by sending rejection
        await this.rejectJob(acpJob, response.error || 'Service error');
        this.jobQueue.markFailed(job.id);
        Logger.error(`❌ Job ${job.id} failed: ${response.error}`);
      }
    } catch (error) {
      Logger.error(`Error processing job ${job.id}:`, error);
      this.jobQueue.markFailed(job.id);

      // Implement exponential backoff for retries
      if (job.retryCount < config.acpMaxRetries) {
        job.retryCount++;
        job.priority -= 5; // Lower priority for retried jobs
        this.jobQueue.addJob(job);
        Logger.info(`🔄 Job ${job.id} queued for retry (attempt ${job.retryCount})`);
      }
    }
  }

  /**
   * Delivers job results to the ACP network.
   *
   * This method submits the processed results on-chain, making them
   * available to the buyer and triggering payment release.
   *
   * @param {AcpJob} job - The job being completed
   * @param {any} result - The result data to deliver
   * @returns {Promise<void>}
   * @throws {Error} If delivery fails
   * @private
   */
  private async deliverJob(job: AcpJob, result: any): Promise<void> {
    try {
      // Format the deliverable according to ACP standards
      const deliverable = {
        type: 'text/json',
        value: JSON.stringify(result),
      };

      // Submit the deliverable on-chain
      const tx = await this.acpClient.deliverJob(job.id, deliverable);

      // Monitor transaction if monitoring is enabled
      if (config.enableTxMonitoring) {
        await this.txMonitor.monitorTransaction(
          {hash: tx, wait: async () => ({status: 1})},
          'deliver',
          String(job.id)
        );
      }

      Logger.info(`✅ Job ${job.id} delivered on-chain`);
    } catch (error) {
      Logger.error(`Failed to deliver job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Rejects a job with a specified reason.
   *
   * This method sends a rejection message on-chain, informing the buyer
   * that the job cannot be completed and potentially triggering a refund.
   *
   * @param {AcpJob} job - The job being rejected
   * @param {string} reason - Human-readable rejection reason
   * @returns {Promise<void>}
   * @throws {Error} If rejection fails
   * @private
   */
  private async rejectJob(job: AcpJob, reason: string): Promise<void> {
    try {
      // Format rejection message according to ACP standards
      const message = {
        type: 'rejection' as any,
        data: {
          reason,
          timestamp: Date.now(),
        },
      };

      // Send rejection message on-chain
      const tx = await this.acpClient.sendMessage(
        job.id,
        message,
        'REJECTED' as any
      );

      // Monitor transaction if monitoring is enabled
      if (config.enableTxMonitoring) {
        await this.txMonitor.monitorTransaction(
          {hash: tx, wait: async () => ({status: 1})},
          'reject',
          String(job.id)
        );
      }

      Logger.info(`❌ Job ${job.id} rejected on-chain`);
    } catch (error) {
      Logger.error(`Failed to reject job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Sets up a mock buyer for testing purposes.
   *
   * This method creates simulated jobs at regular intervals,
   * allowing developers to test their agent logic without real
   * blockchain transactions or buyer interactions.
   *
   * @private
   */
  private setupMockBuyer(): void {
    Logger.info('🧪 Mock buyer enabled for testing');

    setInterval(async () => {
      try {
        // Create a simulated job with test data
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
   * Helper function to sleep for a specified duration.
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>} Resolves after the specified time
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Performs graceful shutdown of the agent.
   *
   * This method:
   * 1. Stops the main processing loop
   * 2. Prints transaction summary
   * 3. Cleans up resources
   * 4. Exits the process
   *
   * @returns {Promise<void>}
   */
  async shutdown(): Promise<void> {
    Logger.info('🛑 Shutting down ACP integration...');
    this.isRunning = false;

    // Print transaction summary if available
    if (this.txMonitor) {
      this.txMonitor.printSummary();
    }

    Logger.info('👋 Shutdown complete');
    process.exit(0);
  }
}

/**
 * Main entry point for the application.
 *
 * This function:
 * 1. Creates an ACP Integration instance
 * 2. Sets up signal handlers for graceful shutdown
 * 3. Configures error handlers
 * 4. Initializes and starts the agent
 *
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const integration = new AcpIntegration();

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

export {AcpIntegration};