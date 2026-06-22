import nodemailer from "nodemailer";
import { prisma } from "@/infrastructure/database/prisma";
import { resolveTranslation, DEFAULT_LANGUAGE } from "@/lib/supportedLanguages";

const EMAIL_DEBUG_LOGS =
  process.env.NODE_ENV !== "production" ||
  process.env.EMAIL_DEBUG_LOGS === "true";

const debugEmailLog = (...args: unknown[]) => {
  if (EMAIL_DEBUG_LOGS) console.log(...args);
};

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
  languageCode?: string;
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

    // Inject built-in system variables (can be overridden by caller-supplied variables)
    const systemVars: Record<string, string> = {
      CURRENT_YEAR: new Date().getFullYear().toString(),
    };

    const merged = { ...systemVars, ...variables };

    for (const [key, value] of Object.entries(merged)) {
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

    debugEmailLog(`${tag} START sendEmail`);
    debugEmailLog(`${tag} templateId    : ${options.templateId ?? "(none)"}`);
    debugEmailLog(`${tag} templateName  : ${options.templateName ?? "(none)"}`);
    debugEmailLog(`${tag} triggeredBy   : ${options.triggeredBy ?? "(none)"}`);
    debugEmailLog(
      `${tag} triggeredByUserId: ${options.triggeredByUserId ?? "(none)"}`,
    );
    debugEmailLog(`${tag} relatedUserId : ${options.relatedUserId ?? "(none)"}`);
    debugEmailLog(
      `${tag} relatedSimulationId: ${options.relatedSimulationId ?? "(none)"}`,
    );
    debugEmailLog(`${tag} attachments   : ${attachmentsCount}`);
    if (options.variables && Object.keys(options.variables).length > 0) {
      debugEmailLog(`${tag} variable keys :`, Object.keys(options.variables));
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
      debugEmailLog(`${tag} [1/4] Loading SMTP config from database`);
      const config = await this.getSMTPConfig();
      debugEmailLog(
        `${tag} [1/4] SMTP config loaded host=${config.host} port=${config.port} secure=${config.secure ?? false}`,
      );

      debugEmailLog(`${tag} [2/4] Creating nodemailer transporter`);
      const transporter = await this.createTransporter();
      debugEmailLog(`${tag} [2/4] Transporter created`);

      debugEmailLog(`${tag} [3/4] Calling transporter.sendMail`);
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
        disableFileAccess: true,
        disableUrlAccess: true,
      });

      const durationMs = Date.now() - startedAt;
      debugEmailLog(
        `${tag} [3/4] sendMail returned messageId=${info.messageId} duration=${durationMs}ms`,
      );

      if (info.rejected && info.rejected.length > 0) {
        throw new Error(
          `Email rejected by SMTP server for recipient(s): ${info.rejected.join(", ")}`,
        );
      }

      debugEmailLog(`${tag} [4/4] Writing success log to database`);
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
      debugEmailLog(`${tag} [4/4] Log saved to database`);

      debugEmailLog(`${tag} DONE success ${durationMs}ms`);
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

      debugEmailLog(`${tag} Writing failure log to database`);
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
      debugEmailLog(`${tag} Failure log saved to database`);
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
        include: { translations: true },
      });

      if (!template) {
        throw new Error(`Email template not found: ${options.templateId}`);
      }

      if (!template.active) {
        throw new Error(`Email template is inactive: ${options.templateId}`);
      }

      const preferredLang = options.languageCode ?? DEFAULT_LANGUAGE;
      const translation = resolveTranslation(
        template.translations,
        preferredLang,
      );

      // Use translation if available, fall back to parent columns
      const subject = this.replaceVariables(
        translation?.subject ?? template.subject,
        options.variables ?? {},
      );
      const html = this.replaceVariables(
        translation?.htmlContent ?? template.htmlContent,
        options.variables ?? {},
      );

      await this.sendEmail({
        to: options.to,
        subject,
        html,
        templateId: template.id,
        templateName: template.name,
        triggeredBy: options.triggeredBy,
        triggeredByUserId: options.triggeredByUserId,
        variables: options.variables,
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
    languageCode?: string;
  }): Promise<void> {
    try {
      const config = await prisma.systemConfig.findFirst();

      if (!config?.userCreationEmailTemplateId) {
        console.warn(
          "User creation email template not configured. Skipping email.",
        );
        return;
      }

      // Resolve language: explicit > user preferences > system default
      let resolvedLanguage =
        options.languageCode ?? config.defaultLanguage ?? "en";
      if (!options.languageCode && options.userId) {
        const prefs = await prisma.userPreferences.findUnique({
          where: { userId: options.userId },
          select: { language: true },
        });
        if (prefs?.language) resolvedLanguage = prefs.language;
      }

      // Generate the setup password URL if a token is provided
      const baseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        "http://localhost:3000";
      const setupPasswordUrl = options.setupToken
        ? `${baseUrl}/internal/setup-password?token=${options.setupToken}`
        : "";
      const setupPasswordValidityHours =
        config.setupTokenValidityHours ?? 72;

      const variables = {
        USER_NAME: options.userName,
        USER_EMAIL: options.userEmail,
        USER_PIN: options.userPin,
        USER_PASSWORD:
          options.userPassword || "Please check with your administrator",
        SETUP_PASSWORD_URL: setupPasswordUrl,
        SETUP_PASSWORD_VALIDITY_HOURS: String(
          setupPasswordValidityHours,
        ),
      };

      await this.sendTemplateEmail({
        to: options.userEmail,
        templateId: config.userCreationEmailTemplateId,
        variables,
        languageCode: resolvedLanguage,
        triggeredBy: "user-creation",
        triggeredByUserId: options.triggeredByUserId,
        relatedUserId: options.userId,
      });

      debugEmailLog(`User creation email sent`);
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
    languageCode?: string;
  }): Promise<void> {
    try {
      const config = await prisma.systemConfig.findFirst();

      if (!config?.passwordResetEmailTemplateId) {
        console.warn(
          "Password reset email template not configured. Skipping email.",
        );
        return;
      }

      // Resolve language: explicit > user preferences > system default
      let resolvedLanguage =
        options.languageCode ?? config.defaultLanguage ?? "en";
      if (!options.languageCode && options.userId) {
        const prefs = await prisma.userPreferences.findUnique({
          where: { userId: options.userId },
          select: { language: true },
        });
        if (prefs?.language) resolvedLanguage = prefs.language;
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
        languageCode: resolvedLanguage,
        triggeredBy: "password-reset-request",
        relatedUserId: options.userId,
      });

      debugEmailLog(`Password reset email sent`);
    } catch (error) {
      // Log the error but don't fail the reset request if email fails
      console.error("Failed to send password reset email:", error);
      throw error; // Re-throw to let caller know email failed
    }
  }

  /**
   * Send a magic link login email
   */
  static async sendMagicLinkEmail(options: {
    userEmail: string;
    userName: string;
    magicLinkToken: string;
    userId?: string;
    languageCode?: string;
  }): Promise<void> {
    try {
      const config = await prisma.systemConfig.findFirst();

      if (!config?.magicLinkEmailTemplateId) {
        console.warn(
          "Magic link email template not configured. Skipping email.",
        );
        return;
      }

      let resolvedLanguage =
        options.languageCode ?? config.defaultLanguage ?? "en";
      if (!options.languageCode && options.userId) {
        const prefs = await prisma.userPreferences.findUnique({
          where: { userId: options.userId },
          select: { language: true },
        });
        if (prefs?.language) resolvedLanguage = prefs.language;
      }

      debugEmailLog("[EmailService][magic-link] env vars:", {
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        NODE_ENV: process.env.NODE_ENV,
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        "http://localhost:3000";

      const magicLinkUrl = `${baseUrl}/internal/login/magic?token=${options.magicLinkToken}`;
      const validityMinutes = config.magicLinkTokenValidityMinutes ?? 15;

      const variables = {
        USER_NAME: options.userName,
        USER_EMAIL: options.userEmail,
        MAGIC_LINK: magicLinkUrl,
        MAGIC_LINK_VALIDITY_MINUTES: String(validityMinutes),
      };

      await this.sendTemplateEmail({
        to: options.userEmail,
        templateId: config.magicLinkEmailTemplateId,
        variables,
        languageCode: resolvedLanguage,
        triggeredBy: "magic-link-request",
        relatedUserId: options.userId,
      });

      debugEmailLog(`Magic link email sent`);
    } catch (error) {
      console.error("Failed to send magic link email:", error);
      throw error;
    }
  }

  static async sendOtpEmail(options: {
    userEmail: string;
    userName: string;
    otpCode: string;
    userId?: string;
    languageCode?: string;
  }): Promise<void> {
    try {
      const config = await prisma.systemConfig.findFirst();

      if (!config?.otpEmailTemplateId) {
        console.warn("OTP email template not configured. Skipping email.");
        return;
      }

      let resolvedLanguage =
        options.languageCode ?? config.defaultLanguage ?? "en";
      if (!options.languageCode && options.userId) {
        const prefs = await prisma.userPreferences.findUnique({
          where: { userId: options.userId },
          select: { language: true },
        });
        if (prefs?.language) resolvedLanguage = prefs.language;
      }

      const validityMinutes = config.otpCodeValidityMinutes ?? 10;

      const variables = {
        USER_NAME: options.userName,
        USER_EMAIL: options.userEmail,
        OTP_CODE: options.otpCode,
        OTP_VALIDITY_MINUTES: String(validityMinutes),
      };

      await this.sendTemplateEmail({
        to: options.userEmail,
        templateId: config.otpEmailTemplateId,
        variables,
        languageCode: resolvedLanguage,
        triggeredBy: "otp-login",
        relatedUserId: options.userId,
      });

      debugEmailLog(`OTP email sent`);
    } catch (error) {
      console.error("Failed to send OTP email:", error);
      throw error;
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
