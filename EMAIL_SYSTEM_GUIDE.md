# Email System Documentation

## Overview

The Axpo Simulator now includes a fully integrated email system that supports SMTP email sending and automated emails for various user actions. This system is configurable through the admin panel and supports HTML email templates with variable substitution.

## Features

- ✅ SMTP configuration through admin panel
- ✅ Email template management
- ✅ Automated emails on user creation
- ✅ Variable substitution in email templates
- ✅ SMTP connection testing
- ✅ Secure credential storage
- ✅ Async email sending (non-blocking)

## Configuration

### SMTP Settings

Configure your SMTP server settings in the admin panel:

1. Navigate to **Configurations** → **System Settings** → **SMTP Email** tab
2. Configure the following settings:
   - **SMTP Host**: Your SMTP server hostname (e.g., `smtp.gmail.com`)
   - **SMTP Port**: Server port (587 for TLS, 465 for SSL, 25 for non-secure)
   - **Use Secure Connection**: Enable SSL/TLS encryption
   - **SMTP Username**: Authentication username
   - **SMTP Password**: Authentication password
   - **From Email Address**: Email address that appears as sender
   - **From Name**: Display name for the sender

### Automated Email Templates

Configure which email templates to use for automated emails:

1. Navigate to **Configurations** → **System Settings** → **Automated Emails** tab
2. Select templates for:
   - **User Creation Email Template**: Email sent when a new user is created

## Email Templates

### Available Template Types

- `user-welcome`: Welcome email sent to new users
- `simulation-share`: Email for sharing simulations with clients
- `magic-link`: Magic link authentication emails
- `password-reset`: Password reset emails
- `expiring-soon`: Simulation expiration reminders
- `notification`: General notifications

### Template Variables

Email templates support variable substitution. Available variables depend on the template type:

#### User Welcome Email Variables

- `{{ USER_NAME }}`: Full name of the user
- `{{ USER_EMAIL }}`: Email address of the user
- `{{ USER_PIN }}`: User's PIN code
- `{{ USER_PASSWORD }}`: User's initial password

### Creating Email Templates

1. Navigate to **Configurations** → **Email Templates**
2. Click **+ New Template**
3. Fill in:
   - **Name**: Template name
   - **Description**: Brief description
   - **Type**: Select template type (e.g., `user-welcome`)
   - **Subject**: Email subject line (supports variables)
   - **HTML Content**: HTML email body (supports variables)
4. Set **Active** to enable the template
5. Click **Save**

### Template Variable Syntax

Use double curly braces for variables:

```html
<p>Hello {{ USER_NAME }},</p>
<p>Your email is: {{ USER_EMAIL }}</p>
```

## API Endpoints

### Test SMTP Connection

**POST** `/api/v1/internal/config/smtp/test`

Tests the SMTP connection with current settings.

**Response:**

```json
{
  "success": true,
  "message": "SMTP connection successful"
}
```

## EmailService API

The `EmailService` class provides methods for sending emails programmatically:

### Send Custom Email

```typescript
import { EmailService } from "@/application/services/emailService";

await EmailService.sendEmail({
  to: "user@example.com",
  subject: "Custom Email",
  html: "<p>Email content</p>",
  text: "Email content", // optional plain text version
});
```

### Send Template Email

```typescript
await EmailService.sendTemplateEmail({
  to: "user@example.com",
  templateId: "template-id",
  variables: {
    USER_NAME: "John Doe",
    USER_EMAIL: "john@example.com",
  },
});
```

### Send User Creation Email

```typescript
await EmailService.sendUserCreationEmail({
  userEmail: "newuser@example.com",
  userName: "New User",
  userPin: "1234",
  userPassword: "temporary-password",
});
```

### Test SMTP Connection

```typescript
const result = await EmailService.testSMTPConnection();
console.log(result); // { success: true, message: "..." }
```

## Security Considerations

1. **Credentials**: SMTP credentials are stored in the database. Ensure your database is properly secured.
2. **TLS/SSL**: Always use secure connections (SSL/TLS) for production SMTP servers.
3. **Password Display**: Be cautious about including passwords in emails. Consider using password reset links instead.
4. **Email Validation**: The system validates email addresses before sending.
5. **Error Handling**: Email sending errors are logged but don't block user creation or other operations.

## Troubleshooting

### Email Not Sending

1. **Check SMTP Configuration**:
   - Verify all SMTP settings are correct
   - Use the SMTP test endpoint to verify connection
   - Check SMTP server logs for authentication issues

2. **Check Email Template Configuration**:
   - Ensure the template is active
   - Verify the template is selected in system settings
   - Check template variables are correctly formatted

3. **Check Application Logs**:
   ```bash
   # Look for email-related errors in your application logs
   grep -i "email" logs/app.log
   ```

### Common SMTP Providers

#### Gmail

- Host: `smtp.gmail.com`
- Port: `587` (TLS) or `465` (SSL)
- Note: Enable "Less secure app access" or use App Password

#### Outlook/Office365

- Host: `smtp.office365.com`
- Port: `587` (TLS)

#### SendGrid

- Host: `smtp.sendgrid.net`
- Port: `587` (TLS) or `465` (SSL)
- Username: `apikey`
- Password: Your SendGrid API key

#### Amazon SES

- Host: `email-smtp.[region].amazonaws.com`
- Port: `587` (TLS) or `465` (SSL)
- Use SMTP credentials from AWS Console

## Implementation Details

### User Creation Flow

When a new user is created:

1. User record is created in database
2. Email is sent asynchronously (non-blocking)
3. If email fails, error is logged but user creation succeeds
4. Email includes login credentials and PIN

### Email Template Rendering

1. System retrieves template from database
2. Variables are replaced using regex pattern matching
3. Subject line and HTML content are processed
4. Email is sent via configured SMTP server

## Future Enhancements

Potential future improvements:

- [ ] Email queue for batch sending
- [ ] Email delivery tracking
- [ ] Email open/click tracking
- [ ] Multiple SMTP configurations
- [ ] Email scheduling
- [ ] Rich text editor for templates
- [ ] Email preview functionality
- [ ] Attachment support
- [ ] Email analytics dashboard

## Support

For issues or questions about the email system, please contact the development team or refer to the main project documentation.
