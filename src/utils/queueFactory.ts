/**
 * Factory for creating the appropriate JobQueue implementation
 * based on environment configuration
 */

import { AcpJob } from '@virtuals-protocol/acp-node';
import { JobQueue, QueueStatus } from './jobQueue';
import { Logger } from './logger';

export interface QueueInterface {
  enqueue(job: AcpJob, priority?: number): void | Promise<void>;
  getQueueStatus?(): Promise<QueueStatus>;
  stopProcessing?(): void;
  reset?(): Promise<void>;
}

/**
 * Create the appropriate job queue based on environment configuration
 */
export async function createJobQueue(
  processJobCallback: (job: AcpJob) => Promise<void>,
  processingDelay: number = 3000,
  maxRetries: number = 3
): Promise<QueueInterface> {
  const useDurableObjects = process.env.USE_DURABLE_OBJECTS === 'true';
  const isLocalTest = process.env.LOCAL_TEST_ONLY === 'true';

  // Safety check for local testing
  if (useDurableObjects && isLocalTest) {
    const workerUrl = process.env.DURABLE_OBJECT_WORKER_URL;
    if (workerUrl && !workerUrl.includes('localhost')) {
      Logger.error(
        '[QueueFactory] SAFETY: LOCAL_TEST_ONLY is set but worker URL is not localhost!'
      );
      Logger.error('[QueueFactory] Falling back to in-memory queue for safety');
      return new JobQueue(processJobCallback, processingDelay, maxRetries);
    }
  }

  // For now, always use in-memory queue
  Logger.log('[QueueFactory] Using in-memory job queue');
  return new JobQueue(processJobCallback, processingDelay, maxRetries);
}

