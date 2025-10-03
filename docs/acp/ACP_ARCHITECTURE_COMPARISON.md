# ACP Architecture Comparison: Current vs. Standard Pattern

## Executive Summary

Your current ACP integration uses a **direct client approach** with manual job processing, while the Athena agent demonstrates the **recommended GameAgent + Plugin pattern**. The Quick Deploy service for Kosher Capital should be refactored to follow the standard pattern for better maintainability and ACP ecosystem integration.

## Current Architecture (Manual ACP Client)

### Structure
```
src/index.ts (AcpIntegration)
├── AcpClient (direct usage)
├── JobQueue (custom implementation)
├── AgentService (API forwarding)
└── Quick Deploy Service (separate service)
```

### How It Works
1. **Direct ACP Client**: Manually initializes `AcpClient` with `onNewTask` and `onEvaluate` callbacks
2. **Custom Job Queue**: Jobs are manually added to a queue and processed with retry logic
3. **Agent Service Layer**: Two service implementations:
   - `DefaultAgentService`: Forwards requests to external API (`config.apiEndpoint`)
   - `CustomAgentService`: Template for custom logic
4. **Manual Job Lifecycle**: You manually call:
   - `acpClient.deliverJob(jobId, deliverable)` for success
   - `acpClient.sendMessage(jobId, message, 'REJECTED')` for failure
5. **Quick Deploy**: Separate service that operates independently of ACP flow

### Current Flow
```
Buyer Request → onNewTask callback
    ↓
JobQueue.addJob()
    ↓
processJob() → agentService.processRequest()
    ↓
API_ENDPOINT (external service)
    ↓
deliverJob() or rejectJob() → blockchain
```

## Standard Architecture (GameAgent + ACP Plugin)

### Structure (Athena Agent)
```
src/index.ts
├── GameAgent (from @virtuals-protocol/game)
│   └── Worker with functions
│       ├── respondJob (from plugin)
│       ├── deliverJob (from plugin)
│       └── getSmartMoneyPositionsFunction (custom)
├── AcpPlugin (from @virtuals-protocol/game-acp-plugin)
│   └── AcpClient (managed internally)
└── Functions (src/functions/smartMoney.ts)
    └── API integration logic
```

### How It Works
1. **GameAgent Orchestration**: `GameAgent` manages the entire agent lifecycle
2. **ACP Plugin Integration**: `AcpPlugin` wraps `AcpClient` and provides:
   - Built-in job handling functions (`respondJob`, `deliverJob`)
   - State management via `getAcpState()`
   - Integration with agent description
3. **Function-Based Processing**: Custom logic is implemented as **functions** that:
   - Are registered with the agent's worker
   - Are called by the AI agent when processing jobs
   - Return structured data for delivery
4. **AI-Driven Job Processing**: The agent uses AI to determine:
   - Whether to accept/reject jobs
   - How to process requests
   - Which functions to call
5. **Job Queue Management**: Uses queue factory with priority-based processing

### Standard Flow
```
Buyer Request → AcpClient.onNewTask
    ↓
JobQueue.enqueue(job, priority)
    ↓
agent.getWorkerById(ACP_WORKER_ID).runTask(prompt)
    ↓
AI decides → calls respondJob() or deliverJob()
    ↓
If deliverJob → calls custom function (e.g., getSmartMoneyPositions)
    ↓
Function makes API call → returns data
    ↓
Plugin handles blockchain delivery
```

## Key Differences

| Aspect | Current (Manual) | Standard (GameAgent) |
|--------|-----------------|---------------------|
| **Agent Framework** | None - direct ACP usage | `GameAgent` from `@virtuals-protocol/game` |
| **ACP Integration** | Manual `AcpClient` initialization | `AcpPlugin` wrapper |
| **Job Processing** | Custom service layer | AI worker with functions |
| **Job Acceptance** | Automatic | AI-driven with `respondJob()` |
| **Custom Logic** | Separate service classes | Functions registered with worker |
| **State Management** | Manual with custom utilities | Plugin provides `getAcpState()` |
| **Blockchain Calls** | Manual `deliverJob()`/`rejectJob()` | Plugin handles via functions |
| **API Integration** | Service layer forwards to endpoint | Functions encapsulate API calls |
| **Extensibility** | Add service methods | Add functions to worker |

## Webhook Explanation

### What is a Webhook?

A webhook is an **HTTP callback** that allows external services to notify your application when events occur, rather than your application constantly polling for updates.

### Webhook Flow

```
Event Occurs (e.g., Payment Received)
    ↓
External Service (Kosher Capital)
    ↓
HTTP POST to your webhook endpoint
    ↓
POST /webhook/payment
{
  "event": "payment.received",
  "txHash": "0xabc...",
  "amount": "1000000",
  "jobId": "123"
}
    ↓
Your Webhook Handler (src/services/quickDeploy/statusApi.ts)
    ↓
Process Event → Update Job Status → Trigger Next Step
    ↓
Respond 200 OK (acknowledge receipt)
```

### Current Webhook Endpoints (Placeholder)

In [src/services/quickDeploy/statusApi.ts](../../src/services/quickDeploy/statusApi.ts):

```typescript
// Payment webhook - notified when payment is received
router.post('/webhook/payment', async (_req: Request, res: Response, _next: NextFunction) => {
  // TODO: Implement payment webhook handler
  res.status(200).json({ status: 'received' });
});

// Deployment webhook - notified when deployment completes
router.post('/webhook/deployment', async (_req: Request, res: Response, _next: NextFunction) => {
  // TODO: Implement deployment webhook handler
  res.status(200).json({ status: 'received' });
});
```

### Benefits of Webhooks

1. **Real-time Updates**: Immediate notification when events occur
2. **Reduced Polling**: No need to constantly check for status changes
3. **Lower Latency**: Faster response to events
4. **Resource Efficient**: Server pushes data instead of client pulling

## Kosher Capital API Service Architecture

### Current Implementation Issue

The Quick Deploy service (`src/services/quickDeploy/`) operates **separately** from the ACP job flow. This creates a disconnect between:
- ACP job lifecycle (REQUEST → NEGOTIATION → TRANSACTION → EVALUATION)
- Quick Deploy operations (payment monitoring, deployment, webhooks)

### Recommended Architecture

The Kosher Capital API should be integrated as a **function** in the GameAgent pattern, similar to how Athena implements `getSmartMoneyPositions`:

```typescript
// src/functions/kosherCapital.ts

/**
 * Deploys an agent using Kosher Capital Quick Deploy
 * This function is called by the AI agent when processing deployment jobs
 */
export function getQuickDeployFunction(acpPlugin: AcpPlugin) {
  return {
    name: 'deployAgentViaKosherCapital',
    description: 'Deploy a new agent using Kosher Capital Quick Deploy service',
    parameters: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'ACP job ID' },
        agentConfig: {
          type: 'object',
          description: 'Agent configuration including name, description, etc.'
        },
        paymentTxHash: {
          type: 'string',
          description: 'Transaction hash of USDC payment'
        }
      },
      required: ['jobId', 'agentConfig', 'paymentTxHash']
    },
    handler: async (args: {
      jobId: string;
      agentConfig: Record<string, any>;
      paymentTxHash: string;
    }) => {
      try {
        // 1. Verify payment via blockchain
        const paymentVerified = await verifyUsdcPayment(
          args.paymentTxHash,
          EXPECTED_AMOUNT
        );

        if (!paymentVerified) {
          throw new Error('Payment verification failed');
        }

        // 2. Call Kosher Capital API
        const response = await fetch('https://app.kosher.capital/api/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${KOSHER_CAPITAL_API_KEY}`
          },
          body: JSON.stringify({
            jobId: args.jobId,
            config: args.agentConfig
          })
        });

        if (!response.ok) {
          throw new Error(`Deployment API error: ${response.status}`);
        }

        const deploymentResult = await response.json();

        // 3. Return result for ACP delivery
        return {
          success: true,
          data: {
            deploymentId: deploymentResult.id,
            agentAddress: deploymentResult.agentAddress,
            status: 'deployed',
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        Logger.error('Quick Deploy function error:', error);
        throw error;
      }
    }
  };
}
```

### Integration with Main Agent

```typescript
// src/index.ts

import { GameAgent } from '@virtuals-protocol/game';
import AcpPlugin from '@virtuals-protocol/game-acp-plugin';
import AcpClient, { AcpContractClient } from '@virtuals-protocol/acp-node';
import { getQuickDeployFunction } from './functions/kosherCapital';

async function main(): Promise<void> {
  const acpClient = new AcpClient({
    acpContractClient: await AcpContractClient.build(
      WHITELISTED_WALLET_PRIVATE_KEY,
      WHITELISTED_WALLET_ENTITY_ID,
      AGENT_WALLET_ADDRESS
    ),
    onNewTask: (job: AcpJob) => {
      jobQueue.enqueue(job, getJobPriority(job.phase));
    },
    onEvaluate: (job: AcpJob) => {
      // Auto-approve or custom evaluation logic
    }
  });

  const acpPlugin = new AcpPlugin({
    apiKey: GAME_API_KEY,
    acpClient,
  });

  const agent = new GameAgent(GAME_API_KEY, {
    name: 'Kosher Capital - Agent Deployment Service',
    description: `
      Professional agent deployment service using Kosher Capital infrastructure.

      I deploy AI agents to the Virtuals Protocol network with:
      - USDC payment verification
      - Automated blockchain deployment
      - Quick Deploy integration
      - Full ACP lifecycle management

      ${acpPlugin.agentDescription}
    `,
    workers: [
      acpPlugin.getWorker({
        functions: [
          acpPlugin.respondJob,      // Accept/reject jobs
          acpPlugin.deliverJob,       // Deliver results
          getQuickDeployFunction(acpPlugin)  // Custom deployment logic
        ]
      })
    ],
    getAgentState: createReducedStateGetter(() => acpPlugin.getAcpState(), {
      keepCompletedJobs: true,
      keepCancelledJobs: false
    })
  });

  await agent.init();
  Logger.log('🚀 Kosher Capital Agent Ready');
}
```

## Migration Path

### Phase 1: Add GameAgent Framework (Parallel)
1. Install `@virtuals-protocol/game` package
2. Create `src/functions/` directory
3. Move Quick Deploy logic into `kosherCapital.ts` function
4. Keep existing implementation running

### Phase 2: Integrate ACP Plugin
1. Replace direct `AcpClient` usage with `AcpPlugin`
2. Register functions with agent worker
3. Update job processing to use AI-driven flow
4. Test with mock buyer

### Phase 3: Deprecate Old Implementation
1. Remove `src/services/agentService.ts`
2. Remove manual job processing in `src/index.ts`
3. Update documentation
4. Clean up unused utilities

### Phase 4: Add Webhook Support
1. Keep Express server for webhooks
2. Integrate webhooks with function-based processing
3. Add event handlers for payment/deployment notifications

## Conclusion

**Current State**: Your implementation works but doesn't follow ACP best practices. It's more like a custom integration that happens to use ACP for payments.

**Standard Pattern**: The Athena agent demonstrates how ACP should be integrated - using GameAgent + AcpPlugin with functions for custom logic.

**Recommendation**: Refactor the Kosher Capital Quick Deploy service to follow the standard pattern. This will:
- Make your code more maintainable
- Better integrate with the ACP ecosystem
- Leverage AI-driven job processing
- Follow Virtuals Protocol conventions
- Make it easier to add new features

**Webhooks**: Yes, webhooks should be implemented for real-time event notifications from Kosher Capital. The webhook endpoints will receive notifications about payments and deployments, then trigger the appropriate functions in your agent's processing flow.
