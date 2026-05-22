import { NextRequest } from "next/server";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { SessionService } from "@/application/services/sessionService";

export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "users.sessions.manage");

    const userId = context?.params?.id;
    if (!userId) {
      throw new ValidationError("User id is required");
    }

    const revokedCount = await SessionService.forceLogoutAllSessionsByUser(
      {
        userId: auth.userId,
        role: auth.role,
        agencyId: auth.agencyId,
      },
      userId,
    );

    return ResponseHandler.ok({ success: true, revokedCount }, 200);
  },
);
