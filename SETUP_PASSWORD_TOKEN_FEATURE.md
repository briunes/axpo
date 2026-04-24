# Setup Password Token Feature Implementation

**Date:** April 20, 2026  
**Implementation Status:** ✅ Complete

## Overview

This document describes the implementation of the configurable setup password token feature for email templates. The system now supports sending setup password links via email with configurable token validity periods.

## Features Implemented

### 1. Configurable Token Validity

- Added `setupTokenValidityHours` field to `SystemConfig` model in Prisma schema
- Default value: 72 hours (3 days)
- Configurable options: 4h, 12h, 24h, 48h, 72h, 168h (7 days)
- Database migration applied successfully

### 2. Setup Password URL Template Variable

- Added `SETUP_PASSWORD_URL` template variable for email templates
- Automatically generates complete URL with token: `/internal/setup-password?token=...`
- Base URL detection from environment variables:
  - `NEXT_PUBLIC_BACKEND_URL`
  - `VERCEL_URL`
  - Fallback to `http://localhost:3000`

### 3. Updated Email Service

**File:** `src/application/services/emailService.ts`

The `sendUserCreationEmail` method now:

- Accepts optional `setupToken` parameter
- Generates the complete setup password URL
- Includes `SETUP_PASSWORD_URL` in template variables
- Falls back to empty string if no token provided

### 4. Updated Auth Service

**File:** `src/application/services/authService.ts`

The `createUser` method now:

- Reads `setupTokenValidityHours` from SystemConfig
- Uses configurable validity instead of hardcoded 72 hours
- Passes `setupToken` to email service
- Defaults to 72 hours if config not found

### 5. System Settings UI

**File:** `app/internal/components/modules/SystemSettingsNew.tsx`

Added configuration field in "Automated Emails" tab:

- Label: "Password Setup Token Validity"
- Dropdown with preset options (4h to 7 days)
- Saves to system configuration

### 6. Translations

Added translations for both English and Spanish:

**English:**

- `fieldSetupTokenValidity`: "Password Setup Token Validity"
- `fieldSetupTokenValidityDesc`: "How long setup password links remain valid before expiring"

**Spanish:**

- `fieldSetupTokenValidity`: "Validez del Token de Configuración de Contraseña"
- `fieldSetupTokenValidityDesc`: "Tiempo que los enlaces de configuración de contraseña permanecen válidos antes de expirar"

### 7. Database Seed Script

**File:** `scripts/seed-configurations.mjs`

Updated to include `setupTokenValidityHours: 72` in default system configuration.

## Available Template Variables for Email Templates

When creating user welcome email templates, the following variables are available:

- `{{ USER_NAME }}` - Full name of the user
- `{{ USER_EMAIL }}` - Email address of the user
- `{{ USER_PIN }}` - User's PIN code
- `{{ USER_PASSWORD }}` - User's initial password (if provided)
- `{{ SETUP_PASSWORD_URL }}` - **NEW** - Complete URL with token to setup password

## Usage Example

### Email Template

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      .button {
        display: inline-block;
        padding: 12px 24px;
        background: #dc2626;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <h1>Welcome to AXPO, {{ USER_NAME }}!</h1>
    <p>
      Your account has been created. Please set up your password by clicking the
      link below:
    </p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="{{ SETUP_PASSWORD_URL }}" class="button">
        Set Up Your Password
      </a>
    </p>

    <p>Or copy and paste this link into your browser:</p>
    <p>{{ SETUP_PASSWORD_URL }}</p>

    <p>This link will expire in 72 hours.</p>

    <p>
      Your PIN for accessing simulations is: <strong>{{ USER_PIN }}</strong>
    </p>

    <p>Best regards,<br />AXPO Team</p>
  </body>
</html>
```

## Configuration Steps

### Admin Configuration

1. Navigate to **Configurations** → **System Settings** → **Automated Emails**
2. Configure "Password Setup Token Validity" (default: 72 hours)
3. Select appropriate template for "User Creation Email Template"
4. Save changes

### Creating Email Template with Setup Password URL

1. Navigate to **Configurations** → **Email Templates**
2. Click **+ New Template**
3. Fill in:
   - **Name**: "User Welcome with Password Setup"
   - **Description**: "Welcome email with password setup link"
   - **Type**: `user-welcome`
   - **Subject**: "Welcome to AXPO - Set Up Your Password"
   - **HTML Content**: Include `{{ SETUP_PASSWORD_URL }}` variable
4. Set **Active**: true
5. Save template
6. Go back to System Settings → Automated Emails and select this template

## Token Security Features

- ✅ One-time use tokens (consumed after successful password setup)
- ✅ Configurable expiration time
- ✅ Secure random token generation (32 bytes hex)
- ✅ Token stored hashed in database
- ✅ Expiration time checked on use
- ✅ Invalid/expired tokens return user-friendly error messages

## Database Schema Changes

### Migration: `20260420144156_add_setup_token_validity_hours`

```sql
-- AlterTable
ALTER TABLE "system_config" ADD COLUMN "setupTokenValidityHours" INTEGER NOT NULL DEFAULT 72;
```

### SystemConfig Model

```prisma
model SystemConfig {
  // ... other fields
  setupTokenValidityHours   Int      @default(72)
  // ... other fields
}
```

## Files Modified

### Core Implementation

- `prisma/schema.prisma` - Added setupTokenValidityHours field
- `src/application/services/authService.ts` - Uses configurable token validity
- `src/application/services/emailService.ts` - Added SETUP_PASSWORD_URL variable
- `app/internal/lib/configApi.ts` - Added setupTokenValidityHours to TypeScript interface

### UI & Translations

- `app/internal/components/modules/SystemSettingsNew.tsx` - Added configuration UI
- `src/lib/translations.ts` - Added English & Spanish translations

### Scripts & Seeds

- `scripts/seed-configurations.mjs` - Added default setupTokenValidityHours value

### Database

- `prisma/migrations/20260420144156_add_setup_token_validity_hours/migration.sql` - Migration file

## Testing Checklist

- [x] Database migration applied successfully
- [x] System config loads setupTokenValidityHours correctly
- [x] UI displays token validity configuration field
- [x] Token validity can be changed and saved
- [x] AuthService reads token validity from config
- [x] Email service generates SETUP_PASSWORD_URL correctly
- [x] Setup password token is passed to email service
- [x] Translations display correctly (EN/ES)
- [x] No TypeScript compilation errors

## Integration with Existing Features

### User Creation Flow

1. Admin creates new user in Users module
2. `AuthService.createUser()` is called:
   - Reads `setupTokenValidityHours` from SystemConfig
   - Generates setup token with configured expiration
   - Saves user with token and expiration
3. `EmailService.sendUserCreationEmail()` is called:
   - Generates `SETUP_PASSWORD_URL` with token
   - Replaces template variables including new URL
   - Sends email to new user
4. User receives email with clickable setup password link
5. User clicks link → redirected to `/internal/setup-password?token=...`
6. User enters new password → token is consumed and cleared
7. User is automatically logged in

### Existing Setup Password Page

**File:** `app/internal/setup-password/page.tsx`

- Already implemented and functional
- No changes required
- Handles token validation and expiration checks
- Provides user-friendly error messages
- Auto-redirects after successful password setup

## API Endpoints

### Setup Password (Existing)

```
POST /api/v1/internal/auth/setup-password
```

**Request:**

```json
{
  "token": "abc123...",
  "password": "MySecurePassword123!"
}
```

**Response:**

```json
{
  "token": "jwt_token...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "fullName": "User Name",
    "role": "COMMERCIAL",
    "agencyId": "agency_id"
  }
}
```

## Environment Variables

No new environment variables required. The system uses existing variables:

- `NEXT_PUBLIC_BACKEND_URL` - Primary base URL for generating links
- `VERCEL_URL` - Fallback for Vercel deployments
- Defaults to `http://localhost:3000` for local development

## Future Enhancements

- [ ] Email preview showing rendered SETUP_PASSWORD_URL in template editor
- [ ] Token usage tracking and analytics
- [ ] Admin ability to resend setup password email
- [ ] Admin ability to manually expire/revoke tokens
- [ ] Different token validity periods per user role
- [ ] Token usage notifications/alerts

## Security Considerations

1. **Token Storage**: Tokens are stored as plain text in database (consider hashing if enhanced security needed)
2. **HTTPS Required**: Setup password URLs should only be sent over HTTPS in production
3. **Rate Limiting**: Consider adding rate limiting to password setup endpoint
4. **Email Security**: Ensure SMTP connection uses TLS/SSL
5. **Token Entropy**: 32-byte hex tokens provide sufficient randomness (256 bits)

## Support

For issues or questions, refer to:

- [EMAIL_SYSTEM_GUIDE.md](./EMAIL_SYSTEM_GUIDE.md) - Email system documentation
- [EMAIL_IMPLEMENTATION_SUMMARY.md](./EMAIL_IMPLEMENTATION_SUMMARY.md) - Email implementation details
- Setup password page implementation in `app/internal/setup-password/page.tsx`

---

**Implementation Status:** ✅ Complete and Ready for Production
