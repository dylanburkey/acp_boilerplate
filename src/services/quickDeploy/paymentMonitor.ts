/**
 * @fileoverview Payment Transaction Monitor for ACP Quick Deploy
 * Monitors blockchain for USDC payment transactions during ACP TRANSACTION phase
 *
 * @author Dylan Burkey
 * @license MIT
 */

import { ethers } from 'ethers';
import { config } from '../../config';
import { Logger } from '../../utils/logger';
import { CONTRACT_ADDRESSES, LOG_PREFIX } from './constants';

/**
 * Payment monitoring configuration
 */
interface PaymentMonitorConfig {
  /** Maximum time to wait for payment (milliseconds) */
  timeout: number;
  /** Polling interval (milliseconds) */
  pollInterval: number;
  /** Number of block confirmations required */
  confirmations: number;
}

/**
 * Payment transaction result
 */
export interface PaymentTransaction {
  /** Transaction hash */
  hash: string;
  /** Transaction block number */
  blockNumber: number;
  /** Amount transferred in USDC (raw amount) */
  amount: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Timestamp when found */
  timestamp: number;
}

/**
 * USDC Transfer event interface
 */
interface TransferEvent {
  from: string;
  to: string;
  value: bigint;
}

/**
 * Payment Monitor for capturing USDC payment transactions
 */
export class PaymentMonitor {
  private readonly logger = Logger;
  private readonly provider: ethers.JsonRpcProvider;
  private readonly usdcContract: ethers.Contract;

  /** Default monitoring configuration */
  private readonly defaultConfig: PaymentMonitorConfig = {
    timeout: 300000, // 5 minutes
    pollInterval: 3000, // 3 seconds
    confirmations: 1, // Require 1 block confirmation
  };

  /** USDC contract ABI (Transfer event) */
  private readonly USDC_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ];

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.acpRpcUrl || 'https://base.llamarpc.com');
    this.usdcContract = new ethers.Contract(
      CONTRACT_ADDRESSES.USDC,
      this.USDC_ABI,
      this.provider
    );

    this.logger.info(`${LOG_PREFIX.INIT} PaymentMonitor initialized`);
  }

  /**
   * Monitor for a payment transaction to the agent wallet
   *
   * This method polls the blockchain looking for a USDC transfer event
   * to the agent wallet address. Used during ACP TRANSACTION phase.
   *
   * @param expectedFrom - Expected sender address (buyer)
   * @param expectedAmount - Expected amount in USDC (e.g., "50" for 50 USDC)
   * @param monitorConfig - Optional monitoring configuration
   * @returns Promise<PaymentTransaction> - The payment transaction details
   * @throws Error if payment not found within timeout or amount mismatch
   */
  async monitorPayment(
    expectedFrom: string,
    expectedAmount: string = '50',
    monitorConfig?: Partial<PaymentMonitorConfig>
  ): Promise<PaymentTransaction> {
    const mergedConfig = { ...this.defaultConfig, ...monitorConfig };
    const startTime = Date.now();
    const expectedAmountWei = ethers.parseUnits(expectedAmount, 6); // USDC has 6 decimals

    this.logger.info(`${LOG_PREFIX.PROCESSING} Monitoring for payment...`, {
      from: expectedFrom,
      to: config.sellerAgentWalletAddress,
      expectedAmount: `${expectedAmount} USDC`,
      timeout: `${mergedConfig.timeout}ms`,
    });

    // Get current block to start monitoring from
    const startBlock = await this.provider.getBlockNumber();

    while (Date.now() - startTime < mergedConfig.timeout) {
      try {
        // Get latest block
        const currentBlock = await this.provider.getBlockNumber();

        // Query Transfer events from start block to current
        const filter = this.usdcContract.filters.Transfer(
          expectedFrom,
          config.sellerAgentWalletAddress
        );

        const events = await this.usdcContract.queryFilter(
          filter,
          startBlock,
          currentBlock
        );

        // Check each event
        for (const event of events) {
          const args = event.args as unknown as TransferEvent;

          // Verify amount matches expected
          if (args.value === expectedAmountWei) {
            // Wait for confirmations
            const eventBlock = event.blockNumber;
            const confirmations = currentBlock - eventBlock;

            if (confirmations >= mergedConfig.confirmations) {
              const paymentTx: PaymentTransaction = {
                hash: event.transactionHash!,
                blockNumber: eventBlock,
                amount: expectedAmount,
                from: args.from,
                to: args.to,
                timestamp: Date.now(),
              };

              this.logger.info(
                `${LOG_PREFIX.SUCCESS} Payment transaction found!`,
                paymentTx
              );

              return paymentTx;
            } else {
              this.logger.debug(
                `${LOG_PREFIX.INFO} Payment found but waiting for confirmations`,
                { current: confirmations, required: mergedConfig.confirmations }
              );
            }
          }
        }

        // Wait before next poll
        await this.sleep(mergedConfig.pollInterval);

      } catch (error) {
        this.logger.error(
          `${LOG_PREFIX.ERROR} Error monitoring payment:`,
          error
        );
        // Continue monitoring despite errors
      }
    }

    // Timeout reached
    throw new Error(
      `Payment not received within ${mergedConfig.timeout}ms timeout`
    );
  }

  /**
   * Verify a specific transaction is a valid payment
   *
   * @param txHash - Transaction hash to verify
   * @param expectedAmount - Expected amount in USDC
   * @returns Promise<boolean> - True if valid payment
   */
  async verifyPaymentTransaction(
    txHash: string,
    expectedAmount: string = '50'
  ): Promise<boolean> {
    try {
      this.logger.info(
        `${LOG_PREFIX.PROCESSING} Verifying payment transaction ${txHash}`
      );

      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        this.logger.warn(`${LOG_PREFIX.WARNING} Transaction not found`);
        return false;
      }

      if (receipt.status !== 1) {
        this.logger.warn(`${LOG_PREFIX.WARNING} Transaction failed`);
        return false;
      }

      // Parse logs for Transfer event
      const expectedAmountWei = ethers.parseUnits(expectedAmount, 6);

      for (const log of receipt.logs) {
        try {
          const parsedLog = this.usdcContract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsedLog && parsedLog.name === 'Transfer') {
            const args = parsedLog.args as unknown as TransferEvent;

            // Check if transfer is to our wallet with correct amount
            if (
              args.to.toLowerCase() === config.sellerAgentWalletAddress.toLowerCase() &&
              args.value === expectedAmountWei
            ) {
              this.logger.info(`${LOG_PREFIX.SUCCESS} Payment verified!`);
              return true;
            }
          }
        } catch (e) {
          // Not a USDC Transfer event, continue
        }
      }

      this.logger.warn(`${LOG_PREFIX.WARNING} No matching USDC transfer found in transaction`);
      return false;

    } catch (error) {
      this.logger.error(
        `${LOG_PREFIX.ERROR} Error verifying payment:`,
        error
      );
      return false;
    }
  }

  /**
   * Get recent transactions to the agent wallet
   * Useful for debugging and manual verification
   *
   * @param blockRange - Number of blocks to look back
   * @returns Promise<PaymentTransaction[]> - Recent payment transactions
   */
  async getRecentPayments(blockRange: number = 1000): Promise<PaymentTransaction[]> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - blockRange);

      const filter = this.usdcContract.filters.Transfer(
        null, // Any sender
        config.sellerAgentWalletAddress // To our wallet
      );

      const events = await this.usdcContract.queryFilter(
        filter,
        fromBlock,
        currentBlock
      );

      return events.map((event) => {
        const args = event.args as unknown as TransferEvent;
        return {
          hash: event.transactionHash!,
          blockNumber: event.blockNumber,
          amount: ethers.formatUnits(args.value, 6), // Convert to USDC
          from: args.from,
          to: args.to,
          timestamp: Date.now(), // Note: This is current time, not block time
        };
      });

    } catch (error) {
      this.logger.error(
        `${LOG_PREFIX.ERROR} Error fetching recent payments:`,
        error
      );
      return [];
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
export const paymentMonitor = new PaymentMonitor();
