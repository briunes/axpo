import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission, assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

const isMissingSoftDeleteColumnError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("app_error_logs.isDeleted does not exist") ||
    (message.includes("PGRST204") && message.includes("isDeleted"))
  );
};

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

/**
 * @swagger
 * /api/v1/internal/app-error-logs:
 *   get:
 *     tags: [System]
 *     summary: List application error logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 *       - in: query
 *         name: errorType
 *         schema: { type: string }
 *       - in: query
 *         name: path
 *         schema: { type: string }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  await assertPermission(auth, "section.app-error-logs");

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);
  const skip = (page - 1) * limit;
  const errorType = searchParams.get("errorType") ?? undefined;
  const path = searchParams.get("path") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const search = searchParams.get("search") || undefined;

  const filters: any = {
    ...(errorType && { errorType }),
    ...(path && { path: { contains: path, mode: "insensitive" } }),
  };
  if (dateFrom || dateTo) {
    filters.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00.000Z") } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59.999Z") } : {}),
    };
  }
  if (search) {
    filters.OR = [
      { message: { contains: search, mode: "insensitive" as const } },
      { errorType: { contains: search, mode: "insensitive" as const } },
      { path: { contains: search, mode: "insensitive" as const } },
      { pagePath: { contains: search, mode: "insensitive" as const } },
    ];
  }

  const loadLogs = async (where: any) => {
    const items = await (prisma as any).appErrorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    const count = await (prisma as any).appErrorLog.count({ where });
    return [items, count] as const;
  };

  let logs: any[];
  let total: number;
  try {
    [logs, total] = await loadLogs({ ...filters, isDeleted: false });
  } catch (error) {
    if (!isMissingSoftDeleteColumnError(error)) throw error;
    [logs, total] = await loadLogs(filters);
  }

  return ResponseHandler.ok(
    {
      items: logs.map((l: any) => ({
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        errorType: l.errorType,
        errorCode: l.errorCode,
        message: l.message,
        stack: l.stack,
        method: l.method,
        path: l.path,
        pagePath: l.pagePath,
        statusCode: l.statusCode,
        sentryEventId: l.sentryEventId,
        metadata: l.metadata,
        user: l.user ?? null,
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

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);
  await assertPermission(auth, "section.app-error-logs");

  const parsed = bulkDeleteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new ValidationError("Invalid application error log ids", {
      issues: parsed.error.issues,
    });
  }

  const ids = Array.from(new Set(parsed.data.ids));
  try {
    const result = await prisma.appErrorLog.updateMany({
      where: {
        id: { in: ids },
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return ResponseHandler.ok(
      {
        requested: ids.length,
        deleted: result.count,
      },
      200,
    );
  } catch (error) {
    if (!isMissingSoftDeleteColumnError(error)) throw error;
    return ResponseHandler.error(
      "MIGRATION_REQUIRED",
      "App error deletion will be available after pending database migrations are applied",
      503,
    );
  }
});
