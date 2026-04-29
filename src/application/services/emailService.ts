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
        // The SMTP server's TLS certificate may be issued for a shared hosting
        // hostname (e.g. *.servidor-correo.net) rather than the branded host
        // (e.g. mail.axpoiberia.es). Setting rejectUnauthorized to false allows
        // the connection while still using TLS encryption.
        rejectUnauthorized: false,
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
    const attachmentsCount = options.attachments?.length ?? 0;
    const tag = `[EmailService][${options.triggeredBy ?? "manual"}]`;

    console.log(`${tag} ── START sendEmail ──────────────────────────────────`);
    console.log(`${tag} to            : ${options.to}`);
    console.log(`${tag} subject       : ${options.subject}`);
    console.log(`${tag} templateId    : ${options.templateId ?? "(none)"}`);
    console.log(`${tag} templateName  : ${options.templateName ?? "(none)"}`);
    console.log(`${tag} triggeredBy   : ${options.triggeredBy ?? "(none)"}`);
    console.log(
      `${tag} triggeredByUserId: ${options.triggeredByUserId ?? "(none)"}`,
    );
    console.log(`${tag} relatedUserId : ${options.relatedUserId ?? "(none)"}`);
    console.log(
      `${tag} relatedSimulationId: ${options.relatedSimulationId ?? "(none)"}`,
    );
    console.log(`${tag} attachments   : ${attachmentsCount}`);
    if (options.variables && Object.keys(options.variables).length > 0) {
      console.log(`${tag} variables     :`, JSON.stringify(options.variables));
    }

    const baseLogData = {
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
      hasAttachments: attachmentsCount > 0,
      attachmentsCount,
    };

    const startedAt = Date.now();

    try {
      console.log(`${tag} [1/4] Loading SMTP config from database…`);
      const config = await this.getSMTPConfig();
      console.log(
        `${tag} [1/4] SMTP config loaded — host=${config.host} port=${config.port} secure=${config.secure ?? false} from="${config.fromName}" <${config.fromEmail}>`,
      );

      console.log(`${tag} [2/4] Creating nodemailer transporter…`);
      const transporter = await this.createTransporter();
      console.log(`${tag} [2/4] Transporter created`);

      console.log(`${tag} [3/4] Calling transporter.sendMail…`);
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      const durationMs = Date.now() - startedAt;
      console.log(
        `${tag} [3/4] sendMail returned — messageId=${info.messageId} response="${info.response}" accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)} duration=${durationMs}ms`,
      );

      console.log(`${tag} [4/4] Writing success log to database…`);
      await prisma.emailLog.create({
        data: {
          ...baseLogData,
          status: "sent",
          errorMessage: null,
          smtpHost: config.host,
          smtpPort: config.port,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          messageId: info.messageId ?? null,
          smtpResponse: info.response ?? null,
          durationMs,
        },
      });
      console.log(`${tag} [4/4] Log saved to database`);

      console.log(
        `${tag} ── DONE (success) ${durationMs}ms ─────────────────────────`,
      );
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      console.error(
        `${tag} ── ERROR after ${durationMs}ms ─────────────────────────────`,
      );
      console.error(
        `${tag} error message :`,
        error instanceof Error ? error.message : error,
      );
      console.error(
        `${tag} error stack   :`,
        error instanceof Error ? error.stack : "(no stack)",
      );

      // Try to capture SMTP config even on failure (best-effort)
      let smtpHost: string | undefined;
      let smtpPort: number | undefined;
      let fromEmail: string | undefined;
      let fromName: string | undefined;
      try {
        const config = await this.getSMTPConfig();
        smtpHost = config.host;
        smtpPort = config.port;
        fromEmail = config.fromEmail;
        fromName = config.fromName;
      } catch (configError) {
        console.error(
          `${tag} could not fetch SMTP config for error log:`,
          configError instanceof Error ? configError.message : configError,
        );
      }

      console.log(`${tag} Writing failure log to database…`);
      await prisma.emailLog.create({
        data: {
          ...baseLogData,
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? (error.stack ?? null) : null,
          smtpHost: smtpHost ?? null,
          smtpPort: smtpPort ?? null,
          fromEmail: fromEmail ?? null,
          fromName: fromName ?? null,
          durationMs,
        },
      });
      console.log(`${tag} Failure log saved to database`);
      console.error(
        `${tag} ── END (failed) ─────────────────────────────────────────`,
      );

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
        process.env.NEXT_PUBLIC_BACKEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || "http://localhost:3000";
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
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
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
