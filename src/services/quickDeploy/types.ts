/**
 * @fileoverview Type definitions for Quick Deploy ACP integration
 * Centralizes all TypeScript interfaces and types for the service
 * 
 * @author Dylan Burkey
 * @license MIT
 */

import { AcpJob } from '@virtuals-protocol/acp-node';

// ==================== ACP Related Types ====================

/**
 * Service types supported by the Quick Deploy service
 */
export enum ServiceType {
  QUICK_DEPLOY = 'quick-deploy',
  DEPLOY_AGENT = 'deploy-agent',
}

/**
 * Service requirement structure for Quick Deploy jobs via ACP
 */
export interface QuickDeployServiceRequirement {
  type: ServiceType.QUICK_DEPLOY;
  agentName?: string;
  aiWallet?: string;
  metadata?: DeploymentMetadata;
}

/**
 * Metadata for deployment requests
 */
export interface DeploymentMetadata {
  referralCode?: string;
  source?: string;
  requestedFeatures?: string[];
  [key: string]: any;
}

/**
 * Deliverable structure for completed deployments
 */
export interface QuickDeployDeliverable {
  success: boolean;
  agentName: string;
  contractAddress?: string;
  creationTxHash?: string;
  paymentTxHash?: string;
  apiResponse?: KosherCapitalAPIResponse;
  deploymentTimestamp?: number;
  gasUsed?: string;
  error?: string;
  timestamp: string;
}

/**
 * Enhanced deliverable with callback status
 */
export interface EnhancedQuickDeployDeliverable extends QuickDeployDeliverable {
  callbackSent?: boolean;
  webhookResponse?: any;
  preCacheUsed?: boolean;
}

/**
 * Webhook configuration for callbacks
 */
export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  retryAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Enhanced deployment metadata with callback info
 */
export interface EnhancedDeploymentMetadata extends DeploymentMetadata {
  webhookUrl?: string;
  autoCaptureTxHash?: boolean;
  preCachedData?: {
    agentName: string;
    estimatedGas: string;
    nonce: number;
  };
}

// ==================== Transaction Types ====================

/**
 * Transaction status enum
 */
export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Transaction record structure
 */
export interface TransactionRecord {
  id: string;
  jobId?: string;
  paymentTxHash: string;
  contractCreationTxHash?: string;
  userWallet: string;
  agentName: string;
  status: TransactionStatus;
  contractAddress?: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

// ==================== Deployment Types ====================

/**
 * Parameters required for agent deployment
 */
export interface DeploymentParams {
  userWallet: string;
  agentName: string;
  aiWallet?: string;
  paymentTxHash?: string;
  referralCode?: string;
}

/**
 * Result from contract deployment
 */
export interface DeploymentResult {
  success: boolean;
  fundAddress?: string;
  creationTxHash?: string;
  paymentTxHash?: string;
  enableTxHash?: string;
  gasUsed?: string;
  error?: string;
}

/**
 * Contract deployment transaction result
 */
export interface ContractDeploymentTx {
  hash: string;
  blockNumber: number;
  gasUsed: string;
  effectiveGasPrice: string;
  from: string;
  to: string;
  status: number;
}

// ==================== Kosher Capital API Types ====================

/**
 * Request structure for Kosher Capital Quick Deploy API
 */
export interface QuickDeployAPIRequest {
  agentName: string;
  contractCreationTxnHash: string;
  creating_user_wallet_address: string;
  paymentTxnHash: string;
  deploySource: string;
  referralCode?: string;
  is_token_fund?: boolean;
}

/**
 * Response from Kosher Capital API
 */
export interface KosherCapitalAPIResponse {
  success: boolean;
  data?: {
    agentId: string;
    contractAddress: string;
    deploymentHash: string;
    [key: string]: any;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ==================== Notification Types ====================

/**
 * Notification structure
 */
export interface DeploymentNotification {
  jobId: string;
  transactionId?: string;
  type: 'deployment.success' | 'deployment.failed' | 'payment.received' | 'payment.failed';
  data: any;
  userWallet: string;
  agentName?: string;
  timestamp: string;
  webhookUrl?: string;
}

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  event: string;
  data: {
    jobId: string;
    transactionId?: string;
    result: DeploymentResult | any;
    metadata?: any;
  };
  timestamp: string;
  signature?: string;
}

// ==================== Event Types ====================

/**
 * Contract event types
 */
export enum ContractEvent {
  PERSONAL_FUND_CREATED = 'PersonalFundCreated',
  TRANSFER = 'Transfer',
  TRADING_STATUS_CHANGED = 'TradingStatusChanged',
}

/**
 * Event monitoring configuration
 */
export interface EventMonitorConfig {
  pollIntervalMs: number;
  maxRetries: number;
  blockConfirmations: number;
  startBlock?: number;
}

/**
 * Monitored event data
 */
export interface MonitoredEvent {
  eventName: ContractEvent;
  transactionHash: string;
  blockNumber: number;
  args: any;
  timestamp: number;
}

// ==================== Error Types ====================

/**
 * Error codes for the service
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  SCOPE_ERROR = 'SCOPE_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  API_ERROR = 'API_ERROR',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
}

/**
 * Custom error class for Quick Deploy service
 */
export class QuickDeployError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'QuickDeployError';
  }
}

// ==================== Configuration Types ====================

/**
 * Service configuration
 */
export interface QuickDeployConfig {
  apiKey: string;
  apiEndpoint: string;
  contractAddresses: ContractAddresses;
  paymentConfig: PaymentConfig;
  deploymentDefaults: DeploymentDefaults;
  acpConfig?: ACPConfig;
}

/**
 * Contract addresses configuration
 */
export interface ContractAddresses {
  factory: string;
  usdc: string;
  paymentRecipient: string;
}

/**
 * Payment configuration
 */
export interface PaymentConfig {
  amount: number;
  tokenDecimals: number;
  minGasBalance: string;
}

/**
 * Deployment default values
 */
export interface DeploymentDefaults {
  agentPrefix: string;
  deploymentSource: string;
  isTokenFund: boolean;
}

/**
 * ACP specific configuration
 */
export interface ACPConfig {
  entityId: string;
  agentWallet: string;
  rpcUrl?: string;
  graduationStatus?: 'GRADUATED' | 'PRE_GRADUATED';
}

// ==================== Utility Types ====================

/**
 * Async function result wrapper
 */
export type AsyncResult<T> = Promise<{
  success: boolean;
  data?: T;
  error?: string;
}>;

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ==================== Status API Types ====================

/**
 * Status query parameters
 */
export interface StatusQueryParams {
  jobId?: string;
  transactionId?: string;
  userWallet?: string;
  status?: TransactionStatus;
  pagination?: PaginationParams;
}

/**
 * Status response
 */
export interface StatusResponse {
  job?: AcpJob;
  transaction?: TransactionRecord;
  deployment?: DeploymentResult;
  notifications?: DeploymentNotification[];
}

// ==================== Type Guards ====================

/**
 * Type guard for QuickDeployServiceRequirement
 */
export function isQuickDeployRequest(req: any): req is QuickDeployServiceRequirement {
  return req?.type === ServiceType.QUICK_DEPLOY;
}

/**
 * Type guard for successful deployment
 */
export function isSuccessfulDeployment(result: DeploymentResult): result is Required<DeploymentResult> {
  return result.success && !!result.fundAddress && !!result.creationTxHash;
}

/**
 * Type guard for error response
 */
export function isErrorResponse(response: any): response is { error: string } {
  return !!response?.error;
}
