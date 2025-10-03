# 🔧 Non-Technical Troubleshooting Guide

**Simple solutions for common problems - no coding required**

This guide helps you fix issues without needing to understand code. Each problem has step-by-step solutions that anyone can follow.

## 🚨 Quick Problem Identifier

**What's wrong with your agent?**

### 😵 Agent Won't Start
- Terminal shows errors when running `pnpm run dev`
- Configuration validation fails
- Build process fails

### 😴 Agent Starts But No Jobs
- Agent runs but never receives work
- Shows "Found 0 active jobs" constantly
- No earnings appearing in wallet

### 💔 Jobs Keep Failing
- Receives jobs but they all fail
- Low success rate (below 80%)
- Error messages in terminal

### 💰 Not Getting Paid
- Jobs complete successfully but no payment
- Wrong wallet receiving money
- Payments delayed or missing

### 🐌 Agent Too Slow
- Jobs timing out
- Customers complaining about speed
- Processing takes too long

---

## 🛠️ Category 1: Agent Won't Start

### Problem: "Missing Environment Variables"
**What you see:**
```
❌ Missing or placeholder values for: GAME_API_KEY
```

**What it means:** You haven't filled in your configuration properly.

**Easy Fix:**
1. Open the `.env` file in your `acp_boilerplate` folder
2. Look for lines that still say things like `your_api_key_here`
3. Replace ALL placeholder text with your real information:
   - `GAME_API_KEY` = Your actual API key from Virtuals Console
   - `WHITELISTED_WALLET_PRIVATE_KEY` = Your real wallet private key
   - `AGENT_WALLET_ADDRESS` = Your real wallet address
4. Save the file
5. Try again: `pnpm run validate`

**Double-check:**
- API key starts with `game_`
- Private key starts with `0x`
- Wallet address starts with `0x`
- No quotes around the values unless they were already there

---

### Problem: "Node.js Version Error"
**What you see:**
```
Error: Node.js 18 or higher is required
```

**What it means:** Your computer has an old version of Node.js.

**Easy Fix:**
1. Go to [nodejs.org](https://nodejs.org)
2. Download the "LTS" version (green button)
3. Run the installer and follow the prompts
4. Close and reopen your terminal
5. Try again: `pnpm run dev`

**Double-check:**
- Download the **LTS** version, not "Current"
- Completely restart your terminal after installation
- If still not working, restart your computer

---

### Problem: "Command Not Found: pnpm"
**What you see:**
```
pnpm: command not found
```

**What it means:** PNPM isn't installed on your computer.

**Easy Fix:**
1. Open terminal or command prompt
2. Type: `npm install -g pnpm`
3. Press Enter and wait for installation
4. Try again: `pnpm run dev`

**If that doesn't work:**
1. Try: `npx pnpm install` instead
2. Or use npm directly: `npm install && npm run dev`

---

### Problem: "Build Failed"
**What you see:**
```
TypeScript compilation failed
```

**What it means:** There's a problem with the code files.

**Easy Fix:**
1. First try: `pnpm run validate`
2. If validation passes, try: `rm -rf node_modules && pnpm install`
3. Then: `pnpm run build`

**If still broken:**
1. Delete the entire `acp_boilerplate` folder
2. Start over with: `git clone https://github.com/dylanburkey/acp_boilerplate.git`
3. Follow the setup steps again

---

## 🛠️ Category 2: Agent Starts But No Jobs

### Problem: "No Active Jobs Found"
**What you see:**
```
Found 0 active jobs
Checking for new jobs...
```

**What it means:** Either no one needs your service, or they can't find you.

**Easy Fix - Check Registration:**
1. Go to [Virtuals Console](https://console.virtuals.io)
2. Log in and check your agent status
3. Make sure it shows "Active" or "Approved"
4. Verify your service description is clear and specific

**Easy Fix - Lower Your Price:**
1. Open `.env` file
2. Find `SERVICE_PRICE=0.001`
3. Change to `SERVICE_PRICE=0.01` (1 cent)
4. Save and restart your agent

**Easy Fix - Improve Description:**
Make your service description MORE specific:

**Bad:** "AI assistant for general tasks"
**Good:** "Analyzes customer sales spreadsheets and creates summary reports with charts for small retail businesses"

**Bad:** "Data analysis service"  
**Good:** "Customer data analysis that identifies top buyers, seasonal trends, and growth opportunities for e-commerce stores"

---

### Problem: "Agent Not Visible to Customers"
**What you see:** Agent runs fine but customer never find you.

**What it means:** Your registration might not be complete.

**Easy Fix:**
1. Go to [Virtuals Console](https://console.virtuals.io)
2. Check if your agent shows in the public directory
3. If not visible, contact Virtuals support
4. Make sure your wallet is properly whitelisted

**Common Registration Issues:**
- Wrong wallet address in registration
- Entity ID doesn't match your configuration
- Service category too vague or wrong
- Pricing set too high for new agents

---

### Problem: "Wrong Target Audience"
**What you see:** Jobs come in but they're not what you expected.

**What it means:** Your service description attracts wrong customers.

**Easy Fix:**
1. Review recent job requests to understand what people want
2. Update your service description to be more specific
3. Add limitations to filter out unwanted requests

**Example Improvements:**
- Add "for businesses under 100 employees"
- Specify "CSV files only, up to 5MB"
- Include "English language only"
- Add "no medical or legal advice"

---

## 🛠️ Category 3: Jobs Keep Failing

### Problem: "High Failure Rate"
**What you see:**
```
❌ Job job_123 failed: Service error
❌ Job job_456 failed: Processing error
```

**What it means:** Your service logic has problems.

**Easy Fix - Check Your API:**
1. If using API service, test your API endpoint manually
2. Try opening your `API_ENDPOINT` in a web browser
3. If it doesn't load, fix your API first
4. Make sure your API accepts POST requests with JSON data

**Easy Fix - Use Different Service Type:**
1. Open `src/index.ts`
2. Find line: `this.agentService = new DefaultAgentService();`
3. Replace with: `this.agentService = new CustomAgentService();`
4. This uses simpler built-in logic instead of your API

**Easy Fix - Extend Timeout:**
1. Open `.env` file
2. Add: `TX_CONFIRMATION_TIMEOUT=120000` (2 minutes)
3. Save and restart your agent

---

### Problem: "Validation Errors"
**What you see:**
```
❌ Job failed: Invalid input data
❌ Request outside service scope
```

**What it means:** Customers are sending data your agent can't handle.

**Easy Fix:**
1. Make your service description MORE specific about what you accept
2. Add examples of correct input format
3. List what file types/sizes you support

**Example Service Description Update:**
```
BEFORE: "Data analysis service"

AFTER: "Sales data analysis for retail businesses. 

Accepts: CSV files with columns for Date, Product, Quantity, Price
File Size: Maximum 5MB
Output: PDF report with sales trends and recommendations
Processing Time: 2-5 minutes"
```

---

### Problem: "Timeout Errors"
**What you see:**
```
❌ Job failed: Processing timeout
❌ Request took too long to process
```

**What it means:** Your service is too slow.

**Easy Fix:**
1. Reduce complexity of your processing
2. Use faster external APIs
3. Process smaller chunks of data
4. Increase timeout in configuration

**Quick Timeout Fix:**
1. Open `.env` file
2. Change: `ACP_PROCESSING_DELAY=3000` to `ACP_PROCESSING_DELAY=1000`
3. Add: `JOB_EXPIRATION_HOURS=2` (extend job lifetime)

---

## 🛠️ Category 4: Payment Problems

### Problem: "No Payments Received"
**What you see:** Jobs complete but wallet balance doesn't increase.

**What it means:** Payments going to wrong wallet or delayed.

**Easy Fix - Check Wallet Address:**
1. Open `.env` file
2. Find `AGENT_WALLET_ADDRESS=0x...`
3. Copy that address
4. Open your wallet (MetaMask) and verify it matches
5. If different, update `.env` with correct address

**Easy Fix - Check Different Wallet:**
1. Sometimes payments go to the whitelisted wallet instead
2. Check the balance of your `WHITELISTED_WALLET_PRIVATE_KEY` wallet
3. If money is there, you can transfer it to your main wallet

**Easy Fix - Wait for Confirmation:**
1. Blockchain payments can take 5-15 minutes
2. Check your wallet balance again after waiting
3. Look for pending transactions

---

### Problem: "Wrong Payment Amount"
**What you see:** Receiving different amount than expected.

**What it means:** Service price might be wrong or fees deducted.

**Easy Fix:**
1. Check your actual service price in Virtuals Console
2. Remember there might be small network fees (usually under $1)
3. Verify your `SERVICE_PRICE` in `.env` file matches what you set

---

### Problem: "Payments Delayed"
**What you see:** Jobs completed hours ago but no payment.

**What it means:** Blockchain congestion or escrow delay.

**Easy Fix:**
1. Wait 24 hours - sometimes blockchain is slow
2. Check blockchain explorer with your wallet address
3. Contact Virtuals support if over 24 hours

---

## 🛠️ Category 5: Performance Issues

### Problem: "Agent Too Slow"
**What you see:** Jobs taking 5+ minutes to process.

**What it means:** Your processing logic needs optimization.

**Easy Fix - Use Faster Service:**
1. Switch to AI service if doing text processing
2. Use simpler logic instead of complex calculations
3. Process data in smaller chunks

**Easy Fix - Optimize Configuration:**
1. Open `.env` file
2. Change: `ACP_PROCESSING_DELAY=3000` to `ACP_PROCESSING_DELAY=1000`
3. Add: `ACP_MAX_RETRIES=1` (reduce retry attempts)

**Easy Fix - Check Internet Speed:**
1. Test your internet speed at speedtest.net
2. Slow internet = slow API calls = slow processing
3. Consider upgrading internet or using cloud hosting

---

### Problem: "Memory Issues"
**What you see:**
```
Error: Out of memory
Process killed
```

**What it means:** Your agent is using too much computer memory.

**Easy Fix:**
1. Restart your agent: Press Ctrl+C, then `pnpm run dev`
2. Process smaller files (under 1MB if possible)
3. Add memory limits to your configuration

**Easy Fix - Clear Cache:**
1. Stop your agent (Ctrl+C)
2. Run: `rm -rf node_modules/.cache`
3. Run: `pnpm run build`
4. Start again: `pnpm run dev`

---

## 🛠️ Emergency Fixes

### "Everything is Broken" Reset
If nothing else works, try this complete reset:

1. **Stop everything:** Press Ctrl+C in terminal
2. **Backup your .env:** Copy your `.env` file to Desktop
3. **Delete everything:** Delete entire `acp_boilerplate` folder
4. **Start fresh:**
   ```bash
   git clone https://github.com/dylanburkey/acp_boilerplate.git
   cd acp_boilerplate
   pnpm run setup
   ```
5. **Restore config:** Copy your saved `.env` file back
6. **Test:** `pnpm run validate`
7. **Start:** `pnpm run dev`

### "I Need Help Right Now" Checklist
1. **Check basics:** Is your computer connected to internet?
2. **Try validation:** Run `pnpm run validate` and fix any errors
3. **Check logs:** Look for red error messages in terminal
4. **Restart everything:** Close terminal, reopen, try again
5. **Ask for help:** Join Discord or create GitHub issue

---

## 📞 Getting Help

### Self-Help Resources (Try First)
1. **Run validation:** `pnpm run validate` finds most problems
2. **Check logs:** Error messages usually explain the issue
3. **Read other guides:** NON-DEVELOPER-GUIDE.md, CUSTOM-LOGIC-GUIDE.md
4. **Try mock mode:** `pnpm run dev:mock` for testing

### Community Help
1. **Discord:** [https://discord.gg/virtuals](https://discord.gg/virtuals)
2. **GitHub Issues:** Report bugs and get help
3. **Documentation:** All guides in the `docs/` folder

### Professional Help
If you need custom development:
1. **Upwork/Fiverr:** Hire a developer
2. **Show them this:** Give them access to the documentation
3. **Be specific:** Explain exactly what you want your agent to do

### What to Include When Asking for Help
1. **What you were trying to do:** "I was trying to start my agent"
2. **What happened:** "I got an error message"
3. **Error message:** Copy the exact error text
4. **What you tried:** "I ran pnpm run validate and got..."
5. **Your setup:** Operating system, Node.js version

### Common Mistakes to Avoid
1. **Don't share private keys:** Never share your private key with anyone
2. **Don't skip validation:** Always run `pnpm run validate` first
3. **Don't ignore errors:** Fix validation errors before trying to run
4. **Don't rush:** Take time to read error messages carefully

---

## 🎯 Prevention Tips

### Daily Checks (30 seconds)
1. **Check agent status:** Is it still running?
2. **Check earnings:** Any new payments?
3. **Check success rate:** Are jobs completing successfully?

### Weekly Maintenance (5 minutes)
1. **Review logs:** Look for patterns in errors
2. **Check competition:** Are others offering similar services?
3. **Update pricing:** Adjust based on demand
4. **Backup config:** Save your `.env` file somewhere safe

### Monthly Optimization (30 minutes)
1. **Analyze performance:** Which jobs succeed most?
2. **Update service description:** Make it more specific
3. **Review pricing:** Increase prices if quality is good
4. **Plan improvements:** What features could you add?

Remember: Most problems are simple configuration issues. Take your time, read error messages carefully, and don't hesitate to ask for help. Your AI agent business is worth the effort! 🚀