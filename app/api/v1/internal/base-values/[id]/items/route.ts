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

const itemsSchema = z.object({
  items: z.array(
    z.object({
      key: z.string().min(1),
      valueNumeric: z.coerce.number().optional().nullable(),
      valueText: z.string().optional().nullable(),
      unit: z.string().optional().nullable(),
      effectiveFrom: z.string().optional().nullable(),
      effectiveTo: z.string().optional().nullable(),
    }),
  ),
});

/**
 * @swagger
 * /api/v1/internal/base-values/{id}/items:
 *   get:
 *     tags: [BaseValues]
 *     summary: List items for base value set
 *     security:
 *       - bearerAuth: []
 *   put:
 *     tags: [BaseValues]
 *     summary: Replace all items in base value set
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

    const set = await prisma.baseValueSet.findUnique({ where: { id } });
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

    const items = await prisma.baseValueItem.findMany({
      where: { baseValueSetId: id },
      orderBy: { key: "asc" },
    });

    return ResponseHandler.ok({ items }, 200);
  },
);

export const PUT = withErrorHandler(
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

    const set = await prisma.baseValueSet.findUnique({ where: { id } });
    if (!set || set.isDeleted) {
      throw new NotFoundError("BaseValueSet", id);
    }

    const body = await request.json();
    const payload = itemsSchema.parse(body);

    await prisma.$transaction([
      prisma.baseValueItem.deleteMany({ where: { baseValueSetId: id } }),
      prisma.baseValueItem.createMany({
        data: payload.items.map((item) => ({
          baseValueSetId: id,
          key: item.key,
          valueNumeric: item.valueNumeric,
          valueText: item.valueText,
          unit: item.unit,
          effectiveFrom: item.effectiveFrom
            ? new Date(item.effectiveFrom)
            : null,
          effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
        })),
      }),
    ]);

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "BASE_VALUE_ITEMS_REPLACED",
      targetType: "BASE_VALUE_SET",
      targetId: id,
      metadataJson: { itemCount: payload.items.length },
    });

    const items = await prisma.baseValueItem.findMany({
      where: { baseValueSetId: id },
    });
    return ResponseHandler.ok({ baseValueSetId: id, items }, 200);
  },
);
