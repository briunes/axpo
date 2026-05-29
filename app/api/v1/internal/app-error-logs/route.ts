import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

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
  await assertPermission(auth, "section.configurations");

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);
  const skip = (page - 1) * limit;
  const errorType = searchParams.get("errorType") ?? undefined;
  const path = searchParams.get("path") ?? undefined;

  const where: any = {
    ...(errorType && { errorType }),
    ...(path && { path: { contains: path, mode: "insensitive" } }),
  };

  const [logs, total] = await Promise.all([
    (prisma as any).appErrorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    }),
    (prisma as any).appErrorLog.count({ where }),
  ]);

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
