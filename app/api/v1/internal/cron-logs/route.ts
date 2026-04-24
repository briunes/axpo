import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/cron-logs:
 *   get:
 *     tags: [Cron]
 *     summary: List cron job execution logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN]);

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "25", 10), 100);
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.cronLog.findMany({
      orderBy: { executedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.cronLog.count(),
  ]);

  return ResponseHandler.ok(
    {
      items: logs.map((l) => ({
        id: l.id,
        executedAt: l.executedAt.toISOString(),
        jobName: l.jobName,
        jobType: l.jobType,
        status: l.status,
        duration: l.duration,
        totalProcessed: l.totalProcessed,
        totalAffected: l.totalAffected,
        metadata: l.metadata,
        errorMessage: l.errorMessage,
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
