/**
 * Wrapper class for ACP State Management
 * Provides a class-based interface for state management functions
 */

import { reduceAgentState, StateReductionConfig } from './acpStateManager';

export default class AcpStateManager {
  private config: StateReductionConfig;

  constructor(config?: StateReductionConfig) {
    this.config = config || {
      keepCompletedJobs: parseInt(process.env.KEEP_COMPLETED_JOBS || '5'),
      keepCancelledJobs: parseInt(process.env.KEEP_CANCELLED_JOBS || '5'),
      jobIdsToIgnore: process.env.IGNORED_JOB_IDS?.split(',').map(id => parseInt(id.trim())).filter(Boolean) || []
    };
  }

  /**
   * Filter and reduce the ACP state to prevent memory issues
   */
  filterState(state: any): any {
    return reduceAgentState(state, this.config);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<StateReductionConfig>) {
    this.config = { ...this.config, ...config };
  }
}