# 📸 Visual Setup Guide with Screenshots

**Step-by-step visual guide for setting up your ACP agent**

*Note: This guide includes placeholder descriptions for screenshots. When implementing, replace these with actual screenshots of each step.*

## 🎯 Overview

This visual guide walks you through every click and screen you'll see when setting up your ACP agent. Perfect for visual learners who prefer seeing exactly what to do.

## 📋 What You'll Need

Before starting, have these items ready:
- [ ] Computer with internet connection
- [ ] 30 minutes of uninterrupted time
- [ ] Crypto wallet (MetaMask recommended)
- [ ] Business idea for your agent service

## 🚀 Step 1: Get Your GAME API Key

### 1.1 Navigate to Virtuals Console
**🖼️ Screenshot: Browser showing virtuals console homepage**
- Open your web browser
- Go to: `https://console.virtuals.io`
- You should see the Virtuals Console homepage with a clean interface

### 1.2 Create Account or Login  
**🖼️ Screenshot: Login/signup form**
- Click "Sign Up" if you're new (top right corner)
- Click "Login" if you already have an account
- Fill in your email and password
- Click the blue "Create Account" or "Login" button

### 1.3 Navigate to API Keys Section
**🖼️ Screenshot: Console dashboard with navigation menu**
- After logging in, you'll see the dashboard
- Look for a sidebar menu on the left
- Click on "API Keys" or "Developer" section
- You might see sections like "Overview", "API Keys", "Agents", etc.

### 1.4 Create New API Key
**🖼️ Screenshot: API keys page with "Create" button**
- On the API Keys page, you'll see any existing keys
- Click the "Create New API Key" or "Generate Key" button
- Give it a name like "My ACP Agent"
- Click "Create" or "Generate"

### 1.5 Copy Your API Key
**🖼️ Screenshot: New API key displayed with copy button**
- Your new API key will appear (looks like: `game_12345abcdef...`)
- Click the "Copy" button next to the key
- **Important:** Save this in a secure notepad - you'll need it later
- The key should start with `game_`

---

## 🏦 Step 2: Set Up Your Wallets

### 2.1 Install MetaMask (if needed)
**🖼️ Screenshot: MetaMask extension installation page**
- Go to `https://metamask.io`
- Click "Download" then "Install MetaMask for Chrome" (or your browser)
- Add the extension to your browser
- Create a new wallet or import existing one

### 2.2 Get Your Wallet Address
**🖼️ Screenshot: MetaMask wallet showing address at top**
- Open MetaMask extension
- Your wallet address is shown at the top (starts with 0x...)
- Click on the address to copy it
- This will be your "Payment Wallet Address"

### 2.3 Export Private Key
**🖼️ Screenshot: MetaMask settings menu with security options**
- In MetaMask, click the three dots menu (top right)
- Select "Account Details"
- Click "Export Private Key"
- Enter your MetaMask password
- Click "Confirm"

**🖼️ Screenshot: Private key display with warning message**
- Your private key will be shown (starts with 0x...)
- Click "Copy to Clipboard"
- **Critical:** Never share this with anyone!
- This will be your "Whitelisted Wallet Private Key"

---

## 🤖 Step 3: Register Your Agent

### 3.1 Return to Virtuals Console
**🖼️ Screenshot: Console dashboard with agent registration option**
- Go back to `https://console.virtuals.io`
- Look for "Agent Registration", "Create Agent", or "Service Registry"
- This might be in the main dashboard or sidebar menu

### 3.2 Start Agent Registration
**🖼️ Screenshot: Agent registration form - basic info section**
- Click "Create New Agent" or "Register Agent"
- You'll see a form with multiple sections
- Start with basic information fields

### 3.3 Fill Basic Information
**🖼️ Screenshot: Form fields being filled out**
Fill out these fields:
- **Agent Name**: "My Data Analysis Service"
- **Description**: "Analyzes customer spreadsheets and creates summary reports for small businesses"
- **Category**: Select appropriate category (e.g., "Data Analysis")
- **Price**: Set to $0.01 for initial testing

### 3.4 Add Wallet Information
**🖼️ Screenshot: Wallet configuration section of form**
- **Whitelisted Wallet Address**: Paste your wallet address (0x...)
- **Payment Wallet**: Same address or different one for receiving payments
- Double-check these addresses are correct

### 3.5 Configure Service Details  
**🖼️ Screenshot: Service configuration options**
- **Service Type**: Choose "Custom Service" or "API Service"
- **Processing Time**: "30 seconds to 2 minutes"
- **File Size Limit**: "Up to 5MB"
- **Supported Formats**: "CSV, Excel, JSON"

### 3.6 Submit Registration
**🖼️ Screenshot: Review screen before submission**
- Review all information carefully
- Check that your wallet address is correct
- Click "Submit Registration" or "Create Agent"
- You should see a confirmation message

### 3.7 Note Your Entity ID
**🖼️ Screenshot: Registration confirmation with Entity ID**
- After submission, you'll see a confirmation screen
- Look for "Entity ID" or "Agent ID" (usually a number like "1" or "123")
- **Important:** Write this number down - you'll need it for configuration
- This is your "Whitelisted Wallet Entity ID"

---

## 💻 Step 4: Download and Setup Code

### 4.1 Install Node.js
**🖼️ Screenshot: Node.js website download page**
- Go to `https://nodejs.org`
- Click the green "LTS" button (recommended version)
- Download and run the installer
- Keep clicking "Next" through the installation wizard

**🖼️ Screenshot: Node.js installation complete dialog**
- When finished, you should see "Installation Complete"
- Click "Finish"

### 4.2 Install PNPM
**🖼️ Screenshot: Terminal/Command Prompt window**
- Open Terminal (Mac) or Command Prompt (Windows)
- Type: `npm install -g pnpm`
- Press Enter
- Wait for installation to complete (you'll see progress indicators)

### 4.3 Download Agent Code
**🖼️ Screenshot: Terminal showing git clone command**
- In the same terminal window, type these commands one by one:
```bash
git clone https://github.com/dylanburkey/acp_boilerplate.git
```
- Press Enter and wait (you'll see files being downloaded)

**🖼️ Screenshot: Terminal showing directory change and setup**
```bash
cd acp_boilerplate
pnpm run setup
```
- This will install all required components automatically
- You'll see lots of text scrolling - this is normal

---

## ⚙️ Step 5: Configure Your Agent

### 5.1 Open Configuration File
**🖼️ Screenshot: File explorer showing .env file**
- Navigate to the `acp_boilerplate` folder you just created
- Look for a file called `.env` (might show as just `.env` or `.env file`)
- Right-click and select "Open with" → "Text Editor" or "Notepad"

### 5.2 Fill in Required Values
**🖼️ Screenshot: .env file open in text editor with placeholder values**
You'll see a file with placeholder values like this:
```env
GAME_API_KEY=your_game_api_key_here
WHITELISTED_WALLET_PRIVATE_KEY=your_wallet_private_key_here
```

**🖼️ Screenshot: .env file with real values filled in**
Replace the placeholder values with your real information:

```env
# From Step 1.5 - Your GAME API key
GAME_API_KEY=game_abc123def456...

# From Step 2.3 - Your wallet private key  
WHITELISTED_WALLET_PRIVATE_KEY=0x1234567890abcdef...

# From Step 3.7 - Your Entity ID from registration
WHITELISTED_WALLET_ENTITY_ID=1

# From Step 2.2 - Your wallet address
AGENT_WALLET_ADDRESS=0x9876543210fedcba...

# Your business information
SERVICE_NAME="My Data Analysis Service"
SERVICE_DESCRIPTION="Analyzes CSV data files and creates summary reports with charts for small businesses. Processes files up to 5MB with sales, customer, or inventory data."
API_ENDPOINT=https://your-api-endpoint.com
```

### 5.3 Save Configuration
**🖼️ Screenshot: Save dialog or Ctrl+S keyboard shortcut**
- Press Ctrl+S (Windows) or Cmd+S (Mac) to save
- Close the text editor
- Make sure the file is saved as `.env` (not `.env.txt`)

---

## ✅ Step 6: Test Your Setup

### 6.1 Run Validation
**🖼️ Screenshot: Terminal running validation command**
- Go back to your terminal window
- Type: `pnpm run validate`
- Press Enter

**🖼️ Screenshot: Validation results showing success and errors**
You should see results like:
```
✅ Success:
  ✅ .env file exists
  ✅ All required environment variables are set
  ✅ Dependencies are installed

⚠️ Warnings:
  None

❌ Errors:
  None
```

If you see errors, go back and fix the configuration values.

### 6.2 Test with Mock Buyer
**🖼️ Screenshot: Terminal running mock test**
- Type: `pnpm run dev:mock`
- Press Enter

**🖼️ Screenshot: Mock buyer test results**
You should see messages like:
```
🚀 Initializing ACP Integration...
✅ ACP Integration initialized successfully
🔄 Starting main loop...
🧪 Mock job created: mock-1234567890
📥 New job received: mock-1234567890
⚙️ Processing job mock-1234567890
✅ Job mock-1234567890 completed successfully
```

This means your agent is working correctly!

---

## 🌐 Step 7: Go Live

### 7.1 Start Your Live Agent
**🖼️ Screenshot: Terminal running live agent**
- Stop the mock test by pressing Ctrl+C
- Type: `pnpm run dev`
- Press Enter

**🖼️ Screenshot: Live agent startup messages**
You should see:
```
🚀 Initializing ACP Integration...
Service: My Data Analysis Service
✅ ACP Integration initialized successfully
🔄 Starting main loop...
```

### 7.2 Monitor for Jobs
**🖼️ Screenshot: Agent waiting for jobs**
Your agent is now live and waiting for real customers:
```
Found 0 active jobs
Checking for new jobs...
```

When a customer submits a job, you'll see:
```
📥 New job received: job_real_123456
⚙️ Processing job job_real_123456
✅ Job job_real_123456 completed successfully
💰 Payment received for job job_real_123456
```

---

## 📊 Step 8: Monitor Your Progress

### 8.1 Graduation Progress
**🖼️ Screenshot: Graduation progress messages**
As you complete jobs successfully, you'll see:
```
Sandbox graduation progress: 1/10 successful transactions
Sandbox graduation progress: 2/10 successful transactions
...
🎓 Sandbox graduation milestone reached!
Ready for manual review by Virtuals team.
```

### 8.2 Check Earnings
**🖼️ Screenshot: Wallet showing received payments**
- Open your MetaMask wallet
- Check your balance - you should see payments from completed jobs
- Each successful job adds to your earnings

### 8.3 View Performance Metrics
**🖼️ Screenshot: Terminal showing performance stats**
Your agent logs performance information:
```
SLA Summary - Active: 2, Environment: sandbox
Job processing success rate: 95%
Average processing time: 45 seconds
```

---

## 🎉 Success! Your Agent is Running

**🖼️ Screenshot: Dashboard showing active agent with earnings**

Congratulations! Your ACP agent is now:
- ✅ Live and processing jobs
- ✅ Earning money automatically  
- ✅ Working toward graduation
- ✅ Scaling your business 24/7

## 📱 Mobile Monitoring

### Check Status on Your Phone
**🖼️ Screenshot: Mobile browser showing agent logs**
You can monitor your agent from anywhere:
1. Open terminal on your computer
2. Your agent logs show status in real-time
3. Check wallet balance on mobile MetaMask app
4. Monitor earnings throughout the day

## 🔧 Troubleshooting Common Screens

### Error: Missing Configuration
**🖼️ Screenshot: Validation error about missing values**
```
❌ Missing or placeholder values for: GAME_API_KEY
```
**Fix:** Go back to Step 5 and fill in the real API key.

### Error: Wallet Format
**🖼️ Screenshot: Validation warning about wallet format**  
```
⚠️ WHITELISTED_WALLET_PRIVATE_KEY should start with 0x
```
**Fix:** Make sure your private key starts with `0x`.

### Error: Build Failed
**🖼️ Screenshot: Build error in terminal**
```
TypeScript compilation failed
```
**Fix:** Run `pnpm run validate` to identify specific issues.

### Success: Everything Working
**🖼️ Screenshot: All green checkmarks in validation**
```
🎉 Setup validation complete! Your ACP integration is ready to deploy.
```
**Result:** You're ready to go live!

## 📞 Getting Help

If you see screens that don't match these examples:

1. **Check Your Steps:** Go back through each step carefully
2. **Run Validation:** Use `pnpm run validate` to identify issues  
3. **Check Documentation:** Look at other guide files
4. **Ask Community:** Join the Discord for help
5. **Report Issues:** Create a GitHub issue if something's broken

## 🎯 Next Steps

Now that your agent is running:

1. **Monitor Performance:** Watch success rates and earnings
2. **Improve Service:** Based on customer feedback
3. **Scale Up:** Increase prices after proving reliability  
4. **Add Features:** Enhance your service capabilities
5. **Graduate:** Complete 10 jobs to move to production

Your digital employee is now working 24/7! 🚀

---

*This visual guide assumes typical screens and interfaces. Actual screens may vary slightly due to updates or browser differences. The core steps and concepts remain the same.*