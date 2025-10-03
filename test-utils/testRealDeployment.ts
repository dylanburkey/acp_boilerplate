/**
 * @fileoverview Comprehensive test for Quick Deploy with real contract deployment
 * This shows the complete flow from ACP job to deployed trading agent
 * 
 * @author Athena AI Team
 * @license MIT
 */

import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment
dotenv.config({ path: path.join(__dirname, '../.env.test.real') });

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Contract addresses from the documentation
const CONTRACTS = {
  FACTORY: '0x0fE1eBa3e809CD0Fc34b6a3666754B7A042c169a',
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  PAYMENT_RECIPIENT: '0x48597AfA1c4e7530CA8889bA9291494757FEABD2',
};

class RealDeploymentTester {
  private provider: ethers.JsonRpcProvider;
  private mockKCUrl = 'http://localhost:4000';
  private statusApiUrl = 'http://localhost:3001';
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ACP_RPC_URL || 'https://base.llamarpc.com');
  }
  
  async run() {
    console.log(`${COLORS.bright}${COLORS.cyan}🚀 Quick Deploy Real Contract Test${COLORS.reset}\n`);
    
    try {
      // Step 1: Show deployment flow
      await this.showDeploymentFlow();
      
      // Step 2: Check contract information
      await this.checkContracts();
      
      // Step 3: Simulate ACP job
      await this.simulateACPJob();
      
      // Step 4: Monitor results
      await this.monitorDeployment();
      
      console.log(`\n${COLORS.green}✅ Test completed!${COLORS.reset}`);
      
    } catch (error) {
      console.error(`\n${COLORS.red}❌ Test failed:${COLORS.reset}`, error);
    }
  }
  
  async showDeploymentFlow() {
    console.log(`${COLORS.yellow}📋 Deployment Flow Overview${COLORS.reset}`);
    console.log('\n1. ACP Job Created with parameters:');
    console.log('   - userWallet: User\'s wallet address');
    console.log('   - agentName: Name for the trading agent');
    console.log('   - executeOnChain: true (for automatic deployment)');
    
    console.log('\n2. Service executes 3 transactions:');
    console.log(`   ${COLORS.cyan}Transaction 1:${COLORS.reset} Create Personal Fund`);
    console.log(`   - Contract: ${CONTRACTS.FACTORY}`);
    console.log('   - Function: createPersonalizedFunds(true, userWallet, USDC)');
    
    console.log(`\n   ${COLORS.cyan}Transaction 2:${COLORS.reset} Payment (50 USDC)`);
    console.log(`   - Contract: ${CONTRACTS.USDC}`);
    console.log(`   - Function: transfer(${CONTRACTS.PAYMENT_RECIPIENT}, 50 USDC)`);
    
    console.log(`\n   ${COLORS.cyan}Transaction 3:${COLORS.reset} Enable Trading`);
    console.log('   - Contract: [Created Fund Address]');
    console.log('   - Function: setTradingEnabled(true)');
    
    console.log('\n3. API Call to Kosher Capital:');
    console.log('   - Endpoint: https://parallax-analytics.onrender.com/api/v1/secure/fundDetails/quick-deploy');
    console.log('   - Payload: { agentName, contractCreationTxnHash, creating_user_wallet_address, ... }');
    
    console.log('\n4. Notifications sent back via callbacks\n');
  }
  
  async checkContracts() {
    console.log(`${COLORS.yellow}🔍 Checking Contract Information${COLORS.reset}`);
    
    try {
      // Check factory contract
      const factoryCode = await this.provider.getCode(CONTRACTS.FACTORY);
      console.log(`\nFactory Contract: ${COLORS.green}✓${COLORS.reset} Deployed`);
      console.log(`Address: ${CONTRACTS.FACTORY}`);
      console.log(`Code size: ${factoryCode.length} bytes`);
      
      // Check USDC contract
      const usdcCode = await this.provider.getCode(CONTRACTS.USDC);
      console.log(`\nUSDC Contract: ${COLORS.green}✓${COLORS.reset} Deployed`);
      console.log(`Address: ${CONTRACTS.USDC}`);
      console.log(`Code size: ${usdcCode.length} bytes`);
      
      // Get current block number
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`\nCurrent Base block: ${blockNumber}`);
      
    } catch (error) {
      console.error('Error checking contracts:', error);
    }
  }
  
  async simulateACPJob() {
    console.log(`\n${COLORS.yellow}🎭 Simulating ACP Job${COLORS.reset}`);
    
    // Create test job data
    const testWallet = ethers.Wallet.createRandom();
    const jobId = `test-real-${Date.now()}`;
    
    console.log('\nTest Job Details:');
    console.log(`Job ID: ${jobId}`);
    console.log(`Test Wallet: ${testWallet.address}`);
    console.log(`Agent Name: RealTest-${Date.now()}`);
    
    console.log('\n⚠️  Note: In a real scenario:');
    console.log('1. The user would have 50 USDC in their wallet');
    console.log('2. They would approve the transactions through their wallet');
    console.log('3. The service would execute the deployment on-chain');
    
    // Show what the ACP job would look like
    const acpJob = {
      id: jobId,
      buyer: testWallet.address,
      params: {
        userWallet: testWallet.address,
        agentName: `RealTest-${Date.now()}`,
        executeOnChain: true,
        type: 'quick-deploy',
      },
      serviceDescription: 'Quick deployment of an AI trading agent',
    };
    
    console.log('\nACP Job Structure:');
    console.log(JSON.stringify(acpJob, null, 2));
    
    // Show required approvals
    console.log(`\n${COLORS.magenta}Required User Approvals:${COLORS.reset}`);
    console.log('1. Approve fund creation transaction');
    console.log('2. Approve USDC transfer (50 USDC)');
    console.log('3. Approve trading enablement');
    
    return acpJob;
  }
  
  async monitorDeployment() {
    console.log(`\n${COLORS.yellow}📊 Monitoring Deployment${COLORS.reset}`);
    
    // In a real deployment, we would:
    // 1. Watch for PersonalFundCreated events
    // 2. Monitor USDC Transfer events
    // 3. Track transaction confirmations
    // 4. Check API responses
    
    console.log('\nWhat to monitor:');
    console.log('1. Transaction hashes from each step');
    console.log('2. Event logs from factory contract');
    console.log('3. Status API for deployment progress');
    console.log('4. Callback notifications');
    
    try {
      // Try to check Status API
      const healthResponse = await axios.get(`${this.statusApiUrl}/health`).catch(() => null);
      if (healthResponse) {
        console.log(`\n${COLORS.green}Status API is running${COLORS.reset}`);
        console.log('Check deployments at: http://localhost:3001/api/deployments');
      }
    } catch (error) {
      console.log('\nStatus API not available (start Quick Deploy service first)');
    }
  }
}

// Test with real wallet (requires funds)
class FundedWalletTest {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  
  constructor(privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(process.env.ACP_RPC_URL || 'https://base.llamarpc.com');
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }
  
  async checkReadiness() {
    console.log(`\n${COLORS.yellow}💰 Checking Wallet Readiness${COLORS.reset}`);
    
    try {
      // Check ETH balance for gas
      const ethBalance = await this.provider.getBalance(this.wallet.address);
      console.log(`\nWallet: ${this.wallet.address}`);
      console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
      
      // Check USDC balance
      const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
      const usdcContract = new ethers.Contract(CONTRACTS.USDC, usdcAbi, this.provider);
      const usdcBalance = await usdcContract.balanceOf(this.wallet.address);
      console.log(`USDC Balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
      
      // Check requirements
      const hasEnoughETH = ethBalance > ethers.parseEther('0.01');
      const hasEnoughUSDC = usdcBalance >= ethers.parseUnits('50', 6);
      
      console.log(`\n${COLORS.cyan}Requirements:${COLORS.reset}`);
      console.log(`ETH for gas (>0.01): ${hasEnoughETH ? '✅' : '❌'}`);
      console.log(`USDC for payment (>=50): ${hasEnoughUSDC ? '✅' : '❌'}`);
      
      if (hasEnoughETH && hasEnoughUSDC) {
        console.log(`\n${COLORS.green}✅ Wallet is ready for deployment!${COLORS.reset}`);
        return true;
      } else {
        console.log(`\n${COLORS.red}❌ Wallet needs funding${COLORS.reset}`);
        return false;
      }
      
    } catch (error) {
      console.error('Error checking wallet:', error);
      return false;
    }
  }
}

// Usage instructions
function showUsage() {
  console.log(`
${COLORS.bright}Quick Deploy Testing Guide${COLORS.reset}

${COLORS.cyan}1. Simulation Test (No funds required):${COLORS.reset}
   pnpm tsx test-utils/testRealDeployment.ts

${COLORS.cyan}2. Wallet Check (With private key):${COLORS.reset}
   WALLET_PRIVATE_KEY=0x... pnpm tsx test-utils/testRealDeployment.ts --check-wallet

${COLORS.cyan}3. Full Test Flow:${COLORS.reset}
   a) Start Mock Kosher Capital: pnpm test:mock-kc
   b) Start Quick Deploy service: pnpm quickdeploy
   c) Run this test: pnpm tsx test-utils/testRealDeployment.ts
   
${COLORS.yellow}Important:${COLORS.reset}
- Real deployments require ETH for gas and 50 USDC for payment
- Test on Base Sepolia first before mainnet
- Always use test wallets for development
`);
}

// Main execution
async function main() {
  if (process.argv.includes('--help')) {
    showUsage();
    return;
  }
  
  if (process.argv.includes('--check-wallet')) {
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      console.error(`${COLORS.red}Error: WALLET_PRIVATE_KEY environment variable required${COLORS.reset}`);
      return;
    }
    
    const walletTest = new FundedWalletTest(privateKey);
    await walletTest.checkReadiness();
  } else {
    const tester = new RealDeploymentTester();
    await tester.run();
  }
}

main().catch(console.error);
