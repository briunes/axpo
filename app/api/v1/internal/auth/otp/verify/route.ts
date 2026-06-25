import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { AuthService } from "@/application/services/authService";
import { ValidationError } from "@/domain/errors/errors";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";
import {
  applyRateLimitShared,
  getClientRateLimitKey,
} from "@/application/middleware/rateLimit";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const sessionContext = getRequestSessionContext(request);
  const body = await request.json();
  const { otpSessionToken, code } = body;

  if (!otpSessionToken || !code) {
    throw new ValidationError("otpSessionToken and code are required");
  }

  await applyRateLimitShared(
    getClientRateLimitKey(
      sessionContext.ipAddress,
      `otp:${String(otpSessionToken).slice(0, 12)}`,
    ),
    { maxRequests: 6, windowMs: 15 * 60 * 1000 },
  );

  const result = await AuthService.verifyOtp(
    otpSessionToken,
    code.trim(),
    sessionContext,
  );
  return ResponseHandler.ok(result);
});
