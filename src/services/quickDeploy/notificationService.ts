/**
 * @fileoverview Notification service for sending deployment results back to Kosher Capital
 * This handles the callback mechanism to inform Kosher Capital about deployment status
 * 
 * @author Athena AI Team
 * @license MIT
 */

import axios, { AxiosResponse } from 'axios';
import { config } from '../../config';
import { Logger } from '../../utils/logger';

/**
 * Interface for deployment notification data
 */
export interface DeploymentNotification {
  /** ACP Job ID */
  jobId: string;
  /** Deployment status */
  status: 'success' | 'failed';
  /** Agent name */
  agentName: string;
  /** Payment transaction hash */
  paymentTxHash: string;
  /** Contract creation transaction hash */
  contractCreationTxHash?: string;
  /** Deployed contract address */
  contractAddress?: string;
  /** User's wallet address */
  userWallet: string;
  /** Error message if failed */
  error?: string;
  /** Deployment timestamp */
  timestamp: string;
  /** Deployment source */
  deploymentSource: 'ACP';
}

/**
 * Interface for callback configuration
 */
interface CallbackConfig {
  /** Callback URL for notifications */
  url?: string;
  /** Authentication method */
  authMethod?: 'bearer' | 'apikey' | 'none';
  /** Authentication token/key */
  authToken?: string;
  /** Retry attempts */
  maxRetries: number;
  /** Timeout in milliseconds */
  timeout: number;
}

/**
 * Service for notifying Kosher Capital about deployment results
 */
export class KosherCapitalNotificationService {
  /** Logger instance */
  private readonly logger = Logger;
  
  /** Callback configuration */
  private readonly callbackConfig: CallbackConfig;
  
  constructor() {
    // Load callback configuration from environment
    this.callbackConfig = {
      url: process.env.KOSHER_CAPITAL_CALLBACK_URL,
      authMethod: (process.env.KOSHER_CAPITAL_AUTH_METHOD || 'bearer') as 'bearer' | 'apikey' | 'none',
      authToken: process.env.KOSHER_CAPITAL_CALLBACK_TOKEN || config.apiKey,
      maxRetries: parseInt(process.env.CALLBACK_MAX_RETRIES || '3'),
      timeout: parseInt(process.env.CALLBACK_TIMEOUT || '30000'),
    };
    
    this.logger.info('KosherCapitalNotificationService initialized');
    if (!this.callbackConfig.url) {
      this.logger.warn('No callback URL configured - notifications will be skipped');
    }
  }

  /**
   * Sends deployment notification to Kosher Capital
   * 
   * @param {DeploymentNotification} notification - Deployment details
   * @returns {Promise<boolean>} True if notification sent successfully
   */
  async notifyDeploymentResult(notification: DeploymentNotification): Promise<boolean> {
    if (!this.callbackConfig.url) {
      this.logger.info('Skipping notification - no callback URL configured');
      return true;
    }

    this.logger.info(`Sending deployment notification for job ${notification.jobId}`);
    
    let attempts = 0;
    while (attempts < this.callbackConfig.maxRetries) {
      try {
        const response = await this.sendNotification(notification);
        
        if (response.status >= 200 && response.status < 300) {
          this.logger.info(`Notification sent successfully for job ${notification.jobId}`);
          return true;
        } else {
          this.logger.warn(`Notification failed with status ${response.status}`);
        }
      } catch (error) {
        this.logger.error(`Error sending notification (attempt ${attempts + 1}):`, error);
      }
      
      attempts++;
      
      // Exponential backoff for retries
      if (attempts < this.callbackConfig.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
        this.logger.info(`Retrying notification in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    
    this.logger.error(`Failed to send notification after ${attempts} attempts`);
    return false;
  }

  /**
   * Sends the actual HTTP notification
   * 
   * @param {DeploymentNotification} notification - Deployment details
   * @returns {Promise<AxiosResponse>} HTTP response
   * @private
   */
  private async sendNotification(notification: DeploymentNotification): Promise<AxiosResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ACP-Agent/QuickDeploy-Notification',
    };

    // Add authentication headers based on method
    if (this.callbackConfig.authToken) {
      switch (this.callbackConfig.authMethod) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${this.callbackConfig.authToken}`;
          break;
        case 'apikey':
          headers['X-API-Key'] = this.callbackConfig.authToken;
          break;
        // 'none' - no auth header
      }
    }

    const response = await axios.post(
      this.callbackConfig.url!,
      notification,
      {
        headers,
        timeout: this.callbackConfig.timeout,
        validateStatus: () => true, // Don't throw on HTTP error status
      }
    );

    if (config.logApiOutput) {
      this.logger.logApiData('Notification response:', {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  }

  /**
   * Creates a deployment notification object
   * 
   * @param {string} jobId - ACP Job ID
   * @param {any} deploymentResult - Result from quick deploy service
   * @param {string} userWallet - User's wallet address
   * @param {string} paymentTxHash - Payment transaction hash
   * @returns {DeploymentNotification} Notification object
   */
  createDeploymentNotification(
    jobId: string,
    deploymentResult: any,
    userWallet: string,
    paymentTxHash: string
  ): DeploymentNotification {
    if (deploymentResult.success) {
      return {
        jobId,
        status: 'success',
        agentName: deploymentResult.data.agentName,
        paymentTxHash,
        contractCreationTxHash: deploymentResult.data.deploymentTxHash,
        contractAddress: deploymentResult.data.contractAddress,
        userWallet,
        timestamp: new Date().toISOString(),
        deploymentSource: 'ACP',
      };
    } else {
      return {
        jobId,
        status: 'failed',
        agentName: deploymentResult.data?.agentName || 'Unknown',
        paymentTxHash,
        userWallet,
        error: deploymentResult.error || 'Unknown error',
        timestamp: new Date().toISOString(),
        deploymentSource: 'ACP',
      };
    }
  }

  /**
   * Sends a webhook event for tracking purposes
   * This can be used to track deployment metrics
   * 
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @returns {Promise<void>}
   */
  async sendWebhookEvent(event: string, data: any): Promise<void> {
    const webhookUrl = process.env.KOSHER_CAPITAL_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    try {
      await axios.post(
        webhookUrl,
        {
          event,
          data,
          timestamp: new Date().toISOString(),
          source: 'ACP-QuickDeploy',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
          },
          timeout: 5000,
        }
      );
      
      this.logger.info(`Webhook event '${event}' sent successfully`);
    } catch (error) {
      // Don't fail the main process if webhook fails
      this.logger.warn(`Failed to send webhook event '${event}':`, error);
    }
  }

  /**
   * Helper function to sleep
   * 
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const notificationService = new KosherCapitalNotificationService();
