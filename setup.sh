#!/bin/bash

echo "🚀 ACP Integration Boilerplate Setup"
echo "===================================="
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher is required (found v$NODE_VERSION)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env ]; then
    echo ""
    echo "📋 Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env with your configuration:"
    echo "   - GAME_API_KEY"
    echo "   - WHITELISTED_WALLET_PRIVATE_KEY"
    echo "   - AGENT_WALLET_ADDRESS"
    echo "   - SERVICE_NAME"
    echo "   - API_ENDPOINT"
else
    echo "✅ .env file already exists"
fi

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Run 'npm run dev' to start your agent"
echo "3. Or 'npm run dev:mock' to test with mock buyer"
echo ""
echo "Happy building! 🎉"