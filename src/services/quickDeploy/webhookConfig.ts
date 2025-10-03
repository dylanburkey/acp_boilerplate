/**
 * @fileoverview Webhook configuration for automatic TX hash callbacks
 * This configuration enables automatic sending of transaction hashes to Kosher Capital
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { WebhookConfig } from './types';

/**
 * Default webhook configuration for Kosher Capital callbacks
 */
export const WEBHOOK_CONFIG: WebhookConfig = {
  // Webhook URL - should be provided by Kosher Capital
  url: process.env.KOSHER_CAPITAL_WEBHOOK_URL || '',
  
  // Custom headers for authentication
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.SHEKEL_API_KEY || '',
    'x-webhook-secret': process.env.WEBHOOK_SECRET || '',
  },
  
  // Retry configuration
  retryAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * Transaction monitor configuration
 */
export const TX_MONITOR_CONFIG = {
  // Enable automatic TX hash capture
  autoCapture: true,
  
  // Delay after blockchain confirmation before sending callback
  callbackDelay: 2000, // 2 seconds
  
  // Maximum retry attempts for webhook
  maxRetries: 3,
  
  // Webhook URL (can override default)
  webhookUrl: WEBHOOK_CONFIG.url,
};

/**
 * Pre-caching configuration for optimized deployments
 */
export const PRECACHE_CONFIG = {
  // Enable pre-caching of deployment data
  enabled: true,
  
  // Cache TTL in milliseconds
  ttl: 300000, // 5 minutes
  
  // Pre-generate agent names
  preGenerateNames: true,
  
  // Agent name prefix
  agentPrefix: 'ACP',
};

/**
 * Event monitoring configuration
 */
export const EVENT_MONITOR_CONFIG = {
  // Polling interval for events
  pollIntervalMs: 1000, // 1 second
  
  // Number of block confirmations to wait
  blockConfirmations: 2,
  
  // Maximum retries for event queries
  maxRetries: 5,
  
  // Events to monitor
  events: [
    'PersonalFundCreated',
    'Transfer',
    'TradingStatusChanged',
  ],
};

/**
 * Status feedback configuration
 */
export const STATUS_FEEDBACK_CONFIG = {
  // Enable real-time status updates
  enabled: true,
  
  // Update interval
  updateIntervalMs: 5000, // 5 seconds
  
  // Status webhook URL
  statusWebhookUrl: process.env.STATUS_WEBHOOK_URL || '',
  
  // Include detailed transaction data
  includeTransactionDetails: true,
};

/**
 * Get webhook configuration based on environment
 */
export function getWebhookConfig(): WebhookConfig {
  const config = { ...WEBHOOK_CONFIG };
  
  // Override with environment variables if set
  if (process.env.KOSHER_CAPITAL_WEBHOOK_URL) {
    config.url = process.env.KOSHER_CAPITAL_WEBHOOK_URL;
  }
  
  if (process.env.WEBHOOK_RETRY_ATTEMPTS) {
    config.retryAttempts = parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS, 10);
  }
  
  if (process.env.WEBHOOK_RETRY_DELAY_MS) {
    config.retryDelayMs = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS, 10);
  }
  
  return config;
}

/**
 * Validate webhook configuration
 */
export function validateWebhookConfig(config: WebhookConfig): boolean {
  if (!config.url || !config.url.startsWith('http')) {
    console.warn('Invalid or missing webhook URL');
    return false;
  }
  
  if (!config.headers || !config.headers['x-api-key']) {
    console.warn('Missing API key in webhook headers');
    return false;
  }
  
  return true;
}
