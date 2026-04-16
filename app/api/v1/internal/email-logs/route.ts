import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/email-logs:
 *   get:
 *     tags: [Email]
 *     summary: List email logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [sent, failed] }
 *       - in: query
 *         name: triggeredBy
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
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN]);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const triggeredBy = searchParams.get("triggeredBy") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

  // Build where clause
  const where: Record<string, unknown> = {};

  // Status filter
  if (status) {
    where.status = status;
  }

  // Triggered by filter
  if (triggeredBy) {
    where.triggeredBy = triggeredBy;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    where.sentAt = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  // Text search across recipient, subject, template name
  if (search) {
    where.OR = [
      { recipientEmail: { contains: search, mode: "insensitive" as const } },
      { subject: { contains: search, mode: "insensitive" as const } },
      { templateName: { contains: search, mode: "insensitive" as const } },
      {
        triggeredByUser: {
          email: { contains: search, mode: "insensitive" as const },
        },
      },
      {
        triggeredByUser: {
          fullName: { contains: search, mode: "insensitive" as const },
        },
      },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      include: {
        triggeredByUser: {
          select: { id: true, email: true, fullName: true },
        },
      },
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailLog.count({ where }),
  ]);

  return ResponseHandler.ok({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
