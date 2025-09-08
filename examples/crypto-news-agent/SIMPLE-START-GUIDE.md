# 🚀 Simple Start Guide - Crypto News Agent

**Get your crypto news agent earning money in 15 minutes!**

This is the SIMPLEST way to start your crypto news business. Perfect if you want to get started fast without understanding all the technical details.

## 🎯 What You're Building

You're creating a **digital employee** that:
- Works 24/7 automatically
- Sells crypto news and analysis to customers
- Gets paid for every successful report
- Can earn $200-2000+ per month

**No coding skills needed** - just follow these exact steps!

## 📝 What You Need

Before starting:
- [ ] 15 minutes of time
- [ ] Computer with internet
- [ ] Email address for API signups
- [ ] Credit card for API services (most are free, some require card for verification)

## 🚀 Step 1: Get Your Free API Keys (5 minutes)

You need these to fetch crypto news and prices:

### NewsAPI (100% Free)
1. Go to [newsapi.org](https://newsapi.org)
2. Click "Get API Key"
3. Sign up with email
4. Copy your API key (looks like: `abc123def456...`)
5. Save it in notepad

### CoinGecko (100% Free) 
1. Go to [coingecko.com/en/api/pricing](https://coingecko.com/en/api/pricing)
2. Click "Demo API" 
3. Sign up and verify email
4. Get your API key from dashboard
5. Save it in notepad

### OpenAI (Optional, $5-20/month)
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account
3. Add $5-10 credit to account
4. Go to "API Keys" → "Create new key"
5. Copy key (starts with `sk-`)
6. Save it in notepad

**💡 Tip**: Start with just NewsAPI and CoinGecko. Add OpenAI later for better analysis quality.

## 🔧 Step 2: Run the Auto-Setup (5 minutes)

1. **Open Terminal/Command Prompt**
   - Windows: Press `Win + R`, type `cmd`, press Enter
   - Mac: Press `Cmd + Space`, type "Terminal", press Enter

2. **Navigate to your ACP project**
   ```bash
   cd /path/to/your/acp_integration
   ```

3. **Run the automatic setup script**
   ```bash
   ./examples/crypto-news-agent/setup.sh
   ```

4. **Follow the prompts**
   - The script will install everything automatically
   - Just answer "yes" to the questions

## ⚙️ Step 3: Add Your API Keys (3 minutes)

1. **Open the `.env` file** in your project
   - Use any text editor (Notepad, TextEdit, VS Code)

2. **Find these lines and replace with your real API keys**:
   ```env
   # Replace these placeholder values:
   NEWSAPI_KEY=your_newsapi_key_here
   COINGECKO_KEY=your_coingecko_key_here  
   OPENAI_API_KEY=sk-your_openai_key_here
   
   # With your real keys:
   NEWSAPI_KEY=abc123def456...
   COINGECKO_KEY=cg-xyz789...
   OPENAI_API_KEY=sk-proj-abc123...
   ```

3. **Update your service info**:
   ```env
   SERVICE_NAME="Crypto News & Analysis"
   SERVICE_DESCRIPTION="Professional cryptocurrency news and market analysis service. Get personalized crypto insights, portfolio analysis, and market intelligence for traders and investors."
   SERVICE_PRICE=0.05
   ```

4. **Save the file**

## ✅ Step 4: Test Everything (2 minutes)

1. **Test your configuration**:
   ```bash
   pnpm run validate
   ```
   
   **You should see**: ✅ All checks passed

2. **Test with fake customers**:
   ```bash
   pnpm run dev:mock
   ```
   
   **You should see**:
   ```
   🧪 Mock job created: mock-123456789
   📥 New job received: mock-123456789  
   📰 Processing crypto news request...
   ✅ Job mock-123456789 completed successfully
   ```

3. **If you see errors**, check:
   - API keys are correct (no extra spaces)
   - API keys start with correct prefix (`sk-` for OpenAI)
   - Internet connection is working

## 🚀 Step 5: Go Live and Start Earning!

1. **Start your live agent**:
   ```bash
   pnpm run dev
   ```

2. **You should see**:
   ```
   🚀 Initializing ACP Integration...
   Service: Crypto News & Analysis
   ✅ ACP Integration initialized successfully  
   🔄 Starting main loop...
   📊 Cache updated with 25 news items and 8 price records
   Found 0 active jobs
   Checking for new jobs...
   ```

3. **Your agent is now LIVE and earning money!** 🎉

## 💰 What Happens Next

### When Customers Find You
```
📥 New job received: job_1234567890
📰 Processing crypto news request...
🤖 Fetching news from 5 sources...
💎 Analyzing portfolio impact for BTC, ETH, SOL...
✅ Job job_1234567890 completed successfully  
💰 Payment received: $0.05
```

### Your Earnings Grow
- **Week 1**: 10 requests/day × $0.05 = **$3.50/day**
- **Month 1**: 50 requests/day × $0.05 = **$75/month**  
- **Month 3**: 200 requests/day × $0.10 = **$600/month**
- **Month 6**: 500 requests/day × $0.15 = **$2,250/month**

## 🎯 Customer Request Examples

Your agent can handle these request types:

### 1. Daily Brief ($0.05)
```json
{
  "type": "daily-brief", 
  "portfolio": ["BTC", "ETH", "SOL"]
}
```
**Response**: Market overview + portfolio-specific news

### 2. Portfolio Analysis ($0.10) 
```json
{
  "type": "portfolio-analysis",
  "portfolio": ["BTC", "ETH", "ADA", "DOT", "LINK"]
}
```
**Response**: Deep analysis of each holding with recommendations

### 3. Risk Alert ($0.15)
```json
{
  "type": "risk-alert",
  "portfolio": ["LUNA", "UST"],
  "alertLevel": "high"
}
```
**Response**: Urgent warnings about potential portfolio risks

### 4. Research Report ($0.50)
```json
{
  "type": "research-report", 
  "topic": "ethereum",
  "depth": "comprehensive"
}
```
**Response**: Professional investment analysis report

## 🛠️ Customization (Optional)

### Change Your Prices
Edit `.env` file:
```env
# Start low for testing, increase as you prove quality
SERVICE_PRICE=0.01  # 1 cent for initial testing
SERVICE_PRICE=0.05  # 5 cents after first week
SERVICE_PRICE=0.25  # 25 cents for premium service
```

### Update Your Description
Make it more specific:
```env
SERVICE_DESCRIPTION="Bitcoin and Ethereum news analysis for day traders. Get personalized portfolio insights, risk alerts, and market intelligence within 60 seconds. Specializing in DeFi, institutional, and regulatory news."
```

### Add More Data Sources
The service automatically uses:
- NewsAPI (general crypto news)
- CoinGecko (prices and market data)
- RSS feeds from CoinDesk, Decrypt
- OpenAI (AI analysis if key provided)

## 🚨 Troubleshooting

### "No jobs received"
**Problem**: Agent runs but no customers find you
**Solutions**:
1. Lower your price to $0.01 for testing
2. Make service description more specific
3. Check agent registration is approved
4. Wait 24-48 hours for indexing

### "Jobs failing" 
**Problem**: Requests come in but fail to complete
**Solutions**:
1. Check API keys are correct
2. Verify internet connection
3. Test with: `pnpm run dev:mock`
4. Check API service status pages

### "API rate limit exceeded"
**Problem**: Too many API calls
**Solutions**:
1. The service has built-in caching (reduces calls)
2. Upgrade to paid API tiers if needed
3. Use multiple API providers (already implemented)

### "OpenAI analysis fails"
**Problem**: AI analysis not working
**Solutions**:
1. Check OpenAI API key format: `sk-proj-...`
2. Verify account has credits ($5+ recommended)
3. Service works without OpenAI (optional feature)

## 📞 Getting Help

### Instant Help
1. **Run diagnostics**: `pnpm run validate`
2. **Check logs**: Look for red error messages in terminal
3. **Test mode**: `pnpm run dev:mock` for safe testing

### Community Support
- **Discord**: [Virtuals Community](https://discord.gg/virtuals)
- **GitHub**: Create issue with error details
- **Documentation**: See other guides in `docs/` folder

### Professional Help
If you want custom features:
1. **Hire developer** on Upwork/Fiverr
2. **Show them this code** - it's well documented
3. **Typical cost**: $100-500 for custom features

## 🎉 Success Checklist

Before celebrating, verify:

- [ ] **Configuration validates**: `pnpm run validate` shows all green
- [ ] **Mock testing works**: `pnpm run dev:mock` completes successfully
- [ ] **Agent is live**: `pnpm run dev` shows "Found 0 active jobs" (waiting for customers)
- [ ] **Service description updated**: Specific crypto news focus
- [ ] **Pricing set appropriately**: Start with $0.01-0.05 for testing
- [ ] **API keys working**: No error messages about missing/invalid keys

## 💡 Success Tips

### Week 1: Focus on Quality
- Start with low prices ($0.01-0.05) 
- Respond within 60 seconds
- Focus on accuracy over speed
- Test with different request types

### Week 2: Scale Price
- Increase to $0.05-0.10 based on success rate
- Monitor customer satisfaction
- Fix any recurring errors
- Add OpenAI key for better analysis

### Month 2+: Premium Features
- Offer specialized services (DeFi news, institutional analysis)
- Scale prices to $0.15-0.50 for proven quality
- Consider adding more data sources
- Build reputation for reliability

---

## 🚀 You're Now Ready!

Your crypto news agent is running and ready to earn money 24/7. The ACP network will automatically:

1. **Find customers** who need crypto news
2. **Send you requests** with their specific needs
3. **Process payments** upfront (no collection hassles)
4. **Transfer earnings** to your wallet automatically

**Start earning while you sleep! 💤💰**

*For advanced customization, see the [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md) and [README.md](README.md)*