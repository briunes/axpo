import nodemailer from "nodemailer";
import { prisma } from "@/infrastructure/database/prisma";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: any[];
  // Metadata for logging
  templateId?: string;
  templateName?: string;
  triggeredBy?: string;
  triggeredByUserId?: string;
  variables?: Record<string, string>;
  relatedUserId?: string;
  relatedSimulationId?: string;
}

interface SendTemplateEmailOptions {
  to: string;
  templateId: string;
  variables?: Record<string, string>;
  // Metadata for logging
  triggeredBy?: string;
  triggeredByUserId?: string;
  relatedUserId?: string;
  relatedSimulationId?: string;
}

export class EmailService {
  /**
   * Get SMTP configuration from database
   */
  private static async getSMTPConfig() {
    const config = await prisma.systemConfig.findFirst();

    if (!config) {
      throw new Error("System configuration not found");
    }

    if (
      !config.smtpHost ||
      !config.smtpUser ||
      !config.smtpPassword ||
      !config.smtpFromEmail
    ) {
      throw new Error(
        "SMTP configuration is incomplete. Please configure SMTP settings in the system configuration.",
      );
    }

    return {
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      user: config.smtpUser,
      password: config.smtpPassword,
      fromEmail: config.smtpFromEmail,
      fromName: config.smtpFromName || "Axpo Simulator",
    };
  }

  /**
   * Create a nodemailer transporter with current SMTP configuration
   */
  private static async createTransporter() {
    const config = await this.getSMTPConfig();

    // Port 465 uses direct SSL (secure: true)
    // Port 587 uses STARTTLS (secure: false, requireTLS: true)
    // Automatically determine the correct settings based on port
    const isPort465 = config.port === 465;
    const useSecure = isPort465;
    const useRequireTLS = !isPort465;

    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: useSecure, // true for port 465, false for port 587
      requireTLS: useRequireTLS, // true for port 587, false for port 465
      auth: {
        user: config.user,
        pass: config.password,
      },
      tls: {
        // Do not fail on invalid certs (for self-signed certificates in development)
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
  }

  /**
   * Replace template variables in content
   */
  private static replaceVariables(
    content: string,
    variables: Record<string, string>,
  ): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      result = result.replace(regex, value || "");
    }
    return result;
  }

  /**
   * Send an email with custom content and log it
   */
  static async sendEmail(options: EmailOptions): Promise<void> {
    const logData = {
      recipientEmail: options.to,
      subject: options.subject,
      htmlBody: options.html,
      templateId: options.templateId,
      templateName: options.templateName,
      triggeredBy: options.triggeredBy,
      triggeredByUserId: options.triggeredByUserId,
      variables: options.variables || {},
      relatedUserId: options.relatedUserId,
      relatedSimulationId: options.relatedSimulationId,
      status: "sent" as const,
      errorMessage: null,
    };

    try {
      const transporter = await this.createTransporter();
      const config = await this.getSMTPConfig();

      await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      // Log successful send
      await prisma.emailLog.create({ data: logData });

      console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      // Log failed send
      await prisma.emailLog.create({
        data: {
          ...logData,
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        },
      });

      console.error("Failed to send email:", error);
      throw new Error(
        `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Send an email using a template from the database
   */
  static async sendTemplateEmail(
    options: SendTemplateEmailOptions,
  ): Promise<void> {
    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: options.templateId },
      });

      if (!template) {
        throw new Error(`Email template not found: ${options.templateId}`);
      }

      if (!template.active) {
        throw new Error(`Email template is inactive: ${options.templateId}`);
      }

      const variables = options.variables || {};
      const subject = this.replaceVariables(template.subject, variables);
      const html = this.replaceVariables(template.htmlContent, variables);

      await this.sendEmail({
        to: options.to,
        subject,
        html,
        templateId: template.id,
        templateName: template.name,
        triggeredBy: options.triggeredBy,
        triggeredByUserId: options.triggeredByUserId,
        variables,
        relatedUserId: options.relatedUserId,
        relatedSimulationId: options.relatedSimulationId,
      });
    } catch (error) {
      console.error("Failed to send template email:", error);
      throw error;
    }
  }

  /**
   * Send a user creation welcome email
   */
  static async sendUserCreationEmail(options: {
    userEmail: string;
    userName: string;
    userPin: string;
    userPassword?: string;
    setupToken?: string;
    userId?: string;
    triggeredByUserId?: string;
  }): Promise<void> {
    try {
      const config = await prisma.systemConfig.findFirst();

      if (!config?.userCreationEmailTemplateId) {
        console.warn(
          "User creation email template not configured. Skipping email.",
        );
        return;
      }

      // Generate the setup password URL if a token is provided
      const baseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.VERCEL_URL ||
        "http://localhost:3000";
      const setupPasswordUrl = options.setupToken
        ? `${baseUrl}/internal/setup-password?token=${options.setupToken}`
        : "";

      const variables = {
        USER_NAME: options.userName,
        USER_EMAIL: options.userEmail,
        USER_PIN: options.userPin,
        USER_PASSWORD:
          options.userPassword || "Please check with your administrator",
        SETUP_PASSWORD_URL: setupPasswordUrl,
      };

      await this.sendTemplateEmail({
        to: options.userEmail,
        templateId: config.userCreationEmailTemplateId,
        variables,
        triggeredBy: "user-creation",
        triggeredByUserId: options.triggeredByUserId,
        relatedUserId: options.userId,
      });

      console.log(`User creation email sent to ${options.userEmail}`);
    } catch (error) {
      // Log the error but don't fail user creation if email fails
      console.error("Failed to send user creation email:", error);
    }
  }

  /**
   * Send a password reset email
   */
  static async sendPasswordResetEmail(options: {
    userEmail: string;
    userName: string;
    resetToken: string;
    userId?: string;
  }): Promise<void> {
    try {
      const config = await prisma.systemConfig.findFirst();

      if (!config?.passwordResetEmailTemplateId) {
        console.warn(
          "Password reset email template not configured. Skipping email.",
        );
        return;
      }

      // Generate the reset password URL
      const baseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.VERCEL_URL ||
        "http://localhost:3000";
      const resetPasswordUrl = `${baseUrl}/internal/reset-password?token=${options.resetToken}`;

      const variables = {
        USER_NAME: options.userName,
        USER_EMAIL: options.userEmail,
        RESET_PASSWORD_URL: resetPasswordUrl,
      };

      await this.sendTemplateEmail({
        to: options.userEmail,
        templateId: config.passwordResetEmailTemplateId,
        variables,
        triggeredBy: "password-reset-request",
        relatedUserId: options.userId,
      });

      console.log(`Password reset email sent to ${options.userEmail}`);
    } catch (error) {
      // Log the error but don't fail the reset request if email fails
      console.error("Failed to send password reset email:", error);
      throw error; // Re-throw to let caller know email failed
    }
  }

  /**
   * Test SMTP configuration
   */
  static async testSMTPConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const transporter = await this.createTransporter();
      await transporter.verify();
      return {
        success: true,
        message: "SMTP connection successful",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
