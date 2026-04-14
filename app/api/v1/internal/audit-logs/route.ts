import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/audit-logs:
 *   get:
 *     tags: [Audit]
 *     summary: List audit logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventType
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 500 }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.AGENT]);

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("eventType") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "500", 10),
    1000,
  );

  // Build where clause
  const where: Record<string, unknown> = {};

  // Role-based scoping
  if (auth.role !== UserRole.ADMIN) {
    where.OR = [
      { actorUserId: auth.userId },
      { metadataJson: { path: ["agencyId"], equals: auth.agencyId } },
    ];
  }

  // Event type filter
  if (eventType) {
    where.eventType = eventType;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  // Text search across actor email, eventType, targetType, targetId
  if (search) {
    const searchConditions = [
      { eventType: { contains: search, mode: "insensitive" as const } },
      { targetType: { contains: search, mode: "insensitive" as const } },
      { targetId: { contains: search, mode: "insensitive" as const } },
      { actor: { email: { contains: search, mode: "insensitive" as const } } },
      {
        actor: { fullName: { contains: search, mode: "insensitive" as const } },
      },
    ];

    if (where.OR) {
      // Already has OR for role scoping — wrap both in AND
      where.AND = [{ OR: where.OR }, { OR: searchConditions }];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      actor: {
        select: { email: true, fullName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return ResponseHandler.ok(
    {
      items: logs.map((l) => ({
        id: l.id,
        actorUserId: l.actorUserId,
        actorEmail: l.actor?.email ?? null,
        actorName: l.actor?.fullName ?? null,
        eventType: l.eventType,
        targetType: l.targetType,
        targetId: l.targetId,
        metadataJson: l.metadataJson,
        createdAt: l.createdAt.toISOString(),
      })),
    },
    200,
  );
});
