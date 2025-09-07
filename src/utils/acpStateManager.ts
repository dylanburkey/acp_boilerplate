/**
 * ACP State Management Utilities
 * Provides functions to filter and reduce ACP state to prevent memory accumulation
 * and improve performance, based on Python implementation patterns.
 */

import type { AcpState, IAcpJob } from '@virtuals-protocol/game-acp-plugin';

// Type for objects that have a jobId property
interface WithJobId {
  jobId?: number;
}

// Type guard to check if an object has a jobId
function hasJobId(obj: unknown): obj is WithJobId {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'jobId' in obj &&
    (typeof (obj as WithJobId).jobId === 'number' || (obj as WithJobId).jobId === undefined)
  );
}

/**
 * Efficient deep clone implementation for ACP state objects
 * Handles nested objects and arrays without using JSON.parse/stringify
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => deepClone(item)) as T;
  }

  const clonedObj = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }

  return clonedObj;
}

/**
 * Configuration for state reduction
 */
export interface StateReductionConfig {
  keepCompletedJobs?: number;
  keepCancelledJobs?: number;
  keepAcquiredInventory?: number;
  keepProducedInventory?: number;
  jobIdsToIgnore?: number[];
  agentAddressesToIgnore?: string[];
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<
  Omit<StateReductionConfig, 'jobIdsToIgnore' | 'agentAddressesToIgnore'>
> = {
  keepCompletedJobs: 5,
  keepCancelledJobs: 5,
  keepAcquiredInventory: 5,
  keepProducedInventory: 5,
};

/**
 * Filters items to keep only the most recent ones based on jobId
 * Returns a new array with the specified number of most recent items
 */
function filterToMostRecent<T>(
  items: T[],
  keep: number,
  label: string,
  getJobId?: (item: T) => number | undefined
): T[] {
  if (items.length <= keep) {
    return items;
  }

  const sorted = [...items].sort((a, b) => {
    const aId = getJobId ? getJobId(a) : hasJobId(a) ? a.jobId : undefined;
    const bId = getJobId ? getJobId(b) : hasJobId(b) ? b.jobId : undefined;
    return (bId || 0) - (aId || 0);
  });
  const filteredCount = items.length - keep;
  console.info(`Filtered out ${filteredCount} old ${label}, keeping ${keep} most recent`);

  return sorted.slice(0, keep);
}

/**
 * Filters out specific job IDs from active job lists
 */
function filterOutJobIds(state: AcpState, jobIdsToIgnore: number[]): AcpState {
  if (!jobIdsToIgnore.length) {
    return state;
  }

  const filteredState = deepClone(state);

  if (filteredState.jobs.active.asABuyer) {
    filteredState.jobs.active.asABuyer = filteredState.jobs.active.asABuyer.filter(
      (job: IAcpJob) => !jobIdsToIgnore.includes(job.jobId)
    );
  }

  if (filteredState.jobs.active.asASeller) {
    filteredState.jobs.active.asASeller = filteredState.jobs.active.asASeller.filter(
      (job: IAcpJob) => !jobIdsToIgnore.includes(job.jobId)
    );
  }

  return filteredState;
}

/**
 * Filters out jobs from specific agent addresses
 */
function filterOutAgentAddresses(state: AcpState, addressesToIgnore: string[]): AcpState {
  if (!addressesToIgnore.length) {
    return state;
  }

  // Ensure arrays exist before spreading to avoid runtime errors
  const buyerJobs = state.jobs.active.asABuyer || [];
  const sellerJobs = state.jobs.active.asASeller || [];

  const allActiveJobs: IAcpJob[] = [...buyerJobs, ...sellerJobs];

  const jobIdsToRemove = allActiveJobs
    .filter(
      (job: IAcpJob) => job.providerAddress && addressesToIgnore.includes(job.providerAddress)
    )
    .map((job: IAcpJob) => job.jobId);

  if (jobIdsToRemove.length > 0) {
    console.info(
      `Removing ${jobIdsToRemove.length} active jobs from ignored agents: ${jobIdsToRemove.join(', ')}`
    );
    return filterOutJobIds(state, jobIdsToRemove);
  }

  return state;
}

/**
 * Filters completed jobs to keep only the most recent ones
 */
function filterCompletedJobs(state: AcpState, keepMostRecent: number): AcpState {
  const filteredState = deepClone(state);
  filteredState.jobs.completed = filterToMostRecent(
    filteredState.jobs.completed,
    keepMostRecent,
    'completed jobs'
  );
  return filteredState;
}

/**
 * Filters cancelled jobs to keep only the most recent ones
 */
function filterCancelledJobs(state: AcpState, keepMostRecent: number): AcpState {
  const filteredState = deepClone(state);
  filteredState.jobs.cancelled = filterToMostRecent(
    filteredState.jobs.cancelled,
    keepMostRecent,
    'cancelled jobs'
  );
  return filteredState;
}

/**
 * Filters acquired inventory to keep only the most recent items
 */
function filterAcquiredInventory(state: AcpState, keepMostRecent: number): AcpState {
  const filteredState = deepClone(state);
  if (filteredState.inventory?.acquired) {
    filteredState.inventory.acquired = filterToMostRecent(
      filteredState.inventory.acquired,
      keepMostRecent,
      'acquired inventory',
      (item: unknown) => (hasJobId(item) ? item.jobId : undefined)
    );
  }
  return filteredState;
}

/**
 * Filters produced inventory to keep only the most recent items
 */
function filterProducedInventory(state: AcpState, keepMostRecent: number): AcpState {
  const filteredState = deepClone(state);
  if (filteredState.inventory?.produced) {
    filteredState.inventory.produced = filterToMostRecent(
      filteredState.inventory.produced,
      keepMostRecent,
      'produced inventory',
      (item: unknown) => (hasJobId(item) ? item.jobId : undefined)
    );
  }
  return filteredState;
}

/**
 * Main function to reduce ACP agent state based on configuration
 * This helps prevent memory accumulation and improves performance
 */
export function reduceAgentState(state: AcpState, config: StateReductionConfig = {}): AcpState {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  let reducedState = state;

  // Step 1: Filter specific job IDs
  if (config.jobIdsToIgnore?.length) {
    reducedState = filterOutJobIds(reducedState, config.jobIdsToIgnore);
  }

  // Step 2: Filter jobs from ignored agent addresses
  if (config.agentAddressesToIgnore?.length) {
    reducedState = filterOutAgentAddresses(reducedState, config.agentAddressesToIgnore);
  }

  // Step 3: Filter historical data to keep only recent items
  reducedState = filterCompletedJobs(reducedState, fullConfig.keepCompletedJobs);
  reducedState = filterCancelledJobs(reducedState, fullConfig.keepCancelledJobs);
  reducedState = filterAcquiredInventory(reducedState, fullConfig.keepAcquiredInventory);
  reducedState = filterProducedInventory(reducedState, fullConfig.keepProducedInventory);

  return reducedState;
}

/**
 * Creates a wrapped getAgentState function that automatically applies state reduction
 */
export function createReducedStateGetter(
  getAcpState: () => Promise<AcpState> | AcpState,
  config: StateReductionConfig = {}
) {
  return async () => {
    const state = await getAcpState();
    return reduceAgentState(state, config);
  };
}
