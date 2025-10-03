#!/usr/bin/env node

/**
 * @fileoverview Kosher Capital Quick Deploy GameAgent
 * Professional AI trading agent deployment service using GameAgent + ACP Plugin pattern
 *
 * @author Dylan Burkey
 * @license MIT
 */

import { GameAgent } from '@virtuals-protocol/game';
import AcpPlugin from '@virtuals-protocol/game-acp-plugin';
import AcpClient, { AcpContractClient, AcpJob, AcpJobPhases } from '@virtuals-protocol/acp-node';

import { getQuickDeployFunction } from './functions';
import { createReducedStateGetter } from './utils/acpStateManager';
import { Logger } from './utils/logger';
import { createJobQueue, QueueInterface } from './utils/queueFactory';
import { ACP_CONFIG, getJobPriority } from './config/acpConfig';
import { config } from './config';

/**
 * Worker ID for the ACP worker
 */
const ACP_WORKER_ID = 'acp-quick-deploy-worker';

/**
 * Type guard to safely check if a memo has a nextPhase property
 */
function hasNextPhase(memo: unknown, expectedPhase: AcpJobPhases): boolean {
  return (
    typeof memo === 'object' &&
    memo !== null &&
    'nextPhase' in memo &&
    (memo as Record<string, unknown>).nextPhase === expectedPhase
  );
}

/**
 * Main entry point for Kosher Capital Quick Deploy Agent
 *
 * This agent:
 * - Registers as an ACP seller on the Virtuals Protocol network
 * - Accepts deployment requests from buyers
 * - Verifies USDC payments on Base chain
 * - Deploys AI trading agent contracts
 * - Registers with Kosher Capital ecosystem
 * - Returns deployment details to buyers
 */
async function main(): Promise<void> {
  let agent: GameAgent;
  let jobQueue: QueueInterface | undefined;

  // Safety check for local testing
  if (process.env.LOCAL_TEST_ONLY === 'true') {
    Logger.log('🧪 LOCAL TEST MODE ENABLED - No real transactions will be sent');
  }

  try {
    // ===================================================================
    // STEP 1: Initialize job queue with processing callback
    // ===================================================================
    const processJob = async (job: AcpJob): Promise<void> => {
      let prompt = '';

      // REQUEST PHASE: Decide whether to accept the deployment request
      if (
        job.phase === AcpJobPhases.REQUEST &&
        job.memos.find((m) => hasNextPhase(m, AcpJobPhases.NEGOTIATION))
      ) {
        prompt = `
        A buyer has requested an AI trading agent deployment through the ACP marketplace.

        Job Details:
        ${JSON.stringify(job, null, 2)}

        Analyze this deployment request and decide whether to accept it.

        Accept if:
        - The request includes a valid agent name in serviceRequirement
        - The buyer's wallet address is valid (starts with 0x)
        - The service type is "quick-deploy"
        - All required information is present

        Reject if:
        - Missing agent name or other required information
        - Invalid wallet addresses
        - Unsupported service type
        - Request does not match our service offering

        Use the respondJob function to accept or reject this request.
        Do NOT proceed with deployment yet - wait for payment in the TRANSACTION phase.
        `;
      }
      // TRANSACTION PHASE: Execute the deployment after payment
      else if (
        job.phase === AcpJobPhases.TRANSACTION &&
        job.memos.find((m) => hasNextPhase(m, AcpJobPhases.EVALUATION))
      ) {
        const requirements = job.serviceRequirement as any;
        const agentName = requirements?.agentName || 'Unknown Agent';

        prompt = `
        The buyer has accepted our terms and the job is now in TRANSACTION phase.

        Job ID: ${job.id}
        Agent Name: ${agentName}

        Job Details:
        ${JSON.stringify(job, null, 2)}

        Execute the deployment by calling the quickDeployAgent function with these parameters:
        - jobId: "${job.id}"
        - agentName: "${agentName}"
        - aiWallet: "${requirements?.aiWallet || 'use buyer address'}"
        - referralCode: "${requirements?.metadata?.referralCode || 'none'}"

        The quickDeployAgent function will:
        1. Monitor for and verify the 50 USDC payment on-chain
        2. Deploy the agent contract to Base chain
        3. Register with Kosher Capital API
        4. Return deployment details

        Once the function completes, use deliverJob to send the results to the buyer.
        `;
      }

      // Execute the prompt via AI worker
      if (prompt && agent) {
        await agent.getWorkerById(ACP_WORKER_ID).runTask(prompt, {
          verbose: true,
        });

        Logger.log(`${agent.name} has processed job #${job.id}`);
      }
    };

    // Create the job queue
    jobQueue = await createJobQueue(
      processJob,
      ACP_CONFIG.jobQueue.processingDelay,
      ACP_CONFIG.jobQueue.maxRetries
    );

    // ===================================================================
    // STEP 2: Initialize ACP Client
    // ===================================================================
    const acpClient = new AcpClient({
      acpContractClient: await AcpContractClient.build(
        config.whitelistedWalletPrivateKey as `0x${string}`,
        config.whitelistedWalletEntityId,
        config.sellerAgentWalletAddress as `0x${string}`,
        config.acpRpcUrl ? { rpcUrl: config.acpRpcUrl } as any : undefined
      ),
      onNewTask: (job: AcpJob) => {
        // Queue jobs for processing to prevent transaction conflicts
        const priority = getJobPriority(job.phase);
        Logger.debug(`[ACP] New job #${job.id} (${job.phase}) queued with priority ${priority}`);
        jobQueue!.enqueue(job, priority);
      },
      onEvaluate: (job: AcpJob) => {
        // Use void operator with proper error handling
        void (async () => {
          try {
            // Automatically approve deliverables
            Logger.log(`Evaluating job #${job.id}`);
            Logger.log('Deliverable:', job.deliverable);
            await job.evaluate(true, 'Deployment completed successfully');
          } catch (error) {
            Logger.error(`Error evaluating job #${job.id}:`, error);
          }
        })();
      },
    });

    // ===================================================================
    // STEP 3: Initialize ACP Plugin
    // ===================================================================
    const acpPlugin = new AcpPlugin({
      apiKey: config.gameApiKey,
      acpClient,
      keepCompletedJobs: config.keepCompletedJobs,
      keepCancelledJobs: config.keepCancelledJobs,
      keepProducedInventory: 10,
    });

    // ===================================================================
    // STEP 4: Initialize GameAgent
    // ===================================================================
    agent = new GameAgent(config.gameApiKey, {
      name: 'Kosher Capital - AI Agent Quick Deploy',
      goal: `Professional AI trading agent deployment service on Base chain via Kosher Capital infrastructure.`,
      description: `
**SERVICE OFFERING: AI Trading Agent Quick Deployment**

I deploy AI trading agents to Base chain using Kosher Capital's professional infrastructure.

**What I Provide:**
- ✅ Automated AI agent contract deployment
- ✅ USDC payment verification (50 USDC per deployment)
- ✅ Integration with Kosher Capital ecosystem
- ✅ Full deployment lifecycle management
- ✅ Instant deployment upon payment confirmation

**Deployment Process:**
1. Submit deployment request with agent name via ACP marketplace
2. I verify your request and accept the job
3. Pay 50 USDC to the agent wallet address
4. I verify payment on-chain (requires 1 confirmation)
5. I deploy your agent contract to Base chain
6. I register your agent with Kosher Capital API
7. You receive contract address and all deployment details

**Service Details:**
- Network: Base (Chain ID: 8453)
- Payment: 50 USDC (verified on-chain)
- Deployment Time: ~5 minutes after payment confirmation
- Support: Full Kosher Capital ecosystem integration
- Reliability: Automated deployment with retry logic

**Required Information:**
- Agent Name: Your AI agent's name (required)
- AI Wallet Address: Wallet for AI operations (optional, defaults to buyer address)
- Referral Code: For tracking and rewards (optional)

**What You'll Receive:**
- Contract Address: Your deployed agent's smart contract address
- Creation TX Hash: Transaction hash of contract deployment
- Payment TX Hash: Your payment transaction hash
- Kosher Capital Registration: Full API integration details
- Timestamp: Deployment completion time

${acpPlugin.agentDescription}
      `,
      workers: [
        acpPlugin.getWorker({
          functions: [
            acpPlugin.respondJob,      // Accept/reject deployment requests
            acpPlugin.deliverJob,       // Deliver deployment results
            getQuickDeployFunction(acpPlugin)  // Execute Quick Deploy logic
          ],
        }),
      ],
      getAgentState: createReducedStateGetter(() => acpPlugin.getAcpState(), {
        keepCompletedJobs: config.keepCompletedJobs,
        keepCancelledJobs: config.keepCancelledJobs,
        keepAcquiredInventory: 0,
        keepProducedInventory: 10,
        jobIdsToIgnore: [],
        agentAddressesToIgnore: [],
      }),
    });

    // ===================================================================
    // STEP 5: Initialize and start the agent
    // ===================================================================
    await agent.init();

    Logger.log('');
    Logger.log('🚀 KOSHER CAPITAL QUICK DEPLOY AGENT REGISTERED AS SELLER');
    Logger.log('Agent Name:', agent.name);
    Logger.log('Seller Wallet:', config.sellerAgentWalletAddress);
    Logger.log('Service: AI Trading Agent Quick Deployment');
    Logger.log('Price: 50 USDC per deployment');
    Logger.log('Network: Base (Chain ID: 8453)');
    Logger.log('Environment:', config.environment);
    Logger.log('');
    Logger.log('Buyers can find me by searching for:');
    Logger.log('- "Kosher Capital"');
    Logger.log('- "Quick Deploy"');
    Logger.log('- "AI agent deployment"');
    Logger.log('- "trading agent"');
    Logger.log('');
    Logger.log('Listening for deployment requests...');

    // Log queue status if available
    if (jobQueue.getQueueStatus) {
      const status = await jobQueue.getQueueStatus();
      Logger.log(
        `[JobQueue] Queue length: ${status.queueLength}, Processing: ${status.isProcessing}`
      );
    }

    // ===================================================================
    // STEP 6: Handle graceful shutdown
    // ===================================================================
    process.on('SIGINT', () => {
      Logger.log('\nGraceful shutdown initiated...');
      if (jobQueue && jobQueue.stopProcessing) {
        jobQueue.stopProcessing();
        Logger.log('Job queue stopped');
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      Logger.log('\nGraceful shutdown initiated...');
      if (jobQueue && jobQueue.stopProcessing) {
        jobQueue.stopProcessing();
        Logger.log('Job queue stopped');
      }
      process.exit(0);
    });

  } catch (error) {
    Logger.error('Error:', error);
    if (jobQueue && jobQueue.stopProcessing) {
      jobQueue.stopProcessing();
    }
    process.exit(1);
  }
}

// Start the agent application
void main();
