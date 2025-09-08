# 🔧 Integration Guide - Crypto News Agent

**Step-by-step instructions to integrate the crypto news service into your ACP agent**

This guide shows you exactly how to replace your default agent with the profitable crypto news service.

## 🎯 What This Does

Transforms your basic ACP agent into a professional cryptocurrency news and analysis service that can earn $200-2000+ per month by providing:

- Real-time crypto news from 20+ sources
- AI-powered market analysis and sentiment scoring  
- Portfolio-specific news filtering
- Custom research reports
- Risk alerts and market intelligence

## 📋 Prerequisites

Before starting, make sure you have:

- [ ] Working ACP integration (completed main setup)
- [ ] API keys for crypto data sources (see [API Keys Guide](#api-keys))
- [ ] OpenAI API key (optional but recommended for AI analysis)
- [ ] 15 minutes to complete integration

## 🚀 Step 1: Install Dependencies

```bash
# Navigate to your main ACP project
cd /path/to/your/acp_integration

# Install required packages for crypto news service
pnpm add node-cron rss-parser cheerio date-fns axios ws
pnpm add -D @types/node-cron @types/ws
```

## 📁 Step 2: Copy Service Files

Copy the crypto news service files to your main project:

```bash
# Copy the main service file
cp examples/crypto-news-agent/src/services/cryptoNewsService.ts src/services/

# Copy configuration if you want the crypto-specific config
cp examples/crypto-news-agent/src/config/cryptoConfig.ts src/config/
```

## ⚙️ Step 3: Update Environment Configuration

Add crypto news API keys to your main `.env` file:

```bash
# Add these lines to your existing .env file
cat examples/crypto-news-agent/.env.example >> .env
```

Then edit `.env` and replace placeholder values:

```env
# Update your service description
SERVICE_NAME="Crypto News & Analysis"
SERVICE_DESCRIPTION="Professional cryptocurrency news and market analysis service that delivers personalized, real-time crypto insights for traders and investors."
SERVICE_PRICE=0.05

# Add crypto API keys (get these from the respective services)
NEWSAPI_KEY=your_actual_newsapi_key_here
COINGECKO_KEY=your_actual_coingecko_key_here  
CRYPTOCOMPARE_KEY=your_actual_cryptocompare_key_here
OPENAI_API_KEY=sk-your_actual_openai_key_here
```

## 🔌 Step 4: Update Main Agent File

Edit your main agent file (`src/index.ts`) to use the crypto news service:

**Find this line (around line 80):**
```typescript
this.agentService = new DefaultAgentService();
```

**Replace it with:**
```typescript
// Import the crypto news service at the top of the file
// Add this to your imports (around line 26)
import { CryptoNewsService } from './services/cryptoNewsService';

// Then replace the DefaultAgentService with:
this.agentService = new CryptoNewsService();
```

## ✅ Step 5: Test Your Configuration

Validate that everything is properly configured:

```bash
# Test configuration
pnpm run validate

# You should see:
# ✅ .env file exists
# ✅ Crypto News Service configured
# ✅ API keys present
```

Test with mock data:

```bash
# Test with fake crypto news requests
pnpm run dev:mock

# You should see:
# 🧪 Mock job created: mock-123456789
# 📥 New job received: mock-123456789  
# ⚙️ Processing crypto news request...
# ✅ Job mock-123456789 completed successfully
```

## 🔑 API Keys Guide {#api-keys}

You need API keys from crypto data providers. Here's how to get them:

### Required APIs (Choose 2-3)

#### 1. NewsAPI (Free Tier: 500 requests/day)
1. Go to [newsapi.org](https://newsapi.org)
2. Click "Get API Key"
3. Register with email
4. Copy your API key
5. Add to `.env`: `NEWSAPI_KEY=your_key_here`

#### 2. CoinGecko (Free Tier: 10-50 calls/minute) 
1. Go to [coingecko.com/en/api/pricing](https://coingecko.com/en/api/pricing)
2. Click "Demo API" for free tier
3. Register and verify email
4. Get API key from dashboard
5. Add to `.env`: `COINGECKO_KEY=your_key_here`

#### 3. CryptoCompare (Free Tier: 100k calls/month)
1. Go to [cryptocompare.com/cryptopian/api-keys](https://cryptocompare.com/cryptopian/api-keys)
2. Create account
3. Generate API key
4. Add to `.env`: `CRYPTOCOMPARE_KEY=your_key_here`

### Optional APIs

#### 4. OpenAI (Recommended for AI analysis)
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account and add payment method
3. Go to "API Keys"
4. Create new key
5. Add to `.env`: `OPENAI_API_KEY=sk-your_key_here`

**Cost**: ~$5-20/month for typical usage

#### 5. CoinAPI (Professional only, paid)
1. Go to [coinapi.io](https://coinapi.io)
2. Choose paid plan ($79+/month)
3. Get API key
4. Add to `.env`: `COINAPI_KEY=your_key_here`

## 🏃‍♂️ Step 6: Launch Your Crypto News Agent

Start your live crypto news service:

```bash
# Start your crypto news agent
pnpm run dev

# You should see:
# 🚀 Initializing ACP Integration...
# Service: Crypto News & Analysis
# ✅ ACP Integration initialized successfully
# 🔄 Starting main loop...
# 📊 Fetching latest crypto news...
# 📹 Market data cache updated
```

## 📊 Monitoring Your Crypto Agent

### Success Indicators

When customers use your service, you'll see:

```bash
📥 New job received: job_1234567890
⚙️ Processing crypto news request...
📰 Fetching news from 5 sources...
🤖 Running AI analysis...
💎 Analyzing portfolio impact for BTC, ETH, SOL...
✅ Job job_1234567890 completed successfully
💰 Payment received: $0.05
```

### Request Types Your Agent Can Handle

1. **Daily Brief** - Market overview with portfolio-specific news
2. **Portfolio Analysis** - Impact analysis for user's crypto holdings
3. **Risk Alert** - Urgent notifications about portfolio risks
4. **Research Report** - Deep dive analysis on specific cryptocurrencies
5. **Market Sentiment** - Current market mood and trend analysis
6. **Price Analysis** - Technical analysis with price predictions

## 💰 Pricing Strategy

### Recommended Starting Prices

- **Basic News Brief**: $0.01-0.03
- **Portfolio Analysis**: $0.05-0.15
- **Custom Research**: $0.25-1.00
- **Real-time Alerts**: $0.10-0.25

### Scaling Strategy

1. **Week 1-2**: Start at $0.01 to test and get initial customers
2. **Week 3-4**: Increase to $0.05 after proving reliability
3. **Month 2+**: Scale to $0.10-0.50 based on service quality
4. **Advanced features**: Premium research at $1.00-5.00

## 🔧 Customization Options

### Add More Data Sources

Edit `src/services/cryptoNewsService.ts` to add more news sources:

```typescript
private async fetchNewsFromAllSources(): Promise<NewsItem[]> {
  const sources = [
    this.fetchNewsAPI(),
    this.fetchCoinDeskRSS(),
    this.fetchDecryptRSS(),
    // Add your custom sources here:
    this.fetchCustomSource(),
  ];
  
  const results = await Promise.allSettled(sources);
  // ... processing logic
}
```

### Customize Analysis

Modify the AI analysis prompts:

```typescript
private async analyzeWithAI(news: NewsItem[], portfolio?: string[]): Promise<AnalysisResult> {
  const prompt = `
    Analyze these crypto news items for trading insights:
    ${news.map(item => `- ${item.title}: ${item.summary}`).join('\n')}
    
    Portfolio: ${portfolio?.join(', ') || 'General market'}
    
    Provide:
    1. Market sentiment (Bullish/Bearish/Neutral)
    2. Key events impact
    3. Trading recommendations
    4. Risk assessment
  `;
  
  // Your custom analysis logic here
}
```

## 🚨 Troubleshooting

### Common Issues

#### "API rate limit exceeded"
**Solution**: 
- Use multiple data sources
- Implement caching (already included)
- Upgrade to paid API tiers

#### "No crypto news found"
**Solution**:
- Check API keys are valid
- Verify internet connection
- Check API service status

#### "OpenAI analysis fails"
**Solution**:
- Verify OpenAI API key format (`sk-...`)
- Check OpenAI account has credits
- Use fallback analysis without AI

### Performance Optimization

```bash
# Check your service performance
echo "Service health check:"
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"type":"daily-brief","portfolio":["BTC","ETH"]}'
```

## 📈 Revenue Projections

### Conservative Estimate (Month 1-3)
- 50 requests/day at $0.05 each
- $2.50/day × 30 days = **$75/month**
- After expenses (APIs): **$50/month profit**

### Moderate Growth (Month 4-6) 
- 200 requests/day at $0.10 each
- $20/day × 30 days = **$600/month**
- After expenses: **$550/month profit**

### Established Service (Month 6+)
- 500 requests/day at $0.15 each
- $75/day × 30 days = **$2,250/month**
- After expenses: **$2,150/month profit**

### Premium Tier (Advanced users)
- 50 premium reports/month at $5 each
- Additional **$250/month**

## 🎯 Success Tips

### Service Quality
1. **Speed**: Respond within 30 seconds
2. **Accuracy**: Cross-reference multiple sources
3. **Relevance**: Focus on actionable insights
4. **Consistency**: Maintain regular data updates

### Customer Satisfaction
1. **Clear formatting**: Well-structured reports
2. **Personalization**: Tailor to user's portfolio
3. **Timeliness**: Fresh news and data
4. **Reliability**: 95%+ success rate

### Business Growth
1. **Monitor metrics**: Track success rates and revenue
2. **Collect feedback**: Learn from customer responses
3. **Iterate service**: Add features based on demand
4. **Scale pricing**: Increase rates as quality improves

---

## ✅ Final Checklist

Before going live, verify:

- [ ] All API keys configured and tested
- [ ] Service validates successfully (`pnpm run validate`)
- [ ] Mock testing works (`pnpm run dev:mock`)
- [ ] Agent registration updated with crypto news description
- [ ] Pricing set appropriately for testing
- [ ] Monitoring setup for tracking performance

**Congratulations! Your crypto news agent is ready to start earning money 24/7! 🚀**

---

*For technical support, see [NON-TECHNICAL-TROUBLESHOOTING.md](../../docs/NON-TECHNICAL-TROUBLESHOOTING.md) or join the [Virtuals Discord](https://discord.gg/virtuals)*