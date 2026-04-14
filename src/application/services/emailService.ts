import nodemailer from "nodemailer";
import { prisma } from "@/infrastructure/database/prisma";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: any[];
}

interface SendTemplateEmailOptions {
  to: string;
  templateId: string;
  variables?: Record<string, string>;
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

    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
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
   * Send an email with custom content
   */
  static async sendEmail(options: EmailOptions): Promise<void> {
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

      console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
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
  }): Promise<void> {
    try {
      const config = await prisma.systemConfig.findFirst();

      if (!config?.userCreationEmailTemplateId) {
        console.warn(
          "User creation email template not configured. Skipping email.",
        );
        return;
      }

      const variables = {
        USER_NAME: options.userName,
        USER_EMAIL: options.userEmail,
        USER_PIN: options.userPin,
        USER_PASSWORD:
          options.userPassword || "Please check with your administrator",
      };

      await this.sendTemplateEmail({
        to: options.userEmail,
        templateId: config.userCreationEmailTemplateId,
        variables,
      });

      console.log(`User creation email sent to ${options.userEmail}`);
    } catch (error) {
      // Log the error but don't fail user creation if email fails
      console.error("Failed to send user creation email:", error);
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
