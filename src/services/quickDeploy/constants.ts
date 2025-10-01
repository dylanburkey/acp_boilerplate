/**
 * @fileoverview Constants for Quick Deploy service
 * Centralizes all configuration values and magic numbers
 * 
 * @author Athena AI Team
 * @license MIT
 */

// Contract Addresses (Base Network)
export const CONTRACT_ADDRESSES = {
  FACTORY: '0x0fE1eBa3e809CD0Fc34b6a3666754B7A042c169a',
  FACTORY_NEW: '0xA2BAB24e3c8cf0d68bF9B16039d7c7D3fBC032e7', // DO NOT USE
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  PAYMENT_RECIPIENT: '0x48597AfA1c4e7530CA8889bA9291494757FEABD2',
} as const;

// API Configuration
export const API_CONFIG = {
  QUICK_DEPLOY_ENDPOINT: 'https://parallax-analytics.onrender.com/api/v1/secure/fundDetails/quick-deploy',
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// Payment Configuration
export const PAYMENT_CONFIG = {
  DEFAULT_AMOUNT: 50,
  USDC_DECIMALS: 6,
  MIN_ETH_FOR_GAS: '0.01',
} as const;

// Transaction Configuration
export const TRANSACTION_CONFIG = {
  GAS_PRICE_MULTIPLIER: 1.1,
  CONFIRMATION_TIMEOUT_MS: 60000,
  CONFIRMATION_BLOCKS: 2,
} as const;

// ACP Configuration
export const ACP_CONFIG = {
  PAYMENT_AMOUNT_USDC: 50,
  JOB_PREFIX: 'acp-job',
  AGENT_PREFIX: 'ACP', // Per meeting: include "ACP" in agent names
  PAYMENT_RECIPIENT: '0x48597AfA1c4e7530CA8889bA9291494757FEABD2',
  PAYMENT_VERIFICATION_REQUIRED: true,
} as const;

// Deployment Configuration
export const DEPLOYMENT_CONFIG = {
  DEFAULT_AGENT_PREFIX: 'ACP',
  DEPLOYMENT_SOURCE: 'ACP',
  IS_TOKEN_FUND: true,
} as const;

// Status Values
export const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Error Types
export const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  SCOPE_ERROR: 'SCOPE_ERROR',
  SERVICE_ERROR: 'SERVICE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  MISSING_API_KEY: 'SHEKEL_API_KEY environment variable not configured.',
  INVALID_REQUEST: 'Invalid request - not a quick deploy request',
  MISSING_USER_WALLET: 'Missing required parameter: userWallet',
  PAYMENT_REQUIRED: 'Payment transaction hash required',
  INVALID_PAYMENT: 'Invalid payment transaction',
  INSUFFICIENT_BALANCE: 'Insufficient USDC balance',
  DEPLOYMENT_FAILED: 'Failed to deploy trading agent',
  CONTRACT_CREATION_FAILED: 'Failed to deploy agent contract',
  API_TIMEOUT: 'Request timeout - deployment took too long',
  API_UNAVAILABLE: 'Deployment API unavailable - no response received',
  WRONG_FACTORY_WARNING: 'Using NEW factory address - transcript says NOT to use this!',
} as const;

// Event Names
export const EVENTS = {
  PERSONAL_FUND_CREATED: 'PersonalFundCreated',
  TRANSFER: 'Transfer',
  TRADING_STATUS_CHANGED: 'TradingStatusChanged',
  AGENT_DEPLOYED: 'agent.deployed',
  DEPLOYMENT_FAILED: 'agent.deployment.failed',
} as const;

// Function Names
export const CONTRACT_FUNCTIONS = {
  CREATE_PERSONALIZED_FUNDS: 'createPersonalizedFunds',
  TRANSFER: 'transfer',
  SET_TRADING_ENABLED: 'setTradingEnabled',
  BALANCE_OF: 'balanceOf',
  GET_PERSONAL_FUND_CREATION_FEE: 'getPersonalFundCreationFee',
} as const;

// Request Types
export const REQUEST_TYPES = {
  QUICK_DEPLOY: 'quick-deploy',
  DEPLOY_AGENT: 'deploy-agent',
} as const;

// Environment Keys
export const ENV_KEYS = {
  SHEKEL_API_KEY: 'SHEKEL_API_KEY',
  SERVICE_PRICE: 'SERVICE_PRICE',
  FACTORY_CONTRACT_ADDRESS: 'FACTORY_CONTRACT_ADDRESS',
  ACP_RPC_URL: 'ACP_RPC_URL',
} as const;

// Logging Prefixes
export const LOG_PREFIX = {
  INIT: '🚀',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: '📋',
  PROCESSING: '⚙️',
  ACP: '🤖',
} as const;
