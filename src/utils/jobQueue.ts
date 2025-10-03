/**
 * @fileoverview Job queue implementation for sequential ACP job processing.
 * Prevents transaction conflicts by processing jobs one at a time with proper delays.
 * Based on Athena's implementation for reliable job handling.
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { AcpJob } from '@virtuals-protocol/acp-node';
import { Logger } from './logger';
import { LOG_PREFIX } from '../services/quickDeploy/constants';

/**
 * Priority queue item structure
 */
interface QueueItem {
  job: AcpJob;
  priority: number;
  addedAt: Date;
}

/**
 * Job processor function type
 */
type JobProcessor = (job: AcpJob) => Promise<void>;

/**
 * Queue status information
 */
export interface QueueStatus {
  queueLength: number;
  isProcessing: boolean;
  currentJob?: AcpJob;
  processedCount: number;
  failedCount: number;
}

/**
 * Queue interface for different implementations
 */
export interface QueueInterface {
  enqueue(job: AcpJob, priority: number): void;
  stopProcessing?(): void;
  getQueueStatus?(): Promise<QueueStatus>;
}

/**
 * In-memory priority queue for ACP jobs
 * Jobs with higher priority are processed first
 */
export class JobQueue implements QueueInterface {
  private readonly logger = Logger;
  private readonly queue: QueueItem[] = [];
  private isProcessing = false;
  private readonly processor: JobProcessor;
  private readonly processingDelay: number;
  private readonly maxRetries: number;
  private shouldStop = false;
  private processedCount = 0;
  private failedCount = 0;
  private currentJob?: AcpJob;

  constructor(
    processor: JobProcessor,
    processingDelay: number = 3000,
    maxRetries: number = 3
  ) {
    this.processor = processor;
    this.processingDelay = processingDelay;
    this.maxRetries = maxRetries;
    
    this.logger.info(
      `${LOG_PREFIX.INIT} JobQueue initialized`,
      { processingDelay, maxRetries }
    );
  }

  /**
   * Add job to queue with priority
   */
  enqueue(job: AcpJob, priority: number): void {
    const queueItem: QueueItem = {
      job,
      priority,
      addedAt: new Date(),
    };
    
    // Insert in priority order (higher priority first)
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }
    
    this.logger.info(
      `${LOG_PREFIX.INFO} Job queued`,
      {
        jobId: job.id,
        phase: job.phase,
        priority,
        queueLength: this.queue.length,
      }
    );
    
    // Start processing if not already running
    if (!this.isProcessing && !this.shouldStop) {
      this.startProcessing();
    }
  }

  /**
   * Start processing jobs from the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.logger.info(`${LOG_PREFIX.PROCESSING} Starting job processing`);
    
    while (this.queue.length > 0 && !this.shouldStop) {
      const queueItem = this.queue.shift()!;
      this.currentJob = queueItem.job;
      
      try {
        await this.processJob(queueItem.job);
        this.processedCount++;
        
        // Delay before next job to prevent conflicts
        if (this.queue.length > 0) {
          this.logger.debug(
            `${LOG_PREFIX.INFO} Waiting ${this.processingDelay}ms before next job`
          );
          await this.delay(this.processingDelay);
        }
        
      } catch (error) {
        this.failedCount++;
        this.logger.error(
          `${LOG_PREFIX.ERROR} Job processing failed`,
          { jobId: queueItem.job.id, error }
        );
      }
    }
    
    this.isProcessing = false;
    this.currentJob = undefined;
    this.logger.info(
      `${LOG_PREFIX.SUCCESS} Job processing stopped`,
      { processed: this.processedCount, failed: this.failedCount }
    );
  }

  /**
   * Process a single job with retry logic
   */
  private async processJob(job: AcpJob): Promise<void> {
    let attempts = 0;
    let lastError: any;
    
    while (attempts < this.maxRetries) {
      attempts++;
      
      try {
        this.logger.info(
          `${LOG_PREFIX.PROCESSING} Processing job`,
          {
            jobId: job.id,
            phase: job.phase,
            attempt: attempts,
          }
        );
        
        await this.processor(job);
        
        this.logger.info(
          `${LOG_PREFIX.SUCCESS} Job processed successfully`,
          { jobId: job.id }
        );
        
        return;
        
      } catch (error) {
        lastError = error;
        
        this.logger.warn(
          `${LOG_PREFIX.WARNING} Job processing attempt failed`,
          {
            jobId: job.id,
            attempt: attempts,
            error,
          }
        );
        
        if (attempts < this.maxRetries) {
          // Exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
          await this.delay(retryDelay);
        }
      }
    }
    
    // All retries exhausted
    throw new Error(
      `Job ${job.id} failed after ${attempts} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    this.shouldStop = true;
    this.logger.info(`${LOG_PREFIX.INFO} Job processing stop requested`);
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(): Promise<QueueStatus> {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentJob: this.currentJob,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
    };
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create appropriate queue implementation
 * Can be extended to support different queue backends (Redis, RabbitMQ, etc.)
 */
export async function createJobQueue(
  processor: JobProcessor,
  processingDelay?: number,
  maxRetries?: number
): Promise<QueueInterface> {
  // For now, return in-memory implementation
  // Future: Could check environment and return Redis-based queue, etc.
  return new JobQueue(processor, processingDelay, maxRetries);
}
