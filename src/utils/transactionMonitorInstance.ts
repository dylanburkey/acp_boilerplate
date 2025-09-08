/**
 * Instance-based Transaction Monitor for ACP transactions
 */

import { Logger } from './logger';

export interface TransactionError {
  jobId: string;
  error: string;
  details?: string;
  nonce?: string;
  timestamp: Date;
}

export class TransactionMonitor {
  private errors: TransactionError[] = [];

  logTransactionError(jobId: string, error: unknown): void {
    const errorObj = error as { message?: string; details?: string; shortMessage?: string };
    const errorMessage = errorObj.message || String(error);

    const errorEntry: TransactionError = {
      jobId,
      error: errorMessage,
      details: errorObj.details || errorObj.shortMessage,
      timestamp: new Date(),
    };

    // Extract nonce if available
    if (errorMessage.includes('nonce')) {
      const nonceMatch = errorMessage.match(/nonce[:\s]+(\w+)/i);
      if (nonceMatch) {
        errorEntry.nonce = nonceMatch[1];
      }
    }

    this.errors.push(errorEntry);

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100);
    }

    Logger.error(`Transaction Error for Job #${jobId}:`, {
      error: errorEntry.error,
      details: errorEntry.details,
      nonce: errorEntry.nonce,
    });

    // Log specific advice for common errors
    if (errorMessage.includes('replacement underpriced')) {
      Logger.warn('Transaction stuck due to gas price. Consider:');
      Logger.warn('1. Waiting for pending transaction to complete');
      Logger.warn('2. Restarting the agent to reset nonce');
      Logger.warn('3. Checking for network congestion on Base chain');
    }
  }

  getRecentErrors(count: number = 10): TransactionError[] {
    return this.errors.slice(-count);
  }

  getErrorSummary(): { total: number; uniqueJobs: number; commonError?: string } {
    const uniqueJobs = new Set(this.errors.map((e) => e.jobId)).size;

    // Find most common error
    const errorCounts = this.errors.reduce(
      (acc, err) => {
        acc[err.error] = (acc[err.error] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const commonError = Object.entries(errorCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

    return {
      total: this.errors.length,
      uniqueJobs,
      commonError,
    };
  }

  /**
   * Monitor a transaction and log its status
   */
  async monitorTransaction(tx: any, type: string, jobId: string): Promise<void> {
    try {
      Logger.info(`[TX Monitor] ${type} transaction for job ${jobId}: ${tx.hash}`);
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        Logger.info(`[TX Monitor] ✅ ${type} transaction confirmed for job ${jobId}`);
      } else {
        Logger.error(`[TX Monitor] ❌ ${type} transaction failed for job ${jobId}`);
        this.logTransactionError(jobId, new Error(`Transaction failed: ${type}`));
      }
    } catch (error) {
      Logger.error(`[TX Monitor] Error monitoring ${type} transaction for job ${jobId}:`, error);
      this.logTransactionError(jobId, error);
    }
  }

  /**
   * Print a summary of transaction errors
   */
  printSummary(): void {
    const summary = this.getErrorSummary();
    Logger.info('=== Transaction Monitor Summary ===');
    Logger.info(`Total errors: ${summary.total}`);
    Logger.info(`Unique jobs with errors: ${summary.uniqueJobs}`);
    if (summary.commonError) {
      Logger.info(`Most common error: ${summary.commonError}`);
    }
    Logger.info('===================================');
  }
}