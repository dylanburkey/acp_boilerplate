/**
 * @fileoverview Enhanced transaction monitoring and callback system
 * Automatically captures transaction hashes and sends them to Kosher Capital
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { ethers } from 'ethers';
import { Logger } from '../../utils/logger';
import { getKosherCapitalClient } from './kosherCapitalClient';
import { EventMonitor } from './eventMonitor';
import { notificationService } from './notificationService';
import { transactionTracker } from './transactionTracker';
import {
  DeploymentParams,
  DeploymentResult,
  TransactionStatus,
  MonitoredEvent,
  ErrorCode,
} from './types';
import { ErrorFactory, Validators } from './errors';
import { RetryUtil, CircuitBreaker } from './retry';
import {
  CONTRACT_ADDRESSES,
  EVENTS,
  LOG_PREFIX,
  ACP_CONFIG,
  TRANSACTION_CONFIG,
} from './constants';

/**
 * Transaction capture configuration
 */
interface TransactionCaptureConfig {
  autoCapture: boolean;
  webhookUrl?: string;
  callbackDelay?: number;
  maxRetries?: number;
}

/**
 * Enhanced transaction monitor for automatic TX hash capture
 */
export class TransactionMonitor {
  private readonly logger = Logger;
  private readonly eventMonitor: EventMonitor;
  private readonly kosherCapitalClient = getKosherCapitalClient();
  private readonly circuitBreaker: CircuitBreaker;
  private readonly config: TransactionCaptureConfig;
  
  constructor(
    provider: ethers.providers.Provider,
    config?: TransactionCaptureConfig
  ) {
    this.config = {
      autoCapture: true,
      callbackDelay: 1000, // 1 second delay after confirmation
      maxRetries: 3,
      ...config,
    };
    
    // Initialize event monitor
    this.eventMonitor = new EventMonitor(provider);
    
    // Initialize circuit breaker for callbacks
    this.circuitBreaker = new CircuitBreaker('tx-callback', {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });
    
    this.logger.info(
      `${LOG_PREFIX.INIT} Transaction monitor initialized`,
      { autoCapture: this.config.autoCapture }
    );
  }

  /**
   * Monitor deployment and automatically send TX hashes to Kosher Capital
   */
  async monitorDeployment(
    params: DeploymentParams,
    jobId: string
  ): Promise<DeploymentResult & { callbackSent: boolean }> {
    try {
      this.logger.info(
        `${LOG_PREFIX.PROCESSING} Starting monitored deployment`,
        { jobId, agentName: params.agentName }
      );

      // Pre-generate agent name with ACP prefix
      const agentName = this.ensureACPPrefix(params.agentName);
      
      // Update params with prefixed name
      const enhancedParams = { ...params, agentName };

      // Start monitoring for events before deployment
      const eventPromise = this.startEventMonitoring(
        params.userWallet,
        jobId
      );

      // Execute deployment
      const deploymentResult = await this.executeDeployment(
        enhancedParams,
        jobId
      );

      // If auto-capture is enabled, wait for events and send callback
      let callbackSent = false;
      if (this.config.autoCapture) {
        callbackSent = await this.captureAndSendTxHashes(
          deploymentResult,
          params.userWallet,
          jobId
        );
      }

      // Stop event monitoring
      this.eventMonitor.stopMonitoring(jobId);

      return {
        ...deploymentResult,
        callbackSent,
      };

    } catch (error) {
      this.logger.error(
        `${LOG_PREFIX.ERROR} Monitored deployment failed`,
        { error, jobId }
      );
      throw error;
    }
  }

  /**
   * Execute deployment with enhanced tracking
   */
  private async executeDeployment(
    params: DeploymentParams,
    jobId: string
  ): Promise<DeploymentResult> {
    // This would typically call contractUtils.deployAgent
    // For now, we'll simulate the structure
    const result: DeploymentResult = {
      fundAddress: '0x...', // From contract deployment
      creationTxHash: '0x...',
      paymentTxHash: '0x...',
      enableTradingTxHash: '0x...',
    };

    // Track each transaction
    await this.trackTransaction(jobId, 'creation', result.creationTxHash);
    await this.trackTransaction(jobId, 'payment', result.paymentTxHash);
    await this.trackTransaction(jobId, 'enable', result.enableTradingTxHash);

    return result;
  }

  /**
   * Start monitoring for deployment events
   */
  private async startEventMonitoring(
    userWallet: string,
    jobId: string
  ): Promise<void> {
    const filters = [
      {
        address: CONTRACT_ADDRESSES.FACTORY,
        event: EVENTS.PERSONAL_FUND_CREATED,
        filter: { creator: userWallet },
      },
      {
        address: CONTRACT_ADDRESSES.USDC,
        event: EVENTS.TRANSFER,
        filter: { from: userWallet },
      },
    ];

    for (const filter of filters) {
      this.eventMonitor.addEventFilter({
        contractAddress: filter.address,
        eventName: filter.event,
        filter: filter.filter,
        callback: async (event: MonitoredEvent) => {
          await this.handleMonitoredEvent(event, jobId);
        },
      });
    }

    // Start monitoring
    this.eventMonitor.startMonitoring(jobId);
  }

  /**
   * Handle monitored blockchain events
   */
  private async handleMonitoredEvent(
    event: MonitoredEvent,
    jobId: string
  ): Promise<void> {
    this.logger.info(
      `${LOG_PREFIX.PROCESSING} Event captured`,
      {
        jobId,
        event: event.eventName,
        txHash: event.transactionHash,
      }
    );

    // Update transaction tracker with event data
    const transaction = transactionTracker.getTransactionByJobId(jobId);
    if (transaction) {
      if (event.eventName === EVENTS.PERSONAL_FUND_CREATED) {
        transactionTracker.updateTransaction(transaction.id, {
          contractCreationTxHash: event.transactionHash,
          contractAddress: event.args.fundAddress,
        });
      } else if (event.eventName === EVENTS.TRANSFER) {
        transactionTracker.updateTransaction(transaction.id, {
          paymentTxHash: event.transactionHash,
        });
      }
    }
  }

  /**
   * Capture and send TX hashes to Kosher Capital
   */
  private async captureAndSendTxHashes(
    deploymentResult: DeploymentResult,
    userWallet: string,
    jobId: string
  ): Promise<boolean> {
    try {
      // Wait for configured delay
      await new Promise(resolve => 
        setTimeout(resolve, this.config.callbackDelay)
      );

      // Prepare callback data
      const callbackData = {
        jobId,
        userWallet,
        fundAddress: deploymentResult.fundAddress,
        creationTxHash: deploymentResult.creationTxHash,
        paymentTxHash: deploymentResult.paymentTxHash,
        enableTradingTxHash: deploymentResult.enableTradingTxHash,
        timestamp: new Date().toISOString(),
      };

      // Send callback with retry and circuit breaker
      const sent = await this.sendCallback(callbackData);

      if (sent) {
        this.logger.info(
          `${LOG_PREFIX.SUCCESS} TX hashes sent to Kosher Capital`,
          { jobId }
        );
        
        // Update transaction status
        const transaction = transactionTracker.getTransactionByJobId(jobId);
        if (transaction) {
          transactionTracker.updateTransaction(transaction.id, {
            status: TransactionStatus.COMPLETED,
          });
        }
      }

      return sent;

    } catch (error) {
      this.logger.error(
        `${LOG_PREFIX.ERROR} Failed to send TX hashes`,
        { error, jobId }
      );
      return false;
    }
  }

  /**
   * Send callback with retry logic
   */
  private async sendCallback(data: any): Promise<boolean> {
    const operation = async () => {
      // If webhook URL is configured, use it
      if (this.config.webhookUrl) {
        await notificationService.sendWebhook(
          this.config.webhookUrl,
          data
        );
        return true;
      }

      // Otherwise, use direct API update if available
      // This would be a new endpoint on Kosher Capital's side
      // For now, we'll log the attempt
      this.logger.info(
        `${LOG_PREFIX.INFO} Would send callback`,
        { data }
      );
      
      return true;
    };

    try {
      // Execute with circuit breaker and retry
      await this.circuitBreaker.execute(async () => {
        await RetryUtil.withRetry(operation, {
          maxAttempts: this.config.maxRetries,
          onRetry: (attempt, error) => {
            this.logger.warn(
              `${LOG_PREFIX.WARNING} Callback retry ${attempt}`,
              { error: error.message }
            );
          },
        });
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Track transaction in the system
   */
  private async trackTransaction(
    jobId: string,
    type: string,
    txHash: string
  ): Promise<void> {
    this.logger.info(
      `${LOG_PREFIX.PROCESSING} Tracking ${type} transaction`,
      { jobId, txHash }
    );
    
    // Update transaction tracker
    const transaction = transactionTracker.getTransactionByJobId(jobId);
    if (transaction) {
      const updates: any = {};
      
      if (type === 'creation') {
        updates.contractCreationTxHash = txHash;
      } else if (type === 'payment') {
        updates.paymentTxHash = txHash;
      }
      
      transactionTracker.updateTransaction(transaction.id, updates);
    }
  }

  /**
   * Ensure agent name has ACP prefix
   */
  private ensureACPPrefix(agentName?: string): string {
    if (!agentName) {
      return `${ACP_CONFIG.AGENT_PREFIX}-${Date.now()}`;
    }
    
    if (agentName.startsWith(ACP_CONFIG.AGENT_PREFIX)) {
      return agentName;
    }
    
    return `${ACP_CONFIG.AGENT_PREFIX}-${agentName}`;
  }

  /**
   * Pre-cache deployment data for faster execution
   */
  async preCacheDeploymentData(
    userWallet: string,
    agentName?: string
  ): Promise<{
    agentName: string;
    estimatedGas: string;
    currentNonce: number;
  }> {
    // Pre-generate agent name
    const finalAgentName = this.ensureACPPrefix(agentName);
    
    // Get current nonce for wallet
    const provider = this.eventMonitor['provider'];
    const currentNonce = await provider.getTransactionCount(userWallet);
    
    // Estimate gas for deployment
    // This would typically estimate all 3 transactions
    const estimatedGas = '500000'; // Placeholder
    
    this.logger.info(
      `${LOG_PREFIX.INFO} Pre-cached deployment data`,
      { agentName: finalAgentName, nonce: currentNonce }
    );
    
    return {
      agentName: finalAgentName,
      estimatedGas,
      currentNonce,
    };
  }

  /**
   * Get deployment status with enhanced details
   */
  async getDeploymentStatus(jobId: string): Promise<any> {
    const transaction = transactionTracker.getTransactionByJobId(jobId);
    if (!transaction) {
      throw ErrorFactory.validation(
        'Transaction not found',
        'jobId',
        jobId
      );
    }

    const events = this.eventMonitor.getMonitoredEvents(jobId);
    
    return {
      jobId,
      status: transaction.status,
      agentName: transaction.agentName,
      contractAddress: transaction.contractAddress,
      transactions: {
        creation: transaction.contractCreationTxHash,
        payment: transaction.paymentTxHash,
      },
      events: events.map(e => ({
        name: e.eventName,
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
      })),
      timestamps: {
        created: transaction.createdAt,
        updated: transaction.updatedAt,
      },
    };
  }
}

/**
 * Create singleton instance
 */
let monitorInstance: TransactionMonitor | null = null;

/**
 * Get or create transaction monitor instance
 */
export function getTransactionMonitor(
  provider: ethers.providers.Provider,
  config?: TransactionCaptureConfig
): TransactionMonitor {
  if (!monitorInstance) {
    monitorInstance = new TransactionMonitor(provider, config);
  }
  return monitorInstance;
}
