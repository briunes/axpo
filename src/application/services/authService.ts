import crypto from "crypto";
import { UserRole } from "@/domain/types";
import {
  AlreadyExistsError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { PinService } from "./pinService";
import { PasswordService } from "./passwordService";
import { EmailService } from "./emailService";
import { SessionRequestContext, SessionService } from "./sessionService";

interface CreateUserInput {
  agencyId: string;
  role: UserRole;
  fullName: string;
  email: string;
  mobilePhone: string;
  commercialPhone: string;
  commercialEmail: string;
  otherDetails?: string;
  password?: string;
  pin?: string;
  maxActiveDevices?: number;
  createdByUserId?: string;
}

export class AuthService {
  static async loginWithEmailAndPassword(
    email: string,
    password: string,
    context?: SessionRequestContext,
  ) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const passwordValid = await PasswordService.verify(
      password,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Check if OTP is enabled system-wide
    const systemConfig = await prisma.systemConfig.findFirst();
    if (systemConfig?.otpEnabled) {
      // Generate 6-digit OTP
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const validityMinutes = systemConfig.otpCodeValidityMinutes ?? 10;
      const otpCodeExpiresAt = new Date(
        Date.now() + validityMinutes * 60 * 1000,
      );
      const otpSessionToken = crypto.randomBytes(32).toString("hex");
      const otpSessionTokenExpiresAt = new Date(
        Date.now() + validityMinutes * 60 * 1000,
      );

      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpCode,
          otpCodeExpiresAt,
          otpSessionToken,
          otpSessionTokenExpiresAt,
        },
      });

      try {
        await EmailService.sendOtpEmail({
          userEmail: user.email,
          userName: user.fullName,
          otpCode,
          userId: user.id,
        });
      } catch (error) {
        console.error("Failed to send OTP email:", error);
      }

      return {
        requiresOtp: true,
        otpSessionToken,
        user: {
          id: user.id,
          agencyId: user.agencyId,
          role: user.role,
          fullName: user.fullName,
          email: user.email,
        },
      };
    }

    const session = await SessionService.createSessionForUser(
      {
        id: user.id,
        role: user.role as UserRole,
        agencyId: user.agencyId,
        email: user.email,
        maxActiveDevices: user.maxActiveDevices,
      },
      "PASSWORD",
      context ?? {
        ipAddress: "unknown",
        userAgent: "unknown",
        browser: "Unknown",
        os: "Unknown",
      },
    );

    return {
      requiresOtp: false,
      token: session.token,
      user: {
        id: user.id,
        agencyId: user.agencyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
    };
  }

  /**
   * Verify a one-time OTP code using the session token issued at login.
   * Single-use: clears the OTP after successful verification.
   */
  static async verifyOtp(
    otpSessionToken: string,
    code: string,
    context?: SessionRequestContext,
  ) {
    const user = await prisma.user.findUnique({ where: { otpSessionToken } });

    if (!user) {
      throw new ValidationError("Invalid or expired OTP session");
    }

    if (
      !user.otpSessionTokenExpiresAt ||
      user.otpSessionTokenExpiresAt < new Date()
    ) {
      throw new ValidationError("OTP session has expired, please log in again");
    }

    if (!user.otpCode || user.otpCode !== code) {
      throw new ValidationError("Invalid OTP code");
    }

    if (!user.otpCodeExpiresAt || user.otpCodeExpiresAt < new Date()) {
      throw new ValidationError("OTP code has expired, please log in again");
    }

    if (!user.isActive) {
      throw new ForbiddenError("User account is inactive");
    }

    // Consume the OTP (single-use)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpCodeExpiresAt: null,
        otpSessionToken: null,
        otpSessionTokenExpiresAt: null,
      },
    });

    const session = await SessionService.createSessionForUser(
      {
        id: user.id,
        role: user.role as UserRole,
        agencyId: user.agencyId,
        email: user.email,
        maxActiveDevices: user.maxActiveDevices,
      },
      "OTP",
      context ?? {
        ipAddress: "unknown",
        userAgent: "unknown",
        browser: "Unknown",
        os: "Unknown",
      },
    );

    return {
      token: session.token,
      user: {
        id: user.id,
        agencyId: user.agencyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
    };
  }

  static async createUser(input: CreateUserInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new AlreadyExistsError("User", "email", input.email);
    }

    let passwordHash: string | undefined;
    if (input.password) {
      PasswordService.validatePolicy(input.password);
      passwordHash = await PasswordService.hash(input.password);
    }

    // Get system configuration for token validity
    const systemConfig = await prisma.systemConfig.findFirst();
    const tokenValidityHours = systemConfig?.setupTokenValidityHours ?? 72;
    const defaultMaxActiveDevices = systemConfig?.defaultMaxActiveDevices ?? 3;

    // Always generate a setup token so the user can set/reset their password
    // via the first-time setup link (configurable validity from system config).
    const setupToken = crypto.randomBytes(32).toString("hex");
    const setupTokenExpiresAt = new Date(
      Date.now() + tokenValidityHours * 60 * 60 * 1000,
    );

    const generated = input.pin ?? PinService.generate();
    const pinHash = await PinService.hash(generated);

    const user = await prisma.user.create({
      data: {
        agencyId: input.agencyId,
        role: input.role,
        fullName: input.fullName,
        email: input.email,
        mobilePhone: input.mobilePhone,
        commercialPhone: input.commercialPhone,
        commercialEmail: input.commercialEmail,
        otherDetails: input.otherDetails,
        maxActiveDevices: input.maxActiveDevices ?? defaultMaxActiveDevices,
        passwordHash: passwordHash ?? null,
        setupToken,
        setupTokenExpiresAt,
        pinHash,
        pinCurrent: generated,
        createdByUserId: input.createdByUserId,
        updatedByUserId: input.createdByUserId,
      },
    });

    // Send welcome email (await to ensure it completes in serverless environments)
    try {
      await EmailService.sendUserCreationEmail({
        userEmail: user.email,
        userName: user.fullName,
        userPin: generated,
        userPassword: input.password,
        setupToken,
        userId: user.id,
        triggeredByUserId: input.createdByUserId,
      });
    } catch (error) {
      // Don't fail user creation if email fails, just log it
      console.error("Failed to send user creation email:", error);
    }

    return {
      user: {
        id: user.id,
        agencyId: user.agencyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        mobilePhone: user.mobilePhone,
        commercialPhone: user.commercialPhone,
        commercialEmail: user.commercialEmail,
        otherDetails: user.otherDetails,
        maxActiveDevices: user.maxActiveDevices,
        isActive: user.isActive,
      },
      generatedPin: generated,
      generatedPinMasked: PinService.mask(generated),
      setupToken,
    };
  }

  /**
   * Validate a first-time setup token and set the user's password.
   * The token is consumed (cleared) after successful use.
   */
  static async setupPassword(
    token: string,
    newPassword: string,
    context?: SessionRequestContext,
  ) {
    const user = await prisma.user.findUnique({
      where: { setupToken: token },
    });

    if (!user) {
      throw new ValidationError("Invalid or already used setup link");
    }

    if (!user.setupTokenExpiresAt || user.setupTokenExpiresAt < new Date()) {
      throw new ValidationError("This setup link has expired");
    }

    if (!user.isActive) {
      throw new ForbiddenError("User account is inactive");
    }

    PasswordService.validatePolicy(newPassword);
    const passwordHash = await PasswordService.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        setupToken: null,
        setupTokenExpiresAt: null,
        updatedByUserId: user.id,
      },
    });

    const session = await SessionService.createSessionForUser(
      {
        id: user.id,
        role: user.role as UserRole,
        agencyId: user.agencyId,
        email: user.email,
        maxActiveDevices: user.maxActiveDevices,
      },
      "SETUP_PASSWORD",
      context ?? {
        ipAddress: "unknown",
        userAgent: "unknown",
        browser: "Unknown",
        os: "Unknown",
      },
    );

    return {
      token: session.token,
      user: {
        id: user.id,
        agencyId: user.agencyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
    };
  }

  /**
   * Request a password reset by sending an email with a reset token.
   * Creates a token even if the email doesn't exist (to prevent email enumeration).
   */
  static async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Don't reveal whether the email exists or not (security best practice)
    if (!user) {
      // Silently succeed - don't tell attackers the email doesn't exist
      return { success: true };
    }

    if (!user.isActive) {
      // Silently succeed for inactive users too
      return { success: true };
    }

    // Get system configuration for token validity
    const systemConfig = await prisma.systemConfig.findFirst();
    const tokenValidityHours =
      systemConfig?.passwordResetTokenValidityHours ?? 24;

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(
      Date.now() + tokenValidityHours * 60 * 60 * 1000,
    );

    // Save the reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: resetTokenExpiresAt,
      },
    });

    // Send password reset email
    try {
      await EmailService.sendPasswordResetEmail({
        userEmail: user.email,
        userName: user.fullName,
        resetToken,
        userId: user.id,
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      // Don't fail the request if email fails, just log it
    }

    return { success: true };
  }

  /**
   * Reset password using a valid reset token.
   * The token is consumed (cleared) after successful use.
   */
  static async resetPassword(
    token: string,
    newPassword: string,
    context?: SessionRequestContext,
  ) {
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      throw new ValidationError("Invalid or already used reset link");
    }

    if (
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      throw new ValidationError("This reset link has expired");
    }

    if (!user.isActive) {
      throw new ForbiddenError("User account is inactive");
    }

    PasswordService.validatePolicy(newPassword);
    const passwordHash = await PasswordService.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        updatedByUserId: user.id,
      },
    });

    const session = await SessionService.createSessionForUser(
      {
        id: user.id,
        role: user.role as UserRole,
        agencyId: user.agencyId,
        email: user.email,
        maxActiveDevices: user.maxActiveDevices,
      },
      "RESET_PASSWORD",
      context ?? {
        ipAddress: "unknown",
        userAgent: "unknown",
        browser: "Unknown",
        os: "Unknown",
      },
    );

    return {
      token: session.token,
      user: {
        id: user.id,
        agencyId: user.agencyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
    };
  }

  static async rotateUserPin(
    actor: { userId: string; role: UserRole; agencyId: string },
    userId: string,
  ) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser) {
      throw new UnauthorizedError("Target user not found");
    }

    if (
      actor.role === UserRole.AGENT &&
      targetUser.agencyId !== actor.agencyId
    ) {
      throw new ForbiddenError(
        "Agent can only rotate PINs from their own agency",
      );
    }

    if (actor.role === UserRole.COMMERCIAL && actor.userId !== userId) {
      throw new ForbiddenError("Commercial can only rotate own PIN");
    }

    const { pin, pinHash, rotatedAt } = await PinService.rotate();

    await prisma.user.update({
      where: { id: userId },
      data: {
        pinHash,
        pinCurrent: pin,
        pinRotatedAt: rotatedAt,
      },
    });

    return {
      userId,
      newPin: pin,
      newPinMasked: PinService.mask(pin),
      pinRotatedAt: rotatedAt.toISOString(),
    };
  }

  /**
   * Request a magic link login email.
   * Always returns success to prevent email enumeration.
   */
  static async requestMagicLink(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return { success: true };
    }

    const systemConfig = await prisma.systemConfig.findFirst();

    // Check if magic link is enabled
    if (!systemConfig?.magicLinkEnabled) {
      return { success: true };
    }

    const validityMinutes = systemConfig?.magicLinkTokenValidityMinutes ?? 15;

    const magicLinkToken = crypto.randomBytes(32).toString("hex");
    const magicLinkTokenExpiresAt = new Date(
      Date.now() + validityMinutes * 60 * 1000,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { magicLinkToken, magicLinkTokenExpiresAt },
    });

    try {
      await EmailService.sendMagicLinkEmail({
        userEmail: user.email,
        userName: user.fullName,
        magicLinkToken,
        userId: user.id,
      });
    } catch (error) {
      console.error("Failed to send magic link email:", error);
    }

    return { success: true };
  }

  /**
   * Verify a magic link token and return a session token.
   * The token is consumed (single-use) after successful verification.
   */
  static async verifyMagicLink(token: string, context?: SessionRequestContext) {
    const user = await prisma.user.findUnique({
      where: { magicLinkToken: token },
    });

    if (!user) {
      throw new ValidationError("Invalid or already used magic link");
    }

    if (
      !user.magicLinkTokenExpiresAt ||
      user.magicLinkTokenExpiresAt < new Date()
    ) {
      throw new ValidationError("This magic link has expired");
    }

    if (!user.isActive) {
      throw new ForbiddenError("User account is inactive");
    }

    // Consume the token (single-use)
    await prisma.user.update({
      where: { id: user.id },
      data: { magicLinkToken: null, magicLinkTokenExpiresAt: null },
    });

    const session = await SessionService.createSessionForUser(
      {
        id: user.id,
        role: user.role as UserRole,
        agencyId: user.agencyId,
        email: user.email,
        maxActiveDevices: user.maxActiveDevices,
      },
      "MAGIC_LINK",
      context ?? {
        ipAddress: "unknown",
        userAgent: "unknown",
        browser: "Unknown",
        os: "Unknown",
      },
    );

    return {
      token: session.token,
      user: {
        id: user.id,
        agencyId: user.agencyId,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
    };
  }

  static enforceCreatePermissions(
    actor: { role: UserRole; agencyId: string },
    payload: CreateUserInput,
  ) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.AGENT) {
      const invalidAgency = payload.agencyId !== actor.agencyId;
      const invalidRole = payload.role !== UserRole.COMMERCIAL;
      if (invalidAgency || invalidRole) {
        throw new ForbiddenError(
          "Agent can only create commercial users in own agency",
        );
      }
      return;
    }

    throw new ForbiddenError("Role not allowed to create users");
  }
}
