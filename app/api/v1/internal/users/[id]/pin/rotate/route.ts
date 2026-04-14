import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { AuthService } from "@/application/services/authService";

/**
 * @swagger
 * /api/v1/internal/users/{id}/pin/rotate:
 *   post:
 *     tags: [Users]
 *     summary: Rotate user PIN
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PIN rotated
 */
export const POST = withErrorHandler(
  async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const userId = context?.params?.id;
    if (!userId) {
      throw new ValidationError("User id parameter is required");
    }

    const result = await AuthService.rotateUserPin(
      {
        userId: auth.userId,
        role: auth.role,
        agencyId: auth.agencyId,
      },
      userId
    );

    return ResponseHandler.ok(result, 200);
  }
);
