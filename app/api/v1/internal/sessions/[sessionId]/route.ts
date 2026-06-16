import { NextRequest } from "next/server";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { SessionService } from "@/application/services/sessionService";

export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "users.sessions.manage");

    const sessionId = context?.params?.sessionId;
    if (!sessionId) {
      throw new ValidationError("Session id is required");
    }

    await SessionService.forceLogoutSession(
      {
        userId: auth.userId,
        role: auth.role,
        agencyId: auth.agencyId,
      },
      sessionId,
    );

    return ResponseHandler.ok({ success: true }, 200);
  },
);
