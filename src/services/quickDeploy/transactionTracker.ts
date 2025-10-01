/**
 * @fileoverview Transaction tracking service for Quick Deploy operations
 * Maintains a record of all deployment transactions for reconciliation
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { Logger } from '../../utils/logger';

/**
 * Interface for deployment transaction record
 */
export interface DeploymentTransaction {
  /** Unique transaction ID */
  id: string;
  /** ACP Job ID */
  jobId: string;
  /** Payment transaction hash */
  paymentTxHash: string;
  /** Contract creation transaction hash */
  contractCreationTxHash?: string;
  /** Deployed contract address */
  contractAddress?: string;
  /** Agent name */
  agentName: string;
  /** User wallet address */
  userWallet: string;
  /** Deployment status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  /** Deployment source */
  source: 'ACP';
  /** Notification status */
  notificationSent: boolean;
  /** Retry count */
  retryCount: number;
}

/**
 * Service for tracking deployment transactions
 */
export class TransactionTracker {
  /** Logger instance */
  private readonly logger = Logger;
  
  /** File path for transaction log */
  private readonly transactionLogPath: string;
  
  /** In-memory cache of recent transactions */
  private transactionCache: Map<string, DeploymentTransaction> = new Map();
  
  /** Maximum transactions to keep in cache */
  private readonly maxCacheSize = 100;
  
  constructor() {
    // Set log path - can be configured via environment
    const logDir = process.env.TRANSACTION_LOG_DIR || './logs';
    this.transactionLogPath = path.join(logDir, 'quick-deploy-transactions.json');
    
    this.logger.info(`TransactionTracker initialized - log path: ${this.transactionLogPath}`);
    
    // Load existing transactions
    this.loadTransactions().catch(err => {
      this.logger.error('Failed to load transaction history:', err);
    });
  }

  /**
   * Creates a new transaction record
   * 
   * @param {string} jobId - ACP Job ID
   * @param {string} paymentTxHash - Payment transaction hash
   * @param {string} userWallet - User wallet address
   * @param {string} agentName - Agent name
   * @returns {DeploymentTransaction} New transaction record
   */
  createTransaction(
    jobId: string,
    paymentTxHash: string,
    userWallet: string,
    agentName: string
  ): DeploymentTransaction {
    const transaction: DeploymentTransaction = {
      id: `tx_${Date.now()}_${jobId}`,
      jobId,
      paymentTxHash,
      agentName,
      userWallet,
      status: 'pending',
      source: 'ACP',
      notificationSent: false,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.transactionCache.set(transaction.id, transaction);
    this.saveTransactions().catch(err => {
      this.logger.error('Failed to save transaction:', err);
    });
    
    this.logger.info(`Created transaction ${transaction.id} for job ${jobId}`);
    return transaction;
  }

  /**
   * Updates a transaction record
   * 
   * @param {string} transactionId - Transaction ID
   * @param {Partial<DeploymentTransaction>} updates - Updates to apply
   * @returns {DeploymentTransaction | null} Updated transaction or null if not found
   */
  updateTransaction(
    transactionId: string,
    updates: Partial<DeploymentTransaction>
  ): DeploymentTransaction | null {
    const transaction = this.transactionCache.get(transactionId);
    if (!transaction) {
      this.logger.warn(`Transaction ${transactionId} not found`);
      return null;
    }
    
    Object.assign(transaction, updates, {
      updatedAt: new Date().toISOString(),
    });
    
    if (updates.status === 'completed' || updates.status === 'failed') {
      transaction.completedAt = new Date().toISOString();
    }
    
    this.saveTransactions().catch(err => {
      this.logger.error('Failed to save transaction update:', err);
    });
    
    this.logger.info(`Updated transaction ${transactionId} - status: ${transaction.status}`);
    return transaction;
  }

  /**
   * Gets a transaction by job ID
   * 
   * @param {string} jobId - ACP Job ID
   * @returns {DeploymentTransaction | null} Transaction or null if not found
   */
  getTransactionByJobId(jobId: string): DeploymentTransaction | null {
    for (const transaction of this.transactionCache.values()) {
      if (transaction.jobId === jobId) {
        return transaction;
      }
    }
    return null;
  }

  /**
   * Gets all transactions with a specific status
   * 
   * @param {string} status - Transaction status
   * @returns {DeploymentTransaction[]} Array of transactions
   */
  getTransactionsByStatus(status: DeploymentTransaction['status']): DeploymentTransaction[] {
    const transactions: DeploymentTransaction[] = [];
    for (const transaction of this.transactionCache.values()) {
      if (transaction.status === status) {
        transactions.push(transaction);
      }
    }
    return transactions;
  }

  /**
   * Gets transaction statistics
   * 
   * @returns {Object} Statistics object
   */
  getStatistics(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    successRate: number;
  } {
    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      successRate: 0,
    };
    
    for (const transaction of this.transactionCache.values()) {
      stats.total++;
      stats[transaction.status]++;
    }
    
    if (stats.total > 0) {
      stats.successRate = (stats.completed / stats.total) * 100;
    }
    
    return stats;
  }

  /**
   * Marks transactions for retry
   * 
   * @param {number} maxAge - Maximum age in milliseconds for pending/processing transactions
   * @returns {DeploymentTransaction[]} Transactions marked for retry
   */
  markStaleTransactionsForRetry(maxAge: number = 300000): DeploymentTransaction[] {
    const staleTransactions: DeploymentTransaction[] = [];
    const now = new Date().getTime();
    
    for (const transaction of this.transactionCache.values()) {
      if (transaction.status === 'pending' || transaction.status === 'processing') {
        const updatedAt = new Date(transaction.updatedAt).getTime();
        
        if (now - updatedAt > maxAge) {
          transaction.retryCount++;
          transaction.status = 'pending';
          transaction.updatedAt = new Date().toISOString();
          staleTransactions.push(transaction);
          
          this.logger.warn(`Marked transaction ${transaction.id} for retry (attempt ${transaction.retryCount})`);
        }
      }
    }
    
    if (staleTransactions.length > 0) {
      this.saveTransactions().catch(err => {
        this.logger.error('Failed to save retry updates:', err);
      });
    }
    
    return staleTransactions;
  }

  /**
   * Loads transactions from disk
   * 
   * @returns {Promise<void>}
   * @private
   */
  private async loadTransactions(): Promise<void> {
    if (!existsSync(this.transactionLogPath)) {
      this.logger.info('No transaction log found - starting fresh');
      return;
    }
    
    try {
      const data = await readFile(this.transactionLogPath, 'utf-8');
      const transactions: DeploymentTransaction[] = JSON.parse(data);
      
      // Load most recent transactions into cache
      const sortedTransactions = transactions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, this.maxCacheSize);
      
      for (const transaction of sortedTransactions) {
        this.transactionCache.set(transaction.id, transaction);
      }
      
      this.logger.info(`Loaded ${this.transactionCache.size} recent transactions`);
    } catch (error) {
      this.logger.error('Error loading transactions:', error);
    }
  }

  /**
   * Saves transactions to disk
   * 
   * @returns {Promise<void>}
   * @private
   */
  private async saveTransactions(): Promise<void> {
    try {
      const transactions = Array.from(this.transactionCache.values());
      const data = JSON.stringify(transactions, null, 2);
      
      // Ensure directory exists
      const dir = path.dirname(this.transactionLogPath);
      const { mkdir } = await import('fs/promises');
      await mkdir(dir, { recursive: true });
      
      await writeFile(this.transactionLogPath, data, 'utf-8');
    } catch (error) {
      this.logger.error('Error saving transactions:', error);
    }
  }

  /**
   * Generates a transaction report
   * 
   * @param {Date} startDate - Start date for report
   * @param {Date} endDate - End date for report
   * @returns {Object} Report data
   */
  generateReport(startDate: Date, endDate: Date): {
    period: { start: string; end: string };
    transactions: DeploymentTransaction[];
    statistics: ReturnType<typeof this.getStatistics>;
    revenue: { expected: number; collected: number };
  } {
    const transactions: DeploymentTransaction[] = [];
    
    for (const transaction of this.transactionCache.values()) {
      const createdAt = new Date(transaction.createdAt);
      if (createdAt >= startDate && createdAt <= endDate) {
        transactions.push(transaction);
      }
    }
    
    // Calculate revenue (50 USDC per deployment)
    const revenue = {
      expected: transactions.length * 50,
      collected: transactions.filter(t => t.status === 'completed').length * 50,
    };
    
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      transactions,
      statistics: this.getStatistics(),
      revenue,
    };
  }
}

// Export singleton instance
export const transactionTracker = new TransactionTracker();
