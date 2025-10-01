/**
 * @fileoverview Butler Integration Service for ACP
 * Handles payment monitoring and automated TX hash capture for Butler-initiated deployments
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { ethers } from 'ethers';
import { Logger } from '../../utils/logger';
import { config } from '../../config';
import {
  CONTRACT_ADDRESSES,
  PAYMENT_CONFIG,
  LOG_PREFIX,
  EVENTS,
  JOB_STATUS,
} from './constants';

/**
 * Butler payment event interface
 */
export interface ButlerPaymentEvent {
  /** Job ID from Butler */
  jobId: string;
  /** Payer's wallet address */
  payerWallet: string;
  /** Payment transaction hash */
  paymentTxHash: string;
  /** Payment amount in USDC */
  amount: number;
  /** Timestamp of payment */
  timestamp: string;
}

/**
 * Butler integration configuration
 */
interface ButlerConfig {
  /** Enable automatic payment monitoring */
  autoMonitor: boolean;
  /** Payment confirmation blocks */
  confirmationBlocks: number;
  /** Webhook URL for Butler callbacks */
  butlerWebhookUrl?: string;
  /** Monitoring interval in ms */
  monitoringInterval: number;
}

/**
 * Service for integrating with Butler payment system
 */
export class ButlerIntegrationService {
  private readonly logger = Logger;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly config: ButlerConfig;
  private paymentListeners: Map<string, ethers.Listener> = new Map();
  private pendingPayments: Map<string, ButlerPaymentEvent> = new Map();

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.acpRpcUrl);
    this.config = {
      autoMonitor: process.env.BUTLER_AUTO_MONITOR === 'true',
      confirmationBlocks: parseInt(process.env.BUTLER_CONFIRMATION_BLOCKS || '2'),
      butlerWebhookUrl: process.env.BUTLER_WEBHOOK_URL,
      monitoringInterval: parseInt(process.env.BUTLER_MONITORING_INTERVAL || '5000'),
    };

    this.logger.info(`${LOG_PREFIX.INIT} Butler Integration Service initialized`);
    
    if (this.config.autoMonitor) {
      this.startPaymentMonitoring();
    }
  }

  /**
   * Starts automatic payment monitoring for USDC transfers
   */
  private async startPaymentMonitoring() {
    this.logger.info(`${LOG_PREFIX.PROCESSING} Starting Butler payment monitoring`);

    // Create USDC contract instance
    const usdcContract = new ethers.Contract(
      CONTRACT_ADDRESSES.USDC,
      [
        'event Transfer(address indexed from, address indexed to, uint256 value)',
      ],
      this.provider
    );

    // Set up event filter for transfers to payment recipient
    const filter = {
      address: CONTRACT_ADDRESSES.USDC,
      topics: [
        ethers.id('Transfer(address,address,uint256)'),
        null, // from any address
        ethers.zeroPadValue(CONTRACT_ADDRESSES.PAYMENT_RECIPIENT, 32), // to payment recipient
      ],
    };

    // Listen for transfer events
    this.provider.on(filter, async (log) => {
      try {
        const parsedLog = usdcContract.interface.parseLog(log);
        if (parsedLog && parsedLog.name === 'Transfer') {
          await this.handlePaymentDetected(
            parsedLog.args[0], // from
            parsedLog.args[2], // value
            log.transactionHash
          );
        }
      } catch (error) {
        this.logger.error(`${LOG_PREFIX.ERROR} Error processing transfer event:`, error);
      }
    });

    // Periodic check for pending payments
    setInterval(() => this.checkPendingPayments(), this.config.monitoringInterval);
  }

  /**
   * Handles detected payment event
   */
  private async handlePaymentDetected(
    from: string,
    value: bigint,
    txHash: string
  ): Promise<void> {
    const amount = Number(ethers.formatUnits(value, PAYMENT_CONFIG.USDC_DECIMALS));
    
    // Check if it's the expected payment amount
    if (amount !== PAYMENT_CONFIG.DEFAULT_AMOUNT) {
      this.logger.warn(
        `${LOG_PREFIX.WARNING} Received payment of ${amount} USDC, expected ${PAYMENT_CONFIG.DEFAULT_AMOUNT} USDC`
      );
    }

    this.logger.info(
      `${LOG_PREFIX.INFO} Detected payment: ${amount} USDC from ${from}, TX: ${txHash}`
    );

    // Create payment event
    const paymentEvent: ButlerPaymentEvent = {
      jobId: await this.generateJobId(from, txHash),
      payerWallet: from,
      paymentTxHash: txHash,
      amount,
      timestamp: new Date().toISOString(),
    };

    // Store pending payment
    this.pendingPayments.set(txHash, paymentEvent);

    // Wait for confirmations
    await this.waitForConfirmations(txHash);

    // Trigger deployment automatically
    await this.triggerAutomaticDeployment(paymentEvent);
  }

  /**
   * Waits for transaction confirmations
   */
  private async waitForConfirmations(txHash: string): Promise<void> {
    const receipt = await this.provider.waitForTransaction(
      txHash,
      this.config.confirmationBlocks
    );

    if (!receipt || receipt.status !== 1) {
      throw new Error(`Payment transaction failed: ${txHash}`);
    }

    this.logger.info(
      `${LOG_PREFIX.SUCCESS} Payment confirmed after ${this.config.confirmationBlocks} blocks`
    );
  }

  /**
   * Registers a Butler job for payment monitoring
   */
  async registerButlerJob(
    jobId: string,
    userWallet: string,
    agentName: string
  ): Promise<void> {
    this.logger.info(
      `${LOG_PREFIX.INFO} Registering Butler job ${jobId} for wallet ${userWallet}`
    );

    // Set up specific listener for this wallet
    const filter = {
      address: CONTRACT_ADDRESSES.USDC,
      topics: [
        ethers.id('Transfer(address,address,uint256)'),
        ethers.zeroPadValue(userWallet, 32), // from specific wallet
        ethers.zeroPadValue(CONTRACT_ADDRESSES.PAYMENT_RECIPIENT, 32),
      ],
    };

    const listener = async (log: any) => {
      try {
        const receipt = await this.provider.getTransactionReceipt(log.transactionHash);
        if (receipt && receipt.status === 1) {
          await this.handleButlerPayment({
            jobId,
            payerWallet: userWallet,
            paymentTxHash: log.transactionHash,
            amount: PAYMENT_CONFIG.DEFAULT_AMOUNT,
            timestamp: new Date().toISOString(),
          });

          // Remove listener after successful payment
          this.provider.off(filter, listener);
          this.paymentListeners.delete(jobId);
        }
      } catch (error) {
        this.logger.error(`${LOG_PREFIX.ERROR} Error handling Butler payment:`, error);
      }
    };

    // Store listener reference
    this.paymentListeners.set(jobId, listener);
    this.provider.on(filter, listener);
  }

  /**
   * Handles Butler payment completion
   */
  private async handleButlerPayment(payment: ButlerPaymentEvent): Promise<void> {
    this.logger.info(
      `${LOG_PREFIX.SUCCESS} Butler payment received for job ${payment.jobId}`
    );

    // Send webhook to Butler if configured
    if (this.config.butlerWebhookUrl) {
      await this.notifyButler(payment);
    }

    // Trigger deployment
    await this.triggerAutomaticDeployment(payment);
  }

  /**
   * Notifies Butler of payment status
   */
  private async notifyButler(payment: ButlerPaymentEvent): Promise<void> {
    if (!this.config.butlerWebhookUrl) {
      return;
    }

    try {
      const response = await fetch(this.config.butlerWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Butler-Event': 'payment.confirmed',
        },
        body: JSON.stringify({
          event: 'payment.confirmed',
          data: payment,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Butler webhook failed: ${response.statusText}`);
      }

      this.logger.info(`${LOG_PREFIX.SUCCESS} Butler notified of payment confirmation`);
    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Failed to notify Butler:`, error);
    }
  }

  /**
   * Triggers automatic deployment after payment
   */
  private async triggerAutomaticDeployment(payment: ButlerPaymentEvent): Promise<void> {
    this.logger.info(
      `${LOG_PREFIX.PROCESSING} Triggering automatic deployment for payment ${payment.paymentTxHash}`
    );

    // Import quickDeployService to avoid circular dependency
    const { quickDeployService } = await import('./index');

    // Create deployment request
    const request = {
      jobId: payment.jobId,
      buyer: payment.payerWallet,
      params: {
        userWallet: payment.payerWallet,
        paymentTxHash: payment.paymentTxHash,
        agentName: this.generateAgentName(),
        executeOnChain: true, // We need to create the contract
      },
    };

    try {
      const response = await quickDeployService.processRequest(request);
      
      this.logger.info(
        `${LOG_PREFIX.SUCCESS} Automatic deployment triggered successfully`,
        response
      );

      // Remove from pending
      this.pendingPayments.delete(payment.paymentTxHash);
    } catch (error) {
      this.logger.error(
        `${LOG_PREFIX.ERROR} Failed to trigger automatic deployment:`,
        error
      );
    }
  }

  /**
   * Generates a unique job ID for Butler
   */
  private async generateJobId(wallet: string, txHash: string): Promise<string> {
    const timestamp = Date.now();
    const shortHash = txHash.slice(0, 8);
    return `butler-${shortHash}-${timestamp}`;
  }

  /**
   * Generates agent name with ACP prefix
   */
  private generateAgentName(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ACP-${random}-${timestamp}`;
  }

  /**
   * Checks for pending payments periodically
   */
  private async checkPendingPayments(): Promise<void> {
    for (const [txHash, payment] of this.pendingPayments.entries()) {
      try {
        const receipt = await this.provider.getTransactionReceipt(txHash);
        if (receipt && receipt.confirmations >= this.config.confirmationBlocks) {
          await this.triggerAutomaticDeployment(payment);
        }
      } catch (error) {
        this.logger.error(
          `${LOG_PREFIX.ERROR} Error checking pending payment ${txHash}:`,
          error
        );
      }
    }
  }

  /**
   * Cleans up listeners and pending payments
   */
  async cleanup(): Promise<void> {
    // Remove all payment listeners
    for (const [jobId, listener] of this.paymentListeners.entries()) {
      this.provider.removeAllListeners();
      this.logger.info(`${LOG_PREFIX.INFO} Removed listener for job ${jobId}`);
    }
    
    this.paymentListeners.clear();
    this.pendingPayments.clear();
  }
}

// Export singleton instance
export const butlerIntegration = new ButlerIntegrationService();
