import { NextRequest } from "next/server";
import { z } from "zod";
import { BaseValueScope, UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole, assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";

const createSchema = z.object({
  scopeType: z.nativeEnum(BaseValueScope),
  agencyId: z.string().optional(),
  name: z.string().min(2),
  sourceWorkbookRef: z.string().optional(),
  sourceScope: z.string().optional(),
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        valueNumeric: z.number().optional(),
        valueText: z.string().optional(),
        unit: z.string().optional(),
        effectiveFrom: z.string().date().optional(),
        effectiveTo: z.string().date().optional(),
      }),
    )
    .default([]),
});

/**
 * @swagger
 * /api/v1/internal/base-values:
 *   get:
 *     tags: [BaseValues]
 *     summary: List base value sets
 *     security:
 *       - bearerAuth: []
 *   post:
 *     tags: [BaseValues]
 *     summary: Create base value set
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.base-values");

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10)),
  );
  const search = searchParams.get("search") ?? undefined;
  const orderBy = searchParams.get("orderBy") ?? "updatedAt";
  const sortDir =
    (searchParams.get("sortDir") ?? "desc") === "asc" ? "asc" : "desc";
  const showArchived =
    searchParams.get("showArchived") === "true" && auth.role === UserRole.ADMIN;

  const allowedOrderBy: Record<string, true> = {
    name: true,
    updatedAt: true,
    createdAt: true,
    version: true,
  };
  const safeOrderBy = allowedOrderBy[orderBy] ? orderBy : "updatedAt";

  const searchFilter = search
    ? { name: { contains: search, mode: "insensitive" as const } }
    : {};

  const where =
    auth.role === UserRole.ADMIN
      ? { ...(showArchived ? {} : { isDeleted: false }), ...searchFilter }
      : {
          isDeleted: false,
          OR: [
            { scopeType: BaseValueScope.GLOBAL },
            { agencyId: auth.agencyId },
          ],
          ...searchFilter,
        };

  const [sets, total] = await Promise.all([
    prisma.baseValueSet.findMany({
      where,
      include: {
        _count: { select: { items: true } },
        createdByUser: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ isActive: "desc" }, { [safeOrderBy]: sortDir }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.baseValueSet.count({ where }),
  ]);

  return ResponseHandler.ok({ items: sets, total, page, pageSize }, 200);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN]);

  const body = await request.json();
  const payload = createSchema.parse(body);

  if (payload.scopeType === BaseValueScope.AGENCY && !payload.agencyId) {
    throw new ValidationError("agencyId is required for AGENCY scope");
  }

  const nextVersion =
    (
      await prisma.baseValueSet.aggregate({
        where: {
          name: payload.name,
          scopeType: payload.scopeType,
          agencyId: payload.agencyId ?? null,
        },
        _max: { version: true },
      })
    )._max.version ?? 0;

  const set = await prisma.baseValueSet.create({
    data: {
      scopeType: payload.scopeType,
      agencyId:
        payload.scopeType === BaseValueScope.GLOBAL ? null : payload.agencyId,
      name: payload.name,
      sourceWorkbookRef: payload.sourceWorkbookRef,
      sourceScope: payload.sourceScope,
      version: nextVersion + 1,
      createdBy: auth.userId,
      items: {
        create: payload.items.map((item) => ({
          key: item.key,
          valueNumeric: item.valueNumeric,
          valueText: item.valueText,
          unit: item.unit,
          effectiveFrom: item.effectiveFrom
            ? new Date(item.effectiveFrom)
            : null,
          effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  await AuditService.logEvent({
    actorUserId: auth.userId,
    eventType: "BASE_VALUE_SET_CREATED",
    targetType: "BASE_VALUE_SET",
    targetId: set.id,
  });

  return ResponseHandler.ok(set, 201);
});
