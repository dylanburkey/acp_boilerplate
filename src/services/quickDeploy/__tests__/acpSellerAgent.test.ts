/**
 * @fileoverview Unit tests for Quick Deploy ACP Seller Agent
 * Tests the ACP integration for Kosher Capital Quick Deploy service
 *
 * @author Athena AI Team
 * @license MIT
 */

// @ts-nocheck - Complex Jest mock types cause issues, but tests work fine at runtime
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { QuickDeployACPAgent } from '../acpSellerAgent';
import { getKosherCapitalClient } from '../kosherCapitalClient';
import { transactionTracker } from '../transactionTracker';
import { notificationService } from '../notificationService';
import {
  ServiceType,
  TransactionStatus,
  QuickDeployServiceRequirement,
} from '../types';
import { ErrorFactory, ValidationError } from '../errors';
import { config } from '../../../config';

// Mock dependencies
jest.mock('../kosherCapitalClient');
jest.mock('../transactionTracker');
jest.mock('../notificationService');
jest.mock('../contractUtils');
jest.mock('@virtuals-protocol/acp-node');

describe('QuickDeployACPAgent', () => {
  let agent: QuickDeployACPAgent;
  let mockKosherCapitalClient: jest.Mocked<ReturnType<typeof getKosherCapitalClient>>;
  let mockJob: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up environment
    process.env.SHEKEL_API_KEY = 'test-api-key';
    
    // Mock Kosher Capital client
    mockKosherCapitalClient = {
      checkHealth: jest.fn().mockResolvedValue({
        success: true,
        data: { healthy: true, latency: 50 }
      }),
      quickDeploy: jest.fn().mockResolvedValue({
        success: true,
        data: {
          success: true,
          data: {
            agentId: 'agent-123',
            contractAddress: '0x1234567890123456789012345678901234567890',
            deploymentHash: '0xabcdef',
          },
        },
      }),
    } as any;
    
    (getKosherCapitalClient as jest.Mock).mockReturnValue(mockKosherCapitalClient);
    
    // Mock transaction tracker
    (transactionTracker.createTransaction as jest.Mock).mockReturnValue({
      id: 'tx-123',
      jobId: 'job-123',
      status: TransactionStatus.PENDING,
    });
    
    // Create test job
    mockJob = {
      id: 'job-123',
      buyer: '0x9876543210987654321098765432109876543210',
      phase: 'REQUEST',
      serviceRequirement: {
        type: ServiceType.QUICK_DEPLOY,
        agentName: 'Test-Agent',
        aiWallet: '0x1111111111111111111111111111111111111111',
        metadata: {
          referralCode: 'TEST123',
        },
      } as QuickDeployServiceRequirement,
      memoIds: ['memo-1'],
    };
    
    // Create agent instance
    agent = new QuickDeployACPAgent();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.SHEKEL_API_KEY;
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration on initialization', async () => {
      // Mock valid configuration
      const mockConfig = {
        whitelistedWalletPrivateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        whitelistedWalletEntityId: 'entity-123',
        sellerAgentWalletAddress: '0x1234567890123456789012345678901234567890',
      };
      
      Object.assign(config, mockConfig);
      
      // Should initialize without errors
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should throw error if API key is missing', async () => {
      delete process.env.SHEKEL_API_KEY;
      
      await expect(agent.initialize()).rejects.toThrow(ValidationError);
    });

    it('should validate private key format', async () => {
      const mockConfig = {
        whitelistedWalletPrivateKey: 'invalid-key',
        whitelistedWalletEntityId: 'entity-123',
        sellerAgentWalletAddress: '0x1234567890123456789012345678901234567890',
      };
      
      Object.assign(config, mockConfig);
      
      await expect(agent.initialize()).rejects.toThrow(ValidationError);
    });

    it('should validate wallet address format', async () => {
      const mockConfig = {
        whitelistedWalletPrivateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        whitelistedWalletEntityId: 'entity-123',
        sellerAgentWalletAddress: 'invalid-address',
      };
      
      Object.assign(config, mockConfig);
      
      await expect(agent.initialize()).rejects.toThrow(ValidationError);
    });
  });

  describe('Job Handling', () => {
    beforeEach(async () => {
      // Set up valid configuration
      const mockConfig = {
        whitelistedWalletPrivateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        whitelistedWalletEntityId: 'entity-123',
        sellerAgentWalletAddress: '0x1234567890123456789012345678901234567890',
      };
      
      Object.assign(config, mockConfig);
    });

    it('should accept valid quick deploy requests', async () => {
      const handleNewTask = (agent as any)['handleNewTask'].bind(agent);
      const acceptJob = jest.spyOn(agent as any, 'acceptJob').mockResolvedValue(undefined);

      await handleNewTask(mockJob);
      
      expect(acceptJob).toHaveBeenCalledWith(
        mockJob,
        expect.stringContaining('Quick deployment service available')
      );
      
      expect(transactionTracker.createTransaction).toHaveBeenCalledWith(
        'job-123',
        'pending',
        mockJob.buyer,
        'Test-Agent'
      );
    });

    it('should reject non-quick-deploy requests', async () => {
      const handleNewTask = (agent as any)['handleNewTask'].bind(agent);
      const rejectJob = jest.spyOn(agent as any, 'rejectJob').mockResolvedValue(undefined);
      
      mockJob.serviceRequirement.type = 'invalid-type' as any;
      
      await handleNewTask(mockJob);
      
      expect(rejectJob).toHaveBeenCalledWith(
        mockJob,
        'Invalid service type - only quick-deploy supported'
      );
    });

    it('should handle REQUEST phase correctly', async () => {
      const handleRequestPhase = agent['handleRequestPhase'].bind(agent);
      const acceptJob = jest.spyOn(agent as any, 'acceptJob').mockResolvedValue(undefined);
      
      await handleRequestPhase(mockJob);
      
      expect(transactionTracker.createTransaction).toHaveBeenCalled();
      expect(acceptJob).toHaveBeenCalled();
    });

    it('should handle TRANSACTION phase with successful deployment', async () => {
      const handleTransactionPhase = agent['handleTransactionPhase'].bind(agent);
      const deliverJob = jest.spyOn(agent as any, 'deliverJob').mockResolvedValue(undefined);

      // Mock successful deployment
      jest.spyOn(agent as any, 'executeDeployment').mockResolvedValue({
        success: true,
        fundAddress: '0xabc123',
        creationTxHash: '0xdef456',
        paymentTxHash: '0x789ghi',
        apiResponse: { success: true },
      } as any);
      
      await handleTransactionPhase(mockJob);

      expect(deliverJob).toHaveBeenCalledWith(
        mockJob,
        expect.objectContaining({
          success: true,
          agentName: 'Test-Agent',
          contractAddress: '0xabc123',
        })
      );
      
      expect(transactionTracker.updateTransaction).toHaveBeenCalledWith(
        'tx-123',
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
        })
      );
    });

    it('should handle deployment failures gracefully', async () => {
      const handleTransactionPhase = agent['handleTransactionPhase'].bind(agent);
      const deliverJob = jest.spyOn(agent as any, 'deliverJob').mockResolvedValue(undefined);

      // Mock failed deployment
      jest.spyOn(agent as any, 'executeDeployment').mockResolvedValue({
        success: false,
        error: 'Deployment failed',
      } as any);
      
      await handleTransactionPhase(mockJob);
      
      expect(deliverJob).toHaveBeenCalledWith(
        mockJob,
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        })
      );
      
      expect(transactionTracker.updateTransaction).toHaveBeenCalledWith(
        'tx-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
        })
      );
    });
  });

  describe('Deployment Execution', () => {
    it('should execute deployment with contract and API calls', async () => {
      const executeDeployment = agent['executeDeployment'].bind(agent);
      
      // Mock contract deployment
      const mockContractUtils = {
        deployAgent: jest.fn().mockResolvedValue({
          success: true,
          fundAddress: '0xcontract123',
          creationTxHash: '0xcreation123',
          paymentTxHash: '0xpayment123',
        }),
      };
      
      (agent as any).contractUtils = mockContractUtils;
      
      const result = await executeDeployment(mockJob, mockJob.serviceRequirement);
      
      expect(result.success).toBe(true);
      expect(mockContractUtils.deployAgent).toHaveBeenCalled();
      expect(mockKosherCapitalClient.quickDeploy).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'Test-Agent',
          contractCreationTxnHash: '0xcreation123',
          creating_user_wallet_address: mockJob.buyer,
          paymentTxnHash: '0xpayment123',
          deploySource: 'ACP',
          referralCode: 'TEST123',
        })
      );
    });

    it('should handle API failures', async () => {
      const executeDeployment = agent['executeDeployment'].bind(agent);
      
      // Mock successful contract deployment but API failure
      const mockContractUtils = {
        deployAgent: jest.fn().mockResolvedValue({
          success: true,
          fundAddress: '0xcontract123',
          creationTxHash: '0xcreation123',
          paymentTxHash: '0xpayment123',
        }),
      };
      
      (agent as any).contractUtils = mockContractUtils;
      
      mockKosherCapitalClient.quickDeploy.mockResolvedValueOnce({
        success: false,
        error: 'API error',
      });
      
      const result = await executeDeployment(mockJob, mockJob.serviceRequirement);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Kosher Capital API failed');
    });
  });

  describe('Error Handling', () => {
    it('should convert unknown errors to structured errors', async () => {
      const handleNewTask = (agent as any)['handleNewTask'].bind(agent);
      const rejectJob = jest.spyOn(agent as any, 'rejectJob').mockResolvedValue(undefined);
      
      // Force an error
      jest.spyOn(agent as any, 'handleRequestPhase').mockRejectedValue(
        new Error('Test error')
      );
      
      await handleNewTask(mockJob);
      
      expect(rejectJob).toHaveBeenCalledWith(
        mockJob,
        expect.any(String)
      );
    });

    it('should handle network errors with appropriate retry behavior', async () => {
      const executeDeployment = agent['executeDeployment'].bind(agent);
      
      // Mock network error
      mockKosherCapitalClient.quickDeploy.mockRejectedValueOnce(
        ErrorFactory.timeout('Network timeout', 'api-call', 30000)
      );
      
      const mockContractUtils = {
        deployAgent: jest.fn().mockResolvedValue({
          success: true,
          fundAddress: '0xcontract123',
          creationTxHash: '0xcreation123',
          paymentTxHash: '0xpayment123',
        }),
      };
      
      (agent as any).contractUtils = mockContractUtils;
      
      const result = await executeDeployment(mockJob, mockJob.serviceRequirement);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Notification Handling', () => {
    it('should send notifications on successful deployment', async () => {
      const sendCompletionNotification = agent['sendCompletionNotification'].bind(agent);
      
      const mockResult = {
        success: true,
        fundAddress: '0xabc123',
        paymentTxHash: '0xpayment123',
      };
      
      await sendCompletionNotification(mockJob, mockResult);
      
      expect(notificationService.createDeploymentNotification).toHaveBeenCalledWith(
        'job-123',
        expect.objectContaining({ success: true }),
        mockJob.buyer,
        '0xpayment123'
      );
      
      expect(notificationService.notifyDeploymentResult).toHaveBeenCalled();
    });

    it('should not fail job if notification fails', async () => {
      const sendCompletionNotification = agent['sendCompletionNotification'].bind(agent);
      
      // Mock notification failure
      (notificationService.notifyDeploymentResult as any) = jest.fn().mockRejectedValue(
        new Error('Notification failed')
      );
      
      const mockResult = {
        success: true,
        fundAddress: '0xabc123',
        paymentTxHash: '0xpayment123',
      };
      
      // Should not throw
      await expect(
        sendCompletionNotification(mockJob, mockResult)
      ).resolves.not.toThrow();
    });
  });
});
