/**
 * @fileoverview E2E tests for GameAgent + ACP Plugin integration
 * Tests the complete ACP job lifecycle using the new GameAgent pattern
 *
 * @author Dylan Burkey
 * @license MIT
 */

/// <reference path="./global.d.ts" />

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { GameAgent } from '@virtuals-protocol/game';
import AcpPlugin from '@virtuals-protocol/game-acp-plugin';
import AcpClient, { AcpContractClient, AcpJobPhases } from '@virtuals-protocol/acp-node';
import { ethers } from 'ethers';
import { config } from '../../src/config';
import { getQuickDeployFunction } from '../../src/functions';
import { createReducedStateGetter } from '../../src/utils/acpStateManager';

describe('GameAgent ACP Integration E2E Tests', () => {
  let acpClient: AcpClient;
  let acpPlugin: AcpPlugin;
  let agent: GameAgent | null = null;

  beforeAll(async () => {
    // Verify required environment variables
    expect(config.gameApiKey).toBeDefined();
    expect(config.whitelistedWalletPrivateKey).toBeDefined();
    expect(config.whitelistedWalletEntityId).toBeDefined();
    expect(config.sellerAgentWalletAddress).toBeDefined();

    // Initialize ACP Contract Client
    const acpContractClient = await AcpContractClient.build(
      config.whitelistedWalletPrivateKey as `0x${string}`,
      config.whitelistedWalletEntityId,
      config.sellerAgentWalletAddress as `0x${string}`,
      config.acpRpcUrl ? { rpcUrl: config.acpRpcUrl } as any : undefined
    );

    // Initialize ACP Client
    acpClient = new AcpClient({
      acpContractClient,
      onNewTask: (job) => {
        console.log(`[Test] New job received: ${job.id}`);
      },
      onEvaluate: (job) => {
        console.log(`[Test] Job evaluation requested: ${job.id}`);
      },
    });

    // Initialize ACP Plugin
    acpPlugin = new AcpPlugin({
      apiKey: config.gameApiKey,
      acpClient,
      keepCompletedJobs: 5,
      keepCancelledJobs: 2,
      keepProducedInventory: 10,
    });
  }, 60000);

  afterAll(async () => {
    // Cleanup
    if (agent) {
      // GameAgent cleanup if needed
      agent = null;
    }
  });

  describe('ACP Client Initialization', () => {
    test('should initialize ACP client successfully', () => {
      expect(acpClient).toBeDefined();
      expect(acpClient).toHaveProperty('getActiveJobs');
      expect(acpClient).toHaveProperty('deliverJob');
    });

    test('should initialize ACP plugin successfully', () => {
      expect(acpPlugin).toBeDefined();
      expect(acpPlugin).toHaveProperty('getAcpState');
      expect(acpPlugin).toHaveProperty('getWorker');
    });

    test('should get ACP state', async () => {
      const state = await acpPlugin.getAcpState();

      expect(state).toBeDefined();
      expect(state).toHaveProperty('jobs');
    }, 30000);
  });

  describe('GameAgent Initialization', () => {
    test('should create GameAgent with ACP Plugin', async () => {
      agent = new GameAgent(config.gameApiKey, {
        name: 'Test Quick Deploy Agent',
        goal: 'Test deployment service',
        description: 'Test agent for E2E testing',
        workers: [
          acpPlugin.getWorker({
            functions: [
              acpPlugin.respondJob,
              acpPlugin.deliverJob,
              getQuickDeployFunction(acpPlugin),
            ],
          }),
        ],
        getAgentState: createReducedStateGetter(() => acpPlugin.getAcpState(), {
          keepCompletedJobs: 5,
          keepCancelledJobs: 2,
          keepAcquiredInventory: 0,
          keepProducedInventory: 10,
          jobIdsToIgnore: [],
          agentAddressesToIgnore: [],
        }),
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Test Quick Deploy Agent');
    });

    test('should initialize GameAgent', async () => {
      if (!agent) {
        throw new Error('Agent not created');
      }

      await agent.init();

      // Agent should be initialized
      expect(agent).toBeDefined();
      console.log('[Test] GameAgent initialized successfully');
    }, 60000);
  });

  describe('Quick Deploy Function Registration', () => {
    test('should register Quick Deploy function', () => {
      const quickDeployFn = getQuickDeployFunction(acpPlugin);

      expect(quickDeployFn).toBeDefined();
      expect(quickDeployFn.name).toBe('quickDeployAgent');
      expect(quickDeployFn.description).toContain('Deploy an AI trading agent');
    });

    test('should have correct function arguments', () => {
      const quickDeployFn = getQuickDeployFunction(acpPlugin);

      expect(quickDeployFn.args).toBeDefined();
      expect(quickDeployFn.args.length).toBeGreaterThan(0);

      // Should have jobId, agentName args
      const argNames = quickDeployFn.args.map((arg) => arg.name);
      expect(argNames).toContain('jobId');
      expect(argNames).toContain('agentName');
    });

    test('should have executable handler', () => {
      const quickDeployFn = getQuickDeployFunction(acpPlugin);

      expect(quickDeployFn.executable).toBeDefined();
      expect(typeof quickDeployFn.executable).toBe('function');
    });
  });

  describe('ACP Job Retrieval', () => {
    test('should get active jobs', async () => {
      const jobs = await acpClient.getActiveJobs();

      expect(jobs).toBeDefined();
      expect(Array.isArray(jobs)).toBe(true);

      console.log(`[Test] Active jobs: ${jobs.length}`);
    }, 30000);

    test('should get completed jobs', async () => {
      const jobs = await acpClient.getCompletedJobs();

      expect(jobs).toBeDefined();
      expect(Array.isArray(jobs)).toBe(true);

      console.log(`[Test] Completed jobs: ${jobs.length}`);
    }, 30000);
  });

  describe('ACP State Management', () => {
    test('should get reduced state', async () => {
      const stateGetter = createReducedStateGetter(() => acpPlugin.getAcpState(), {
        keepCompletedJobs: 5,
        keepCancelledJobs: 2,
        keepAcquiredInventory: 0,
        keepProducedInventory: 10,
        jobIdsToIgnore: [],
        agentAddressesToIgnore: [],
      });

      const state = await stateGetter();

      expect(state).toBeDefined();
      console.log('[Test] State reduced successfully');
    }, 30000);

    test('should access jobs in state', async () => {
      const state = await acpPlugin.getAcpState();

      expect(state.jobs).toBeDefined();

      // Log job counts
      console.log('[Test] State structure:', {
        hasJobs: !!state.jobs,
        hasActive: !!(state.jobs as any).active,
        hasCompleted: !!(state.jobs as any).completed,
      });
    }, 30000);
  });

  describe('Blockchain Connectivity', () => {
    test('should connect to Base network', async () => {
      const rpcUrl = config.acpRpcUrl || 'https://mainnet.base.org';
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const network = await provider.getNetwork();
      expect(network.chainId).toBe(8453n); // Base mainnet

      provider.destroy();
    });

    test('should have valid whitelisted wallet', () => {
      const wallet = new ethers.Wallet(config.whitelistedWalletPrivateKey);

      expect(wallet.address).toBeTruthy();
      expect(ethers.isAddress(wallet.address)).toBe(true);
    });

    test('should have valid seller agent wallet', () => {
      expect(config.sellerAgentWalletAddress).toBeTruthy();
      expect(ethers.isAddress(config.sellerAgentWalletAddress)).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    test('should have valid GameAgent API key', () => {
      expect(config.gameApiKey).toBeTruthy();
      expect(config.gameApiKey.length).toBeGreaterThan(10);
    });

    test('should have valid service configuration', () => {
      expect(config.servicePrice).toBe(50); // 50 USDC
      expect(config.serviceName).toContain('Kosher Capital');
    });

    test('should have valid Kosher Capital API configuration', () => {
      expect(process.env.SHEKEL_API_KEY).toBeTruthy();
      expect(process.env.KOSHER_CAPITAL_API_URL).toBeTruthy();
    });
  });

  describe('ACP Job Phase Handling', () => {
    test('should understand REQUEST phase', () => {
      expect(AcpJobPhases.REQUEST).toBeDefined();
    });

    test('should understand NEGOTIATION phase', () => {
      expect(AcpJobPhases.NEGOTIATION).toBeDefined();
    });

    test('should understand TRANSACTION phase', () => {
      expect(AcpJobPhases.TRANSACTION).toBeDefined();
    });

    test('should understand EVALUATION phase', () => {
      expect(AcpJobPhases.EVALUATION).toBeDefined();
    });
  });
});
