# 🔧 Crypto News Agent Troubleshooting

**Quick fixes for common problems with your crypto news service**

This guide helps you solve issues fast so you can get back to earning money!

## 🚨 Emergency Quick Fixes

### Agent Won't Start
```bash
# Try these commands in order:
pnpm run validate          # Check configuration
rm -rf node_modules        # Clear dependencies  
pnpm install              # Reinstall
pnpm run dev              # Try starting again
```

### No Jobs Coming In
```bash
# Lower your price temporarily
echo "SERVICE_PRICE=0.01" >> .env
pnpm run dev
```

### All Jobs Failing
```bash
# Test with fake data
pnpm run dev:mock
# If this works, the issue is with API keys
```

## 📊 Diagnostic Commands

Run these to identify problems:

### Check Overall Health
```bash
pnpm run validate
```
**Good output**:
```
✅ .env file exists
✅ All required environment variables are set
✅ API keys format is valid
✅ Dependencies are installed
✅ Service configuration is complete
```

### Test Service Logic
```bash
pnpm run dev:mock
```
**Good output**:
```
🧪 Mock job created: mock-1234567890
📥 New job received: mock-1234567890
📰 Processing crypto news request...
✅ Job mock-1234567890 completed successfully
```

### Check API Connections
```bash
# Test NewsAPI
curl "https://newsapi.org/v2/everything?q=bitcoin&apiKey=YOUR_NEWSAPI_KEY"

# Test CoinGecko
curl "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
```

## 🔍 Common Problems & Solutions

### Problem 1: "Missing API Keys"
**What you see**:
```
❌ Missing or placeholder values for: NEWSAPI_KEY
```

**Solution**:
1. Open `.env` file
2. Find line: `NEWSAPI_KEY=your_newsapi_key_here`
3. Replace with real key: `NEWSAPI_KEY=abc123def456...`
4. Save file
5. Restart: `pnpm run dev`

**Double-check**:
- No spaces around the `=` sign
- No quotes around the key (unless they were there originally)
- Key copied completely

---

### Problem 2: "No Jobs Received"
**What you see**:
```
Found 0 active jobs
Checking for new jobs...
(repeats forever)
```

**Why this happens**:
- Price too high for new agents
- Service description too vague
- Not enough customers yet

**Solutions**:
1. **Lower your price**:
   ```bash
   # Edit .env file:
   SERVICE_PRICE=0.01    # Start with 1 cent
   ```

2. **Improve description**:
   ```env
   SERVICE_DESCRIPTION="Bitcoin and Ethereum news analysis for day traders. Get portfolio insights, risk alerts, and market updates within 60 seconds. Specializes in DeFi protocols and institutional adoption news."
   ```

3. **Wait patiently**:
   - New agents take 24-48 hours to get first jobs
   - Market demand varies by time of day
   - Crypto news is more popular during market hours

---

### Problem 3: "Jobs Keep Failing"
**What you see**:
```
📥 New job received: job_1234567890
❌ Job job_1234567890 failed: API error
```

**Common causes & solutions**:

#### API Rate Limits
```
Error: "API rate limit exceeded"
```
**Solution**: Service has built-in caching, but you might need:
- Upgrade to paid API tiers
- Wait for rate limit reset (usually 1 hour)
- The service will use cached data automatically

#### Invalid API Keys
```
Error: "Invalid API key"
```
**Solution**:
1. Check key format:
   - NewsAPI: `abc123def456...` (no special prefix)
   - OpenAI: `sk-proj-...` or `sk-...` (must start with sk-)
   - CoinGecko: `CG-...` (starts with CG-)

2. Test keys manually:
   ```bash
   # Test NewsAPI
   curl "https://newsapi.org/v2/everything?q=bitcoin&apiKey=YOUR_KEY"
   
   # Should return JSON with articles, not error message
   ```

#### Internet Connection Issues
```
Error: "timeout" or "network error"
```
**Solution**:
- Check internet connection
- Try: `ping google.com`
- Restart router if needed
- Service will retry automatically

---

### Problem 4: "OpenAI Analysis Fails"
**What you see**:
```
⚠️ OpenAI analysis unavailable, using fallback
```

**Solutions**:
1. **Check API key format**:
   ```env
   # Wrong:
   OPENAI_API_KEY=openai_abc123
   
   # Right:
   OPENAI_API_KEY=sk-proj-abc123def456...
   ```

2. **Check account credits**:
   - Go to [platform.openai.com](https://platform.openai.com)
   - Check "Usage" section
   - Add $5-10 credits if needed

3. **Test key manually**:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_OPENAI_KEY"
   ```

**Note**: Service works without OpenAI - it's optional for enhanced analysis

---

### Problem 5: "Service Too Slow"
**What you see**:
```
❌ Job failed: Processing timeout
```

**Why this happens**:
- Slow internet connection
- API services are slow
- Processing too much data

**Solutions**:
1. **Check internet speed**:
   ```bash
   # Test speed
   curl -o /dev/null -s -w "%{time_total}" https://google.com
   # Should be under 1 second
   ```

2. **Reduce data processing**:
   - Service automatically limits to 50 news items
   - Uses 5-minute caching to speed up responses
   - Processes only relevant news for each request

3. **Optimize configuration**:
   ```env
   # Add these to .env for faster processing:
   MAX_NEWS_ITEMS=25        # Reduce from 50
   REQUEST_TIMEOUT_MS=15000 # 15 second timeout
   ```

---

### Problem 6: "Wrong Wallet Address"
**What you see**:
```
Jobs complete but no payment received
```

**Solution**:
1. **Check wallet addresses in .env**:
   ```env
   AGENT_WALLET_ADDRESS=0xYourPaymentWallet...
   WHITELISTED_WALLET_PRIVATE_KEY=0xYourWhitelistedWallet...
   ```

2. **Verify addresses are correct**:
   - Open MetaMask
   - Copy your address
   - Compare with .env file

3. **Check both wallets**:
   - Payments might go to whitelisted wallet
   - Transfer to main wallet if needed

---

## 🔧 Advanced Debugging

### Enable Debug Logging
```bash
# Add to .env file:
LOG_LEVEL=debug
ENABLE_DEBUG_LOGS=true

# Restart agent:
pnpm run dev
```

This shows detailed information about:
- API calls being made
- Data processing steps
- Cache hit/miss statistics
- Error details

### Check Service Health
```bash
# Create a test request file:
cat > test_request.json << 'EOF'
{
  "type": "daily-brief",
  "portfolio": ["BTC", "ETH"],
  "format": "summary"
}
EOF

# Test service directly (advanced):
node -e "
const { CryptoNewsService } = require('./src/services/cryptoNewsService');
const service = new CryptoNewsService();
const request = require('./test_request.json');
service.processRequest({jobId: 'test', params: request})
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => console.error(err));
"
```

### Monitor API Usage
```bash
# Check your API usage:
echo "NewsAPI: https://newsapi.org/account"
echo "OpenAI: https://platform.openai.com/usage"
echo "CoinGecko: Check your dashboard"
```

## 📈 Performance Optimization

### Monitor Success Rate
Track these metrics in your logs:
```
✅ Job completed successfully  (Good - aim for 95%+)
❌ Job failed                 (Bad - investigate causes)
⚠️ Using cached data          (Normal - saves API costs)
🔄 Cache updated              (Good - fresh data fetched)
```

### Optimize for Profit
```bash
# Check earnings vs costs:
echo "Average request: $0.05"
echo "API costs per request: ~$0.001" 
echo "Profit margin: ~98%"
```

### Scale Your Service
Once successful:
1. **Increase prices gradually** ($0.01 → $0.05 → $0.15)
2. **Add premium features** (research reports at $0.50+)
3. **Specialize in niches** (DeFi news, institutional analysis)
4. **Improve response time** (under 30 seconds)

## 🚨 Emergency Recovery

### "Everything is Broken"
If nothing works, complete reset:

```bash
# 1. Stop everything
Ctrl+C  # Stop the agent

# 2. Backup your configuration
cp .env .env.backup
cp src/index.ts src/index.ts.backup

# 3. Clean slate
rm -rf node_modules
git checkout src/index.ts  # Reset to original
pnpm install

# 4. Re-run setup
./examples/crypto-news-agent/setup.sh

# 5. Restore your API keys
# Copy from .env.backup to .env

# 6. Test
pnpm run validate
pnpm run dev:mock
pnpm run dev
```

### Get Help Fast
1. **Discord**: [Virtuals Community](https://discord.gg/virtuals) - fastest response
2. **GitHub Issues**: Include error logs and .env (WITHOUT API keys!)
3. **Professional Help**: Hire developer on Upwork with this error info

### What to Include When Asking for Help
```bash
# Run these and include output:
pnpm run validate
node --version
npm --version
echo $SHELL
uname -a  # System info

# Include (without API keys):
# - Exact error message
# - What you were doing when it failed
# - Your .env file (replace API keys with "HIDDEN")
# - Any recent changes you made
```

## ✅ Prevention Tips

### Daily Health Check (30 seconds)
```bash
# Quick daily check:
tail -10 logs/agent.log    # Check recent activity
echo "Agent running: $(ps aux | grep 'pnpm run dev')" 
echo "Wallet balance: Check MetaMask"
```

### Weekly Maintenance (5 minutes)
```bash
# Update dependencies:
pnpm update

# Check API usage:
echo "Review API dashboards for usage and costs"

# Monitor performance:
echo "Check success rate and response times"

# Backup configuration:
cp .env backups/.env.$(date +%Y%m%d)
```

### Monthly Optimization (30 minutes)
1. **Review earnings**: Are you meeting targets?
2. **Check competition**: What prices are others charging?
3. **Update service description**: Make it more specific
4. **Consider new features**: What do customers request most?
5. **Optimize API usage**: Can you reduce costs?

Remember: Most problems are simple configuration issues. Take your time, read error messages carefully, and don't hesitate to ask for help. Your crypto news business is worth fixing! 🚀