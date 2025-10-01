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

// Contract addresses from the provided documentation
const FACTORY_ADDRESS = '0x0fE1eBa3e809CD0Fc34b6a3666754B7A042c169a';
const FACTORY_ADDRESS_NEW = '0xA2BAB24e3c8cf0d68bF9B16039d7c7D3fBC032e7';
const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const DESIGNATED_ADDRESS = '0x48597AfA1c4e7530CA8889bA9291494757FEABD2'; // Payment recipient

// Minimal ABIs for the required functions
const FACTORY_ABI = [
  {
    "inputs": [
      { "internalType": "bool", "name": "isTokenFund", "type": "bool" },
      { "internalType": "address", "name": "aiWallet", "type": "address" },
      { "internalType": "address", "name": "frTokenAddress", "type": "address" }
    ],
    "name": "createPersonalizedFunds",
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
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

const PERSONAL_FUND_ABI = [
  {
    "type": "function",
    "name": "setTradingEnabled",
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
  
  /** Payment amount in USDC (with 6 decimals) */
  private readonly PAYMENT_AMOUNT = ethers.parseUnits('50', 6); // 50 USDC

  constructor() {
    // Initialize provider with configured RPC URL
    this.provider = new ethers.JsonRpcProvider(config.acpRpcUrl);
    
    // Use the original factory address (not the new one, as per transcript)
    this.FACTORY_CONTRACT_ADDRESS = config.factoryContractAddress || FACTORY_ADDRESS;
    
    if (this.FACTORY_CONTRACT_ADDRESS === FACTORY_ADDRESS_NEW) {
      this.logger.warn('Using NEW factory address - transcript says NOT to use this!');
    }
    
    this.logger.info('QuickDeployContract initialized');
    this.logger.info(`Factory address: ${this.FACTORY_CONTRACT_ADDRESS}`);
    this.logger.info(`USDC address: ${USDC_ADDRESS}`);
    this.logger.info(`Payment recipient: ${DESIGNATED_ADDRESS}`);
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
      this.logger.info('Simulating deployment process...');
      
      // 1. Check USDC balance
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_TRANSFER_ABI, this.provider);
      const balance = await usdcContract.balanceOf(params.userWallet);
      
      if (balance < this.PAYMENT_AMOUNT) {
        this.logger.error(`Insufficient USDC balance: ${ethers.formatUnits(balance, 6)} USDC`);
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
          USDC_ADDRESS // frTokenAddress
        );
        this.logger.info('Fund creation simulation successful');
      } catch (error) {
        this.logger.error('Fund creation simulation failed:', error);
        return false;
      }
      
      // 3. Simulate USDC transfer
      try {
        await usdcContract.transfer.staticCall(
          DESIGNATED_ADDRESS,
          this.PAYMENT_AMOUNT
        );
        this.logger.info('Payment simulation successful');
      } catch (error) {
        this.logger.error('Payment simulation failed:', error);
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.logger.error('Deployment simulation failed:', error);
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
      this.logger.info('Starting agent deployment process');
      
      // Transaction 1: Create personal fund
      const fundAddress = await this.createPersonalFund(params, signer);
      const creationTxHash = await this.getLatestTransactionHash(params.userWallet);
      
      // Transaction 2: Payment (USDC transfer)
      const paymentTxHash = await this.makePayment(params, signer);
      
      // Transaction 3: Enable trading
      const enableTradingTxHash = await this.enableTrading(fundAddress, signer);
      
      this.logger.info('Agent deployment completed successfully');
      
      return {
        fundAddress,
        creationTxHash,
        paymentTxHash,
        enableTradingTxHash,
      };
      
    } catch (error) {
      this.logger.error('Agent deployment failed:', error);
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
    this.logger.info('Creating personal fund...');
    
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
      USDC_ADDRESS // frTokenAddress
    );
    
    this.logger.info(`Fund creation tx sent: ${tx.hash}`);
    
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
        if (log.topics[0] === ethers.id('PersonalFundCreated(address,address,bool)')) {
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
    
    this.logger.info(`Personal fund created at: ${fundAddress}`);
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
    this.logger.info('Making USDC payment...');
    
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      ERC20_TRANSFER_ABI,
      signer
    );
    
    const paymentAmount = params.paymentAmount 
      ? ethers.parseUnits(params.paymentAmount.toString(), 6)
      : this.PAYMENT_AMOUNT;
    
    // Transfer USDC to designated address
    const tx = await usdcContract.transfer(
      DESIGNATED_ADDRESS,
      paymentAmount
    );
    
    this.logger.info(`Payment tx sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('Payment transaction failed');
    }
    
    this.logger.info(`Payment of ${ethers.formatUnits(paymentAmount, 6)} USDC completed`);
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
    this.logger.info(`Enabling trading for fund ${fundAddress}...`);
    
    const fundContract = new ethers.Contract(
      fundAddress,
      PERSONAL_FUND_ABI,
      signer
    );
    
    // Enable trading
    const tx = await fundContract.setTradingEnabled(true);
    
    this.logger.info(`Enable trading tx sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('Enable trading transaction failed');
    }
    
    this.logger.info('Trading enabled successfully');
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
      this.logger.info(`Verifying payment transaction: ${paymentTxHash}`);
      
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(paymentTxHash);
      
      if (!receipt) {
        this.logger.warn('Payment transaction not found');
        return false;
      }

      // Check if transaction was successful
      if (receipt.status !== 1) {
        this.logger.warn('Payment transaction failed');
        return false;
      }

      // Verify it's a USDC transfer to the correct address
      if (receipt.to?.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
        this.logger.warn('Transaction is not to USDC contract');
        return false;
      }

      // Parse logs to verify transfer details
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
          // Check if it's a Transfer event
          const transferTopic = ethers.id('Transfer(address,address,uint256)');
          if (log.topics[0] === transferTopic) {
            const to = ethers.getAddress('0x' + log.topics[2].slice(26));
            if (to.toLowerCase() === DESIGNATED_ADDRESS.toLowerCase()) {
              const amount = ethers.toBigInt(log.data);
              if (amount >= this.PAYMENT_AMOUNT) {
                this.logger.info('Payment verified successfully');
                return true;
              }
            }
          }
        }
      }

      this.logger.warn('Could not verify payment details in transaction');
      return false;

    } catch (error) {
      this.logger.error('Error verifying payment:', error);
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
            "name": "getPersonalFundCreationFee",
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
      this.logger.error('Failed to get creation fee:', error);
      throw error;
    }
  }
}
