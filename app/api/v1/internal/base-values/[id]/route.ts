import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole, assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  sourceWorkbookRef: z.string().optional(),
  sourceScope: z.string().optional(),
  isDeleted: z.boolean().optional(),
});

/**
 * @swagger
 * /api/v1/internal/base-values/{id}:
 *   get:
 *     tags: [BaseValues]
 *     summary: Get base value set details
 *     security:
 *       - bearerAuth: []
 *   patch:
 *     tags: [BaseValues]
 *     summary: Update base value set metadata
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.base-values");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Base value set id parameter is required");
    }

    const set = await prisma.baseValueSet.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!set || set.isDeleted) {
      throw new NotFoundError("BaseValueSet", id);
    }

    if (
      auth.role === UserRole.AGENT &&
      set.agencyId !== auth.agencyId &&
      set.scopeType !== "GLOBAL"
    ) {
      throw new NotFoundError("BaseValueSet", id);
    }

    return ResponseHandler.ok(set, 200);
  },
);

export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Base value set id parameter is required");
    }

    const body = await request.json();
    const payload = updateSchema.parse(body);

    const exists = await prisma.baseValueSet.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundError("BaseValueSet", id);
    }

    const updated = await prisma.baseValueSet.update({
      where: { id },
      data: {
        name: payload.name,
        sourceWorkbookRef: payload.sourceWorkbookRef,
        sourceScope: payload.sourceScope,
        isDeleted: payload.isDeleted,
        deletedAt: payload.isDeleted ? new Date() : null,
      },
      include: { items: true },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "BASE_VALUE_SET_UPDATED",
      targetType: "BASE_VALUE_SET",
      targetId: id,
    });

    return ResponseHandler.ok(updated, 200);
  },
);
