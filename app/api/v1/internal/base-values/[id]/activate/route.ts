import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";

/**
 * @swagger
 * /api/v1/internal/base-values/{id}/activate:
 *   post:
 *     tags: [BaseValues]
 *     summary: Activate base value set and deactivate siblings in same scope
 *     security:
 *       - bearerAuth: []
 */
export const POST = withErrorHandler(
  async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Base value set id parameter is required");
    }

    const set = await prisma.baseValueSet.findUnique({ where: { id } });
    if (!set || set.isDeleted) {
      throw new NotFoundError("BaseValueSet", id);
    }

    await prisma.$transaction([
      prisma.baseValueSet.updateMany({
        where: {
          name: set.name,
          scopeType: set.scopeType,
          agencyId: set.agencyId,
          isDeleted: false,
        },
        data: { isActive: false },
      }),
      prisma.baseValueSet.update({
        where: { id: set.id },
        data: { isActive: true },
      }),
    ]);

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "BASE_VALUE_SET_ACTIVATED",
      targetType: "BASE_VALUE_SET",
      targetId: id,
    });

    return ResponseHandler.ok({ id, activated: true }, 200);
  }
);
