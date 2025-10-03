/**
 * @fileoverview Main entry point for Quick Deploy ACP Seller Agent
 * Registers as an ACP seller agent to offer AI trading agent deployment services
 * 
 * @author Dylan Burkey
 * @license MIT
 */

import dotenv from 'dotenv';
import { QuickDeployACPAgent } from './services/quickDeploy/acpSellerAgent';
import { startStatusApi } from './services/quickDeploy/statusApi';
import { Logger } from './utils/logger';

// Load environment variables
dotenv.config();

const logger = Logger;

/**
 * Main function to start the Quick Deploy ACP Seller Agent
 */
async function main() {
  try {
    logger.info('🚀 Starting Quick Deploy ACP Seller Agent...');
    
    // Validate environment
    validateEnvironment();
    
    // Initialize ACP seller agent
    const acpAgent = new QuickDeployACPAgent();
    await acpAgent.initialize();
    
    // Start status API if enabled
    if (process.env.STATUS_API_ENABLED === 'true') {
      const statusPort = parseInt(process.env.STATUS_API_PORT || '3001');
      await startStatusApi(statusPort);
    }
    
    logger.info('✅ Quick Deploy ACP Seller Agent is running');
    logger.info('🔄 Waiting for job requests from ACP network...');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down gracefully...');
      await acpAgent.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Shutting down gracefully...');
      await acpAgent.shutdown();
      process.exit(0);
    });
    
    // Keep the process running
    await new Promise(() => {});
    
  } catch (error) {
    logger.error('Failed to start Quick Deploy ACP Seller Agent:', error);
    process.exit(1);
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const required = [
    'WHITELISTED_WALLET_PRIVATE_KEY',
    'WHITELISTED_WALLET_ENTITY_ID', 
    'SELLER_AGENT_WALLET_ADDRESS',
    'SHEKEL_API_KEY',
    'ACP_RPC_URL',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate formats
  const privateKey = process.env.WHITELISTED_WALLET_PRIVATE_KEY;
  if (privateKey && !privateKey.match(/^(0x)?[a-fA-F0-9]{64}$/)) {
    throw new Error('Invalid WHITELISTED_WALLET_PRIVATE_KEY format');
  }
  
  const walletAddress = process.env.SELLER_AGENT_WALLET_ADDRESS;
  if (walletAddress && !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error('Invalid SELLER_AGENT_WALLET_ADDRESS format');
  }
  
  const entityId = process.env.WHITELISTED_WALLET_ENTITY_ID;
  if (entityId && isNaN(parseInt(entityId))) {
    throw new Error('Invalid WHITELISTED_WALLET_ENTITY_ID - must be a number');
  }
  
  logger.info('✅ Environment validation passed');
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { QuickDeployACPAgent };
