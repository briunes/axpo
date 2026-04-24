/**
 * Seed script to create the password reset email template
 * Run with: node scripts/seed-password-reset-template.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const passwordResetTemplate = {
  name: "Password Reset",
  subject: "Reset your password - AXPO Simulator",
  bodyHtml: `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tbody><tr>
    <td align="center">

      <!-- MAIN CONTAINER -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;">

        <!-- HEADER -->
        <tbody><tr>
  <td align="center" style="background-color:#f3f3f3; padding:20px; text-align:center;">
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tbody><tr>
        <td align="center">
          <img src="https://tuenergia.axpo.com/wp-content/uploads/2025/12/Axpo_logo.png" alt="Axpo Logo" style="display:block; margin:0 auto; border:0; max-width:200px; height:auto;">
        </td>
      </tr>
    </tbody></table>

  </td>
</tr>

        <!-- CONTENT -->
        <tr>
          <td style="background-color:#f9f9f9; padding:30px;">

            <p style="margin:0 0 15px 0;">
              Hello <strong>{{ USER_NAME }}</strong>,
            </p>

            <p style="margin:0 0 15px 0;">
              We received a request to reset the password for your Axpo Simulator account (<strong>{{ USER_EMAIL }}</strong>). 
              To reset your password, click the button below.
            </p>

            <!-- RESET PASSWORD BUTTON -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:25px 0;">
              <tbody><tr>
                <td align="center">
                  <a href="{{ RESET_PASSWORD_URL }}" style="display:inline-block; padding:15px 40px; background-color:#FF3254; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:6px; font-size:16px;">
                    Reset Your Password
                  </a>
                </td>
              </tr>
            </tbody></table>

            <p style="margin:0 0 15px 0; font-size:13px; color:#666666;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="{{ RESET_PASSWORD_URL }}" style="color:#FF3254; word-break:break-all;">{{ RESET_PASSWORD_URL }}</a>
            </p>

            <!-- SECURITY WARNING BOX -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff5f5; border-left:4px solid #FF3254; margin:20px 0;">
              <tbody><tr>
                <td style="padding:15px;">

                  <p style="margin:0 0 10px 0; font-weight:bold; color:#FF3254;">
                    ⚠️ Security Notice
                  </p>

                  <p style="margin:0; font-size:13px; color:#666666;">
                    If you didn't request a password reset, please ignore this email. Your password will remain unchanged and no further action is required.
                  </p>

                </td>
              </tr>
            </tbody></table>

            <p style="margin:0 0 15px 0;">
              <strong style="color:#FF3254;">Important:</strong> This reset link will expire in 24 hours for security reasons. 
              Please complete your password reset as soon as possible.
            </p>

            <p style="margin:0 0 15px 0;">
              After resetting your password, you can log in to the platform using your email address and your new password.
            </p>

            <p style="margin:0 0 15px 0;">
              If you have any questions or need assistance, please contact your administrator.
            </p>

            <p style="margin:0;">
              Best regards,<br>
              The Axpo Simulator Team
            </p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="text-align:center; padding:20px; color:#666666; font-size:12px;">
            This is an automated message. Please do not reply to this email.
          </td>
        </tr>

      </tbody></table>

    </td>
  </tr>
</tbody></table>`,
  bodyText: `Password Reset Request

Hello {{ USER_NAME }},

We received a request to reset the password for your Axpo Simulator account ({{ USER_EMAIL }}).

To reset your password, visit this link:
{{ RESET_PASSWORD_URL }}

⚠️ SECURITY NOTICE
If you didn't request a password reset, please ignore this email. Your password will remain unchanged and no further action is required.

IMPORTANT: This reset link will expire in 24 hours for security reasons.

After resetting your password, you can log in to the platform using your email address and your new password.

If you have any questions or need assistance, please contact your administrator.

Best regards,
The Axpo Simulator Team

---
This is an automated message. Please do not reply to this email.`,
  availableVariables: ["USER_NAME", "USER_EMAIL", "RESET_PASSWORD_URL"],
  isActive: true,
};

async function main() {
  console.log("🚀 Seeding password reset email template...");

  // Check if template already exists
  const existing = await prisma.emailTemplate.findFirst({
    where: { name: passwordResetTemplate.name },
  });

  let templateId;

  if (existing) {
    console.log("✅ Password reset template already exists, updating...");
    await prisma.emailTemplate.update({
      where: { id: existing.id },
      data: passwordResetTemplate,
    });
    templateId = existing.id;
  } else {
    console.log("✅ Creating password reset template...");
    const template = await prisma.emailTemplate.create({
      data: passwordResetTemplate,
    });
    templateId = template.id;
  }

  // Always update system config to reference this template
  const systemConfig = await prisma.systemConfig.findFirst();
  if (systemConfig) {
    await prisma.systemConfig.update({
      where: { id: systemConfig.id },
      data: { passwordResetEmailTemplateId: templateId },
    });
    console.log(
      "✅ System config updated with password reset template ID:",
      templateId
    );
  } else {
    console.log(
      "⚠️  No system config found. Please create one and set passwordResetEmailTemplateId to:",
      templateId
    );
  }

  console.log("✅ Password reset email template seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding password reset template:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
