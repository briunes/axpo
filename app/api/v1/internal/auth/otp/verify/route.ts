import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { AuthService } from "@/application/services/authService";
import { ValidationError } from "@/domain/errors/errors";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const sessionContext = getRequestSessionContext(request);
  const body = await request.json();
  const { otpSessionToken, code } = body;

  if (!otpSessionToken || !code) {
    throw new ValidationError("otpSessionToken and code are required");
  }

  const result = await AuthService.verifyOtp(
    otpSessionToken,
    code.trim(),
    sessionContext,
  );
  return ResponseHandler.ok(result);
});
