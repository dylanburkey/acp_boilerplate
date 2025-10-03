/**
 * @fileoverview Custom error handling for Quick Deploy service
 * Provides structured error classes and error handling utilities
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { ErrorCode } from './types';

/**
 * Base error class for Quick Deploy service
 */
export abstract class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly timestamp: Date;
  public readonly details?: any;

  constructor(code: ErrorCode, message: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.details = details;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Validation error - thrown when input validation fails
 */
export class ValidationError extends BaseError {
  constructor(message: string, field?: string, value?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, { field, value });
  }
}

/**
 * Processing error - thrown during job processing
 */
export class ProcessingError extends BaseError {
  constructor(message: string, jobId?: string, phase?: string) {
    super(ErrorCode.PROCESSING_ERROR, message, { jobId, phase });
  }
}

/**
 * Service error - thrown when external service fails
 */
export class ServiceError extends BaseError {
  constructor(message: string, service?: string, statusCode?: number) {
    super(ErrorCode.SERVICE_ERROR, message, { service, statusCode });
  }
}

/**
 * Contract error - thrown during blockchain operations
 */
export class ContractError extends BaseError {
  constructor(message: string, contractAddress?: string, method?: string, txHash?: string) {
    super(ErrorCode.CONTRACT_ERROR, message, { contractAddress, method, txHash });
  }
}

/**
 * API error - thrown when API calls fail
 */
export class APIError extends BaseError {
  constructor(message: string, endpoint?: string, statusCode?: number, response?: any) {
    super(ErrorCode.API_ERROR, message, { endpoint, statusCode, response });
  }
}

/**
 * Payment error - thrown for payment-related issues
 */
export class PaymentError extends BaseError {
  constructor(message: string, txHash?: string, amount?: string, reason?: string) {
    super(ErrorCode.PAYMENT_ERROR, message, { txHash, amount, reason });
  }
}

/**
 * Timeout error - thrown when operations exceed time limits
 */
export class TimeoutError extends BaseError {
  constructor(message: string, operation?: string, timeoutMs?: number) {
    super(ErrorCode.TIMEOUT_ERROR, message, { operation, timeoutMs });
  }
}

/**
 * Error factory to create appropriate error instances
 */
export class ErrorFactory {
  static validation(message: string, field?: string, value?: any): ValidationError {
    return new ValidationError(message, field, value);
  }

  static processing(message: string, jobId?: string, phase?: string): ProcessingError {
    return new ProcessingError(message, jobId, phase);
  }

  static service(message: string, service?: string, statusCode?: number): ServiceError {
    return new ServiceError(message, service, statusCode);
  }

  static contract(message: string, contractAddress?: string, method?: string, txHash?: string): ContractError {
    return new ContractError(message, contractAddress, method, txHash);
  }

  static api(message: string, endpoint?: string, statusCode?: number, response?: any): APIError {
    return new APIError(message, endpoint, statusCode, response);
  }

  static payment(message: string, txHash?: string, amount?: string, reason?: string): PaymentError {
    return new PaymentError(message, txHash, amount, reason);
  }

  static timeout(message: string, operation?: string, timeoutMs?: number): TimeoutError {
    return new TimeoutError(message, operation, timeoutMs);
  }

  /**
   * Convert unknown error to structured error
   */
  static fromUnknown(error: unknown, defaultMessage: string = 'An unexpected error occurred'): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    if (error instanceof Error) {
      return new ProcessingError(error.message || defaultMessage);
    }

    if (typeof error === 'string') {
      return new ProcessingError(error);
    }

    return new ProcessingError(defaultMessage, undefined, error as string);
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Handle error and return structured response
   */
  static handle(error: unknown): {
    success: false;
    error: {
      code: string;
      message: string;
      details?: any;
    };
  } {
    const structuredError = ErrorFactory.fromUnknown(error);
    
    return {
      success: false,
      error: {
        code: structuredError.code,
        message: structuredError.message,
        details: structuredError.details,
      },
    };
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    const structuredError = ErrorFactory.fromUnknown(error);
    
    // Network and timeout errors are retryable
    if (structuredError.code === ErrorCode.TIMEOUT_ERROR) return true;
    if (structuredError.code === ErrorCode.SERVICE_ERROR) return true;
    
    // Some contract errors might be retryable (e.g., gas estimation failures)
    if (structuredError.code === ErrorCode.CONTRACT_ERROR) {
      const details = structuredError.details;
      if (details?.message?.includes('gas')) return true;
      if (details?.message?.includes('nonce')) return true;
    }
    
    return false;
  }

  /**
   * Extract user-friendly message from error
   */
  static getUserMessage(error: unknown): string {
    const structuredError = ErrorFactory.fromUnknown(error);
    
    switch (structuredError.code) {
      case ErrorCode.VALIDATION_ERROR:
        return `Invalid input: ${structuredError.message}`;
      
      case ErrorCode.PAYMENT_ERROR:
        return `Payment issue: ${structuredError.message}`;
      
      case ErrorCode.TIMEOUT_ERROR:
        return 'The operation took too long. Please try again.';
      
      case ErrorCode.SERVICE_ERROR:
        return 'Service temporarily unavailable. Please try again later.';
      
      default:
        return 'An error occurred processing your request. Please try again.';
    }
  }
}

/**
 * Validation utilities
 */
export class Validators {
  /**
   * Validate Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate transaction hash
   */
  static isValidTxHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  /**
   * Validate private key format
   */
  static isValidPrivateKey(key: string): boolean {
    // Remove 0x prefix if present
    const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
    return /^[a-fA-F0-9]{64}$/.test(cleanKey);
  }

  /**
   * Validate agent name
   */
  static isValidAgentName(name: string): boolean {
    // Agent name should be alphanumeric with optional hyphens/underscores
    return /^[a-zA-Z0-9_-]+$/.test(name) && name.length >= 3 && name.length <= 64;
  }

  /**
   * Validate USDC amount
   */
  static isValidAmount(amount: string | number): boolean {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return !isNaN(numAmount) && numAmount > 0;
  }

  /**
   * Assert validation with error throwing
   */
  static assert(condition: boolean, message: string, field?: string, value?: any): asserts condition {
    if (!condition) {
      throw ErrorFactory.validation(message, field, value);
    }
  }
}
