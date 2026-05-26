import { NextRequest } from "next/server";
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
import { SessionService } from "@/application/services/sessionService";
import { parseUpdateUserPayload } from "../userPayloadValidation";

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
        maxActiveDevices: true,
        isActive: true,
        isDeleted: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        pinRotatedAt: true,
        createdByUser: { select: { id: true, fullName: true } },
        updatedByUser: { select: { id: true, fullName: true } },
      },
    });

    if (!user || user.isDeleted) {
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
    if (!existing || existing.isDeleted) {
      throw new NotFoundError("User", id);
    }

    assertUserReadable(auth, existing);

    const body = await request.json();
    const payload = await parseUpdateUserPayload(body);

    if (auth.role === UserRole.AGENT) {
      if (id !== auth.userId) {
        throw new ForbiddenError("Agent can only update their own profile");
      }
      if (
        payload.role !== undefined ||
        payload.isActive !== undefined ||
        payload.maxActiveDevices !== undefined
      ) {
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
      if (
        payload.role !== undefined ||
        payload.isActive !== undefined ||
        payload.maxActiveDevices !== undefined
      ) {
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

    const existingPreferences = payload.preferences
      ? await prisma.userPreferences.findUnique({ where: { userId: id } })
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          fullName: payload.fullName,
          email: payload.email,
          mobilePhone: payload.mobilePhone,
          commercialPhone: payload.commercialPhone,
          commercialEmail: payload.commercialEmail,
          otherDetails: payload.otherDetails,
          maxActiveDevices: payload.maxActiveDevices,
          isActive: payload.isActive,
          role: payload.role,
          agencyId: payload.agencyId,
          passwordHash,
          updatedByUserId: auth.userId,
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
          maxActiveDevices: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          pinRotatedAt: true,
          createdByUser: { select: { id: true, fullName: true } },
          updatedByUser: { select: { id: true, fullName: true } },
        },
      });

      if (payload.preferences) {
        await tx.userPreferences.upsert({
          where: { userId: id },
          create: {
            userId: id,
            language: payload.preferences.language,
            dateFormat: payload.preferences.dateFormat,
            timeFormat: payload.preferences.timeFormat,
            timezone: payload.preferences.timezone,
            numberFormat: payload.preferences.numberFormat,
            itemsPerPage: payload.preferences.itemsPerPage,
          },
          update: {
            language: payload.preferences.language,
            dateFormat: payload.preferences.dateFormat,
            timeFormat: payload.preferences.timeFormat,
            timezone: payload.preferences.timezone,
            numberFormat: payload.preferences.numberFormat,
            itemsPerPage: payload.preferences.itemsPerPage,
          },
        });
      }

      return updatedUser;
    });

    if (payload.isActive === false) {
      await SessionService.forceLogoutAllSessionsByUser(
        {
          userId: auth.userId,
          role: auth.role,
          agencyId: auth.agencyId,
        },
        id,
      );
    }

    const {
      password: _pw,
      currentPassword: _cp,
      preferences,
      ...changedFields
    } = payload;
    const changedKeys = Object.keys(changedFields);
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
    if (preferences) {
      auditMeta.preferencesBefore = existingPreferences
        ? {
            language: existingPreferences.language,
            dateFormat: existingPreferences.dateFormat,
            timeFormat: existingPreferences.timeFormat,
            timezone: existingPreferences.timezone,
            numberFormat: existingPreferences.numberFormat,
            itemsPerPage: existingPreferences.itemsPerPage,
          }
        : null;
      auditMeta.preferencesAfter = preferences;
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

/**
 * @swagger
 * /api/v1/internal/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user (sets isDeleted for admin, isArchived for agent/commercial)
 *     security:
 *       - bearerAuth: []
 */
export const DELETE = withErrorHandler(
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
    if (!existing || existing.isDeleted) {
      throw new NotFoundError("User", id);
    }

    assertUserReadable(auth, existing);

    // Admin sets isDeleted = true (soft delete)
    // Agent/Commercial can only delete their own user
    if (auth.role === UserRole.ADMIN) {
      await prisma.user.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false,
          updatedByUserId: auth.userId,
        },
      });
    } else {
      // Agent/Commercial can only delete their own user
      if (id !== auth.userId) {
        throw new ForbiddenError("You can only delete your own user");
      }
      await prisma.user.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false,
          updatedByUserId: auth.userId,
        },
      });
    }

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "USER_DELETED",
      targetType: "USER",
      targetId: id,
    });

    return ResponseHandler.ok({ userId: id, deleted: true }, 200);
  },
);
