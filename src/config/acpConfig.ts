/**
 * @fileoverview ACP (Agent Commerce Protocol) configuration module.
 * Centralized configuration for the ACP job queue system, transaction settings,
 * rate limiting, and monitoring. Based on Athena's optimized settings.
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { AcpJobPhases } from '@virtuals-protocol/acp-node';

/**
 * Main ACP configuration object containing all settings for job queue management,
 * transaction handling, rate limiting, and monitoring.
 */
export const ACP_CONFIG = {
  // Job Queue Settings
  jobQueue: {
    // Delay between processing jobs (milliseconds)
    processingDelay: parseInt(process.env.ACP_PROCESSING_DELAY || '3000'),

    // Maximum retry attempts for failed transactions
    maxRetries: parseInt(process.env.ACP_MAX_RETRIES || '3'),

    // Priority levels for different job phases
    priorities: {
      EVALUATION: 20,    // Highest priority - final stage
      TRANSACTION: 15,   // High priority - payment stage
      NEGOTIATION: 10,   // Medium priority - negotiation stage
      REQUEST: 5,        // Lower priority - initial request
      COMPLETED: 0,      // Completed jobs (shouldn't be processed)
      REJECTED: 0,       // Rejected jobs (shouldn't be processed)
      EXPIRED: 0,        // Expired jobs (shouldn't be processed)
    },
  },

  // Transaction Settings
  transaction: {
    // Gas price multiplier for retries (e.g., 1.1 = 10% increase)
    gasPriceMultiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER || '1.1'),

    // Maximum gas price in gwei
    maxGasPrice: parseInt(process.env.MAX_GAS_PRICE || '100'),

    // Timeout for transaction confirmation (milliseconds)
    confirmationTimeout: parseInt(process.env.TX_CONFIRMATION_TIMEOUT || '60000'),
  },

  // Rate Limiting
  rateLimiting: {
    // Minimum time between transactions from same wallet (milliseconds)
    minTimeBetweenTx: parseInt(process.env.MIN_TIME_BETWEEN_TX || '2000'),

    // Maximum concurrent pending transactions
    maxPendingTx: parseInt(process.env.MAX_PENDING_TX || '1'),
  },

  // Monitoring
  monitoring: {
    // Enable transaction monitoring
    enabled: process.env.ENABLE_TX_MONITORING !== 'false',

    // Log transaction details
    logDetails: process.env.LOG_TX_DETAILS === 'true',
  },

  // State Management
  stateReduction: {
    // Number of completed jobs to keep
    keepCompletedJobs: parseInt(process.env.KEEP_COMPLETED_JOBS || '5'),

    // Number of cancelled jobs to keep
    keepCancelledJobs: parseInt(process.env.KEEP_CANCELLED_JOBS || '5'),

    // Number of inventory items to keep
    keepAcquiredInventory: parseInt(process.env.KEEP_ACQUIRED_INVENTORY || '5'),
    keepProducedInventory: parseInt(process.env.KEEP_PRODUCED_INVENTORY || '5'),
  },
};

/**
 * Get priority level for a given ACP job phase.
 * 
 * Priority levels (higher is more important):
 * - EVALUATION: 20 (highest priority - final stage)
 * - TRANSACTION: 15 (high priority - payment stage)
 * - NEGOTIATION: 10 (medium priority - negotiation stage)
 * - REQUEST: 5 (lower priority - initial request)
 * - COMPLETED/REJECTED/EXPIRED: 0 (should not be processed)
 * 
 * @param phase - The job phase, can be an enum value, string, or number
 * @returns The priority level for the given phase
 */
export function getJobPriority(phase: AcpJobPhases | string | number): number {
  let phaseStr: string;

  if (typeof phase === 'number') {
    // Convert enum value to string using reverse mapping
    const enumKey = AcpJobPhases[phase];
    
    if (typeof enumKey === 'string') {
      phaseStr = enumKey;
    } else {
      console.warn(`[ACP] Invalid phase number: ${phase}`);
      phaseStr = 'UNKNOWN';
    }
  } else if (typeof phase === 'string') {
    phaseStr = phase;
  } else {
    console.warn(`[ACP] Unexpected phase type: ${typeof phase}`);
    phaseStr = 'UNKNOWN';
  }

  return (
    ACP_CONFIG.jobQueue.priorities[phaseStr as keyof typeof ACP_CONFIG.jobQueue.priorities] || 0
  );
}

/**
 * Check if a job phase indicates the job should be processed
 * @param phase - The job phase to check
 * @returns True if the job should be processed
 */
export function shouldProcessJob(phase: AcpJobPhases | string | number): boolean {
  const priority = getJobPriority(phase);
  return priority > 0;
}

/**
 * Get configuration for transaction retry logic
 * @param attemptNumber - Current attempt number (1-based)
 * @returns Configuration for the retry attempt
 */
export function getRetryConfig(attemptNumber: number): {
  gasMultiplier: number;
  delay: number;
} {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  
  // Exponential backoff with jitter
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attemptNumber - 1),
    maxDelay
  );
  
  // Add jitter (±20%)
  const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
  const delay = Math.floor(exponentialDelay + jitter);
  
  // Calculate gas multiplier
  const gasMultiplier = Math.pow(
    ACP_CONFIG.transaction.gasPriceMultiplier,
    attemptNumber - 1
  );
  
  return { gasMultiplier, delay };
}

/**
 * Validate ACP configuration
 * @throws Error if configuration is invalid
 */
export function validateACPConfig(): void {
  // Validate job queue settings
  if (ACP_CONFIG.jobQueue.processingDelay < 1000) {
    throw new Error('ACP_PROCESSING_DELAY must be at least 1000ms');
  }
  
  if (ACP_CONFIG.jobQueue.maxRetries < 1 || ACP_CONFIG.jobQueue.maxRetries > 10) {
    throw new Error('ACP_MAX_RETRIES must be between 1 and 10');
  }
  
  // Validate transaction settings
  if (ACP_CONFIG.transaction.gasPriceMultiplier < 1.0 || ACP_CONFIG.transaction.gasPriceMultiplier > 2.0) {
    throw new Error('GAS_PRICE_MULTIPLIER must be between 1.0 and 2.0');
  }
  
  if (ACP_CONFIG.transaction.maxGasPrice < 10 || ACP_CONFIG.transaction.maxGasPrice > 1000) {
    throw new Error('MAX_GAS_PRICE must be between 10 and 1000 gwei');
  }
  
  // Validate rate limiting
  if (ACP_CONFIG.rateLimiting.minTimeBetweenTx < 500) {
    throw new Error('MIN_TIME_BETWEEN_TX must be at least 500ms');
  }
  
  if (ACP_CONFIG.rateLimiting.maxPendingTx < 1 || ACP_CONFIG.rateLimiting.maxPendingTx > 5) {
    throw new Error('MAX_PENDING_TX must be between 1 and 5');
  }
}
