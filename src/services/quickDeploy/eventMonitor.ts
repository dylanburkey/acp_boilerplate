/**
 * @fileoverview Event monitoring service for ACP integration
 * Monitors blockchain events to automatically capture transaction hashes
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { ethers } from 'ethers';
import { Logger } from '../../utils/logger';
import { 
  CONTRACT_ADDRESSES,
  EVENTS,
  LOG_PREFIX,
  ACP_CONFIG,
} from './constants';
import { MonitoredEvent } from './types';

/**
 * Event filter configuration
 */
export interface EventFilterConfig {
  contractAddress: string;
  eventName: string;
  filter?: any;
  callback: (event: MonitoredEvent) => Promise<void>;
}

/**
 * Service for monitoring blockchain events
 */
export class EventMonitor {
  /** Logger instance */
  private readonly logger = Logger;
  
  /** Provider instance */
  private readonly provider: ethers.Provider;
  
  /** Active monitors by job ID */
  private activeMonitors: Map<string, boolean> = new Map();
  
  /** Event filters by job ID */
  private eventFilters: Map<string, EventFilterConfig[]> = new Map();
  
  /** Monitored events by job ID */
  private monitoredEvents: Map<string, MonitoredEvent[]> = new Map();
  
  /** Contract instances */
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.logger.info(`${LOG_PREFIX.INIT} EventMonitor initialized`);
  }

  /**
   * Add event filter for monitoring
   */
  addEventFilter(config: EventFilterConfig): void {
    // For now, we'll use a default job ID if not monitoring specific jobs
    const jobId = 'default';
    
    if (!this.eventFilters.has(jobId)) {
      this.eventFilters.set(jobId, []);
    }
    
    this.eventFilters.get(jobId)!.push(config);
    
    this.logger.debug(`${LOG_PREFIX.INFO} Event filter added`, {
      contractAddress: config.contractAddress,
      eventName: config.eventName,
    });
  }

  /**
   * Start monitoring for a specific job
   */
  startMonitoring(jobId: string): void {
    if (this.activeMonitors.has(jobId)) {
      this.logger.warn(`${LOG_PREFIX.WARNING} Monitoring already active for job ${jobId}`);
      return;
    }
    
    this.activeMonitors.set(jobId, true);
    this.monitoredEvents.set(jobId, []);
    
    // Set up event listeners for this job
    const filters = this.eventFilters.get('default') || [];
    
    for (const filterConfig of filters) {
      this.setupEventListener(jobId, filterConfig);
    }
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} Started monitoring for job ${jobId}`);
  }

  /**
   * Stop monitoring for a specific job
   */
  stopMonitoring(jobId: string): void {
    if (!this.activeMonitors.has(jobId)) {
      return;
    }
    
    this.activeMonitors.delete(jobId);
    
    // Clean up event filters specific to this job
    this.eventFilters.delete(jobId);
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} Stopped monitoring for job ${jobId}`);
  }

  /**
   * Get monitored events for a job
   */
  getMonitoredEvents(jobId: string): MonitoredEvent[] {
    return this.monitoredEvents.get(jobId) || [];
  }

  /**
   * Set up event listener for a specific filter
   */
  private setupEventListener(jobId: string, filterConfig: EventFilterConfig): void {
    try {
      // Get or create contract instance
      const contract = this.getOrCreateContract(
        filterConfig.contractAddress,
        filterConfig.eventName
      );
      
      // Create event filter
      const eventFilter = contract.filters[filterConfig.eventName](
        ...(filterConfig.filter ? Object.values(filterConfig.filter) : [])
      );
      
      // Set up listener
      const listener = async (...args: any[]) => {
        // The last argument is the event object
        const event = args[args.length - 1];
        
        const monitoredEvent: MonitoredEvent = {
          eventName: filterConfig.eventName,
          transactionHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          args: args.slice(0, -1), // All args except the event object
          timestamp: Date.now(),
        };
        
        // Store event
        if (!this.monitoredEvents.has(jobId)) {
          this.monitoredEvents.set(jobId, []);
        }
        this.monitoredEvents.get(jobId)!.push(monitoredEvent);
        
        // Call callback
        await filterConfig.callback(monitoredEvent);
        
        this.logger.info(`${LOG_PREFIX.INFO} Event captured`, {
          jobId,
          eventName: filterConfig.eventName,
          txHash: monitoredEvent.transactionHash,
        });
      };
      
      contract.on(eventFilter, listener);
      
    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Failed to setup event listener`, error);
    }
  }

  /**
   * Get or create contract instance
   */
  private getOrCreateContract(address: string, eventName: string): ethers.Contract {
    const key = `${address}-${eventName}`;
    
    if (!this.contracts.has(key)) {
      // Define minimal ABI for the event
      let abi: string[] = [];
      
      if (eventName === EVENTS.PERSONAL_FUND_CREATED) {
        abi = ['event PersonalFundCreated(address indexed fundAddress, address indexed owner, bool isTokenFund)'];
      } else if (eventName === EVENTS.TRANSFER) {
        abi = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
      } else if (eventName === EVENTS.TRADING_STATUS_CHANGED) {
        abi = ['event TradingStatusChanged(bool enabled)'];
      }
      
      const contract = new ethers.Contract(address, abi, this.provider);
      this.contracts.set(key, contract);
    }
    
    return this.contracts.get(key)!;
  }

  /**
   * Find recent contract creation by user
   */
  async findRecentContractCreation(
    userWallet: string,
    fromBlock?: number
  ): Promise<string | null> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const startBlock = fromBlock || currentBlock - 100; // Look back 100 blocks
      
      const contract = this.getOrCreateContract(
        CONTRACT_ADDRESSES.FACTORY,
        EVENTS.PERSONAL_FUND_CREATED
      );
      
      const filter = contract.filters.PersonalFundCreated(
        null, // any fund address
        userWallet, // specific owner
        null // any fund type
      );
      
      const events = await contract.queryFilter(
        filter,
        startBlock,
        currentBlock
      );
      
      if (events.length > 0) {
        // Return the most recent deployment
        const latestEvent = events[events.length - 1];
        return latestEvent.transactionHash;
      }
      
      return null;
      
    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Failed to find contract creation:`, error);
      return null;
    }
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    // Remove all contract listeners
    for (const contract of this.contracts.values()) {
      contract.removeAllListeners();
    }
    
    this.contracts.clear();
    this.activeMonitors.clear();
    this.eventFilters.clear();
    this.monitoredEvents.clear();
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} EventMonitor cleaned up`);
  }
}

// Export singleton instance
let eventMonitorInstance: EventMonitor | null = null;

export function getEventMonitor(provider?: ethers.Provider): EventMonitor {
  if (!eventMonitorInstance && provider) {
    eventMonitorInstance = new EventMonitor(provider);
  }
  
  if (!eventMonitorInstance) {
    throw new Error('EventMonitor not initialized. Provide a provider on first call.');
  }
  
  return eventMonitorInstance;
}
