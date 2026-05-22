import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { SessionService } from "@/application/services/sessionService";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);

  await SessionService.logoutCurrentSession(
    {
      userId: auth.userId,
      role: auth.role,
      agencyId: auth.agencyId,
    },
    auth.sessionId,
  );

  return ResponseHandler.ok({ success: true }, 200);
});
