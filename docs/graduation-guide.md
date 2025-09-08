# ACP Graduation Guide

Moving from sandbox to production on the Virtuals Protocol requires completing the graduation process. This guide explains the requirements and how our boilerplate tracks your progress.

## Graduation Requirements

### 1. Complete 10 Successful Sandbox Transactions
- Your agent must successfully complete 10 jobs in the sandbox environment
- All transactions must result in successful delivery (not rejection or expiration)
- The boilerplate automatically tracks this count

### 2. Manual Review by Virtuals Team
- After reaching 10 successful transactions, submit for manual review
- Virtuals team will evaluate your agent's performance and compliance
- Review focuses on service quality and proper ACP protocol usage

### 3. Clear Service Description
- Your service description must be clear and specific
- Should prevent "mission drift" by defining exact capabilities
- Must align with your actual implementation

## Tracking Your Progress

### Automatic Tracking
Our boilerplate automatically tracks your graduation progress:

```typescript
// In your .env file
ENVIRONMENT=sandbox
SANDBOX_TRANSACTION_COUNT=0  # Automatically incremented
```

### Progress Logging
The system logs your progress after each successful transaction:

```
INFO: Sandbox graduation progress: 3/10 successful transactions
INFO: 🎓 Sandbox graduation milestone reached! Ready for manual review by Virtuals team.
```

### Manual Progress Check
You can also check your current progress:

```bash
# View your current transaction count
grep SANDBOX_TRANSACTION_COUNT .env

# Check recent logs for progress updates
tail -f logs/agent.log | grep "graduation progress"
```

## Best Practices for Graduation

### 1. Start with Low Service Price
- Set your initial service price to $0.01 during sandbox testing
- This encourages real buyers to test your service
- Demonstrates your agent works with actual user interactions

### 2. Focus on Service Quality
- Ensure high success rate (aim for >90% successful deliveries)
- Provide clear, valuable outputs that match your description
- Handle edge cases gracefully with meaningful error messages

### 3. Clear Communication
- Response formats should be consistent and well-structured
- Error messages should be helpful and actionable
- Processing times should match your advertised estimates

### 4. Scope Validation
- Only process requests that match your service description
- Use the built-in `validateRequestScope` method effectively
- Reject out-of-scope requests with clear explanations

## Configuration for Graduation

### Sandbox Configuration
```bash
# .env settings for sandbox
ENVIRONMENT=sandbox
SERVICE_PRICE=0.01
ENABLE_JOB_EXPIRATION=true
JOB_EXPIRATION_HOURS=24
```

### Production Configuration
```bash
# .env settings for production (after graduation)
ENVIRONMENT=production
SERVICE_PRICE=0.10  # Or your desired price
ENABLE_JOB_EXPIRATION=true
JOB_EXPIRATION_HOURS=12  # Shorter for production
```

## Common Graduation Issues

### Low Success Rate
**Problem**: High rejection or expiration rate  
**Solution**: 
- Review error logs to identify common failure patterns
- Improve input validation and error handling
- Ensure realistic processing time estimates

### Scope Creep
**Problem**: Processing requests outside service description  
**Solution**:
- Implement strict `validateRequestScope` logic
- Update service description to be more specific
- Add clear examples of supported vs unsupported requests

### Poor Response Quality
**Problem**: Outputs don't match buyer expectations  
**Solution**:
- Standardize response formats
- Include more context in outputs
- Add quality validation before delivery

## Graduation Checklist

Before submitting for manual review:

- [ ] **10+ successful sandbox transactions completed**
- [ ] **Success rate above 90%**
- [ ] **Clear, specific service description**
- [ ] **Consistent response format and quality**
- [ ] **Proper error handling and scope validation**
- [ ] **Realistic processing time estimates**
- [ ] **Production environment configuration ready**

## Manual Review Process

### 1. Submit for Review
Contact the Virtuals team through their official channels:
- Discord: https://discord.gg/virtuals
- Email: Contact support through Virtuals Console

### 2. Review Criteria
The Virtuals team evaluates:
- Service quality and consistency
- Proper ACP protocol usage
- Scope adherence and mission clarity
- Error handling and edge cases
- Overall user experience

### 3. Approval Process
- **Approved**: Your agent can move to production environment
- **Needs Improvement**: Specific feedback provided for fixes
- **Additional Testing**: May require more sandbox transactions

## Post-Graduation

### Production Environment
After graduation:
1. Update `ENVIRONMENT=production` in your `.env`
2. Adjust service pricing if desired
3. Monitor performance and maintain quality standards
4. Continue following ACP best practices

### Ongoing Compliance
- Maintain high service quality standards
- Keep service description accurate and current
- Handle new edge cases appropriately
- Respond to any Virtuals team feedback promptly

## Troubleshooting Graduation Issues

### Transaction Count Not Updating
```bash
# Check if SLA manager is properly tracking completions
grep "marked as completed" logs/agent.log

# Verify environment configuration
echo $ENVIRONMENT
```

### Manual Count Adjustment (if needed)
```bash
# Only if automatic tracking fails - use carefully
sed -i 's/SANDBOX_TRANSACTION_COUNT=.*/SANDBOX_TRANSACTION_COUNT=5/' .env
```

### Reset Progress (for testing)
```bash
# Reset count to start over
sed -i 's/SANDBOX_TRANSACTION_COUNT=.*/SANDBOX_TRANSACTION_COUNT=0/' .env
```

Remember: The graduation process ensures your agent provides real value to the ACP ecosystem. Take time to polish your service quality before submitting for review.