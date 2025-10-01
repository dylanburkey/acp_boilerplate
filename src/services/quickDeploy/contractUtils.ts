/**
 * @fileoverview Contract interaction utilities for Quick Deploy service.
 * Handles the actual on-chain deployment of trading agents using Kosher Capital's factory contracts.
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { ethers } from 'ethers';
import { config } from '../../config';
import { Logger } from '../../utils/logger';
import { 
  CONTRACT_ADDRESSES,
  PAYMENT_CONFIG,
  CONTRACT_FUNCTIONS,
  EVENTS,
  LOG_PREFIX,
} from './constants';

// Minimal ABIs for the required functions
const FACTORY_ABI = [
  {
    "inputs": [
      { "internalType": "bool", "name": "isTokenFund", "type": "bool" },
      { "internalType": "address", "name": "aiWallet", "type": "address" },
      { "internalType": "address", "name": "frTokenAddress", "type": "address" }
    ],
    "name": CONTRACT_FUNCTIONS.CREATE_PERSONALIZED_FUNDS,
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const ERC20_TRANSFER_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": CONTRACT_FUNCTIONS.TRANSFER,
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": CONTRACT_FUNCTIONS.BALANCE_OF,
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

const PERSONAL_FUND_ABI = [
  {
    "type": "function",
    "name": CONTRACT_FUNCTIONS.SET_TRADING_ENABLED,
    "inputs": [{ "name": "enable", "type": "bool", "internalType": "bool" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];

/**
 * Interface for deployment parameters
 */
export interface DeploymentParams {
  /** User's wallet address */
  userWallet: string;
  /** Agent/Fund name */
  agentName: string;
  /** AI wallet address (can be same as user wallet) */
  aiWallet?: string;
  /** Payment amount in USDC (default: 50) */
  paymentAmount?: number;
}

/**
 * Interface for deployment result
 */
export interface DeploymentResult {
  /** Created fund contract address */
  fundAddress: string;
  /** Fund creation transaction hash */
  creationTxHash: string;
  /** Payment transaction hash */
  paymentTxHash: string;
  /** Trading enablement transaction hash */
  enableTradingTxHash: string;
}

/**
 * Contract utilities for Quick Deploy service
 */
export class QuickDeployContract {
  /** Logger instance */
  private readonly logger = Logger;
  
  /** RPC provider */
  private readonly provider: ethers.JsonRpcProvider;
  
  /** Factory contract address (using the original, not the new one) */
  private readonly FACTORY_CONTRACT_ADDRESS: string;
  
  /** Payment amount in USDC (with decimals) */
  private readonly PAYMENT_AMOUNT = ethers.parseUnits(
    (config.servicePrice || PAYMENT_CONFIG.DEFAULT_AMOUNT).toString(), 
    PAYMENT_CONFIG.USDC_DECIMALS
  );

  constructor() {
    // Initialize provider with configured RPC URL
    this.provider = new ethers.JsonRpcProvider(config.acpRpcUrl);
    
    // Use the original factory address (not the new one, as per transcript)
    this.FACTORY_CONTRACT_ADDRESS = config.factoryContractAddress || CONTRACT_ADDRESSES.FACTORY;
    
    if (this.FACTORY_CONTRACT_ADDRESS === CONTRACT_ADDRESSES.FACTORY_NEW) {
      this.logger.warn(`${LOG_PREFIX.WARNING} Using NEW factory address - transcript says NOT to use this!`);
    }
    
    this.logger.info(`${LOG_PREFIX.INIT} QuickDeployContract initialized`);
    this.logger.info(`${LOG_PREFIX.INFO} Factory address: ${this.FACTORY_CONTRACT_ADDRESS}`);
    this.logger.info(`${LOG_PREFIX.INFO} USDC address: ${CONTRACT_ADDRESSES.USDC}`);
    this.logger.info(`${LOG_PREFIX.INFO} Payment recipient: ${CONTRACT_ADDRESSES.PAYMENT_RECIPIENT}`);
    this.logger.info(`${LOG_PREFIX.INFO} Payment amount: ${config.servicePrice || PAYMENT_CONFIG.DEFAULT_AMOUNT} USDC`);
  }

  /**
   * Simulates the complete deployment process to estimate gas and validate
   * 
   * @param {DeploymentParams} params - Deployment parameters
   * @param {ethers.Signer} signer - Signer for the transactions
   * @returns {Promise<boolean>} True if simulation succeeds
   */
  async simulateDeployment(params: DeploymentParams, signer: ethers.Signer): Promise<boolean> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} Simulating deployment process...`);
      
      // 1. Check USDC balance
      const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.USDC, ERC20_TRANSFER_ABI, this.provider);
      const balance = await usdcContract.balanceOf(params.userWallet);
      
      if (balance < this.PAYMENT_AMOUNT) {
        const currentBalance = ethers.formatUnits(balance, PAYMENT_CONFIG.USDC_DECIMALS);
        const requiredAmount = config.servicePrice || PAYMENT_CONFIG.DEFAULT_AMOUNT;
        this.logger.error(`${LOG_PREFIX.ERROR} Insufficient USDC balance: ${currentBalance} USDC (need ${requiredAmount} USDC)`);
        return false;
      }
      
      // 2. Simulate fund creation
      const factoryContract = new ethers.Contract(
        this.FACTORY_CONTRACT_ADDRESS,
        FACTORY_ABI,
        this.provider
      );
      
      const aiWallet = params.aiWallet || params.userWallet;
      
      try {
        await factoryContract.createPersonalizedFunds.staticCall(
          true, // isTokenFund
          aiWallet,
          CONTRACT_ADDRESSES.USDC // frTokenAddress
        );
        this.logger.info(`${LOG_PREFIX.SUCCESS} Fund creation simulation successful`);
      } catch (error) {
        this.logger.error(`${LOG_PREFIX.ERROR} Fund creation simulation failed:`, error);
        return false;
      }
      
      // 3. Simulate USDC transfer
      try {
        await usdcContract.transfer.staticCall(
          CONTRACT_ADDRESSES.PAYMENT_RECIPIENT,
          this.PAYMENT_AMOUNT
        );
        this.logger.info(`${LOG_PREFIX.SUCCESS} Payment simulation successful`);
      } catch (error) {
        this.logger.error(`${LOG_PREFIX.ERROR} Payment simulation failed:`, error);
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Deployment simulation failed:`, error);
      return false;
    }
  }

  /**
   * Executes the complete deployment process
   * This replicates the 3-transaction flow from OneClickLaunchModal.jsx
   * 
   * @param {DeploymentParams} params - Deployment parameters  
   * @param {ethers.Signer} signer - Signer for the transactions
   * @returns {Promise<DeploymentResult>} Deployment result with all transaction hashes
   */
  async deployAgent(params: DeploymentParams, signer: ethers.Signer): Promise<DeploymentResult> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} Starting agent deployment process`);
      
      // Transaction 1: Create personal fund
      const fundAddress = await this.createPersonalFund(params, signer);
      const creationTxHash = await this.getLatestTransactionHash(params.userWallet);
      
      // Transaction 2: Payment (USDC transfer)
      const paymentTxHash = await this.makePayment(params, signer);
      
      // Transaction 3: Enable trading
      const enableTradingTxHash = await this.enableTrading(fundAddress, signer);
      
      this.logger.info(`${LOG_PREFIX.SUCCESS} Agent deployment completed successfully`);
      
      return {
        fundAddress,
        creationTxHash,
        paymentTxHash,
        enableTradingTxHash,
      };
      
    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Agent deployment failed:`, error);
      throw new Error('Failed to deploy agent');
    }
  }

  /**
   * Transaction 1: Creates a personal fund using the factory contract
   * 
   * @param {DeploymentParams} params - Deployment parameters
   * @param {ethers.Signer} signer - Signer for the transaction
   * @returns {Promise<string>} Created fund address
   * @private
   */
  private async createPersonalFund(params: DeploymentParams, signer: ethers.Signer): Promise<string> {
    this.logger.info(`${LOG_PREFIX.PROCESSING} Creating personal fund...`);
    
    const factoryContract = new ethers.Contract(
      this.FACTORY_CONTRACT_ADDRESS,
      FACTORY_ABI,
      signer
    );
    
    const aiWallet = params.aiWallet || params.userWallet;
    
    // Call createPersonalizedFunds
    const tx = await factoryContract.createPersonalizedFunds(
      true, // isTokenFund
      aiWallet, // aiWallet (can be same as user)
      CONTRACT_ADDRESSES.USDC // frTokenAddress
    );
    
    this.logger.info(`${LOG_PREFIX.INFO} Fund creation tx sent: ${tx.hash}`);
    
    // Wait for confirmation and get the created fund address from events
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('Fund creation transaction failed');
    }
    
    // Parse logs to find the PersonalFundCreated event
    let fundAddress: string | null = null;
    
    for (const log of receipt.logs) {
      try {
        // Look for PersonalFundCreated event
        // event PersonalFundCreated(address indexed fundAddress, address indexed owner, bool isTokenFund)
        if (log.topics[0] === ethers.id(`${EVENTS.PERSONAL_FUND_CREATED}(address,address,bool)`)) {
          fundAddress = ethers.getAddress('0x' + log.topics[1].slice(26));
          break;
        }
      } catch (e) {
        // Continue checking other logs
      }
    }
    
    if (!fundAddress) {
      throw new Error('Could not find created fund address in transaction logs');
    }
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} Personal fund created at: ${fundAddress}`);
    return fundAddress;
  }

  /**
   * Transaction 2: Makes the USDC payment
   * 
   * @param {DeploymentParams} params - Deployment parameters
   * @param {ethers.Signer} signer - Signer for the transaction
   * @returns {Promise<string>} Payment transaction hash
   * @private
   */
  private async makePayment(params: DeploymentParams, signer: ethers.Signer): Promise<string> {
    this.logger.info(`${LOG_PREFIX.PROCESSING} Making USDC payment...`);
    
    const usdcContract = new ethers.Contract(
      CONTRACT_ADDRESSES.USDC,
      ERC20_TRANSFER_ABI,
      signer
    );
    
    const paymentAmount = params.paymentAmount 
      ? ethers.parseUnits(params.paymentAmount.toString(), PAYMENT_CONFIG.USDC_DECIMALS)
      : this.PAYMENT_AMOUNT;
    
    // Log expected vs actual payment amount
    const expectedAmount = config.servicePrice || PAYMENT_CONFIG.DEFAULT_AMOUNT;
    const actualAmount = Number(ethers.formatUnits(paymentAmount, PAYMENT_CONFIG.USDC_DECIMALS));
    if (actualAmount !== expectedAmount) {
      this.logger.warn(`${LOG_PREFIX.WARNING} Payment amount mismatch: expected ${expectedAmount} USDC, got ${actualAmount} USDC`);
    }
    
    // Transfer USDC to designated address
    const tx = await usdcContract.transfer(
      CONTRACT_ADDRESSES.PAYMENT_RECIPIENT,
      paymentAmount
    );
    
    this.logger.info(`${LOG_PREFIX.INFO} Payment tx sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('Payment transaction failed');
    }
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} Payment of ${ethers.formatUnits(paymentAmount, PAYMENT_CONFIG.USDC_DECIMALS)} USDC completed`);
    return tx.hash;
  }

  /**
   * Transaction 3: Enables trading on the personal fund
   * 
   * @param {string} fundAddress - Address of the created fund
   * @param {ethers.Signer} signer - Signer for the transaction
   * @returns {Promise<string>} Enable trading transaction hash
   * @private
   */
  private async enableTrading(fundAddress: string, signer: ethers.Signer): Promise<string> {
    this.logger.info(`${LOG_PREFIX.PROCESSING} Enabling trading for fund ${fundAddress}...`);
    
    const fundContract = new ethers.Contract(
      fundAddress,
      PERSONAL_FUND_ABI,
      signer
    );
    
    // Enable trading
    const tx = await fundContract.setTradingEnabled(true);
    
    this.logger.info(`${LOG_PREFIX.INFO} Enable trading tx sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('Enable trading transaction failed');
    }
    
    this.logger.info(`${LOG_PREFIX.SUCCESS} Trading enabled successfully`);
    return tx.hash;
  }

  /**
   * Gets the latest transaction hash for an address
   * 
   * @param {string} address - Address to check
   * @returns {Promise<string>} Latest transaction hash
   * @private
   */
  private async getLatestTransactionHash(address: string): Promise<string> {
    // This is a simplified version - in production you might want to use
    // a more robust method to track the specific transaction
    const latestBlock = await this.provider.getBlockNumber();
    const history = await this.provider.getHistory(address, latestBlock - 10, latestBlock);
    
    if (history.length > 0) {
      return history[history.length - 1].hash;
    }
    
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  /**
   * Verifies a payment transaction on-chain
   * 
   * @param {string} paymentTxHash - Transaction hash to verify
   * @returns {Promise<boolean>} True if payment is valid
   */
  async verifyPayment(paymentTxHash: string): Promise<boolean> {
    try {
      this.logger.info(`${LOG_PREFIX.PROCESSING} Verifying payment transaction: ${paymentTxHash}`);
      
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(paymentTxHash);
      
      if (!receipt) {
        this.logger.warn(`${LOG_PREFIX.WARNING} Payment transaction not found`);
        return false;
      }

      // Check if transaction was successful
      if (receipt.status !== 1) {
        this.logger.warn(`${LOG_PREFIX.WARNING} Payment transaction failed`);
        return false;
      }

      // Verify it's a USDC transfer to the correct address
      if (receipt.to?.toLowerCase() !== CONTRACT_ADDRESSES.USDC.toLowerCase()) {
        this.logger.warn(`${LOG_PREFIX.WARNING} Transaction is not to USDC contract`);
        return false;
      }

      // Parse logs to verify transfer details
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === CONTRACT_ADDRESSES.USDC.toLowerCase()) {
          // Check if it's a Transfer event
          const transferTopic = ethers.id(`${EVENTS.TRANSFER}(address,address,uint256)`);
          if (log.topics[0] === transferTopic) {
            const to = ethers.getAddress('0x' + log.topics[2].slice(26));
            if (to.toLowerCase() === CONTRACT_ADDRESSES.PAYMENT_RECIPIENT.toLowerCase()) {
              const amount = ethers.toBigInt(log.data);
              if (amount >= this.PAYMENT_AMOUNT) {
                this.logger.info(`${LOG_PREFIX.SUCCESS} Payment verified successfully`);
                return true;
              }
            }
          }
        }
      }

      this.logger.warn(`${LOG_PREFIX.WARNING} Could not verify payment details in transaction`);
      return false;

    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Error verifying payment:`, error);
      return false;
    }
  }

  /**
   * Gets the creation fee from the factory contract
   * 
   * @returns {Promise<bigint>} Creation fee in wei
   */
  async getCreationFee(): Promise<bigint> {
    try {
      const factoryContract = new ethers.Contract(
        this.FACTORY_CONTRACT_ADDRESS,
        [
          {
            "inputs": [],
            "name": CONTRACT_FUNCTIONS.GET_PERSONAL_FUND_CREATION_FEE,
            "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        this.provider
      );

      const fee = await factoryContract.getPersonalFundCreationFee();
      return fee;

    } catch (error) {
      this.logger.error(`${LOG_PREFIX.ERROR} Failed to get creation fee:`, error);
      throw error;
    }
  }
}
