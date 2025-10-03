# Configuration Guide - API Keys

## Environment Variable Configuration

This integration uses environment variables for configuration to follow best practices.

### Best Practices:

1. **Never commit API keys to version control**
   - Add `.env` to your `.gitignore` file
   - Use `.env.example` files with placeholders only

2. **Environment Variables Only**
   - Store the API key in your `.env` file
   - Never hardcode API keys in source code

3. **Example .env Setup**:
   ```env
   # KEEP THIS FILE PRIVATE - DO NOT COMMIT TO GIT
   SHEKEL_API_KEY=your-actual-api-key-here
   ```

4. **Production Security**
   - Use secure key management systems
   - Rotate keys regularly
   - Limit key access to necessary personnel only

### Configuration

Add your API key to your `.env` file:
```
SHEKEL_API_KEY=<your-private-api-key>
```

The service will warn you if the API key is not configured properly.

### Configuration Management

Always use environment variables for configuration values. This makes it easier to:
- Deploy to different environments
- Keep configuration separate from code
- Follow standard development practices
