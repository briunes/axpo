import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { UserRole } from "@/domain/types";
import { AuthService } from "@/application/services/authService";
import { prisma } from "@/infrastructure/database/prisma";
import { NotFoundError, ValidationError } from "@/domain/errors/errors";

/**
 * @swagger
 * /api/v1/internal/users/{id}/reset-password:
 *   post:
 *     tags: [Users]
 *     summary: Trigger a password reset email for a user (Admin action)
 *     description: Generates a password reset token and sends an email to the user with a reset link. Admin/Agent only.
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
 *         description: Password reset email sent successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("User id parameter is required");
    }

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, isActive: true, agencyId: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Agents can only reset passwords for users in their own agency
    if (auth.role === UserRole.AGENT && user.agencyId !== auth.agencyId) {
      throw new NotFoundError("User not found");
    }

    // Trigger the password reset flow
    await AuthService.requestPasswordReset(user.email);

    return ResponseHandler.ok({
      success: true,
      message: "Password reset email sent successfully",
    });
  },
);
