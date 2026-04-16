# Email Tracking System - Implementation Summary

## Overview

A comprehensive email tracking system has been added to monitor all emails sent by the application. This provides admins with full visibility into email communications including status, content, metadata, and troubleshooting information.

## Features Implemented

### 1. Database Schema

- **New table**: `email_logs` with the following fields:
  - Tracking: `sentAt`, `status` (sent/failed), `errorMessage`
  - Recipient: `recipientEmail`
  - Content: `subject`, `htmlBody`, `templateId`, `templateName`
  - Metadata: `triggeredBy`, `triggeredByUserId`, `variables` (JSON)
  - Relations: `relatedUserId`, `relatedSimulationId`
  - Indexes on common query fields for performance

### 2. Email Service Logging

- **Auto-logging**: Every email sent through `EmailService.sendEmail()` is automatically logged
- **Status tracking**: Both successful and failed sends are logged
- **Metadata capture**: Template variables, triggering context, and user information
- **Error tracking**: Full error messages stored for failed sends

### 3. API Endpoints

- **GET /api/v1/internal/email-logs**: List emails with filtering
  - Filter by: status, triggeredBy, date range, search text
  - Pagination support
  - Includes triggeredByUser relation
- **GET /api/v1/internal/email-logs/[id]**: Get full email details
  - Complete email content and metadata
  - User information

### 4. Admin UI Module

- **Location**: `/internal/email-logs`
- **Features**:
  - Filterable email list (status, trigger type, date range, search)
  - Detailed view with full email content
  - HTML preview of emails
  - Template variables display
  - Error messages for failed sends
  - Pagination
- **Access**: Admin only

### 5. Navigation Integration

- Added "Email Logs" to sidebar navigation
- Email icon from Material-UI
- Accessible only to ADMIN role (via `section.email-logs` permission)
- Translations in English and Spanish

## Usage

### For Admins

1. **View all emails**: Navigate to Email Logs from the sidebar
2. **Filter emails**: Use dropdowns to filter by status or trigger type
3. **Search**: Search by recipient email, subject, or template name
4. **View details**: Click any email row to see full content
5. **Debug failures**: Failed emails show error messages

### Email Trigger Types

The system tracks different email origins:

- `user-creation`: Welcome emails when creating users
- `simulation-share`: Emails sent when sharing simulations
- `test-email`: Test emails sent from email template configuration

### Adding New Email Types

When sending emails programmatically, pass metadata:

```typescript
await EmailService.sendTemplateEmail({
  to: recipientEmail,
  templateId: templateId,
  variables: variables,
  triggeredBy: "your-trigger-type", // e.g., "password-reset"
  triggeredByUserId: userId, // User who triggered the email
  relatedUserId: targetUserId, // Related user (optional)
  relatedSimulationId: simId, // Related simulation (optional)
});
```

## Files Modified/Created

### Database

- `prisma/schema.prisma` - Added EmailLog model
- `prisma/migrations/20260416131253_add_email_logs/` - Migration

### Backend

- `src/application/services/emailService.ts` - Auto-logging in sendEmail()
- `src/application/services/authService.ts` - Pass metadata for user creation emails
- `app/api/v1/internal/email-logs/route.ts` - List endpoint
- `app/api/v1/internal/email-logs/[id]/route.ts` - Detail endpoint
- `app/api/v1/internal/config/email-templates/test/route.ts` - Updated to pass metadata

### Frontend

- `app/internal/email-logs/page.tsx` - Page component
- `app/internal/components/modules/EmailLogsModule.tsx` - Main module component
- `app/internal/components/modules/index.ts` - Export
- `app/internal/components/ui/icons.tsx` - EmailLogsIcon
- `app/internal/components/layout/SectionMenu.tsx` - Navigation
- `app/internal/components/InternalWorkspace.tsx` - Workspace integration
- `app/internal/layout.tsx` - Route handling
- `src/lib/translations.ts` - Translations

## Security

- **Access Control**: Email logs are only accessible to ADMIN role
- **Sensitive Data**: Email content and variables are stored in full (consider data retention policies)
- **Audit Trail**: All emails are permanently logged for compliance

## Performance Considerations

- **Indexes**: Added on `sentAt`, `recipientEmail`, `triggeredBy`, `status`, `triggeredByUserId`
- **Pagination**: Default 50 items per page, max 500
- **Query optimization**: Filters use indexed fields

## Future Enhancements

Potential additions:

- Email resend functionality
- Bulk email operations tracking
- Email statistics dashboard
- Data retention/archival policies
- Export email logs to CSV
- Email delivery status webhooks (if SMTP provider supports)
- Link tracking (track when links in emails are clicked)

## Testing

To test the system:

1. **Create a user**: Should log a "user-creation" email
2. **Test an email template**: Should log a "test-email"
3. **Check failures**: Configure invalid SMTP settings and try sending
4. **View in UI**: Navigate to Email Logs and verify all data is visible

## Migration

The migration has been applied to your database. The system will start logging all emails immediately.
