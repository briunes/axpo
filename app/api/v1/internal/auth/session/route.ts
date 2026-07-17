import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);

  return ResponseHandler.ok({
    valid: true,
    user: {
      id: auth.userId,
      agencyId: auth.agencyId,
      role: auth.role,
      email: auth.email,
    },
  });
});
