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

This is a **direct Virtuals ACP (Agent Commerce Protocol) integration** for the Kosher Capital Quick Deploy service. The agent accepts paid deployment requests from buyers, verifies USDC payments on Base chain, deploys agent contracts, and returns deployment details through blockchain transactions.

**Important:** This codebase uses **direct ACP Client** (`@virtuals-protocol/acp-node` only), NOT the GameAgent SDK pattern. This provides a simpler, faster, more cost-effective solution for deterministic services.

### Core Components
- **QuickDeployACPAgent** (src/services/quickDeploy/acpSellerAgent.ts) - Main ACP seller agent that processes deployment jobs
- **QuickDeployService** (src/services/quickDeploy/quickDeployService.ts) - Handles payment verification, contract deployment, and Kosher Capital API integration
- **JobQueue** (src/utils/jobQueue.ts) - Priority queue with retry management for sequential job processing
- **AcpStateManager** (src/utils/acpStateManager.ts) - Filters and manages ACP state to prevent memory issues
- **Config** (src/config/index.ts) - Centralized configuration loaded from environment variables

### Core Flow
1. **Direct ACP Client** (src/quickDeploy.ts) - Initializes AcpClient with onNewTask and onEvaluate callbacks
2. **Job Queue** - New jobs are added to priority queue for sequential processing
3. **Job Processing** - Each job goes through:
   - REQUEST phase: Validate deployment request, accept/reject
   - TRANSACTION phase: Verify 50 USDC payment, deploy contract, deliver results
   - EVALUATION phase: Auto-approve successful deployments
4. **Blockchain Integration** - Direct calls to AcpClient for job responses and deliverables

## Environment Configuration

Required environment variables (set in .env):
- `WHITELISTED_WALLET_PRIVATE_KEY` - Private key for wallet registered with Virtuals (gas fees handled by protocol)
- `WHITELISTED_WALLET_ENTITY_ID` - Entity ID from wallet registration
- `SELLER_AGENT_WALLET_ADDRESS` - Address that receives USDC payments
- `SERVICE_NAME` - Service name displayed to buyers
- `SERVICE_DESCRIPTION` - Service description
- `SERVICE_PRICE` - Price in USDC (default: 50)
- `SHEKEL_API_KEY` - Kosher Capital API key
- `KOSHER_CAPITAL_API_URL` - Kosher Capital API endpoint
- `FACTORY_CONTRACT_ADDRESS` - Agent factory contract address

Note: No GAME_API_KEY needed - this codebase uses direct ACP Client only.

## TypeScript Configuration

Strict TypeScript settings are enforced with:
- Target: ES2022
- All strict checks enabled
- No unused locals/parameters
- Source maps and declarations generated