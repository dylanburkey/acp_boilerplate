# Security Guidelines

## 🔒 Environment Variables

### Never Commit Sensitive Data

The following files should **NEVER** contain real credentials or sensitive data:

- `.env.example` - Template file with placeholder values only
- `.env.*.example` - Any example environment files
- Any files tracked by git

### Proper .env File Usage

1. **Template Files** (`.env.example`):
   ```bash
   # ✅ GOOD - Use placeholders
   API_KEY=your_api_key_here
   PRIVATE_KEY=0xyour_private_key_here
   WALLET_ADDRESS=0xYourWalletAddress
   ```

2. **Real Configuration** (`.env`, `.env.local`):
   ```bash
   # ✅ These files are in .gitignore
   API_KEY=sk-real-api-key-12345
   PRIVATE_KEY=0xabcdef123456...
   WALLET_ADDRESS=0x1234567890...
   ```

### Protected Files

The following patterns are automatically excluded from git:

```gitignore
# All .env files except examples
.env
.env.*
!.env.example
!.env.*.example

# Additional protection
.env.local
.env.*.local
.env.production
.env.development
.env.test.real
.env.*.real

# Credentials
**/secrets.json
**/credentials.json
*.key
*.pem
*.p12
*.pfx
```

## 🛡️ Security Best Practices

### 1. API Keys & Tokens

- **Never** commit API keys to git
- Use environment variables for all secrets
- Rotate keys regularly
- Use different keys for dev/staging/prod

### 2. Private Keys

- **Never** share private keys
- Store securely in `.env` (not tracked by git)
- Use hardware wallets for production
- Keep backups in secure, encrypted storage

### 3. Wallet Addresses

While not as sensitive as private keys, wallet addresses can reveal:
- Transaction history
- Balance information
- Associated contracts

Use example/test addresses in documentation.

### 4. Configuration Templates

When creating `.env.example` files:

```bash
# ❌ BAD - Real values
GAME_API_KEY=656a58ea4149df4dc24ae733fcd7efce665d99303379d4db1945e3a79fa9d635
PRIVATE_KEY=0x547b05e2222a7def433a6a5da83ad695029ff6d9dae9360cb1cdb4601917989e

# ✅ GOOD - Placeholder values
GAME_API_KEY=your_game_api_key_here
PRIVATE_KEY=0xyour_private_key_here
```

## 🚨 If Sensitive Data Was Committed

If you accidentally commit sensitive data:

1. **Immediately rotate all exposed credentials**
   - Generate new API keys
   - Create new wallet if private key exposed
   - Update all services using old credentials

2. **Clean git history** (if not yet pushed):
   ```bash
   # Amend last commit
   git commit --amend

   # Or use interactive rebase
   git rebase -i HEAD~N  # N = number of commits to review
   ```

3. **If already pushed to remote**:
   ```bash
   # Contact repository admin
   # Rotate ALL exposed credentials immediately
   # Consider the compromised credentials permanently exposed
   ```

4. **Update documentation** to prevent future incidents

## ✅ Security Checklist

Before committing:

- [ ] No real API keys in code or docs
- [ ] No private keys in any file
- [ ] `.env.example` uses only placeholders
- [ ] Sensitive files in `.gitignore`
- [ ] Documentation uses example values
- [ ] No hardcoded credentials

Before pushing:

- [ ] Review all changes in `git diff`
- [ ] Verify `.env` files not staged
- [ ] Check for accidentally committed secrets
- [ ] Run `git log --oneline -5` to review commits

## 📚 Additional Resources

- [Git Secrets](https://github.com/awslabs/git-secrets) - Prevent committing secrets
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## 🔐 Credential Storage Recommendations

### Development
- Use `.env` files (gitignored)
- Consider using [dotenv-vault](https://github.com/dotenv-org/dotenv-vault)
- Use OS-level credential managers

### Production
- Use secret management services:
  - AWS Secrets Manager
  - Google Cloud Secret Manager
  - Azure Key Vault
  - HashiCorp Vault
- Environment variables via deployment platform
- Hardware security modules (HSM) for critical keys

## 📞 Security Incident Response

If you discover a security issue:

1. **Do NOT** create a public GitHub issue
2. **Do NOT** discuss in public channels
3. Contact the repository maintainer privately
4. Follow responsible disclosure practices

---

**Remember**: Once a secret is committed to git, consider it permanently compromised, even if removed later.
