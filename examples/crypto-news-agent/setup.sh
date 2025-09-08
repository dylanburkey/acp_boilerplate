#!/bin/bash

# ===========================================
# Crypto News Agent Quick Setup Script
# ===========================================
# This script automates the integration of the crypto news service
# into your existing ACP agent project.

set -e  # Exit on any error

echo "🚀 Crypto News Agent Quick Setup"
echo "======================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "../../package.json" ]]; then
    print_error "Please run this script from examples/crypto-news-agent/ directory"
    exit 1
fi

print_status "Setting up Crypto News Agent..."

# Step 1: Install dependencies
print_status "Installing required dependencies..."
cd ../..
pnpm add node-cron rss-parser cheerio date-fns axios ws
pnpm add -D @types/node-cron @types/ws
print_success "Dependencies installed"

# Step 2: Copy service files
print_status "Copying crypto news service files..."
cp examples/crypto-news-agent/src/services/cryptoNewsService.ts src/services/
print_success "Service files copied"

# Step 3: Backup and update .env
print_status "Updating environment configuration..."
if [[ -f ".env" ]]; then
    cp .env .env.backup
    print_success "Created backup of existing .env file (.env.backup)"
fi

# Append crypto news configuration to .env
cat examples/crypto-news-agent/.env.example >> .env
print_success "Added crypto news configuration to .env"

# Step 4: Update main index.ts file
print_status "Updating main agent file..."
cp src/index.ts src/index.ts.backup
print_success "Created backup of main agent file (src/index.ts.backup)"

# Add import for CryptoNewsService
if ! grep -q "CryptoNewsService" src/index.ts; then
    # Find the line with CustomAgentService import and add CryptoNewsService
    sed -i.tmp '/CustomAgentService,/a\
  CryptoNewsService,
' src/index.ts
    
    # Add the actual import
    sed -i.tmp 's/} from '\''\.\/services\/agentService'\'';/} from '\''\.\/services\/agentService'\'';\'$'\nimport { CryptoNewsService } from '\''\.\/services\/cryptoNewsService'\'';/' src/index.ts
    
    # Replace DefaultAgentService with CryptoNewsService
    sed -i.tmp 's/this\.agentService = new DefaultAgentService();/\/\/ Use CryptoNewsService for crypto news and analysis\
    this.agentService = new CryptoNewsService();\
    \/\/ Uncomment to use DefaultAgentService instead:\
    \/\/ this.agentService = new DefaultAgentService();/' src/index.ts
    
    # Clean up temporary file
    rm src/index.ts.tmp
    print_success "Updated main agent file to use CryptoNewsService"
else
    print_warning "CryptoNewsService import already exists in main file"
fi

# Step 5: Create a simple configuration validator
print_status "Creating configuration validator..."
cat > validate-crypto-config.js << 'EOF'
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Crypto News Agent Configuration...');

// Check if .env file exists
if (!fs.existsSync('.env')) {
    console.log('❌ .env file not found');
    process.exit(1);
}

// Read .env file
const envContent = fs.readFileSync('.env', 'utf8');

// Required crypto configuration
const requiredKeys = [
    'GAME_API_KEY',
    'WHITELISTED_WALLET_PRIVATE_KEY',
    'AGENT_WALLET_ADDRESS',
    'SERVICE_NAME',
    'SERVICE_DESCRIPTION'
];

// Optional but recommended
const recommendedKeys = [
    'NEWSAPI_KEY',
    'COINGECKO_KEY',
    'CRYPTOCOMPARE_KEY',
    'OPENAI_API_KEY'
];

let errors = [];
let warnings = [];

// Check required keys
requiredKeys.forEach(key => {
    const regex = new RegExp(`^${key}=(.+)$`, 'm');
    const match = envContent.match(regex);
    if (!match || match[1].includes('your_') || match[1].includes('_here')) {
        errors.push(`${key} is missing or has placeholder value`);
    }
});

// Check recommended keys
recommendedKeys.forEach(key => {
    const regex = new RegExp(`^${key}=(.+)$`, 'm');
    const match = envContent.match(regex);
    if (!match || match[1].includes('your_') || match[1].includes('_here')) {
        warnings.push(`${key} is missing or has placeholder value (recommended for full functionality)`);
    }
});

// Check if crypto news service is configured
if (envContent.includes('Crypto News') || envContent.includes('cryptocurrency')) {
    console.log('✅ Crypto News Service configuration detected');
} else {
    warnings.push('Service name/description may not be configured for crypto news');
}

// Print results
if (errors.length === 0) {
    console.log('✅ All required configuration is present');
} else {
    console.log('❌ Configuration errors found:');
    errors.forEach(error => console.log(`   - ${error}`));
}

if (warnings.length > 0) {
    console.log('⚠️  Configuration warnings:');
    warnings.forEach(warning => console.log(`   - ${warning}`));
}

console.log('');
if (errors.length === 0) {
    console.log('🎉 Crypto News Agent configuration is ready!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Update your .env file with real API keys');
    console.log('2. Run: pnpm run validate');
    console.log('3. Test: pnpm run dev:mock');
    console.log('4. Go live: pnpm run dev');
    process.exit(0);
} else {
    console.log('🔧 Please fix the configuration errors above before proceeding.');
    process.exit(1);
}
EOF

print_success "Configuration validator created"

# Step 6: Run validation
print_status "Running initial configuration validation..."
node validate-crypto-config.js

# Clean up validator script
rm validate-crypto-config.js

print_success "Crypto News Agent setup complete!"
echo ""
echo "======================================="
echo "🎯 NEXT STEPS:"
echo "======================================="
echo "1. Edit your .env file with real API keys:"
echo "   - Get NewsAPI key: https://newsapi.org"
echo "   - Get CoinGecko key: https://coingecko.com/en/api/pricing" 
echo "   - Get OpenAI key: https://platform.openai.com"
echo ""
echo "2. Test your setup:"
echo "   pnpm run validate"
echo "   pnpm run dev:mock"
echo ""
echo "3. Update your service registration:"
echo "   - Service Name: 'Crypto News & Analysis'"
echo "   - Description: Focus on crypto news and market analysis"
echo ""
echo "4. Go live:"
echo "   pnpm run dev"
echo ""
echo "🚀 Your crypto news agent will start earning automatically!"
echo "📖 See INTEGRATION-GUIDE.md for detailed instructions"