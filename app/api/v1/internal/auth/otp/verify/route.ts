import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { AuthService } from "@/application/services/authService";
import { ValidationError } from "@/domain/errors/errors";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { otpSessionToken, code } = body;

  if (!otpSessionToken || !code) {
    throw new ValidationError("otpSessionToken and code are required");
  }

  const result = await AuthService.verifyOtp(otpSessionToken, code.trim());
  return ResponseHandler.ok(result);
});
