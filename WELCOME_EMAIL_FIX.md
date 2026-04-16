# Welcome Email Not Sent - Issue Resolution

## Problem

Welcome emails were not being sent when creating users on Vercel (production), but worked fine locally. Testing email templates worked in both environments.

## Root Cause

The `userCreationEmailTemplateId` field in the `SystemConfig` table was not configured in production. The `sendUserCreationEmail` method in [emailService.ts](../src/application/services/emailService.ts#L155-L158) has this check:

```typescript
if (!config?.userCreationEmailTemplateId) {
  console.warn("User creation email template not configured. Skipping email.");
  return;
}
```

When this field is `null`, the email is silently skipped with only a console warning.

## Why It Worked Locally

Your local database had the `userCreationEmailTemplateId` properly configured (likely set manually through the UI), but the production database didn't have this value set.

## Why Test Emails Still Worked

The test email endpoint directly specifies the template ID in the request, so it doesn't depend on the `SystemConfig.userCreationEmailTemplateId` field.

## Solution

### Option 1: Run the Fix Script (Recommended for Production)

Run this script on your production database:

```bash
node scripts/fix-welcome-email-config.mjs
```

This will:

1. Ensure the user welcome email template exists
2. Link it to the system configuration
3. Verify the configuration is correct

### Option 2: Configure Through UI

1. Log in as Admin
2. Go to System Settings
3. Find "User Creation Email Template" dropdown
4. Select "User Welcome Email"
5. Save

### Option 3: Re-run Configuration Seed

If you're setting up a new environment:

```bash
node scripts/seed-configurations.mjs
```

This has been updated to automatically configure the welcome email template.

## Files Modified

1. [scripts/seed-configurations.mjs](../scripts/seed-configurations.mjs) - Updated to create and link the user welcome email template
2. [scripts/fix-welcome-email-config.mjs](../scripts/fix-welcome-email-config.mjs) - New script to fix existing installations

## Verification

After applying the fix, create a new user and check:

1. The user receives a welcome email
2. Check the server logs for: `"User creation email sent to {email}"`
3. If you see `"User creation email template not configured. Skipping email."`, the fix was not applied correctly

## Prevention

The `seed-configurations.mjs` script now ensures this is configured from the start, preventing this issue in future deployments.
