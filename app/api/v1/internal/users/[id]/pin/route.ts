import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/users/{id}/pin:
 *   get:
 *     tags: [Users]
 *     summary: Get user PIN info (masked only)
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(
  async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("User id parameter is required");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        agencyId: true,
        pinRotatedAt: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User", id);
    }

    if (auth.role === UserRole.AGENT && user.agencyId !== auth.agencyId) {
      throw new NotFoundError("User", id);
    }

    if (auth.role === UserRole.COMMERCIAL && auth.userId !== id) {
      throw new NotFoundError("User", id);
    }

    return ResponseHandler.ok(
      {
        userId: user.id,
        maskedPin: "******",
        pinRotatedAt: user.pinRotatedAt,
        isActive: user.isActive,
        note: "PIN is stored hashed and cannot be displayed in clear text. Rotate to generate a new one.",
      },
      200
    );
  }
);
