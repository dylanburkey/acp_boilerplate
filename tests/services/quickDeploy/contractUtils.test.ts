/**
 * @fileoverview Unit tests for Quick Deploy Contract Utilities
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { QuickDeployContract } from '../../../src/services/quickDeploy/contractUtils';
import { ethers } from 'ethers';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getTransactionReceipt: jest.fn(),
    })),
    Wallet: {
      createRandom: jest.fn().mockReturnValue({
        connect: jest.fn().mockReturnThis(),
        address: '0xGasWallet123',
      }),
    },
    Contract: jest.fn(),
    id: jest.fn((str) => `0x${str}`),
  }
}));

// Mock config
jest.mock('../../../src/config', () => ({
  config: {
    acpRpcUrl: 'https://test-rpc.com',
  }
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('QuickDeployContract', () => {
  let contractUtils: QuickDeployContract;
  let mockProvider: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock provider
    mockProvider = {
      getTransactionReceipt: jest.fn(),
    };
    (ethers.JsonRpcProvider as jest.Mock).mockImplementation(() => mockProvider);
    
    // Set factory contract address in env
    process.env.FACTORY_CONTRACT_ADDRESS = '0xFactoryContract123';
    
    contractUtils = new QuickDeployContract();
  });

  afterEach(() => {
    delete process.env.FACTORY_CONTRACT_ADDRESS;
  });

  describe('verifyPayment', () => {
    it('should return true for valid payment transaction', async () => {
      mockProvider.getTransactionReceipt.mockResolvedValueOnce({
        status: 1,
        hash: '0xPaymentHash',
      });

      const result = await contractUtils.verifyPayment('0xPaymentHash');
      expect(result).toBe(true);
    });

    it('should return false when transaction not found', async () => {
      mockProvider.getTransactionReceipt.mockResolvedValueOnce(null);

      const result = await contractUtils.verifyPayment('0xInvalidHash');
      expect(result).toBe(false);
    });

    it('should return false when transaction failed', async () => {
      mockProvider.getTransactionReceipt.mockResolvedValueOnce({
        status: 0,
        hash: '0xFailedHash',
      });

      const result = await contractUtils.verifyPayment('0xFailedHash');
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockProvider.getTransactionReceipt.mockRejectedValueOnce(new Error('Network error'));

      const result = await contractUtils.verifyPayment('0xErrorHash');
      expect(result).toBe(false);
    });
  });

  describe('deployAgent', () => {
    let mockContract: any;

    beforeEach(() => {
      mockContract = {
        deployAgent: jest.fn(),
      };
      (ethers.Contract as jest.Mock).mockReturnValue(mockContract);
    });

    it('should successfully deploy an agent', async () => {
      const mockTx = {
        hash: '0xDeployTxHash',
        wait: jest.fn().mockResolvedValueOnce({
          status: 1,
          hash: '0xDeployTxHash',
        }),
      };
      mockContract.deployAgent.mockResolvedValueOnce(mockTx);

      const params = {
        paymentTxHash: '0xPaymentHash',
        userWallet: '0xUserWallet',
        agentName: 'TestAgent',
      };

      const result = await contractUtils.deployAgent(params);
      expect(result).toBe('0xDeployTxHash');
      expect(mockContract.deployAgent).toHaveBeenCalledWith(
        'TestAgent',
        '0xUserWallet',
        '0x0xPaymentHash'
      );
    });

    it('should throw error when deployment fails', async () => {
      const mockTx = {
        hash: '0xFailedTxHash',
        wait: jest.fn().mockResolvedValueOnce({
          status: 0,
          hash: '0xFailedTxHash',
        }),
      };
      mockContract.deployAgent.mockResolvedValueOnce(mockTx);

      const params = {
        paymentTxHash: '0xPaymentHash',
        userWallet: '0xUserWallet',
        agentName: 'TestAgent',
      };

      await expect(contractUtils.deployAgent(params)).rejects.toThrow('Deployment transaction failed');
    });

    it('should handle contract call errors', async () => {
      mockContract.deployAgent.mockRejectedValueOnce(new Error('Contract error'));

      const params = {
        paymentTxHash: '0xPaymentHash',
        userWallet: '0xUserWallet',
        agentName: 'TestAgent',
      };

      await expect(contractUtils.deployAgent(params)).rejects.toThrow('Failed to deploy agent contract');
    });
  });

  describe('getDeploymentFee', () => {
    let mockContract: any;

    beforeEach(() => {
      mockContract = {
        getDeploymentFee: jest.fn(),
      };
      (ethers.Contract as jest.Mock).mockReturnValue(mockContract);
    });

    it('should return deployment fee', async () => {
      const expectedFee = BigInt('50000000'); // 50 USDC
      mockContract.getDeploymentFee.mockResolvedValueOnce(expectedFee);

      const fee = await contractUtils.getDeploymentFee();
      expect(fee).toBe(expectedFee);
    });

    it('should handle errors', async () => {
      mockContract.getDeploymentFee.mockRejectedValueOnce(new Error('Contract error'));

      await expect(contractUtils.getDeploymentFee()).rejects.toThrow('Contract error');
    });
  });

  describe('getDeployedAgentAddress', () => {
    it('should return null for failed transaction', async () => {
      mockProvider.getTransactionReceipt.mockResolvedValueOnce({
        status: 0,
        hash: '0xFailedTx',
      });

      const result = await contractUtils.getDeployedAgentAddress('0xFailedTx');
      expect(result).toBeNull();
    });

    it('should return null when receipt not found', async () => {
      mockProvider.getTransactionReceipt.mockResolvedValueOnce(null);

      const result = await contractUtils.getDeployedAgentAddress('0xNotFound');
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockProvider.getTransactionReceipt.mockRejectedValueOnce(new Error('Network error'));

      const result = await contractUtils.getDeployedAgentAddress('0xErrorTx');
      expect(result).toBeNull();
    });
  });
});
