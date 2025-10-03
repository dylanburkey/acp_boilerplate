# ACP Architecture Comparison: Direct ACP vs. GameAgent Pattern

## Executive Summary

This document compares **two different approaches** to integrating with Virtuals Protocol ACP:

1. **Direct ACP Client** (used by Kosher Capital) - Simple, direct blockchain integration
2. **GameAgent + ACP Plugin** (used by Athena) - AI-driven agent framework with ACP integration

**Kosher Capital uses the Direct ACP Client approach** for a simpler, more focused implementation.

---

## Direct ACP Client Architecture (Kosher Capital)

### Structure
```
src/quickDeploy.ts
├── AcpClient (direct usage from @virtuals-protocol/acp-node)
├── JobQueue (in-memory priority queue)
├── Quick Deploy Service (payment verification + contract deployment)
└── Kosher Capital API Integration
```

### How It Works
1. **Direct ACP Client**: Uses `AcpClient` directly with `onNewTask` and `onEvaluate` callbacks
2. **Job Queue**: Jobs are processed sequentially with priority-based ordering and retry logic
3. **Business Logic**: Validates requests, verifies payments, deploys contracts
4. **Manual Job Lifecycle**: Direct calls to:
   - `job.respondJob()` to accept/reject requests
   - `job.deliverJob()` to deliver results
   - `job.evaluate()` to approve deliverables

### Flow
```
Buyer Request → onNewTask callback
    ↓
JobQueue.enqueue(job, priority)
    ↓
processJob() → validateRequest()
    ↓
Accept job → Monitor for payment
    ↓
Payment verified → Deploy contract
    ↓
deliverJob(deploymentDetails) → blockchain
    ↓
onEvaluate → Auto-approve → Complete
```

### Code Example

```typescript
// src/quickDeploy.ts
import AcpClient, { AcpContractClient, AcpJob } from '@virtuals-protocol/acp-node';

const acpClient = new AcpClient({
  acpContractClient: await AcpContractClient.build(
    privateKey,
    entityId,
    walletAddress,
    { rpcUrl }
  ),
  onNewTask: (job: AcpJob) => {
    // Add job to processing queue
    const priority = getJobPriority(job.phase);
    jobQueue.enqueue(job, priority);
  },
  onEvaluate: (job: AcpJob) => {
    // Auto-approve successful deployments
    job.evaluate(true, 'Deployment completed successfully');
  }
});

// Process jobs from queue
async function processJob(job: AcpJob) {
  if (job.phase === AcpJobPhases.REQUEST) {
    // Validate request and accept/reject
    const isValid = validateDeploymentRequest(job);
    if (isValid) {
      await job.respondJob({
        accepted: true,
        message: 'Deployment request accepted'
      });
    }
  }
  else if (job.phase === AcpJobPhases.TRANSACTION) {
    // Verify payment and deploy
    const paymentVerified = await verifyUsdcPayment(job);
    const deploymentResult = await deployContract(job);
    await job.deliverJob({
      contractAddress: deploymentResult.address,
      txHash: deploymentResult.txHash
    });
  }
}
```

### Benefits
- ✅ **Simple**: Minimal dependencies, direct blockchain interaction
- ✅ **Lightweight**: No AI framework overhead
- ✅ **Predictable**: Business logic is explicit and deterministic
- ✅ **Fast**: No LLM calls, immediate processing
- ✅ **Cost-effective**: No AI API costs
- ✅ **Maintainable**: Easy to understand and debug

### Trade-offs
- ⚠️ Manual job processing logic
- ⚠️ No AI-driven decision making
- ⚠️ Requires explicit business rules

---

## GameAgent + ACP Plugin Architecture (Athena)

### Structure
```
src/index.ts
├── GameAgent (from @virtuals-protocol/game)
│   └── Worker with functions
│       ├── respondJob (from plugin)
│       ├── deliverJob (from plugin)
│       └── Custom functions
├── AcpPlugin (from @virtuals-protocol/game-acp-plugin)
│   └── AcpClient (managed internally)
└── Functions (custom logic)
```

### How It Works
1. **GameAgent Orchestration**: AI agent framework manages lifecycle
2. **ACP Plugin Integration**: Wraps `AcpClient` and provides:
   - Built-in job handling functions
   - State management
   - Integration with agent description
3. **AI-Driven Processing**: Uses LLM to:
   - Decide whether to accept/reject jobs
   - Determine how to process requests
   - Call appropriate functions
4. **Function-Based Logic**: Custom logic implemented as functions

### Flow
```
Buyer Request → AcpClient.onNewTask
    ↓
JobQueue.enqueue(job, priority)
    ↓
agent.runTask(prompt) → LLM decides
    ↓
LLM calls respondJob() or deliverJob()
    ↓
LLM calls custom function
    ↓
Function executes → returns data
    ↓
Plugin handles blockchain delivery
```

### Code Example

```typescript
// src/index.ts (Athena pattern)
import { GameAgent } from '@virtuals-protocol/game';
import AcpPlugin from '@virtuals-protocol/game-acp-plugin';

const acpPlugin = new AcpPlugin({
  apiKey: GAME_API_KEY,
  acpClient,
});

const agent = new GameAgent(GAME_API_KEY, {
  name: 'AI Agent',
  workers: [
    acpPlugin.getWorker({
      functions: [
        acpPlugin.respondJob,
        acpPlugin.deliverJob,
        customFunction
      ]
    })
  ]
});
```

### Benefits
- ✅ **AI-Driven**: LLM makes decisions based on natural language prompts
- ✅ **Flexible**: Can handle varied, unpredictable requests
- ✅ **Extensible**: Easy to add new functions
- ✅ **Framework**: Built-in state management, job handling

### Trade-offs
- ⚠️ More complex architecture
- ⚠️ Requires GAME_API_KEY and AI infrastructure
- ⚠️ LLM calls add latency and cost
- ⚠️ Less predictable (AI decisions)
- ⚠️ Higher resource requirements

---

## Key Differences

| Aspect | Direct ACP (Kosher Capital) | GameAgent (Athena) |
|--------|----------------------------|-------------------|
| **Framework** | None - direct ACP | GameAgent SDK |
| **ACP Integration** | Direct `AcpClient` | `AcpPlugin` wrapper |
| **Job Processing** | Business logic + queue | AI worker + functions |
| **Decision Making** | Explicit code | AI-driven |
| **Custom Logic** | Service classes/functions | GameFunctions |
| **Dependencies** | `@virtuals-protocol/acp-node` only | + `@virtuals-protocol/game`<br>+ `@virtuals-protocol/game-acp-plugin` |
| **Complexity** | Lower | Higher |
| **Latency** | Fast (no LLM calls) | Slower (LLM processing) |
| **Cost** | Low (blockchain only) | Higher (AI API + blockchain) |
| **Use Case** | Deterministic services | AI-powered agents |

---

## When to Use Each Pattern

### Use Direct ACP Client (Kosher Capital Pattern) When:

✅ Service has **clear, deterministic business rules**
✅ **Fast response times** are critical
✅ Want to **minimize complexity and costs**
✅ Don't need AI-driven decision making
✅ Processing logic is **straightforward**

**Examples:**
- Payment processing services
- Contract deployment services
- Data retrieval APIs
- Fixed-price services with clear scope

### Use GameAgent + ACP Plugin (Athena Pattern) When:

✅ Need **AI-driven decision making**
✅ Handling **varied, unpredictable requests**
✅ Want **natural language interaction**
✅ Building a **general-purpose AI agent**
✅ Complex reasoning required

**Examples:**
- AI research assistants
- Trading strategy analysis
- Smart money tracking
- General-purpose AI services

---

## Kosher Capital Use Case

**Service:** Quick Deploy - AI Trading Agent Deployment

**Requirements:**
- Accept deployment requests with agent name
- Verify 50 USDC payment on Base chain
- Deploy agent contract via Factory
- Register with Kosher Capital API
- Return deployment details

**Why Direct ACP Client?**
1. ✅ **Deterministic**: Clear business logic (validate → verify payment → deploy)
2. ✅ **Fast**: No AI latency, immediate processing after payment
3. ✅ **Simple**: Straightforward service, no AI needed
4. ✅ **Cost-effective**: No AI API costs
5. ✅ **Reliable**: Predictable behavior, easy to test

**Direct ACP Client is the right choice for Kosher Capital Quick Deploy.**

---

## Webhook Integration

Both patterns can use webhooks for real-time event notifications.

### Webhook Flow
```
External Event (e.g., payment received)
    ↓
Kosher Capital API
    ↓
HTTP POST to your webhook endpoint
    ↓
POST /webhook/payment
{
  "event": "payment.received",
  "txHash": "0xabc...",
  "amount": "50000000",
  "jobId": "job_123"
}
    ↓
Webhook Handler
    ↓
Update job status → Trigger deployment
    ↓
Respond 200 OK
```

### Implementation
```typescript
// Webhook endpoint (works with both patterns)
app.post('/webhook/payment', async (req, res) => {
  const { jobId, txHash, amount } = req.body;

  // Verify webhook signature
  const isValid = verifyWebhookSignature(req);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Trigger job processing
  await handlePaymentReceived(jobId, txHash, amount);

  res.status(200).json({ status: 'received' });
});
```

---

## Migration Considerations

### From Direct ACP → GameAgent

**When to migrate:**
- Service scope expands beyond deterministic logic
- Need AI-driven decision making
- Want to handle varied, unpredictable requests

**Migration steps:**
1. Install `@virtuals-protocol/game` and `@virtuals-protocol/game-acp-plugin`
2. Wrap existing logic in GameFunctions
3. Replace direct AcpClient with AcpPlugin
4. Add AI prompts for job processing
5. Test with mock buyer

### From GameAgent → Direct ACP

**When to migrate:**
- Service has simple, deterministic logic
- AI overhead not justified
- Want faster, more predictable processing
- Reduce costs and complexity

**Migration steps:**
1. Extract business logic from GameFunctions
2. Replace AcpPlugin with direct AcpClient
3. Implement onNewTask/onEvaluate callbacks
4. Remove GameAgent dependencies
5. Update configuration (remove GAME_API_KEY)

---

## Conclusion

**Both patterns are valid ACP integrations.** The choice depends on your use case:

- **Direct ACP Client** (Kosher Capital) - Simple, fast, deterministic services
- **GameAgent + ACP Plugin** (Athena) - AI-powered, flexible, general-purpose agents

**Kosher Capital Quick Deploy uses the Direct ACP Client pattern** because:
1. Service has clear, deterministic business logic
2. Fast processing is important
3. No AI decision making required
4. Simpler architecture is easier to maintain
5. Lower costs and complexity

This is the **correct architectural choice** for this use case.

---

**Last Updated:** 2025-01-03
