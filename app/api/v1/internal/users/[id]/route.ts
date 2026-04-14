import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";
import { PasswordService } from "@/application/services/passwordService";

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  mobilePhone: z.string().min(1).optional(),
  commercialPhone: z.string().min(1).optional(),
  commercialEmail: z.string().email().optional(),
  otherDetails: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(UserRole).optional(),
  agencyId: z.string().optional(),
  password: z.string().min(12).max(128).optional(),
  currentPassword: z.string().min(1).optional(),
});

const assertUserReadable = (
  actor: { userId: string; role: UserRole; agencyId: string },
  user: { id: string; agencyId: string },
) => {
  if (actor.role === UserRole.ADMIN) {
    return;
  }

  if (actor.role === UserRole.AGENT && user.id === actor.userId) {
    return;
  }

  if (actor.role === UserRole.COMMERCIAL && user.id === actor.userId) {
    return;
  }

  throw new NotFoundError("User", user.id);
};

/**
 * @swagger
 * /api/v1/internal/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by id
 *     security:
 *       - bearerAuth: []
 *   patch:
 *     tags: [Users]
 *     summary: Update user by id
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("User id parameter is required");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        agencyId: true,
        role: true,
        fullName: true,
        email: true,
        mobilePhone: true,
        commercialPhone: true,
        commercialEmail: true,
        otherDetails: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        pinRotatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User", id);
    }

    assertUserReadable(auth, user);
    return ResponseHandler.ok(user, 200);
  },
);

export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("User id parameter is required");
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("User", id);
    }

    assertUserReadable(auth, existing);

    const body = await request.json();
    const payload = updateUserSchema.parse(body);

    if (auth.role === UserRole.AGENT) {
      if (id !== auth.userId) {
        throw new ForbiddenError("Agent can only update their own profile");
      }
      if (payload.role !== undefined || payload.isActive !== undefined) {
        throw new ForbiddenError("Agent cannot change role or active state");
      }
      if (payload.password && !payload.currentPassword) {
        throw new ValidationError(
          "Current password is required to change password",
        );
      }
    }

    if (auth.role === UserRole.COMMERCIAL) {
      if (id !== auth.userId) {
        throw new ForbiddenError("Commercial can only update own user");
      }
      if (payload.role !== undefined || payload.isActive !== undefined) {
        throw new ForbiddenError(
          "Commercial cannot change role or active state",
        );
      }
      if (payload.password && !payload.currentPassword) {
        throw new ValidationError(
          "Current password is required to change password",
        );
      }
    }

    if (payload.password) {
      PasswordService.validatePolicy(payload.password);
    }

    if (payload.currentPassword) {
      if (auth.userId !== id) {
        throw new ForbiddenError(
          "Current password can only be used for own account",
        );
      }
      if (!existing.passwordHash) {
        throw new ValidationError("Current password is invalid");
      }
      const currentPasswordOk = await PasswordService.verify(
        payload.currentPassword,
        existing.passwordHash,
      );
      if (!currentPasswordOk) {
        throw new ValidationError("Current password is invalid");
      }
    }

    const passwordHash = payload.password
      ? await PasswordService.hash(payload.password)
      : undefined;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: payload.fullName,
        email: payload.email,
        mobilePhone: payload.mobilePhone,
        commercialPhone: payload.commercialPhone,
        commercialEmail: payload.commercialEmail,
        otherDetails: payload.otherDetails,
        isActive: payload.isActive,
        role: payload.role,
        agencyId: payload.agencyId,
        passwordHash,
      },
      select: {
        id: true,
        agencyId: true,
        role: true,
        fullName: true,
        email: true,
        mobilePhone: true,
        commercialPhone: true,
        commercialEmail: true,
        otherDetails: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        pinRotatedAt: true,
      },
    });

    const { password: _pw, currentPassword: _cp, ...changedFields } = payload;
    const changedKeys = Object.keys(
      changedFields,
    ) as (keyof typeof changedFields)[];
    const auditBefore: Record<string, unknown> = {};
    const auditAfter: Record<string, unknown> = {};
    for (const key of changedKeys) {
      auditBefore[key] = (existing as Record<string, unknown>)[key] ?? null;
      auditAfter[key] = (updated as Record<string, unknown>)[key] ?? null;
    }
    const auditMeta: Record<string, unknown> = {};
    if (changedKeys.length > 0) {
      auditMeta.before = auditBefore;
      auditMeta.after = auditAfter;
    }
    if (payload.password) auditMeta.passwordUpdated = true;
    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "USER_UPDATED",
      targetType: "USER",
      targetId: id,
      metadataJson: Object.keys(auditMeta).length > 0 ? auditMeta : undefined,
    });

    return ResponseHandler.ok(updated, 200);
  },
);
