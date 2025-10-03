# Kosher Capital ACP Integration - Implementation Plan

## Current State Analysis

### What You Have ✅
Your Quick Deploy service **already implements ACP seller agent functionality** in `src/services/quickDeploy/acpSellerAgent.ts`:

```typescript
class QuickDeployACPAgent {
  - Initializes AcpClient with onNewTask/onEvaluate callbacks
  - Handles ACP job phases: REQUEST → NEGOTIATION → TRANSACTION → EVALUATION
  - Monitors USDC payments on-chain
  - Deploys contracts via contractUtils
  - Calls Kosher Capital API with payment + creation TX hashes
  - Delivers results back to buyers via ACP
}
```

### What's Missing 🔧
You're using the **direct ACP Client approach** instead of the **standard GameAgent + ACP Plugin pattern**:

| Current (Direct) | Standard (GameAgent) |
|-----------------|---------------------|
| `QuickDeployACPAgent` class | `GameAgent` from `@virtuals-protocol/game` |
| Manual `AcpClient` setup | `AcpPlugin` wrapper |
| Custom job phase handlers | AI worker with functions |
| Automatic job acceptance | AI-driven accept/reject |
| No AI decision making | AI analyzes requests |

## Why Migrate to GameAgent Pattern?

### Benefits

1. **AI-Driven Decision Making**
   - AI can analyze deployment requests and decide whether to accept
   - Can negotiate terms based on complexity
   - Can provide intelligent responses to buyers

2. **Standardized Architecture**
   - Follows Virtuals Protocol conventions
   - Easier for other developers to understand
   - Better ecosystem integration

3. **Built-in Functionality**
   - Plugin provides `respondJob` and `deliverJob` functions
   - State management via `getAcpState()`
   - Better error handling and retry logic

4. **Extensibility**
   - Easy to add new deployment types as functions
   - Can combine multiple services (deployment + monitoring + support)
   - Better suited for complex workflows

5. **Agent Discovery**
   - Proper agent description helps buyers find your service
   - Better marketplace presence
   - Can include keywords and service categories

### Drawbacks of Migration

1. **Added Complexity**
   - Requires understanding GameAgent SDK
   - More abstraction layers
   - AI decision making may be overkill for simple deployment service

2. **Additional Dependencies**
   - Need `@virtuals-protocol/game` package
   - Larger bundle size
   - More configuration

3. **Migration Effort**
   - Refactor existing code
   - Update tests
   - Update documentation

## Recommendation

**Option A: Keep Current Implementation (Simpler)**
- Your current implementation works and is production-ready
- Direct ACP Client approach is perfectly valid
- No unnecessary complexity
- **Best if**: You just want a simple deployment service that accepts all valid requests

**Option B: Migrate to GameAgent (Standard)**
- Follow Virtuals Protocol best practices
- Better for complex workflows
- AI-driven decision making
- **Best if**: You want to build a sophisticated agent with multiple services or need AI analysis

## Implementation Plan (Option B)

If you choose to migrate to GameAgent pattern, here's the step-by-step plan:

### Phase 1: Setup GameAgent Infrastructure

#### 1.1 Install Dependencies
```bash
pnpm add @virtuals-protocol/game
```

#### 1.2 Create Functions Directory
```
src/functions/
├── index.ts                  # Export all functions
├── quickDeploy.ts           # Main deployment function
└── utils/
    ├── paymentVerification.ts
    └── contractDeployment.ts
```

#### 1.3 Create Deployment Function

Create `src/functions/quickDeploy.ts`:

```typescript
import AcpPlugin from '@virtuals-protocol/game-acp-plugin';
import { AcpJob } from '@virtuals-protocol/acp-node';
import { paymentMonitor } from '../services/quickDeploy/paymentMonitor';
import { getKosherCapitalClient } from '../services/quickDeploy/kosherCapitalClient';
import { QuickDeployContract } from '../services/quickDeploy/contractUtils';
import { Logger } from '../utils/logger';

/**
 * Quick Deploy function for GameAgent
 * This function handles AI trading agent deployments via Kosher Capital
 */
export function getQuickDeployFunction(acpPlugin: AcpPlugin) {
  return {
    name: 'quickDeployAgent',
    description: `Deploy an AI trading agent using Kosher Capital infrastructure.

    This function:
    1. Verifies USDC payment (50 USDC) on Base chain
    2. Deploys agent contract
    3. Registers with Kosher Capital API
    4. Returns deployment details to buyer

    Required parameters:
    - agentName: Name for the AI agent
    - aiWallet: Wallet address for AI operations (optional)
    - referralCode: Referral code for deployment (optional)`,
    parameters: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'ACP job ID from the marketplace'
        },
        agentName: {
          type: 'string',
          description: 'Name for the AI trading agent'
        },
        aiWallet: {
          type: 'string',
          description: 'Wallet address for AI operations (optional)'
        },
        referralCode: {
          type: 'string',
          description: 'Referral code for deployment tracking (optional)'
        }
      },
      required: ['jobId', 'agentName']
    },
    handler: async (args: {
      jobId: string;
      agentName: string;
      aiWallet?: string;
      referralCode?: string;
    }) => {
      try {
        Logger.info(`[Quick Deploy] Starting deployment for ${args.agentName}`);

        // Get the ACP job
        const job = await acpPlugin.acpClient.getJob(args.jobId);
        if (!job) {
          throw new Error(`Job ${args.jobId} not found`);
        }

        const buyerAddress = (job as any).buyer || (job as any).providerAddress;

        // STEP 1: Monitor for payment (50 USDC)
        Logger.info(`[Quick Deploy] Waiting for payment from ${buyerAddress}...`);
        const paymentTx = await paymentMonitor.monitorPayment(
          buyerAddress,
          '50', // 50 USDC
          {
            timeout: 300000, // 5 minutes
            pollInterval: 3000,
            confirmations: 1
          }
        );

        Logger.info(`[Quick Deploy] Payment received: ${paymentTx.hash}`);

        // STEP 2: Deploy agent contract
        const contractUtils = new QuickDeployContract();
        const wallet = new ethers.Wallet(
          process.env.WHITELISTED_WALLET_PRIVATE_KEY!,
          contractUtils['provider']
        );

        const deploymentResult = await contractUtils.deployAgent(
          {
            userWallet: buyerAddress,
            agentName: args.agentName,
            aiWallet: args.aiWallet || buyerAddress
          },
          wallet
        );

        Logger.info(`[Quick Deploy] Contract deployed: ${deploymentResult.fundAddress}`);

        // STEP 3: Register with Kosher Capital API
        const kosherClient = getKosherCapitalClient();
        const apiResult = await kosherClient.quickDeploy({
          agentName: args.agentName,
          contractCreationTxnHash: deploymentResult.creationTxHash!,
          creating_user_wallet_address: buyerAddress,
          paymentTxnHash: paymentTx.hash,
          deploySource: 'acp-marketplace',
          referralCode: args.referralCode
        });

        if (!apiResult.success) {
          throw new Error(`Kosher Capital API error: ${apiResult.error}`);
        }

        Logger.info(`[Quick Deploy] Deployment complete for ${args.agentName}`);

        // Return deliverable
        return {
          success: true,
          agentName: args.agentName,
          contractAddress: deploymentResult.fundAddress,
          creationTxHash: deploymentResult.creationTxHash,
          paymentTxHash: paymentTx.hash,
          kosherCapitalResponse: apiResult.data,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        Logger.error('[Quick Deploy] Deployment failed:', error);

        return {
          success: false,
          agentName: args.agentName,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };
      }
    }
  };
}
```

### Phase 2: Create Main Agent Entry Point

Create `src/quickDeployAgent.ts`:

```typescript
import { GameAgent } from '@virtuals-protocol/game';
import AcpPlugin from '@virtuals-protocol/game-acp-plugin';
import AcpClient, { AcpContractClient, AcpJob, AcpJobPhases } from '@virtuals-protocol/acp-node';
import { getQuickDeployFunction } from './functions/quickDeploy';
import { createReducedStateGetter } from './utils/acpStateManager';
import { Logger } from './utils/logger';
import { createJobQueue, QueueInterface } from './utils/queueFactory';
import { ACP_CONFIG, getJobPriority } from './config/acpConfig';
import {
  GAME_API_KEY,
  WHITELISTED_WALLET_PRIVATE_KEY,
  WHITELISTED_WALLET_ENTITY_ID,
  AGENT_WALLET_ADDRESS
} from './config';

const ACP_WORKER_ID = 'acp-quick-deploy-worker';

/**
 * Type guard for checking memo phases
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
 * Main entry point for Kosher Capital Quick Deploy ACP Agent
 */
async function main(): Promise<void> {
  let agent: GameAgent;
  let jobQueue: QueueInterface | undefined;

  try {
    // Initialize job queue
    const processJob = async (job: AcpJob): Promise<void> => {
      let prompt = '';

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
        - The request includes a valid agent name
        - The buyer's wallet address is valid
        - The payment amount is 50 USDC
        - The service type is "quick-deploy"

        Reject if:
        - Missing required information
        - Invalid wallet addresses
        - Incorrect payment amount
        - Unsupported service type

        Once you've made your decision, use the respondJob function to accept or reject.
        Do NOT proceed with deployment yet - wait for the TRANSACTION phase.
        `;
      } else if (
        job.phase === AcpJobPhases.TRANSACTION &&
        job.memos.find((m) => hasNextPhase(m, AcpJobPhases.EVALUATION))
      ) {
        prompt = `
        The buyer has paid and the job is now in TRANSACTION phase.

        Job Details:
        ${JSON.stringify(job, null, 2)}

        Execute the deployment by calling the quickDeployAgent function.
        The function will:
        1. Verify the 50 USDC payment on-chain
        2. Deploy the agent contract
        3. Register with Kosher Capital API
        4. Return deployment details

        Once complete, use deliverJob to send the results to the buyer.
        `;
      }

      if (prompt && agent) {
        await agent.getWorkerById(ACP_WORKER_ID).runTask(prompt, {
          verbose: true
        });

        Logger.log(`${agent.name} has processed job #${job.id}`);
      }
    };

    // Create job queue
    jobQueue = await createJobQueue(
      processJob,
      ACP_CONFIG.jobQueue.processingDelay,
      ACP_CONFIG.jobQueue.maxRetries
    );

    // Initialize ACP client
    const acpClient = new AcpClient({
      acpContractClient: await AcpContractClient.build(
        WHITELISTED_WALLET_PRIVATE_KEY,
        WHITELISTED_WALLET_ENTITY_ID,
        AGENT_WALLET_ADDRESS
      ),
      onNewTask: (job: AcpJob) => {
        const priority = getJobPriority(job.phase);
        Logger.debug(`[ACP] New job #${job.id} (${job.phase}) queued with priority ${priority}`);
        jobQueue!.enqueue(job, priority);
      },
      onEvaluate: (job: AcpJob) => {
        void (async () => {
          try {
            Logger.log(`Evaluating job #${job.id}`);
            // Auto-approve deployments that completed successfully
            await job.evaluate(true, 'Deployment completed successfully');
          } catch (error) {
            Logger.error(`Error evaluating job #${job.id}:`, error);
          }
        })();
      }
    });

    // Initialize ACP plugin
    const acpPlugin = new AcpPlugin({
      apiKey: GAME_API_KEY,
      acpClient,
      keepCompletedJobs: true,
      keepCancelledJobs: false,
      keepProducedInventory: true
    });

    // Initialize GameAgent
    agent = new GameAgent(GAME_API_KEY, {
      name: 'Kosher Capital - AI Agent Quick Deploy',
      goal: `Professional AI trading agent deployment service on Base chain via Kosher Capital infrastructure.`,
      description: `
**SERVICE OFFERING: AI Trading Agent Quick Deployment**

I deploy AI trading agents to Base chain using Kosher Capital's infrastructure.

**What I Provide:**
- Automated AI agent contract deployment
- USDC payment verification (50 USDC per deployment)
- Integration with Kosher Capital ecosystem
- Full deployment lifecycle management
- Instant deployment upon payment confirmation

**Deployment Process:**
1. Submit deployment request with agent name via ACP marketplace
2. Pay 50 USDC to agent wallet
3. I verify payment on-chain (1 confirmation)
4. I deploy your agent contract to Base
5. I register with Kosher Capital API
6. You receive contract address and deployment details

**Service Details:**
- Network: Base (Chain ID: 8453)
- Payment: 50 USDC
- Deployment Time: ~5 minutes after payment
- Support: Kosher Capital ecosystem integration

**Required Information:**
- Agent Name (required)
- AI Wallet Address (optional, defaults to buyer address)
- Referral Code (optional)

${acpPlugin.agentDescription}
      `,
      workers: [
        acpPlugin.getWorker({
          functions: [
            acpPlugin.respondJob,      // Accept/reject jobs
            acpPlugin.deliverJob,       // Deliver results
            getQuickDeployFunction(acpPlugin)  // Quick Deploy logic
          ]
        })
      ],
      getAgentState: createReducedStateGetter(() => acpPlugin.getAcpState(), {
        keepCompletedJobs: true,
        keepCancelledJobs: false,
        keepAcquiredInventory: false,
        keepProducedInventory: true
      })
    });

    await agent.init();

    Logger.log('');
    Logger.log('🚀 KOSHER CAPITAL QUICK DEPLOY AGENT REGISTERED');
    Logger.log('Agent Name:', agent.name);
    Logger.log('Wallet:', AGENT_WALLET_ADDRESS);
    Logger.log('Service: AI Trading Agent Quick Deployment');
    Logger.log('Price: 50 USDC per deployment');
    Logger.log('Network: Base (Chain ID: 8453)');
    Logger.log('');
    Logger.log('Buyers can find me by searching for:');
    Logger.log('- "Kosher Capital"');
    Logger.log('- "Quick Deploy"');
    Logger.log('- "AI agent deployment"');
    Logger.log('- "trading agent"');
    Logger.log('');
    Logger.log('Listening for deployment requests...');

    // Handle graceful shutdown
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

// Start the agent
void main();
```

### Phase 3: Update Configuration

Add to `.env`:
```bash
# GameAgent API Key (from Virtuals Console)
GAME_API_KEY=your_game_api_key_here

# Keep existing Quick Deploy variables
SHEKEL_API_KEY=your_shekel_api_key
KOSHER_CAPITAL_API_URL=https://app.kosher.capital/api
```

### Phase 4: Migration Strategy

**Parallel Operation (Recommended)**
1. Keep existing `QuickDeployACPAgent` running
2. Deploy new GameAgent version alongside
3. Test thoroughly with different job types
4. Monitor for issues
5. Gradually shift traffic to new implementation
6. Deprecate old implementation once stable

**Big Bang (Faster)**
1. Replace `src/index.ts` with new GameAgent implementation
2. Update all imports and references
3. Run comprehensive E2E tests
4. Deploy directly to production

### Phase 5: Testing

Update E2E tests to test GameAgent functions:

```typescript
// tests/e2e/gameagent-quick-deploy.e2e.test.ts

describe('GameAgent Quick Deploy Integration', () => {
  test('should accept valid deployment request', async () => {
    // Create ACP job
    // Verify AI accepts job
    // Check respondJob was called
  });

  test('should reject invalid deployment request', async () => {
    // Create invalid ACP job
    // Verify AI rejects job
  });

  test('should execute deployment on payment', async () => {
    // Create ACP job
    // Simulate payment
    // Verify deployment executes
    // Check deliverJob was called
  });
});
```

### Phase 6: Documentation Updates

Update documentation to reflect GameAgent architecture:
- How functions work
- AI decision making process
- Job phase handling
- Webhook integration with functions

## Webhook Integration with GameAgent

Webhooks can still be used alongside GameAgent:

```typescript
// src/webhooks/paymentWebhook.ts

/**
 * Payment webhook handler
 * Receives notifications from external payment processors
 */
export async function handlePaymentWebhook(req: Request, res: Response) {
  const { jobId, txHash, amount } = req.body;

  // Verify webhook signature
  // ...

  // Find the ACP job
  const job = await acpClient.getJob(jobId);

  // Trigger the quickDeployAgent function via AI worker
  await agent.getWorkerById(ACP_WORKER_ID).runTask(`
    Payment received for job ${jobId}.
    Transaction: ${txHash}
    Amount: ${amount} USDC

    Proceed with deployment by calling quickDeployAgent function.
  `);

  res.status(200).json({ received: true });
}
```

## Timeline Estimate

- **Phase 1 (Setup)**: 2-3 hours
- **Phase 2 (Main Agent)**: 4-6 hours
- **Phase 3 (Configuration)**: 1 hour
- **Phase 4 (Migration)**: 2-4 hours
- **Phase 5 (Testing)**: 4-8 hours
- **Phase 6 (Documentation)**: 2-3 hours

**Total: 15-25 hours** for complete migration

## Decision Matrix

| Factor | Keep Current | Migrate to GameAgent |
|--------|-------------|---------------------|
| **Complexity** | ✅ Simple | ❌ More complex |
| **Standards** | ⚠️ Non-standard | ✅ Standard pattern |
| **AI Features** | ❌ None | ✅ AI-driven decisions |
| **Maintenance** | ✅ Easier | ⚠️ More abstraction |
| **Extensibility** | ⚠️ Limited | ✅ Easy to extend |
| **Time to Deploy** | ✅ Already done | ❌ 15-25 hours |
| **Production Ready** | ✅ Yes | ⚠️ Needs testing |

## My Recommendation

**Keep your current implementation for now.** Here's why:

1. **It works** - Your `QuickDeployACPAgent` is production-ready
2. **It's complete** - Has all the features you need
3. **It's tested** - You have E2E tests
4. **It's simple** - Direct ACP approach is easier to maintain
5. **No AI needed** - Deployment service doesn't benefit much from AI decision making

**When to consider migration:**
- You want to add multiple services (deployment + monitoring + support)
- You need AI to analyze deployment requests
- You want better marketplace discoverability
- You're building a complex agent ecosystem

For a simple deployment service that accepts all valid requests, your current direct ACP implementation is **perfectly appropriate**.
