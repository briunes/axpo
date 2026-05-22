import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
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
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.audit-logs");

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("eventType") ?? undefined;
  const excludeAuthEvents = searchParams.get("excludeAuthEvents") === "true";
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "25", 10), 1),
    100,
  );
  const skip = (page - 1) * limit;

  const parseDateParam = (
    rawValue: string | undefined,
    boundary: "start" | "end",
  ): Date | null => {
    if (!rawValue) return null;

    const value = rawValue.trim();
    if (!value) return null;

    const hasTime = value.includes("T");
    const normalized = hasTime
      ? value
      : `${value}${boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"}`;

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  };

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

  if (excludeAuthEvents) {
    where.NOT = {
      eventType: { startsWith: "AUTH_" },
    };
  }

  // Date range filter
  if (dateFrom || dateTo) {
    const parsedDateFrom = parseDateParam(dateFrom, "start");
    const parsedDateTo = parseDateParam(dateTo, "end");

    if (dateFrom && !parsedDateFrom) {
      return ResponseHandler.error(
        "VALIDATION_ERROR",
        "Invalid dateFrom parameter",
        400,
      );
    }

    if (dateTo && !parsedDateTo) {
      return ResponseHandler.error(
        "VALIDATION_ERROR",
        "Invalid dateTo parameter",
        400,
      );
    }

    where.createdAt = {
      ...(parsedDateFrom ? { gte: parsedDateFrom } : {}),
      ...(parsedDateTo ? { lte: parsedDateTo } : {}),
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

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: { email: true, fullName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    200,
  );
});
