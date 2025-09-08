/**
 * Simple Job Queue for managing ACP jobs
 */

export interface Job {
  id: string;
  buyer: string;
  phase: string;
  priority: number;
  timestamp: number;
  retryCount: number;
  params?: any;
}

export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private completedJobs: Set<string> = new Set();
  private failedJobs: Set<string> = new Set();

  /**
   * Get first item from a Set safely
   */
  private getFirstFromSet(set: Set<string>): string | undefined {
    return set.values().next().value;
  }

  /**
   * Check if a job is already queued
   */
  isQueued(jobId: string): boolean {
    return this.jobs.has(jobId) || this.completedJobs.has(jobId);
  }

  /**
   * Add a job to the queue
   */
  addJob(job: Job): void {
    if (!this.isQueued(job.id)) {
      this.jobs.set(job.id, job);
    }
  }

  /**
   * Get the next job to process (highest priority first)
   */
  getNextJob(): Job | null {
    if (this.jobs.size === 0) return null;

    let nextJob: Job | null = null;
    let highestPriority = -Infinity;

    for (const job of this.jobs.values()) {
      if (job.priority > highestPriority) {
        highestPriority = job.priority;
        nextJob = job;
      }
    }

    if (nextJob) {
      this.jobs.delete(nextJob.id);
    }

    return nextJob;
  }

  /**
   * Mark a job as completed
   */
  markCompleted(jobId: string): void {
    this.jobs.delete(jobId);
    this.completedJobs.add(jobId);
    
    // Keep only recent completed jobs to prevent memory issues
    if (this.completedJobs.size > 100) {
      const firstJob = this.getFirstFromSet(this.completedJobs);
      if (firstJob) {
        this.completedJobs.delete(firstJob);
      }
    }
  }

  /**
   * Mark a job as failed
   */
  markFailed(jobId: string): void {
    this.jobs.delete(jobId);
    this.failedJobs.add(jobId);
    
    // Keep only recent failed jobs
    if (this.failedJobs.size > 50) {
      const firstJob = this.getFirstFromSet(this.failedJobs);
      if (firstJob) {
        this.failedJobs.delete(firstJob);
      }
    }
  }

  /**
   * Remove a specific job from the queue (e.g., for expired jobs)
   */
  removeJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Get queue status
   */
  getStatus(): { pending: number; completed: number; failed: number } {
    return {
      pending: this.jobs.size,
      completed: this.completedJobs.size,
      failed: this.failedJobs.size
    };
  }

  /**
   * Clear completed and failed jobs
   */
  clearHistory(): void {
    this.completedJobs.clear();
    this.failedJobs.clear();
  }
}