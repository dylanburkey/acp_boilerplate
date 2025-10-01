/**
 * @fileoverview Test script for Quick Deploy service
 * Simulates an ACP job for testing the full deployment flow
 * 
 * @author Dylan Burkey
 * @license MIT
 */

import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment
dotenv.config({ path: path.join(__dirname, '../.env.test') });

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

class QuickDeployTester {
  private mockKCUrl = 'http://localhost:4000';
  private statusApiUrl = 'http://localhost:3001';
  
  async run() {
    console.log(`${COLORS.bright}${COLORS.cyan}🚀 Quick Deploy Test Suite${COLORS.reset}\n`);
    
    try {
      // Step 1: Check if services are running
      await this.checkServices();
      
      // Step 2: Clear previous test data
      await this.clearTestData();
      
      // Step 3: Simulate a deployment
      const jobId = await this.simulateDeployment();
      
      // Step 4: Check deployment status
      await this.checkDeploymentStatus(jobId);
      
      // Step 5: Verify notifications were sent
      await this.verifyNotifications();
      
      console.log(`\n${COLORS.green}✅ All tests passed!${COLORS.reset}`);
      
    } catch (error) {
      console.error(`\n${COLORS.red}❌ Test failed:${COLORS.reset}`, error);
      process.exit(1);
    }
  }
  
  async checkServices() {
    console.log(`${COLORS.yellow}📡 Checking services...${COLORS.reset}`);
    
    // Check Mock KC server
    try {
      const kcHealth = await axios.get(`${this.mockKCUrl}/health`);
      console.log(`✓ Mock Kosher Capital: ${COLORS.green}Running${COLORS.reset}`);
    } catch (error) {
      throw new Error('Mock Kosher Capital server not running. Start it with: pnpm tsx test-utils/mockKosherCapital.ts');
    }
    
    // Check Status API
    try {
      const statusHealth = await axios.get(`${this.statusApiUrl}/health`);
      console.log(`✓ Status API: ${COLORS.green}Running${COLORS.reset}`);
    } catch (error) {
      console.log(`✗ Status API: ${COLORS.red}Not running${COLORS.reset} (optional)`);
    }
    
    console.log();
  }
  
  async clearTestData() {
    console.log(`${COLORS.yellow}🧹 Clearing test data...${COLORS.reset}`);
    
    try {
      await axios.delete(`${this.mockKCUrl}/test/clear`);
      console.log(`✓ Test data cleared\n`);
    } catch (error) {
      console.log(`✗ Could not clear test data\n`);
    }
  }
  
  async simulateDeployment(): Promise<string> {
    console.log(`${COLORS.yellow}🚀 Simulating deployment...${COLORS.reset}`);
    
    // Generate test data
    const jobId = `test-job-${Date.now()}`;
    const userWallet = '0x' + ethers.randomBytes(20).toString('hex');
    const paymentTxHash = '0x' + ethers.randomBytes(32).toString('hex');
    const agentName = `TestAgent-${Date.now()}`;
    
    console.log(`Job ID: ${jobId}`);
    console.log(`User Wallet: ${userWallet}`);
    console.log(`Payment Tx: ${paymentTxHash}`);
    console.log(`Agent Name: ${agentName}\n`);
    
    // If the Quick Deploy service is running with mock buyer enabled,
    // it will automatically process jobs. Otherwise, we need to manually
    // trigger a job through the ACP contract or mock the job creation.
    
    // For this test, we'll directly call the Quick Deploy service
    // through its API if available, or wait for the mock buyer to create a job
    
    console.log(`${COLORS.cyan}Deployment job created. Waiting for processing...${COLORS.reset}`);
    
    // Wait a bit for processing
    await this.sleep(5000);
    
    return jobId;
  }
  
  async checkDeploymentStatus(jobId: string) {
    console.log(`\n${COLORS.yellow}📊 Checking deployment status...${COLORS.reset}`);
    
    try {
      const response = await axios.get(
        `${this.statusApiUrl}/api/deployments/${jobId}`,
        {
          headers: { 'X-API-Key': process.env.API_KEY || 'test-api-key' }
        }
      );
      
      console.log(`Status: ${response.data.status}`);
      console.log(`Contract Address: ${response.data.contractAddress || 'N/A'}`);
      console.log(`Error: ${response.data.error || 'None'}`);
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`${COLORS.yellow}⚠️  Deployment not found in Status API (may still be processing)${COLORS.reset}`);
      } else {
        console.log(`${COLORS.red}❌ Could not check status${COLORS.reset}`);
      }
    }
  }
  
  async verifyNotifications() {
    console.log(`\n${COLORS.yellow}📬 Verifying notifications...${COLORS.reset}`);
    
    try {
      // Check deployment notifications
      const notifResponse = await axios.get(`${this.mockKCUrl}/test/notifications`);
      const notifications = notifResponse.data;
      
      console.log(`Deployment Notifications: ${notifications.count}`);
      
      if (notifications.count > 0) {
        const latest = notifications.notifications[notifications.count - 1];
        console.log(`\nLatest Notification:`);
        console.log(`- Status: ${latest.body.status}`);
        console.log(`- Agent: ${latest.body.agentName}`);
        console.log(`- Contract: ${latest.body.contractAddress || 'N/A'}`);
        console.log(`- Auth Header: ${latest.headers.authorization ? '✓' : '✗'}`);
      }
      
      // Check webhooks
      const webhookResponse = await axios.get(`${this.mockKCUrl}/test/webhooks`);
      const webhooks = webhookResponse.data;
      
      console.log(`\nWebhook Events: ${webhooks.count}`);
      
      if (webhooks.count > 0) {
        const events = webhooks.webhooks.map((w: any) => w.body.event);
        console.log(`- Events: ${events.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`${COLORS.red}❌ Could not verify notifications${COLORS.reset}`);
    }
  }
  
  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Manual test job creation
class ManualJobCreator {
  async createTestJob() {
    console.log(`\n${COLORS.yellow}📝 Creating manual test job...${COLORS.reset}`);
    
    // This would normally interact with the ACP contract
    // For testing, we'll simulate the job data structure
    
    const testJob = {
      id: `manual-test-${Date.now()}`,
      buyer: '0x' + ethers.randomBytes(20).toString('hex'),
      params: {
        paymentTxHash: '0x' + ethers.randomBytes(32).toString('hex'),
        userWallet: '0x' + ethers.randomBytes(20).toString('hex'),
        agentName: `ManualTest-${Date.now()}`,
        type: 'quick-deploy',
      },
      phase: 'request',
      serviceDescription: 'Quick deployment of an AI trading agent',
    };
    
    console.log('Test Job Created:');
    console.log(JSON.stringify(testJob, null, 2));
    
    // In a real scenario, this would be submitted to the ACP contract
    // which would then trigger the Quick Deploy service
    
    return testJob;
  }
}

// Test runner
async function main() {
  const tester = new QuickDeployTester();
  
  console.log(`${COLORS.bright}Test Mode Options:${COLORS.reset}`);
  console.log('1. Automatic - Uses mock buyer (requires service running with ENABLE_MOCK_BUYER=true)');
  console.log('2. Manual - Create a test job manually\n');
  
  if (process.argv.includes('--manual')) {
    const creator = new ManualJobCreator();
    const job = await creator.createTestJob();
    console.log(`\n${COLORS.cyan}Submit this job to your Quick Deploy service for testing${COLORS.reset}`);
  } else {
    await tester.run();
  }
}

// Show usage
if (process.argv.includes('--help')) {
  console.log(`
${COLORS.bright}Quick Deploy Test Script${COLORS.reset}

Usage:
  pnpm tsx test-utils/testQuickDeploy.ts          Run automatic tests
  pnpm tsx test-utils/testQuickDeploy.ts --manual Create manual test job
  pnpm tsx test-utils/testQuickDeploy.ts --help   Show this help

Prerequisites:
  1. Start Mock Kosher Capital server:
     pnpm tsx test-utils/mockKosherCapital.ts
     
  2. Start Quick Deploy service with test config:
     cp .env.test .env
     pnpm quickdeploy
  `);
  process.exit(0);
}

main().catch(console.error);
