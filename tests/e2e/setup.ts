/**
 * @fileoverview E2E test setup
 * Configures test environment and global utilities
 *
 * @author Dylan Burkey
 * @license MIT
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables - prefer .env.test for E2E tests
const testEnvPath = path.resolve(__dirname, '../../.env.test');
const mainEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath });
  console.log('✓ Loaded test environment from .env.test');
} else if (fs.existsSync(mainEnvPath)) {
  dotenv.config({ path: mainEnvPath });
  console.log('✓ Loaded environment from .env');
} else {
  console.warn('⚠️  No .env or .env.test file found - using process.env');
}

// Increase timeout for E2E tests
jest.setTimeout(120000);

// Global test utilities
global.testUtils = {
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock wallet addresses for testing
  mockAddresses: {
    buyer: '0x1234567890123456789012345678901234567890',
    agent: '0x0987654321098765432109876543210987654321',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Base USDC
  },

  // Mock transaction hashes
  mockTxHashes: {
    payment: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    creation: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
};

// Type augmentation for global test utils
declare global {
  var testUtils: {
    sleep: (ms: number) => Promise<void>;
    mockAddresses: {
      buyer: string;
      agent: string;
      usdc: string;
    };
    mockTxHashes: {
      payment: string;
      creation: string;
    };
  };
}

export {};
