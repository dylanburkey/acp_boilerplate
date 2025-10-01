/**
 * @fileoverview Kosher Capital API client service
 * Encapsulates all interactions with the Kosher Capital Quick Deploy API
 * 
 * @author Athena AI Team
 * @license MIT
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { Logger } from '../../utils/logger';
import { 
  QuickDeployAPIRequest, 
  KosherCapitalAPIResponse,
  AsyncResult 
} from './types';
import { 
  APIError, 
  ServiceError, 
  TimeoutError,
  ErrorFactory,
  Validators 
} from './errors';
import { RetryUtil, CircuitBreaker, RateLimiter } from './retry';
import { API_CONFIG, LOG_PREFIX, ENV_KEYS } from './constants';

/**
 * Kosher Capital API client configuration
 */
interface KosherCapitalClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  enableCircuitBreaker?: boolean;
  enableRateLimiter?: boolean;
  rateLimitRequests?: number;
  rateLimitWindowMs?: number;
}

/**
 * Kosher Capital API client
 * Handles all interactions with the Kosher Capital Quick Deploy API
 */
export class KosherCapitalClient {
  private readonly logger = Logger;
  private readonly axiosInstance: AxiosInstance;
  private readonly circuitBreaker?: CircuitBreaker;
  private readonly rateLimiter?: RateLimiter;
  private readonly config: KosherCapitalClientConfig;

  constructor(config: KosherCapitalClientConfig) {
    // Validate configuration
    Validators.assert(!!config.apiKey, 'API key is required');
    
    this.config = {
      baseUrl: API_CONFIG.QUICK_DEPLOY_ENDPOINT,
      timeout: API_CONFIG.TIMEOUT_MS,
      maxRetries: API_CONFIG.MAX_RETRIES,
      enableCircuitBreaker: true,
      enableRateLimiter: true,
      rateLimitRequests: 100,
      rateLimitWindowMs: 60000, // 100 requests per minute
      ...config,
    };

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
    });

    // Add request/response interceptors
    this.setupInterceptors();

    // Initialize circuit breaker if enabled
    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker('kosher-capital-api', {
        failureThreshold: 5,
        resetTimeoutMs: 60000,
      });
    }

    // Initialize rate limiter if enabled
    if (this.config.enableRateLimiter) {
      this.rateLimiter = new RateLimiter(
        this.config.rateLimitRequests!,
        this.config.rateLimitWindowMs!
      );
    }

    this.logger.info(
      `${LOG_PREFIX.INIT} Kosher Capital API client initialized`,
      { baseUrl: this.config.baseUrl }
    );
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug(`${LOG_PREFIX.PROCESSING} API Request`, {
          method: config.method,
          url: config.url,
          data: config.data,
        });
        return config;
      },
      (error) => {
        this.logger.error(`${LOG_PREFIX.ERROR} API Request Error`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug(`${LOG_PREFIX.SUCCESS} API Response`, {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error: AxiosError) => {
        this.logger.error(`${LOG_PREFIX.ERROR} API Response Error`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(this.handleAxiosError(error));
      }
    );
  }

  /**
   * Handle axios errors and convert to structured errors
   */
  private handleAxiosError(error: AxiosError): Error {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new TimeoutError(
        'API request timed out',
        'kosher-capital-api',
        this.config.timeout
      );
    }

    if (!error.response) {
      return new ServiceError(
        'Network error - unable to reach API',
        'kosher-capital-api'
      );
    }

    const status = error.response.status;
    const data = error.response.data as any;

    // Handle specific status codes
    switch (status) {
      case 400:
        return new APIError(
          data?.error?.message || 'Bad request',
          this.config.baseUrl,
          status,
          data
        );
      
      case 401:
        return new APIError(
          'Unauthorized - invalid API key',
          this.config.baseUrl,
          status
        );
      
      case 403:
        return new APIError(
          'Forbidden - access denied',
          this.config.baseUrl,
          status
        );
      
      case 404:
        return new APIError(
          'Endpoint not found',
          this.config.baseUrl,
          status
        );
      
      case 429:
        return new ServiceError(
          'Rate limit exceeded',
          'kosher-capital-api',
          status
        );
      
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServiceError(
          `Server error: ${data?.error?.message || error.message}`,
          'kosher-capital-api',
          status
        );
      
      default:
        return new APIError(
          data?.error?.message || error.message,
          this.config.baseUrl,
          status,
          data
        );
    }
  }

  /**
   * Quick deploy an AI trading agent
   */
  async quickDeploy(request: QuickDeployAPIRequest): AsyncResult<KosherCapitalAPIResponse> {
    try {
      // Validate request
      this.validateQuickDeployRequest(request);

      // Apply rate limiting if enabled
      if (this.rateLimiter) {
        await this.rateLimiter.waitForSlot();
      }

      // Execute request with circuit breaker and retry logic
      const operation = async () => {
        const response = await this.axiosInstance.post<KosherCapitalAPIResponse>(
          '/api/v1/secure/fundDetails/quick-deploy',
          {
            ...request,
            is_token_fund: request.is_token_fund ?? true,
          }
        );

        // Validate response
        if (!response.data || typeof response.data !== 'object') {
          throw new APIError(
            'Invalid response format',
            this.config.baseUrl,
            response.status,
            response.data
          );
        }

        return response.data;
      };

      // Execute with circuit breaker if enabled
      const executeOperation = this.circuitBreaker
        ? () => this.circuitBreaker.execute(operation)
        : operation;

      // Execute with retry logic
      const result = await RetryUtil.withRetry(executeOperation, {
        maxAttempts: this.config.maxRetries,
        timeout: this.config.timeout,
        onRetry: (attempt, error) => {
          this.logger.warn(
            `${LOG_PREFIX.WARNING} Quick deploy retry attempt ${attempt}`,
            { error: error.message }
          );
        },
      });

      this.logger.info(
        `${LOG_PREFIX.SUCCESS} Quick deploy successful`,
        { agentName: request.agentName }
      );

      return {
        success: true,
        data: result,
      };

    } catch (error) {
      this.logger.error(
        `${LOG_PREFIX.ERROR} Quick deploy failed`,
        { error, request }
      );

      return {
        success: false,
        error: ErrorFactory.fromUnknown(error).message,
      };
    }
  }

  /**
   * Validate quick deploy request
   */
  private validateQuickDeployRequest(request: QuickDeployAPIRequest): void {
    // Validate required fields
    Validators.assert(
      !!request.agentName && request.agentName.trim().length > 0,
      'Agent name is required',
      'agentName',
      request.agentName
    );

    Validators.assert(
      Validators.isValidTxHash(request.contractCreationTxnHash),
      'Invalid contract creation transaction hash',
      'contractCreationTxnHash',
      request.contractCreationTxnHash
    );

    Validators.assert(
      Validators.isValidAddress(request.creating_user_wallet_address),
      'Invalid user wallet address',
      'creating_user_wallet_address',
      request.creating_user_wallet_address
    );

    Validators.assert(
      Validators.isValidTxHash(request.paymentTxnHash),
      'Invalid payment transaction hash',
      'paymentTxnHash',
      request.paymentTxnHash
    );

    Validators.assert(
      !!request.deploySource && request.deploySource.trim().length > 0,
      'Deploy source is required',
      'deploySource',
      request.deploySource
    );

    // Validate agent name format
    Validators.assert(
      Validators.isValidAgentName(request.agentName),
      'Agent name must be alphanumeric with optional hyphens/underscores (3-64 characters)',
      'agentName',
      request.agentName
    );
  }

  /**
   * Check API health
   */
  async checkHealth(): AsyncResult<{ healthy: boolean; latency?: number }> {
    try {
      const start = Date.now();
      
      const response = await this.axiosInstance.get('/health', {
        timeout: 5000, // 5 second timeout for health check
      });

      const latency = Date.now() - start;

      return {
        success: true,
        data: {
          healthy: response.status === 200,
          latency,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: 'API health check failed',
      };
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    if (!this.circuitBreaker) {
      return null;
    }

    return this.circuitBreaker.getStats();
  }

  /**
   * Get rate limiter usage
   */
  getRateLimiterUsage() {
    if (!this.rateLimiter) {
      return null;
    }

    return this.rateLimiter.getUsage();
  }

  /**
   * Create client instance from environment
   */
  static fromEnvironment(): KosherCapitalClient {
    const apiKey = process.env[ENV_KEYS.SHEKEL_API_KEY];
    
    if (!apiKey) {
      throw new Error(`${ENV_KEYS.SHEKEL_API_KEY} environment variable is required`);
    }

    return new KosherCapitalClient({ apiKey });
  }
}

/**
 * Singleton instance
 */
let clientInstance: KosherCapitalClient | null = null;

/**
 * Get or create Kosher Capital client instance
 */
export function getKosherCapitalClient(): KosherCapitalClient {
  if (!clientInstance) {
    clientInstance = KosherCapitalClient.fromEnvironment();
  }
  return clientInstance;
}
