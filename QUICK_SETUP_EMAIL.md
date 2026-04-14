# Quick Setup Guide - Email System

## 🚀 Quick Start (5 Minutes)

### Step 1: Start the Application

```bash
pnpm dev
```

### Step 2: Login as Admin

Navigate to your application and login with admin credentials.

### Step 3: Configure SMTP (Required)

1. Go to **Configurations** → **System Settings**
2. Click on the **SMTP Email** tab
3. Fill in your SMTP settings:

   **For Gmail (Example):**

   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   Use Secure Connection: ✓ (checked)
   SMTP Username: your-email@gmail.com
   SMTP Password: your-app-password
   From Email: your-email@gmail.com
   From Name: Axpo Simulator
   ```

   **Note:** For Gmail, you need to create an [App Password](https://support.google.com/accounts/answer/185833)

4. Click **Save Changes**

### Step 4: Configure Automated Email (Optional)

1. Stay in **Configurations** → **System Settings**
2. Click on the **Automated Emails** tab
3. For **User Creation Email Template**, select:
   - **User Welcome Email**
4. Click **Save Changes**

### Step 5: Test It!

Create a new user and check if they receive the welcome email.

## 📧 Testing SMTP Connection

### Via API (Recommended)

```bash
curl -X POST http://localhost:3000/api/v1/internal/config/smtp/test \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Via User Creation

Just create a test user - if email sending is enabled, they'll get a welcome email!

## 🎯 Common SMTP Settings

### Gmail

```
Host: smtp.gmail.com
Port: 587 (TLS) or 465 (SSL)
Secure: Yes
Note: Use App Password, not your regular password
```

### Outlook/Office 365

```
Host: smtp.office365.com
Port: 587
Secure: Yes
```

### SendGrid

```
Host: smtp.sendgrid.net
Port: 587 or 465
Secure: Yes
Username: apikey
Password: <Your SendGrid API Key>
```

### Mailtrap (Testing)

```
Host: smtp.mailtrap.io
Port: 587 or 2525
Secure: No
Username: <From Mailtrap>
Password: <From Mailtrap>
```

## 🔧 Troubleshooting

### Emails Not Sending?

1. **Check SMTP Configuration**
   - Verify all fields are filled correctly
   - Test connection using the API endpoint

2. **Check Application Logs**
   Look for error messages in your terminal where `pnpm dev` is running

3. **Check Template Selection**
   - Make sure a template is selected in Automated Emails tab
   - Verify the template is marked as "Active"

4. **Gmail Users**
   - Enable 2-factor authentication
   - Create and use an App Password
   - Don't use your regular Gmail password

### Email Received but Looks Wrong?

Check the email template:

1. Go to **Configurations** → **Email Templates**
2. Find "User Welcome Email"
3. Click **Edit**
4. Verify the template content and variables

## 📝 Available Template Variables

When creating or editing templates, you can use these variables:

**User Welcome Email:**

- `{{ USER_NAME }}` - Full name
- `{{ USER_EMAIL }}` - Email address
- `{{ USER_PIN }}` - PIN code
- `{{ USER_PASSWORD }}` - Initial password

## 🔒 Security Tips

- ✅ Always use TLS/SSL in production
- ✅ Use app-specific passwords (not your main password)
- ✅ Keep SMTP credentials secure
- ✅ Consider not sending passwords in emails for production
- ✅ Use environment variables for sensitive config (future enhancement)

## 📚 More Information

- Full documentation: `EMAIL_SYSTEM_GUIDE.md`
- Implementation details: `EMAIL_IMPLEMENTATION_SUMMARY.md`

## ✅ Checklist

Before going to production:

- [ ] SMTP credentials configured
- [ ] SMTP connection tested successfully
- [ ] Email template selected for user creation
- [ ] Test user created and email received
- [ ] Email content reviewed and approved
- [ ] TLS/SSL enabled for SMTP
- [ ] Application logs monitored for errors

---

**Need Help?** Check the full documentation or contact your development team.
