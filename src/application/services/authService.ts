import { UserRole } from "@/domain/types";
import {
  AlreadyExistsError,
  ForbiddenError,
  UnauthorizedError,
} from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { PinService } from "./pinService";
import { JwtService } from "./jwtService";
import { PasswordService } from "./passwordService";
import { EmailService } from "./emailService";

interface CreateUserInput {
  agencyId: string;
  role: UserRole;
  fullName: string;
  email: string;
  mobilePhone: string;
  commercialPhone: string;
  commercialEmail: string;
  otherDetails?: string;
  password: string;
  pin?: string;
  createdByUserId?: string;
}

export class AuthService {
  static async loginWithEmailAndPassword(email: string, password: string) {
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

    const token = JwtService.signAccessToken({
      sub: user.id,
      role: user.role as UserRole,
      agencyId: user.agencyId,
      email: user.email,
    });

    return {
      token,
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

    PasswordService.validatePolicy(input.password);

    const generated = input.pin ?? PinService.generate();
    const pinHash = await PinService.hash(generated);
    const passwordHash = await PasswordService.hash(input.password);

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
        passwordHash,
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
        isActive: user.isActive,
      },
      generatedPin: generated,
      generatedPinMasked: PinService.mask(generated),
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
