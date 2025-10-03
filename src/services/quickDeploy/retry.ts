/**
 * @fileoverview Retry utility with exponential backoff and circuit breaker
 * Provides resilient operation execution with retry logic
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { Logger } from '../../utils/logger';
import { ErrorHandler, TimeoutError } from './errors';
import { LOG_PREFIX } from './constants';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  timeout?: number;
  retryIf?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  monitoringPeriodMs?: number;
}

/**
 * Retry utility with exponential backoff
 */
export class RetryUtil {
  private static readonly logger = Logger;

  /**
   * Execute operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelayMs = 1000,
      maxDelayMs = 30000,
      backoffFactor = 2,
      timeout,
      retryIf = ErrorHandler.isRetryable,
      onRetry,
    } = options;

    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Execute with timeout if specified
        if (timeout) {
          return await this.withTimeout(operation(), timeout);
        }
        return await operation();
        
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt === maxAttempts || !retryIf(error)) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelayMs * Math.pow(backoffFactor, attempt - 1),
          maxDelayMs
        );
        
        this.logger.warn(
          `${LOG_PREFIX.WARNING} Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`,
          { error: (error as Error)?.message || error }
        );
        
        // Call retry callback if provided
        if (onRetry) {
          onRetry(attempt, error);
        }
        
        // Wait before retrying
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Execute operation with timeout
   */
  static async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          `Operation timed out after ${timeoutMs}ms`,
          'withTimeout',
          timeoutMs
        ));
      }, timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime?: Date;
  private successCount: number = 0;
  
  private readonly logger = Logger;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 60000; // 1 minute
    // monitoringPeriodMs is available but not currently used
    // Can be used for future monitoring features
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.info(`${LOG_PREFIX.INFO} Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // Close circuit after successful operations in half-open state
      if (this.successCount >= 3) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successCount = 0;
        this.logger.info(`${LOG_PREFIX.SUCCESS} Circuit breaker ${this.name} is now CLOSED`);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open on failure in half-open state
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      this.logger.warn(`${LOG_PREFIX.WARNING} Circuit breaker ${this.name} is now OPEN`);
    } else if (this.failures >= this.failureThreshold) {
      // Open circuit after threshold reached
      this.state = CircuitState.OPEN;
      this.logger.warn(
        `${LOG_PREFIX.WARNING} Circuit breaker ${this.name} opened after ${this.failures} failures`
      );
    }
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.resetTimeoutMs;
  }

  /**
   * Get circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Manual circuit reset
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.logger.info(`${LOG_PREFIX.INFO} Circuit breaker ${this.name} manually reset`);
  }
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private requests: number[] = [];
  
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  /**
   * Check if request is allowed
   */
  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove old requests outside window
    this.requests = this.requests.filter(time => time > windowStart);
    
    // Check if under limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }

  /**
   * Wait until request is allowed
   */
  async waitForSlot(): Promise<void> {
    while (!(await this.checkLimit())) {
      // Calculate wait time until next slot
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - Date.now() + 100; // Add small buffer
      await new Promise(resolve => setTimeout(resolve, Math.max(0, waitTime)));
    }
  }

  /**
   * Get current usage
   */
  getUsage(): { current: number; max: number; percentUsed: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const currentRequests = this.requests.filter(time => time > windowStart);
    
    return {
      current: currentRequests.length,
      max: this.maxRequests,
      percentUsed: (currentRequests.length / this.maxRequests) * 100,
    };
  }
}
