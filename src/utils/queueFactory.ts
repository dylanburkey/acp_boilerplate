/**
 * @fileoverview Job queue factory for creating in-memory job queues
 * Simple, server-agnostic implementation that works on any Node.js server
 *
 * @author Dylan Burkey
 * @license MIT
 */

import { AcpJob } from '@virtuals-protocol/acp-node';
import { JobQueue, QueueStatus } from './jobQueue';
import { Logger } from './logger';

/**
 * Queue interface for job processing
 */
export interface QueueInterface {
  enqueue(job: AcpJob, priority?: number): void | Promise<void>;
  getQueueStatus?(): Promise<QueueStatus>;
  stopProcessing?(): void;
  reset?(): Promise<void>;
}

/**
 * Creates an in-memory job queue for sequential ACP job processing
 *
 * This implementation:
 * - Works on any Node.js server (no cloud-specific dependencies)
 * - Processes jobs sequentially to prevent transaction conflicts
 * - Supports priority-based job ordering
 * - Includes retry logic for failed jobs
 *
 * @param processJobCallback - Async function to process each job
 * @param processingDelay - Delay between job processing in milliseconds (default: 3000)
 * @param maxRetries - Maximum retry attempts for failed jobs (default: 3)
 * @returns JobQueue instance ready for use
 *
 * @example
 * ```typescript
 * const queue = await createJobQueue(
 *   async (job) => {
 *     // Process the job
 *     console.log('Processing job:', job.id);
 *   },
 *   3000,  // 3 second delay between jobs
 *   3      // Retry up to 3 times
 * );
 *
 * // Add jobs to the queue
 * queue.enqueue(job, 10);  // priority 10 (higher = processed first)
 * ```
 */
export async function createJobQueue(
  processJobCallback: (job: AcpJob) => Promise<void>,
  processingDelay: number = 3000,
  maxRetries: number = 3
): Promise<QueueInterface> {
  Logger.log('[JobQueue] Initializing in-memory job queue');
  Logger.log(`[JobQueue] Processing delay: ${processingDelay}ms, Max retries: ${maxRetries}`);

  return new JobQueue(processJobCallback, processingDelay, maxRetries);
}
