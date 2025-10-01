/**
 * @fileoverview Event monitoring service for Butler integration
 * Monitors blockchain events to automatically capture contract creation TX hashes
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
  BUTLER_CONFIG,
} from './constants';

/**
 * Interface for monitored events
 */
interface MonitoredEvent {
  eventName: string;
  contractAddress: string;
  fundAddress?: string;
  owner?: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

/**
 * Service for monitoring blockchain events related to Butler deployments
 */
export class EventMonitorService {
  /** Logger instance */
  private readonly logger = Logger;
  
  /** Provider instance */
  private readonly provider: ethers.JsonRpcProvider;
  
  /** Factory contract instance */
  private factoryContract: ethers.Contract;
  
  /** Event listeners */
  private listeners: Map<string, Function> = new Map();
  
  /** Payment to deployment mapping */
  private paymentToDeployment: Map<string, MonitoredEvent> = new Map();

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    
    // Initialize factory contract for event monitoring
    const factoryAbi = [
      'event PersonalFundCreated(address indexed fundAddress, address indexed owner, bool isTokenFund)',
    ];
    
    this.factoryContract = new ethers.Contract(
      CONTRACT_ADDRESSES.FACTORY,
      factoryAbi,
      this.provider
    );
    
    this.logger.info(`${LOG_PREFIX.INIT} EventMonitorService initialized`);
  }

  /**
   * Starts monitoring for PersonalFundCreated events
   */
  async startMonitoring(): Promise<void> {
    this.logger.info(`${LOG_PREFIX.PROCESSING} Starting event monitoring...`);
    
    // Listen for PersonalFundCreated events
    const filter = this.factoryContract.filters.PersonalFundCreated();
    
    const listener = async (fundAddress: string, owner: string, isTokenFund: boolean, event: any) => {
      const txHash = event.log.transactionHash;
      const blockNumber = event.log.blockNumber;
      
      this.logger.info(`${LOG_PREFIX.BUTLER} PersonalFundCreated event detected:`, {
        fundAddress,
        owner,
        isTokenFund,
        txHash,
        blockNumber,
      });
      
      // Store event data
      const monitoredEvent: MonitoredEvent = {
        eventName: EVENTS.PERSONAL_FUND_CREATED,
        contractAddress: CONTRACT_ADDRESSES.FACTORY,
        fundAddress,
        owner,
        txHash,
        blockNumber,
        timestamp: Date.now(),
      };
      
      // Check if we have a payment TX waiting for this deployment
      await this.checkPaymentMatching(monitoredEvent);
      
      // Emit custom event for other services
      this.emitDeploymentEvent(monitoredEvent);
    };
    
    this.factoryContract.on(filter, listener);
    this.listeners.set('PersonalFundCreated', listener);
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} Event monitoring started`);
  }

  /**
   * Monitors a Butler payment transaction
   * Links payment TX to subsequent deployment
   */
  async monitorButlerPayment(paymentTxHash: string, userWallet: string): Promise<void> {
    this.logger.info(`${LOG_PREFIX.BUTLER} Monitoring Butler payment: ${paymentTxHash}`);
    
    try {
      // Get payment transaction details
      const receipt = await this.provider.getTransactionReceipt(paymentTxHash);
      
      if (!receipt) {
        this.logger.warn(`${LOG_PREFIX.WARNING} Payment transaction not found`);
        return;
      }
      
      // Verify it's a USDC transfer to the payment recipient
      const isValidPayment = await this.verifyButlerPayment(receipt);
      
      if (!isValidPayment) {
        this.logger.warn(`${LOG_PREFIX.WARNING} Invalid Butler payment`);
        return;
      }
      
      // Store payment info for matching with deployment
      this.paymentToDeployment.set(userWallet, {
        eventName: 'ButlerPayment',
        contractAddress: CONTRACT_ADDRESSES.USDC,
        txHash: paymentTxHash,
        blockNumber: receipt.blockNumber,
        timestamp: Date.now(),
      });
      
      this.logger.info(`${LOG_PREFIX.SUCCESS} Butler payment registered for ${userWallet}`);
      
      // Set timeout to clean up if no deployment follows
      setTimeout(() => {
        if (this.paymentToDeployment.has(userWallet)) {
          this.logger.warn(`${LOG_PREFIX.WARNING} No deployment followed Butler payment for ${userWallet}`);
          this.paymentToDeployment.delete(userWallet);
        }
      }, 5 * 60 * 1000); // 5 minutes
      
    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Failed to monitor Butler payment:`, error);
    }
  }

  /**
   * Verifies Butler payment transaction
   */
  private async verifyButlerPayment(receipt: ethers.TransactionReceipt): Promise<boolean> {
    // Check if it's to USDC contract
    if (receipt.to?.toLowerCase() !== CONTRACT_ADDRESSES.USDC.toLowerCase()) {
      return false;
    }
    
    // Check for Transfer event to payment recipient
    const transferTopic = ethers.id(`${EVENTS.TRANSFER}(address,address,uint256)`);
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === CONTRACT_ADDRESSES.USDC.toLowerCase() &&
          log.topics[0] === transferTopic) {
        const to = ethers.getAddress('0x' + log.topics[2].slice(26));
        if (to.toLowerCase() === BUTLER_CONFIG.PAYMENT_RECIPIENT.toLowerCase()) {
          const amount = ethers.toBigInt(log.data);
          const expectedAmount = ethers.parseUnits(
            BUTLER_CONFIG.PAYMENT_AMOUNT_USDC.toString(), 
            6
          );
          
          if (amount >= expectedAmount) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Checks if a deployment matches a waiting Butler payment
   */
  private async checkPaymentMatching(deploymentEvent: MonitoredEvent): Promise<void> {
    const userWallet = deploymentEvent.owner;
    
    if (!userWallet) return;
    
    const paymentEvent = this.paymentToDeployment.get(userWallet);
    
    if (paymentEvent) {
      this.logger.info(`${LOG_PREFIX.SUCCESS} Matched Butler payment to deployment:`, {
        paymentTx: paymentEvent.txHash,
        deploymentTx: deploymentEvent.txHash,
        userWallet,
      });
      
      // Emit matched event
      this.emitMatchedEvent({
        paymentTxHash: paymentEvent.txHash,
        contractCreationTxHash: deploymentEvent.txHash,
        fundAddress: deploymentEvent.fundAddress!,
        userWallet,
      });
      
      // Clean up
      this.paymentToDeployment.delete(userWallet);
    }
  }

  /**
   * Emits deployment event for other services
   */
  private emitDeploymentEvent(event: MonitoredEvent): void {
    process.emit('deployment:created', event);
  }

  /**
   * Emits matched payment-deployment event
   */
  private emitMatchedEvent(data: any): void {
    process.emit('butler:matched', data);
  }

  /**
   * Gets contract creation TX by user wallet
   * Used when Butler provides payment TX
   */
  async findContractCreationByUser(
    userWallet: string, 
    fromBlock?: number
  ): Promise<string | null> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const startBlock = fromBlock || currentBlock - 1000; // Look back 1000 blocks
      
      const filter = this.factoryContract.filters.PersonalFundCreated(
        null, // any fund address
        userWallet, // specific owner
        null // any fund type
      );
      
      const events = await this.factoryContract.queryFilter(
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
   * Stops event monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.logger.info(`${LOG_PREFIX.INFO} Stopping event monitoring...`);
    
    // Remove all listeners
    for (const [eventName, listener] of this.listeners) {
      this.factoryContract.off(eventName, listener);
    }
    
    this.listeners.clear();
    this.paymentToDeployment.clear();
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} Event monitoring stopped`);
  }

  /**
   * Gets current monitoring status
   */
  getStatus(): object {
    return {
      isMonitoring: this.listeners.size > 0,
      activeListeners: Array.from(this.listeners.keys()),
      pendingPayments: this.paymentToDeployment.size,
      pendingUsers: Array.from(this.paymentToDeployment.keys()),
    };
  }
}

// Export singleton instance
let eventMonitor: EventMonitorService | null = null;

export function getEventMonitor(provider?: ethers.JsonRpcProvider): EventMonitorService {
  if (!eventMonitor && provider) {
    eventMonitor = new EventMonitorService(provider);
  }
  
  if (!eventMonitor) {
    throw new Error('EventMonitor not initialized. Provide a provider on first call.');
  }
  
  return eventMonitor;
}
