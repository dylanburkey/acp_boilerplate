/**
 * @fileoverview Service Level Agreement (SLA) manager for handling job expiration
 * and lifecycle states according to ACP best practices.
 * @author ACP Integration Boilerplate
 * @license MIT
 */

import {Logger} from './logger';
import {config} from '../config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a job's lifecycle state in the SLA system
 */
export enum JobLifecycleState {
  /** Job is active and being processed */
  Green = 'GREEN',
  /** Job was rejected due to failure */
  Red = 'RED', 
  /** Job expired due to SLA timeout */
  Brown = 'BROWN'
}

/**
 * Interface for job tracking within SLA system
 */
export interface SlaJob {
  /** Unique job identifier */
  id: string;
  /** Timestamp when job was created */
  createdAt: number;
  /** Timestamp when job expires according to SLA */
  expiresAt: number;
  /** Current lifecycle state */
  state: JobLifecycleState;
  /** Number of retry attempts made */
  retryCount: number;
  /** Optional rejection reason if state is RED */
  rejectionReason?: string;
}

/**
 * Manages Service Level Agreements for ACP jobs according to the tech playbook.
 * 
 * Key features:
 * - Automatic job expiration based on configurable SLA timeouts
 * - Job lifecycle state tracking (Green/Red/Brown)
 * - Automatic refund triggering for expired jobs
 * - Graduation progress tracking for sandbox environments
 * 
 * @class SlaManager
 */
export class SlaManager {
  /** Map of active jobs being tracked */
  private jobs: Map<string, SlaJob> = new Map();
  
  /** Timer for periodic SLA checks */
  private checkTimer?: NodeJS.Timeout;

  /**
   * Creates a new SLA manager instance.
   * Automatically starts periodic SLA checks if job expiration is enabled.
   */
  constructor() {
    if (config.enableJobExpiration) {
      this.startPeriodicChecks();
      Logger.info(`SLA Manager initialized with ${config.jobExpirationHours}h expiration`);
    }
  }

  /**
   * Adds a new job to SLA tracking.
   * 
   * @param jobId - Unique identifier for the job
   * @param createdAt - Optional timestamp when job was created (defaults to now)
   */
  addJob(jobId: string, createdAt?: number): void {
    const now = createdAt || Date.now();
    const expiresAt = now + (config.jobExpirationHours * 60 * 60 * 1000);
    
    const slaJob: SlaJob = {
      id: jobId,
      createdAt: now,
      expiresAt,
      state: JobLifecycleState.Green,
      retryCount: 0
    };
    
    this.jobs.set(jobId, slaJob);
    Logger.debug(`Job ${jobId} added to SLA tracking, expires at ${new Date(expiresAt).toISOString()}`);
  }

  /**
   * Marks a job as completed successfully (Green state).
   * Removes the job from active tracking.
   * 
   * @param jobId - Job identifier to mark as completed
   * @returns True if job was found and marked, false otherwise
   */
  markCompleted(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      Logger.warn(`Attempted to mark non-tracked job as completed: ${jobId}`);
      return false;
    }
    
    job.state = JobLifecycleState.Green;
    this.jobs.delete(jobId);
    
    Logger.info(`Job ${jobId} marked as completed (GREEN state)`);
    this.updateGraduationProgress();
    return true;
  }

  /**
   * Marks a job as rejected/failed (Red state).
   * Removes the job from active tracking.
   * 
   * @param jobId - Job identifier to mark as rejected
   * @param reason - Optional reason for rejection
   * @returns True if job was found and marked, false otherwise
   */
  markRejected(jobId: string, reason?: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      Logger.warn(`Attempted to mark non-tracked job as rejected: ${jobId}`);
      return false;
    }
    
    job.state = JobLifecycleState.Red;
    job.rejectionReason = reason;
    this.jobs.delete(jobId);
    
    Logger.info(`Job ${jobId} marked as rejected (RED state)${reason ? `: ${reason}` : ''}`);
    return true;
  }

  /**
   * Increments retry count for a job.
   * 
   * @param jobId - Job identifier to increment retry count
   * @returns New retry count, or -1 if job not found
   */
  incrementRetry(jobId: string): number {
    const job = this.jobs.get(jobId);
    if (!job) {
      Logger.warn(`Attempted to increment retry for non-tracked job: ${jobId}`);
      return -1;
    }
    
    job.retryCount++;
    Logger.debug(`Job ${jobId} retry count incremented to ${job.retryCount}`);
    return job.retryCount;
  }

  /**
   * Gets the current state of a tracked job.
   * 
   * @param jobId - Job identifier to query
   * @returns Job state or null if not found
   */
  getJobState(jobId: string): SlaJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Gets all currently tracked jobs.
   * 
   * @returns Array of all tracked jobs
   */
  getAllJobs(): SlaJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Checks for expired jobs and marks them as expired (Brown state).
   * This method should be called periodically to enforce SLA timeouts.
   * 
   * @returns Array of job IDs that have expired
   */
  checkExpiredJobs(): string[] {
    if (!config.enableJobExpiration) {
      return [];
    }

    const now = Date.now();
    const expiredJobs: string[] = [];
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (now > job.expiresAt && job.state === JobLifecycleState.Green) {
        job.state = JobLifecycleState.Brown;
        expiredJobs.push(jobId);
        
        Logger.warn(`Job ${jobId} expired after ${config.jobExpirationHours}h (BROWN state)`);
        
        // Remove from active tracking
        this.jobs.delete(jobId);
      }
    }
    
    return expiredJobs;
  }

  /**
   * Gets statistics about job states and SLA performance.
   * 
   * @returns Object containing various SLA metrics
   */
  getStatistics(): {
    activeJobs: number;
    averageJobAge: number;
    jobsNearingExpiration: number;
    sandboxProgress: number;
    environment: string;
    graduationReady: boolean;
  } {
    const now = Date.now();
    const activeJobs = Array.from(this.jobs.values());
    const jobsNearingExpiration = activeJobs.filter(job => 
      (job.expiresAt - now) < (2 * 60 * 60 * 1000) // Less than 2 hours remaining
    ).length;
    
    const totalAge = activeJobs.reduce((sum, job) => sum + (now - job.createdAt), 0);
    const averageJobAge = activeJobs.length > 0 ? totalAge / activeJobs.length : 0;
    
    return {
      activeJobs: activeJobs.length,
      averageJobAge: Math.round(averageJobAge / (60 * 1000)), // Convert to minutes
      jobsNearingExpiration,
      sandboxProgress: config.sandboxTransactionCount,
      environment: config.environment,
      graduationReady: config.environment === 'sandbox' && config.sandboxTransactionCount >= 10
    };
  }

  /**
   * Updates graduation progress for sandbox environment.
   * Tracks successful transactions towards the 10 required for graduation.
   * Persists the count to the .env file for accurate tracking.
   * 
   * @private
   */
  private updateGraduationProgress(): void {
    if (config.environment === 'sandbox') {
      try {
        const newCount = config.sandboxTransactionCount + 1;
        
        // Update the .env file with new count
        this.updateEnvFile('SANDBOX_TRANSACTION_COUNT', newCount.toString());
        
        Logger.info(`Sandbox graduation progress: ${newCount}/10 successful transactions`);
        
        if (newCount >= 10) {
          Logger.info('🎓 Sandbox graduation milestone reached!');
          Logger.info('Next steps:');
          Logger.info('1. Contact Virtuals team for manual review');
          Logger.info('2. Discord: https://discord.gg/virtuals');
          Logger.info('3. Ensure service quality is consistent before submitting');
        } else if (newCount >= 5) {
          Logger.info(`Halfway to graduation! ${10 - newCount} more successful transactions needed.`);
        }
      } catch (error) {
        Logger.error('Failed to update graduation progress:', error);
      }
    }
  }
  
  /**
   * Updates a value in the .env file.
   * Used for persisting graduation progress.
   * 
   * @param key - Environment variable key
   * @param value - New value to set
   * @private
   */
  private updateEnvFile(key: string, value: string): void {
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      Logger.warn('.env file not found, cannot update graduation progress');
      return;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    let updated = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${key}=`)) {
        lines[i] = `${key}=${value}`;
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      // Add the key if it doesn't exist
      lines.push(`${key}=${value}`);
    }
    
    fs.writeFileSync(envPath, lines.join('\n'));
  }

  /**
   * Starts periodic SLA checks to monitor job expiration.
   * 
   * @private
   */
  private startPeriodicChecks(): void {
    // Check for expired jobs every 5 minutes
    const checkInterval = 5 * 60 * 1000;
    
    this.checkTimer = setInterval(() => {
      const expiredJobs = this.checkExpiredJobs();
      
      if (expiredJobs.length > 0) {
        Logger.warn(`SLA Check: ${expiredJobs.length} jobs expired and marked as BROWN`);
      }
      
      // Log statistics periodically
      const stats = this.getStatistics();
      if (stats.activeJobs > 0) {
        Logger.debug(`SLA Status: ${stats.activeJobs} active jobs, ` +
                    `${stats.jobsNearingExpiration} nearing expiration`);
      }
    }, checkInterval);
    
    Logger.debug('SLA periodic checks started');
  }

  /**
   * Stops periodic SLA checks and cleans up resources.
   */
  shutdown(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      Logger.debug('SLA Manager shutdown complete');
    }
  }
}