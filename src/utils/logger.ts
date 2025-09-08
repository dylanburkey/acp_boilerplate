/**
 * Logger utility that provides conditional logging based on environment variables
 * Prevents sensitive data exposure in production environments
 */

export class Logger {
  private static shouldLogApiOutput(): boolean {
    // Default to false for security
    const logApiOutput = process.env.LOG_API_OUTPUT?.toLowerCase().trim();
    // Only accept explicit 'true', everything else is false
    return logApiOutput === 'true';
  }

  /**
   * Log general information
   */
  static log(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(message, ...args);
  }

  /**
   * Log info messages (alias for log)
   */
  static info(message: string, ...args: unknown[]): void {
    this.log(message, ...args);
  }

  /**
   * Log API-related data only if LOG_API_OUTPUT is true
   * Use this for any data that might contain sensitive information
   */
  static logApiData(message: string, data?: unknown): void {
    if (this.shouldLogApiOutput()) {
      if (data !== undefined) {
        // eslint-disable-next-line no-console
        console.log(message, data);
      } else {
        // eslint-disable-next-line no-console
        console.log(message);
      }
    } else if (process.env.NODE_ENV === 'development' && process.env.LOG_API_OUTPUT !== 'false') {
      // Only show placeholder in development if LOG_API_OUTPUT is not explicitly set to false
      // This prevents accidental exposure even in development
      const hasData = data !== undefined ? ' (with data)' : '';
      // eslint-disable-next-line no-console
      console.log(`${message}${hasData} [data hidden - set LOG_API_OUTPUT=true to see details]`);
    }
  }

  /**
   * Log error messages (always logged)
   */
  static error(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  }

  /**
   * Log warning messages (always logged)
   */
  static warn(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn(message, ...args);
  }

  /**
   * Log debug messages only in development
   */
  static debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      // eslint-disable-next-line no-console
      console.log('[DEBUG]', message, ...args);
    }
  }
}
