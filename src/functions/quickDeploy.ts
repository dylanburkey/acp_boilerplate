/**
 * @fileoverview Quick Deploy function for GameAgent
 * This function handles AI trading agent deployments via Kosher Capital infrastructure
 *
 * @author Dylan Burkey
 * @license MIT
 */

import AcpPlugin from '@virtuals-protocol/game-acp-plugin';
import {
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
  GameFunction,
} from '@virtuals-protocol/game';
import { ethers } from 'ethers';
import { config } from '../config';
import { Logger } from '../utils/logger';
import { paymentMonitor } from '../services/quickDeploy/paymentMonitor';
import { getKosherCapitalClient } from '../services/quickDeploy/kosherCapitalClient';
import { QuickDeployContract } from '../services/quickDeploy/contractUtils';
import { transactionTracker } from '../services/quickDeploy/transactionTracker';
import { RetryUtil } from '../services/quickDeploy/retry';
import { ErrorFactory } from '../services/quickDeploy/errors';
import { LOG_PREFIX, DEPLOYMENT_CONFIG } from '../services/quickDeploy/constants';
import type {
  QuickDeployDeliverable,
  DeploymentParams,
} from '../services/quickDeploy/types';

/**
 * Creates the Quick Deploy function for GameAgent
 *
 * This function is called by the AI agent when processing deployment jobs.
 * It handles the complete deployment workflow:
 * 1. Monitors for USDC payment (50 USDC)
 * 2. Deploys agent contract to Base chain
 * 3. Registers with Kosher Capital API
 * 4. Returns deployment details to buyer
 *
 * @param acpPlugin - The ACP plugin instance
 * @returns GameFunction for Quick Deploy
 */
export function getQuickDeployFunction(acpPlugin: AcpPlugin) {
  const kosherClient = getKosherCapitalClient();
  const contractUtils = new QuickDeployContract();

  return new GameFunction({
    name: 'quickDeployAgent',
    description: `Deploy an AI trading agent using Kosher Capital infrastructure.

This function handles the complete deployment process:
1. Verifies USDC payment (50 USDC) on Base chain
2. Deploys agent contract with specified configuration
3. Registers with Kosher Capital API for ecosystem integration
4. Returns deployment details including contract address and transaction hashes

Required parameters:
- jobId: ACP job ID from the marketplace (required)
- agentName: Name for the AI agent (required)
- aiWallet: Wallet address for AI operations (optional, defaults to buyer address)
- referralCode: Referral code for deployment tracking (optional)

The function will wait up to 5 minutes for payment confirmation before timing out.`,

    args: [
      {
        name: 'jobId',
        type: 'string',
        description: 'ACP job ID from the marketplace',
      },
      {
        name: 'agentName',
        type: 'string',
        description: 'Name for the AI trading agent',
      },
      {
        name: 'aiWallet',
        type: 'string',
        description: 'Wallet address for AI operations (optional)',
      },
      {
        name: 'referralCode',
        type: 'string',
        description: 'Referral code for deployment tracking (optional)',
      },
    ] as const,

    executable: async (args, logger) => {
      try {
        logger(`Starting deployment for ${args.agentName || 'agent'}`);

        if (!args.jobId) {
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Job ${args.jobId} is invalid. Should only respond to active seller jobs.`
          );
        }

        if (!args.agentName) {
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            'Agent name is required for deployment.'
          );
        }

        // Get the ACP job from state
        const state = await acpPlugin.getAcpState();
        const job = state.jobs.active.asASeller.find((j) => j.jobId === +args.jobId!);

        if (!job) {
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            `Job ${args.jobId} not found in active seller jobs.`
          );
        }

        // Extract buyer address from job
        const buyerAddress = (job as any).buyer || (job as any).providerAddress || (job as any).buyerAddress;
        if (!buyerAddress) {
          return new ExecutableGameFunctionResponse(
            ExecutableGameFunctionStatus.Failed,
            'Buyer address not found in job.'
          );
        }

        Logger.info(`${LOG_PREFIX.INFO} Buyer address: ${buyerAddress}`);

        // Create transaction tracking record
        const transaction = transactionTracker.createTransaction(
          args.jobId,
          'pending',
          buyerAddress,
          args.agentName
        );

        Logger.info(`${LOG_PREFIX.INFO} Transaction ID: ${transaction.id}`);

        // ===================================================================
        // STEP 1: Monitor for USDC payment (50 USDC)
        // ===================================================================
        logger(`Waiting for payment from ${buyerAddress}...`);

        const paymentTx = await paymentMonitor.monitorPayment(
          buyerAddress,
          config.servicePrice.toString(), // "50"
          {
            timeout: 300000, // 5 minutes
            pollInterval: 3000, // Check every 3 seconds
            confirmations: 1
          }
        );

        logger(`Payment received! TX: ${paymentTx.hash}`);
        Logger.info(
          `${LOG_PREFIX.SUCCESS} Payment received! TX: ${paymentTx.hash}`,
          { amount: `${paymentTx.amount} USDC`, block: paymentTx.blockNumber }
        );

        // Update transaction with payment info
        transactionTracker.updateTransaction(transaction.id, {
          paymentTxHash: paymentTx.hash,
          status: 'processing' as any
        });

        // ===================================================================
        // STEP 2: Deploy agent contract to Base chain
        // ===================================================================
        logger(`Deploying contract for ${args.agentName}...`);

        // Create wallet signer for contract deployment
        const wallet = new ethers.Wallet(
          config.whitelistedWalletPrivateKey,
          contractUtils['provider']
        );

        // Execute contract deployment with retry logic
        const deploymentResult = await RetryUtil.withRetry(
          async () => {
            const params: DeploymentParams = {
              userWallet: buyerAddress,
              agentName: args.agentName!,
              aiWallet: args.aiWallet || buyerAddress,
            };

            return await contractUtils.deployAgent(params, wallet);
          },
          {
            maxAttempts: 3,
            onRetry: (attempt, error) => {
              logger(`Contract deployment retry ${attempt}: ${error.message}`);
              Logger.warn(
                `${LOG_PREFIX.WARNING} Contract deployment retry ${attempt}`,
                { error: error.message }
              );
            },
          }
        );

        logger(`Contract deployed: ${deploymentResult.fundAddress}`);
        Logger.info(
          `${LOG_PREFIX.SUCCESS} Contract deployed: ${deploymentResult.fundAddress}`,
          { creationTx: deploymentResult.creationTxHash }
        );

        // Update transaction with contract info
        transactionTracker.updateTransaction(transaction.id, {
          contractAddress: deploymentResult.fundAddress,
          contractCreationTxHash: deploymentResult.creationTxHash
        });

        // ===================================================================
        // STEP 3: Register with Kosher Capital API
        // ===================================================================
        logger('Registering with Kosher Capital API...');

        const apiResult = await kosherClient.quickDeploy({
          agentName: args.agentName!,
          contractCreationTxnHash: deploymentResult.creationTxHash!,
          creating_user_wallet_address: buyerAddress,
          paymentTxnHash: paymentTx.hash,
          deploySource: DEPLOYMENT_CONFIG.DEPLOYMENT_SOURCE,
          referralCode: args.referralCode,
        });

        if (!apiResult.success) {
          throw new Error(`Kosher Capital API failed: ${apiResult.error}`);
        }

        logger('Registration complete!');
        Logger.info(
          `${LOG_PREFIX.SUCCESS} Registration complete`,
          { apiResponse: apiResult.data }
        );

        // Update transaction as completed
        transactionTracker.updateTransaction(transaction.id, {
          status: 'completed' as any
        });

        // ===================================================================
        // STEP 4: Return deliverable
        // ===================================================================
        Logger.info(`${LOG_PREFIX.SUCCESS} Deployment complete for ${args.agentName}`);

        const deliverable: QuickDeployDeliverable = {
          success: true,
          agentName: args.agentName!,
          contractAddress: deploymentResult.fundAddress!,
          creationTxHash: deploymentResult.creationTxHash!,
          paymentTxHash: paymentTx.hash,
          apiResponse: apiResult.data,
          timestamp: new Date().toISOString(),
        };

        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Done,
          JSON.stringify(deliverable)
        );

      } catch (error) {
        const structuredError = ErrorFactory.fromUnknown(error);
        Logger.error(
          `${LOG_PREFIX.ERROR} Deployment failed:`,
          structuredError.toJSON()
        );

        // Update transaction as failed
        const transaction = transactionTracker.getTransactionByJobId(args.jobId!);
        if (transaction) {
          transactionTracker.updateTransaction(transaction.id, {
            status: 'failed' as any,
            error: structuredError.message
          });
        }

        // Return error response
        const errorDeliverable: QuickDeployDeliverable = {
          success: false,
          agentName: args.agentName || 'Unknown',
          error: structuredError.message,
          timestamp: new Date().toISOString(),
        };

        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          JSON.stringify(errorDeliverable)
        );
      }
    }
  });
}
