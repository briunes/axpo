import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { NotFoundError } from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/email-logs/{id}:
 *   get:
 *     tags: [Email]
 *     summary: Get email log details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN]);

    const id = context?.params?.id as string;
    const log = await prisma.emailLog.findUnique({
      where: { id },
      include: {
        triggeredByUser: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });

    if (!log) {
      throw new NotFoundError("Email log");
    }

    return ResponseHandler.ok(log);
  },
);
