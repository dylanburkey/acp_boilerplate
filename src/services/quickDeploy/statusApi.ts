/**
 * @fileoverview Status API for Quick Deploy service
 * Provides REST endpoints for Kosher Capital to check deployment status
 * 
 * @author Dylan Burkey
 * @license MIT
 */

import express, { Request, Response, NextFunction } from 'express';
import { transactionTracker } from './transactionTracker';
import { config } from '../../config';
import { Logger } from '../../utils/logger';

/**
 * Creates an Express app with status API endpoints
 * 
 * @returns {express.Application} Express app
 */
export function createStatusApi(): express.Application {
  const app = express();
  const logger = Logger;
  
  // Middleware
  app.use(express.json());
  
  // API Key authentication middleware
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!config.apiKey || apiKey === config.apiKey) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
  
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'QuickDeploy-ACP',
      timestamp: new Date().toISOString(),
    });
  });
  
  // Get deployment status by job ID
  app.get('/api/deployments/:jobId', authenticate, (req: Request, res: Response) => {
    const { jobId } = req.params;
    const transaction = transactionTracker.getTransactionByJobId(jobId);
    
    if (!transaction) {
      res.status(404).json({ error: 'Deployment not found' });
      return;
    }
    
    res.json({
      jobId,
      status: transaction.status,
      agentName: transaction.agentName,
      contractAddress: transaction.contractAddress,
      paymentTxHash: transaction.paymentTxHash,
      contractCreationTxHash: transaction.contractCreationTxHash,
      error: transaction.error,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      completedAt: transaction.completedAt,
    });
  });
  
  // Get all deployments (with pagination)
  app.get('/api/deployments', authenticate, (req: Request, res: Response) => {
    const { status, limit = '10', offset = '0' } = req.query;
    
    let transactions = Array.from(transactionTracker['transactionCache'].values());
    
    // Filter by status if provided
    if (status && typeof status === 'string') {
      transactions = transactions.filter(t => t.status === status);
    }
    
    // Sort by creation date (newest first)
    transactions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Pagination
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    const paginatedTransactions = transactions.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      total: transactions.length,
      limit: limitNum,
      offset: offsetNum,
      deployments: paginatedTransactions.map(t => ({
        jobId: t.jobId,
        status: t.status,
        agentName: t.agentName,
        contractAddress: t.contractAddress,
        createdAt: t.createdAt,
        error: t.error,
      })),
    });
  });
  
  // Get deployment statistics
  app.get('/api/statistics', authenticate, (req: Request, res: Response) => {
    const stats = transactionTracker.getStatistics();
    res.json(stats);
  });
  
  // Get deployment report
  app.get('/api/report', authenticate, (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const report = transactionTracker.generateReport(start, end);
    res.json(report);
  });
  
  // Retry failed deployments
  app.post('/api/deployments/:jobId/retry', authenticate, (req: Request, res: Response) => {
    const { jobId } = req.params;
    const transaction = transactionTracker.getTransactionByJobId(jobId);
    
    if (!transaction) {
      res.status(404).json({ error: 'Deployment not found' });
      return;
    }
    
    if (transaction.status !== 'failed') {
      res.status(400).json({ error: 'Only failed deployments can be retried' });
      return;
    }
    
    // Update transaction for retry
    transactionTracker.updateTransaction(transaction.id, {
      status: 'pending',
      retryCount: transaction.retryCount + 1,
    });
    
    logger.info(`Deployment ${jobId} marked for retry`);
    
    res.json({
      message: 'Deployment marked for retry',
      jobId,
      retryCount: transaction.retryCount + 1,
    });
  });
  
  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('API Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
  
  return app;
}

/**
 * Starts the status API server
 * 
 * @param {number} port - Port to listen on
 * @returns {Promise<void>}
 */
export async function startStatusApi(port: number = 3000): Promise<void> {
  const app = createStatusApi();
  const logger = Logger;
  
  app.listen(port, () => {
    logger.info(`Status API listening on port ${port}`);
    logger.info(`Health check: http://localhost:${port}/health`);
    logger.info(`Deployments: http://localhost:${port}/api/deployments`);
  });
}
