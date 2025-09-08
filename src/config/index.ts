import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration interface for ACP integration
 */
export interface Config {
  // Core configuration
  gameApiKey: string;
  whitelistedWalletPrivateKey: string;
  agentWalletAddress: string;
  
  // Service configuration
  serviceName: string;
  serviceDescription: string;
  apiEndpoint: string;
  apiKey?: string;
  servicePrice: number;
  
  // ACP configuration
  acpRpcUrl: string;
  acpChainId: number;
  acpContractAddress: string;
  
  // Performance settings
  acpProcessingDelay: number;
  acpMaxRetries: number;
  gasPriceMultiplier: number;
  maxGasPrice: number;
  txConfirmationTimeout: number;
  
  // Service Level Agreement (SLA)
  jobExpirationHours: number;
  enableJobExpiration: boolean;
  
  // Environment
  environment: 'sandbox' | 'production';
  sandboxTransactionCount: number;
  
  // Logging
  logLevel: string;
  logApiOutput: boolean;
  enableTxMonitoring: boolean;
  
  // Mock testing
  enableMockBuyer: boolean;
  mockBuyerInterval: number;
  
  // State management
  keepCompletedJobs: number;
  keepCancelledJobs: number;
  ignoredJobIds: string[];
}

/**
 * Validates that all required environment variables are set
 */
function validateConfig(): void {
  const required = [
    'GAME_API_KEY',
    'WHITELISTED_WALLET_PRIVATE_KEY',
    'AGENT_WALLET_ADDRESS',
    'SERVICE_NAME',
    'SERVICE_DESCRIPTION',
    'API_ENDPOINT'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in all required values.'
    );
  }
}

/**
 * Loads and validates configuration from environment variables
 */
export function loadConfig(): Config {
  validateConfig();
  
  return {
    // Core configuration
    gameApiKey: process.env.GAME_API_KEY!,
    whitelistedWalletPrivateKey: process.env.WHITELISTED_WALLET_PRIVATE_KEY!,
    agentWalletAddress: process.env.AGENT_WALLET_ADDRESS!,
    
    // Service configuration
    serviceName: process.env.SERVICE_NAME!,
    serviceDescription: process.env.SERVICE_DESCRIPTION!,
    apiEndpoint: process.env.API_ENDPOINT!,
    apiKey: process.env.API_KEY,
    servicePrice: parseFloat(process.env.SERVICE_PRICE || '0.001'),
    
    // ACP configuration
    acpRpcUrl: process.env.ACP_RPC_URL || 'https://base.llamarpc.com',
    acpChainId: parseInt(process.env.ACP_CHAIN_ID || '8453'),
    acpContractAddress: process.env.ACP_CONTRACT_ADDRESS || '0xC6e864B52203da6593C83fD18E4c1212D088F61F',
    
    // Performance settings
    acpProcessingDelay: parseInt(process.env.ACP_PROCESSING_DELAY || '3000'),
    acpMaxRetries: parseInt(process.env.ACP_MAX_RETRIES || '3'),
    gasPriceMultiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER || '1.1'),
    maxGasPrice: parseInt(process.env.MAX_GAS_PRICE || '100'),
    txConfirmationTimeout: parseInt(process.env.TX_CONFIRMATION_TIMEOUT || '60000'),
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    logApiOutput: process.env.LOG_API_OUTPUT === 'true',
    enableTxMonitoring: process.env.ENABLE_TX_MONITORING !== 'false',
    
    // Mock testing
    enableMockBuyer: process.env.ENABLE_MOCK_BUYER === 'true',
    mockBuyerInterval: parseInt(process.env.MOCK_BUYER_INTERVAL || '30000'),
    
    // State management
    keepCompletedJobs: parseInt(process.env.KEEP_COMPLETED_JOBS || '5'),
    keepCancelledJobs: parseInt(process.env.KEEP_CANCELLED_JOBS || '5'),
    ignoredJobIds: process.env.IGNORED_JOB_IDS?.split(',').filter(Boolean) || [],
    
    // Service Level Agreement (SLA)
    jobExpirationHours: parseInt(process.env.JOB_EXPIRATION_HOURS || '24'),
    enableJobExpiration: process.env.ENABLE_JOB_EXPIRATION !== 'false',
    
    // Environment
    environment: (process.env.ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    sandboxTransactionCount: parseInt(process.env.SANDBOX_TRANSACTION_COUNT || '0')
  };
}

// Export a singleton instance
export const config = loadConfig();