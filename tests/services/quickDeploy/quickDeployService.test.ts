/**
 * @fileoverview Unit tests for Quick Deploy Service
 * 
 * @author Dylan Burkey
 * @license MIT
 */

import { QuickDeployService } from '../../../src/services/quickDeploy/quickDeployService';
import { AgentRequest } from '../../../src/services/agentService';
import axios from 'axios';
import { config } from '../../../src/config';

// Mock dependencies
jest.mock('axios');
jest.mock('../../../src/config', () => ({
  config: {
    apiEndpoint: 'https://test-api.com/api/v1/secure/fundDetails/quick-deploy',
    apiKey: 'test-api-key',
    logApiOutput: false,
  }
}));
jest.mock('../../../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logApiData: jest.fn(),
  }
}));

// Mock the contract utilities
jest.mock('../../../src/services/quickDeploy/contractUtils', () => ({
  QuickDeployContract: jest.fn().mockImplementation(() => ({
    verifyPayment: jest.fn().mockResolvedValue(true),
    deployAgent: jest.fn().mockResolvedValue('0x1234567890abcdef'),
  }))
}));

describe('QuickDeployService', () => {
  let service: QuickDeployService;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuickDeployService();
  });

  describe('processRequest', () => {
    const validRequest: AgentRequest = {
      jobId: 'test-job-123',
      buyer: '0xBuyerAddress',
      params: {
        paymentTxHash: '0xPaymentHash123',
        userWallet: '0xUserWallet123',
        agentName: 'TestAgent',
      },
      timestamp: Date.now(),
    };

    it('should successfully process a valid quick deploy request', async () => {
      // Mock API response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          contractAddress: '0xDeployedContract',
          deploymentTxHash: '0xDeploymentTx',
          success: true,
        },
        status: 200,
      });

      const response = await service.processRequest(validRequest);

      expect(response.success).toBe(true);
      expect(response.data).toMatchObject({
        agentName: 'TestAgent',
        contractAddress: '0xDeployedContract',
        deploymentTxHash: '0xDeploymentTx',
        message: 'Trading agent deployed successfully',
      });
      expect(response.metadata?.deploymentSource).toBe('ACP');
    });

    it('should fail when missing required parameters', async () => {
      const invalidRequest: AgentRequest = {
        jobId: 'test-job-123',
        buyer: '0xBuyerAddress',
        params: {
          // Missing paymentTxHash and userWallet
        },
        timestamp: Date.now(),
      };

      const response = await service.processRequest(invalidRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Missing required parameters');
      expect(response.errorType).toBe('VALIDATION_ERROR');
    });

    it('should fail when payment verification fails', async () => {
      // Mock payment verification failure
      const { QuickDeployContract } = require('../../../src/services/quickDeploy/contractUtils');
      QuickDeployContract.mockImplementation(() => ({
        verifyPayment: jest.fn().mockResolvedValue(false),
        deployAgent: jest.fn(),
      }));

      // Recreate service to use new mock
      service = new QuickDeployService();

      const response = await service.processRequest(validRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid payment transaction');
      expect(response.errorType).toBe('VALIDATION_ERROR');
    });

    it('should handle API timeout errors', async () => {
      const error = new Error('Request timeout');
      error.code = 'ECONNABORTED';
      mockedAxios.post.mockRejectedValueOnce(error);

      const response = await service.processRequest(validRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Request timeout');
      expect(response.errorType).toBe('TIMEOUT_ERROR');
    });

    it('should handle API server errors', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { message: 'Server error occurred' },
        },
      });

      const response = await service.processRequest(validRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Deployment API error: 500');
      expect(response.errorType).toBe('SERVICE_ERROR');
    });

    it('should use default agent name when not provided', async () => {
      const requestWithoutName: AgentRequest = {
        ...validRequest,
        params: {
          paymentTxHash: '0xPaymentHash123',
          userWallet: '0xUserWallet123',
          // No agentName provided
        },
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
        status: 200,
      });

      await service.processRequest(requestWithoutName);

      // Check that API was called with generated name
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          name: expect.stringMatching(/^ACP-\d+$/),
        }),
        expect.any(Object)
      );
    });
  });

  describe('validateRequestScope', () => {
    it('should return true for valid quick deploy requests', () => {
      const validRequest: AgentRequest = {
        jobId: 'test-job',
        buyer: '0xBuyer',
        params: {
          paymentTxHash: '0xHash',
          userWallet: '0xWallet',
        },
        timestamp: Date.now(),
      };

      const result = service.validateRequestScope(validRequest);
      expect(result).toBe(true);
    });

    it('should return false for requests without params', () => {
      const invalidRequest: AgentRequest = {
        jobId: 'test-job',
        buyer: '0xBuyer',
        params: undefined as any,
        timestamp: Date.now(),
      };

      const result = service.validateRequestScope(invalidRequest);
      expect(result).toBe(false);
    });

    it('should return false for requests with wrong type', () => {
      const wrongTypeRequest: AgentRequest = {
        jobId: 'test-job',
        buyer: '0xBuyer',
        params: {
          type: 'other-service',
          paymentTxHash: '0xHash',
          userWallet: '0xWallet',
        },
        timestamp: Date.now(),
      };

      const result = service.validateRequestScope(wrongTypeRequest);
      expect(result).toBe(false);
    });
  });

  describe('validateService', () => {
    it('should return true when API endpoint is configured', async () => {
      const result = await service.validateService();
      expect(result).toBe(true);
    });

    it('should return false when API endpoint is not configured', async () => {
      // Mock config without apiEndpoint
      const originalConfig = (config as any).apiEndpoint;
      (config as any).apiEndpoint = '';

      const result = await service.validateService();
      expect(result).toBe(false);

      // Restore original config
      (config as any).apiEndpoint = originalConfig;
    });
  });
});
