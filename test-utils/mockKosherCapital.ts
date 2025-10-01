/**
 * @fileoverview Mock Kosher Capital server for testing callbacks
 * This simulates Kosher Capital's API endpoints for receiving deployment notifications
 * 
 * @author Dylan Burkey
 * @license MIT
 */

import express from 'express';
import { Logger } from '../src/utils/logger';

const app = express();
const logger = Logger;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  logger.info(`[MOCK KC] ${req.method} ${req.path}`);
  logger.info(`[MOCK KC] Headers:`, req.headers);
  logger.info(`[MOCK KC] Body:`, req.body);
  next();
});

// Store received notifications for inspection
const receivedNotifications: any[] = [];
const receivedWebhooks: any[] = [];

// Mock Quick Deploy API endpoint
app.post('/api/v1/secure/fundDetails/quick-deploy', (req, res) => {
  logger.info('[MOCK KC] Quick Deploy API called');
  
  const { name, paymentTxnHash, contractCreationTxnHash, creatingUserWallet } = req.body;
  
  // Validate request
  if (!name || !paymentTxnHash || !contractCreationTxnHash || !creatingUserWallet) {
    logger.error('[MOCK KC] Missing required fields');
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['name', 'paymentTxnHash', 'contractCreationTxnHash', 'creatingUserWallet']
    });
  }
  
  // Simulate successful deployment
  const response = {
    success: true,
    contractAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
    deploymentTxHash: contractCreationTxnHash,
    agentId: Math.floor(Math.random() * 100000),
    message: 'Trading agent deployed successfully',
    details: {
      name,
      network: 'base',
      deployedAt: new Date().toISOString(),
    }
  };
  
  logger.info('[MOCK KC] Deployment successful:', response);
  res.json(response);
});

// Mock callback endpoint for deployment notifications
app.post('/webhooks/acp/deployment', (req, res) => {
  logger.info('[MOCK KC] Deployment notification received');
  
  // Check authentication
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];
  
  logger.info(`[MOCK KC] Auth - Bearer: ${authHeader}, API Key: ${apiKey}`);
  
  // Store notification
  receivedNotifications.push({
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body,
  });
  
  // Simulate processing
  if (req.body.status === 'success') {
    logger.info('[MOCK KC] Deployment notification processed successfully');
    logger.info(`[MOCK KC] Agent: ${req.body.agentName}, Contract: ${req.body.contractAddress}`);
  } else {
    logger.warn('[MOCK KC] Deployment failed:', req.body.error);
  }
  
  res.json({ received: true, processed: true });
});

// Mock webhook endpoint for events
app.post('/webhooks/acp/events', (req, res) => {
  logger.info('[MOCK KC] Event webhook received:', req.body.event);
  
  receivedWebhooks.push({
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body,
  });
  
  res.json({ received: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Mock Kosher Capital',
    notifications: receivedNotifications.length,
    webhooks: receivedWebhooks.length,
  });
});

// Get received notifications (for testing)
app.get('/test/notifications', (req, res) => {
  res.json({
    count: receivedNotifications.length,
    notifications: receivedNotifications,
  });
});

// Get received webhooks (for testing)
app.get('/test/webhooks', (req, res) => {
  res.json({
    count: receivedWebhooks.length,
    webhooks: receivedWebhooks,
  });
});

// Clear test data
app.delete('/test/clear', (req, res) => {
  receivedNotifications.length = 0;
  receivedWebhooks.length = 0;
  res.json({ cleared: true });
});

// Start server
const PORT = process.env.MOCK_KC_PORT || 4000;

app.listen(PORT, () => {
  logger.info(`[MOCK KC] Mock Kosher Capital server listening on port ${PORT}`);
  logger.info(`[MOCK KC] Quick Deploy API: http://localhost:${PORT}/api/v1/secure/fundDetails/quick-deploy`);
  logger.info(`[MOCK KC] Deployment Callbacks: http://localhost:${PORT}/webhooks/acp/deployment`);
  logger.info(`[MOCK KC] Event Webhooks: http://localhost:${PORT}/webhooks/acp/events`);
  logger.info(`[MOCK KC] View notifications: http://localhost:${PORT}/test/notifications`);
});

export default app;
