# Password Reset System Implementation

## Overview

Complete forgot password system implemented, following the same pattern as the user setup system. Users can now request a password reset link via email and reset their password using a secure token.

## Changes Made

### 1. Database Schema

**File:** `prisma/schema.prisma`

Added password reset token fields to the User model:

```prisma
passwordResetToken          String?   @unique
passwordResetTokenExpiresAt DateTime?
```

Added configuration for password reset token validity to SystemConfig:

```prisma
passwordResetEmailTemplateId String?
passwordResetTokenValidityHours Int @default(24)
```

**Migration:** `20260420150804_add_password_reset_tokens`

- Applied successfully ✅

### 2. Backend Services

#### AuthService (`src/application/services/authService.ts`)

**New Methods:**

1. `requestPasswordReset(email: string)`
   - Generates a secure reset token
   - Stores token with expiration (24 hours default, configurable)
   - Sends password reset email
   - Returns success even if email doesn't exist (prevents email enumeration)

2. `resetPassword(token: string, newPassword: string)`
   - Validates the reset token
   - Checks token expiration
   - Validates password policy
   - Updates password and consumes token
   - Returns JWT token for auto-login

#### EmailService (`src/application/services/emailService.ts`)

**New Method:**

1. `sendPasswordResetEmail(options)`
   - Sends templated email with reset link
   - Variables: USER_NAME, USER_EMAIL, RESET_PASSWORD_URL
   - Template ID configured in SystemConfig

### 3. API Endpoints

Created two new public authentication endpoints:

#### POST `/api/v1/internal/auth/forgot-password`

**File:** `app/api/v1/internal/auth/forgot-password/route.ts`

- Accepts: `{ email: string }`
- Returns: `{ success: true }` (always, for security)
- No authentication required

#### POST `/api/v1/internal/auth/reset-password`

**File:** `app/api/v1/internal/auth/reset-password/route.ts`

- Accepts: `{ token: string, password: string }`
- Returns: JWT token + user info
- No authentication required
- Validates password policy (12+ chars, upper, lower, number, special)

### 4. Frontend Pages

#### Forgot Password Page

**File:** `app/internal/forgot-password/page.tsx`

- Email input form
- Success message (doesn't reveal if email exists)
- Back to login link
- Full i18n support

#### Reset Password Page

**File:** `app/internal/reset-password/page.tsx`

- Token extracted from URL query parameter
- Password and confirm password fields
- Password strength indicator (Weak, Fair, Good, Strong)
- Real-time validation
- Auto-login on success
- Redirects to simulations page

#### Login Page Updates

**File:** `app/internal/login/page.tsx`

- Added "Forgot your password?" link below password input
- Links to `/internal/forgot-password`

### 5. API Client Functions

**File:** `app/internal/lib/internalApi.ts`

Added two new functions:

```typescript
forgotPassword(email: string): Promise<{ success: boolean }>
resetPassword(token: string, password: string): Promise<LoginResult>
```

### 6. Translations

**File:** `src/lib/translations.ts`

Added complete translations for both English and Spanish:

**English:**

- `login.forgotPassword`: "Forgot your password?"
- `forgotPassword.*`: All forgot password page strings
- `resetPassword.*`: All reset password page strings

**Spanish:**

- `login.forgotPassword`: "¿Olvidaste tu contraseña?"
- `forgotPassword.*`: All Spanish translations
- `resetPassword.*`: All Spanish translations

### 7. Layout Configuration

**File:** `app/internal/layout.tsx`

Excluded forgot-password and reset-password pages from workspace wrapper (public pages).

### 8. Email Template

**File:** `scripts/seed-password-reset-template.mjs`

Created seed script for password reset email template:

- Professional HTML design matching user creation email
- Security notice for unauthorized requests
- 24-hour expiration warning
- Plain text alternative
- Variables: USER_NAME, USER_EMAIL, RESET_PASSWORD_URL

**To run:** `node scripts/seed-password-reset-template.mjs`

## Security Features

1. **Token Expiration:** Reset tokens expire after 24 hours (configurable)
2. **One-Time Use:** Tokens are consumed (deleted) after successful use
3. **Email Enumeration Prevention:** Always returns success, doesn't reveal if email exists
4. **Secure Token Generation:** Uses crypto.randomBytes(32) for cryptographically secure tokens
5. **Password Policy Enforcement:** Min 12 chars, uppercase, lowercase, number, special character
6. **Inactive User Protection:** Silently fails for inactive users

## User Flow

1. User clicks "Forgot your password?" on login page
2. User enters email address on forgot password page
3. System generates reset token and sends email (if account exists)
4. User receives email with reset link: `/internal/reset-password?token=...`
5. User clicks link, enters new password
6. Password validated against policy
7. Password updated, user auto-logged in
8. Redirected to simulations page

## Configuration

System admins should configure in System Configuration:

- `passwordResetEmailTemplateId`: ID of the email template to use
- `passwordResetTokenValidityHours`: Hours before token expires (default: 24)

## Testing

To test the system:

1. Run seed script to create email template
2. Configure SMTP settings in system configuration
3. Navigate to `/internal/login`
4. Click "Forgot your password?"
5. Enter email and submit
6. Check email for reset link
7. Click link and set new password

## Files Created

- `app/api/v1/internal/auth/forgot-password/route.ts`
- `app/api/v1/internal/auth/reset-password/route.ts`
- `app/internal/forgot-password/page.tsx`
- `app/internal/reset-password/page.tsx`
- `scripts/seed-password-reset-template.mjs`

## Files Modified

- `prisma/schema.prisma`
- `src/application/services/authService.ts`
- `src/application/services/emailService.ts`
- `app/internal/lib/internalApi.ts`
- `app/internal/login/page.tsx`
- `app/internal/layout.tsx`
- `src/lib/translations.ts`

## Next Steps

1. Run the seed script: `node scripts/seed-password-reset-template.mjs`
2. Configure SMTP settings if not already done
3. Test the complete flow
4. Optional: Customize email template design in admin panel
