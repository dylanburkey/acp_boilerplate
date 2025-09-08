# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Note: PNPM is preferred over npm for this project.**

### Development
- `pnpm run dev` - Run the agent in development mode using tsx
- `pnpm run dev:mock` - Run with mock buyer for testing (simulates buyer requests every 30 seconds)
- `pnpm run build` - Build TypeScript to JavaScript in dist/
- `pnpm run start` - Run the compiled JavaScript from dist/

### Testing & Quality
- `pnpm run test` - Run Jest tests (currently no test files configured)
- `pnpm run lint` - Run ESLint on TypeScript files
- `pnpm run typecheck` - Run TypeScript type checking without emitting files

### Setup
- `pnpm run setup` - Install dependencies and create .env file from template
- `cp .env.example .env` - Create environment configuration file

## Architecture

This is an ACP (Agent Commerce Protocol) integration boilerplate for connecting AI agents to the Virtuals Protocol network on Base chain. The agent accepts paid requests from buyers, processes them, and returns results through blockchain transactions.

### Latest Updates (v0.2.9)
- Uses `@virtuals-protocol/game-acp-plugin` v0.2.9
- Uses `@virtuals-protocol/acp-node` v0.2.0-beta.10
- Full support for job processing, delivery, and blockchain integration
- Session key support for gas-efficient transactions

### Core Flow
1. **AcpIntegration** (src/index.ts) - Main orchestrator that initializes ACP client, monitors for jobs, and manages the processing loop
2. **AgentService** (src/services/agentService.ts) - Defines the agent's functionality. Two implementations:
   - `DefaultAgentService` - Forwards requests to an external API endpoint
   - `CustomAgentService` - Implements custom logic directly in code
3. **Job Processing** - Jobs are queued, processed with retry logic, and results are submitted on-chain via accept/reject transactions

### Key Components
- **JobQueue** (src/utils/jobQueue.ts) - Priority queue with retry management for processing buyer requests
- **TransactionMonitor** (src/utils/transactionMonitor.ts) - Tracks blockchain transactions with timeout handling
- **AcpStateManager** (src/utils/acpStateManager.ts) - Filters and manages ACP state to prevent memory issues
- **Config** (src/config/index.ts) - Centralized configuration loaded from environment variables

### Service Customization
To implement custom agent logic, modify `CustomAgentService` in src/services/agentService.ts and update the initialization in src/index.ts:28 to use `CustomAgentService` instead of `DefaultAgentService`.

## Environment Configuration

Required environment variables (set in .env):
- `GAME_API_KEY` - API key from Virtuals Console
- `WHITELISTED_WALLET_PRIVATE_KEY` - Private key for wallet that pays gas fees
- `AGENT_WALLET_ADDRESS` - Address that receives payments
- `SERVICE_NAME` - Name displayed to users
- `SERVICE_DESCRIPTION` - Service description
- `API_ENDPOINT` - External API endpoint (for DefaultAgentService)

## TypeScript Configuration

Strict TypeScript settings are enforced with:
- Target: ES2022
- All strict checks enabled
- No unused locals/parameters
- Source maps and declarations generated