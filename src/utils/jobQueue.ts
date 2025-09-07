/**
 * Job Queue implementation for ACP jobs to prevent transaction conflicts
 * Based on Virtuals Protocol threading example
 */

import { AcpJob } from '@virtuals-protocol/acp-node';
import { Logger } from './logger';
import { TransactionMonitor } from './transactionMonitor';

export interface QueuedJob {
  job: AcpJob;
  priority: number;
  timestamp: Date;
  retryCount: number;
}

export class JobQueue {
  private queue: QueuedJob[] = [];
  private processing = false;
  private processingDelay: number;
  private maxRetries: number;
  private processJobCallback: (job: AcpJob) => Promise<void>;

  constructor(
    processJobCallback: (job: AcpJob) => Promise<void>,
    processingDelay: number = 2000, // 2 seconds between jobs
    maxRetries: number = 3
  ) {
    this.processJobCallback = processJobCallback;
    this.processingDelay = processingDelay;
    this.maxRetries = maxRetries;
  }

  /**
   * Add a job to the queue with priority
   */
  enqueue(job: AcpJob, priority: number = 0): void {
    const queuedJob: QueuedJob = {
      job,
      priority,
      timestamp: new Date(),
      retryCount: 0,
    };

    Logger.log(`[JobQueue] Enqueuing job #${job.id} (Phase: ${job.phase}, Priority: ${priority})`);

    // Insert job based on priority (higher priority first)
    const insertIndex = this.queue.findIndex((item) => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queuedJob);
    } else {
      this.queue.splice(insertIndex, 0, queuedJob);
    }

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue().catch((error) => {
        Logger.error('[JobQueue] Fatal error in queue processing:', error);
        this.processing = false;
      });
    }
  }

  /**
   * Process jobs sequentially with delay between them
   */
  private async processQueue(): Promise<void> {
    // Prevent duplicate processing
    if (this.processing) {
      Logger.debug('[JobQueue] Already processing, skipping duplicate call');
      return;
    }

    if (this.queue.length === 0) {
      Logger.debug('[JobQueue] Queue is empty, nothing to process');
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const queuedJob = this.queue.shift();
      if (!queuedJob) break;

      try {
        Logger.log(
          `[JobQueue] Processing job #${queuedJob.job.id} (${this.queue.length} remaining)`
        );
        await this.processJobCallback(queuedJob.job);
        Logger.log(`[JobQueue] Successfully processed job #${queuedJob.job.id}`);
      } catch (error) {
        Logger.error(`[JobQueue] Error processing job #${queuedJob.job.id}:`, error);

        // Log transaction error for monitoring
        TransactionMonitor.logTransactionError(String(queuedJob.job.id), error);

        // Handle retry logic
        if (this.shouldRetry(error, queuedJob)) {
          await this.retryJob(queuedJob);
        }
      }

      // Add delay between jobs to prevent nonce conflicts
      if (this.queue.length > 0) {
        Logger.debug(`[JobQueue] Waiting ${this.processingDelay}ms before next job`);
        await new Promise((resolve) => setTimeout(resolve, this.processingDelay));
      }
    }

    this.processing = false;
    Logger.log('[JobQueue] Queue processing complete');
  }

  /**
   * Determine if a job should be retried based on the error
   */
  private shouldRetry(error: unknown, queuedJob: QueuedJob): boolean {
    const errorStr = String(error);

    // Don't retry if max retries exceeded
    if (queuedJob.retryCount >= this.maxRetries) {
      Logger.warn(`[JobQueue] Job #${queuedJob.job.id} exceeded max retries (${this.maxRetries})`);
      return false;
    }

    // Retry on specific blockchain errors
    const retryableErrors = [
      'replacement underpriced',
      'nonce too low',
      'transaction underpriced',
      'insufficient funds for gas',
      'timeout',
    ];

    return retryableErrors.some((retryableError) =>
      errorStr.toLowerCase().includes(retryableError)
    );
  }

  /**
   * Retry a failed job with exponential backoff
   */
  private async retryJob(queuedJob: QueuedJob): Promise<void> {
    queuedJob.retryCount++;

    // Exponential backoff: 2^retryCount seconds
    const backoffDelay = Math.min(Math.pow(2, queuedJob.retryCount) * 1000, 30000); // Max 30s

    Logger.warn(
      `[JobQueue] Retrying job #${queuedJob.job.id} (attempt ${queuedJob.retryCount}/${this.maxRetries}) after ${backoffDelay}ms`
    );

    await new Promise((resolve) => setTimeout(resolve, backoffDelay));

    // Re-enqueue with higher priority
    this.enqueue(queuedJob.job, queuedJob.priority + 1);
  }

  /**
   * Get current queue status
   */
  getStatus(): { queueLength: number; isProcessing: boolean; jobs: string[] } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.processing,
      jobs: this.queue.map((q) => `#${q.job.id} (${q.job.phase})`),
    };
  }

  /**
   * Clear the queue (emergency use only)
   */
  clear(): void {
    Logger.warn(`[JobQueue] Clearing queue with ${this.queue.length} pending jobs`);
    this.queue = [];
  }

  /**
   * Gracefully stop processing after current job
   */
  async stop(): Promise<void> {
    Logger.log('[JobQueue] Stopping queue processing after current job');
    this.processing = false;

    // Wait for current job to complete
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
