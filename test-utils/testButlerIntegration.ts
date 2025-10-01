/**
 * @fileoverview Test script for Butler integration with Quick Deploy
 * Simulates how Butler would interact with the Quick Deploy service
 * 
 * @author Athena AI Team
 * @license MIT
 */

import { ethers } from 'ethers';
import axios from 'axios';

// Types
interface ButlerJobRequest {
  jobId: string;
  buyer: string;
  params: {
    userWallet: string;
    paymentTxHash?: string;
    agentName?: string;
    executeOnChain?: boolean;
  };
}

// Configuration
const CONFIG = {
  quickDeployUrl: process.env.QUICK_DEPLOY_URL || 'http://localhost:3000',
  statusApiUrl: process.env.STATUS_API_URL || 'http://localhost:3001',
  mockPaymentTx: '0x' + '0'.repeat(63) + '1', // Mock payment TX hash
};

/**
 * Simulates Butler creating a job after user payment
 */
async function createButlerJob(userWallet: string, paymentTxHash: string): Promise<ButlerJobRequest> {
  const timestamp = Date.now();
  const jobId = `butler-job-${timestamp}`;
  
  return {
    jobId,
    buyer: userWallet,
    params: {
      userWallet,
      paymentTxHash,
      agentName: `ACP-${timestamp}`, // Auto-generated with ACP prefix
      executeOnChain: false, // Butler already handled payment
    },
  };
}

/**
 * Simulates Butler payment processing
 * In production, Butler would handle the actual 50 USDC transfer
 */
async function simulateButlerPayment(userWallet: string): Promise<string> {
  console.log(`\n💰 Butler: Processing 50 USDC payment from ${userWallet}`);
  console.log('   - Initiating USDC transfer...');
  console.log('   - Waiting for confirmation...');
  
  // In production, this would be a real blockchain transaction
  const mockPaymentTx = `0x${ethers.keccak256(ethers.toUtf8Bytes(userWallet + Date.now())).slice(2)}`;
  
  console.log(`   ✅ Payment confirmed: ${mockPaymentTx}`);
  return mockPaymentTx;
}

/**
 * Monitors deployment status (as Butler would)
 */
async function monitorDeployment(jobId: string): Promise<void> {
  console.log(`\n📊 Butler: Monitoring deployment ${jobId}`);
  
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(`${CONFIG.statusApiUrl}/api/deployments/${jobId}`);
      const deployment = response.data.data;
      
      console.log(`   Status: ${deployment.status}`);
      
      if (deployment.status === 'completed') {
        console.log(`   ✅ Deployment successful!`);
        console.log(`   - Agent: ${deployment.agentName}`);
        console.log(`   - Contract: ${deployment.contractAddress}`);
        console.log(`   - TX Hash: ${deployment.contractCreationTxHash}`);
        return;
      } else if (deployment.status === 'failed') {
        console.log(`   ❌ Deployment failed: ${deployment.error}`);
        return;
      }
      
      await sleep(2000);
      attempts++;
    } catch (error) {
      console.log(`   ⏳ Waiting for deployment to start...`);
      await sleep(2000);
      attempts++;
    }
  }
  
  console.log(`   ⚠️ Timeout: Deployment status unknown`);
}

/**
 * Simulates the complete Butler flow
 */
async function runButlerFlow() {
  console.log('🤖 Butler Integration Test');
  console.log('==========================');
  
  // Test wallet
  const userWallet = process.env.TEST_WALLET || '0x' + '0'.repeat(39) + '1';
  
  try {
    // Step 1: Butler processes payment
    const paymentTxHash = await simulateButlerPayment(userWallet);
    
    // Step 2: Butler creates ACP job
    const job = await createButlerJob(userWallet, paymentTxHash);
    console.log(`\n📋 Butler: Created job ${job.jobId}`);
    console.log(`   Job details:`, JSON.stringify(job, null, 2));
    
    // Step 3: Submit job to Quick Deploy (via ACP)
    // In production, this would go through ACP network
    console.log(`\n🚀 Butler: Submitting job to Quick Deploy service`);
    
    // For testing, we can directly call the service
    if (process.env.DIRECT_TEST === 'true') {
      const quickDeployResponse = await axios.post(
        `${CONFIG.quickDeployUrl}/api/process`,
        job,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-ACP-Job-ID': job.jobId,
          },
        }
      );
      
      console.log('   Response:', quickDeployResponse.data);
    } else {
      console.log('   (In production, this would go through ACP network)');
      console.log('   Run with DIRECT_TEST=true to test direct integration');
    }
    
    // Step 4: Monitor deployment status
    await monitorDeployment(job.jobId);
    
    console.log('\n✨ Butler flow completed!');
    
  } catch (error) {
    console.error('\n❌ Butler flow failed:', error);
  }
}

/**
 * Helper function to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test specific Butler scenarios
 */
async function testButlerScenarios() {
  console.log('\n🧪 Testing Butler Scenarios');
  console.log('===========================');
  
  // Scenario 1: Normal flow with payment
  console.log('\n1️⃣ Normal flow with payment TX:');
  const job1 = await createButlerJob('0xUser1', '0xPaymentTx1');
  console.log('   ✅ Job created:', job1.jobId);
  
  // Scenario 2: Missing payment TX (should fail)
  console.log('\n2️⃣ Missing payment TX:');
  const job2: ButlerJobRequest = {
    jobId: 'butler-job-fail',
    buyer: '0xUser2',
    params: {
      userWallet: '0xUser2',
      // No paymentTxHash provided
    },
  };
  console.log('   ⚠️ This should fail with "Butler must provide paymentTxHash"');
  
  // Scenario 3: Custom agent name
  console.log('\n3️⃣ Custom agent name:');
  const job3 = await createButlerJob('0xUser3', '0xPaymentTx3');
  job3.params.agentName = 'ACP-CustomBot';
  console.log('   ✅ Job with custom name:', job3.params.agentName);
  
  console.log('\n📝 Test scenarios complete');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--scenarios')) {
    await testButlerScenarios();
  } else {
    await runButlerFlow();
  }
  
  console.log('\n🎉 Butler integration test complete!');
  console.log('\nTips:');
  console.log('- Run with DIRECT_TEST=true to test direct API calls');
  console.log('- Run with --scenarios to test different Butler scenarios');
  console.log('- Set TEST_WALLET to use a specific wallet address');
}

// Run the test
main().catch(console.error);
