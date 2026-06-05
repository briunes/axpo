import { NextRequest } from "next/server";
import { z } from "zod";
import { InvalidTokenError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";
import { JwtService } from "@/application/services/jwtService";
import { SessionService } from "@/application/services/sessionService";

const redirectReportSchema = z.object({
  reason: z.string().min(1).max(100),
  statusCode: z.number().int().min(100).max(599).optional(),
  path: z.string().max(500).optional(),
  currentPath: z.string().max(500).optional(),
  errorCode: z.string().max(120).optional(),
  errorMessage: z.string().max(500).optional(),
});

const readBearerToken = (request: NextRequest): string => {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    throw new InvalidTokenError("Missing Authorization header");
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new InvalidTokenError("Invalid Authorization header format");
  }

  return token;
};

export const POST = withErrorHandler(async (request: NextRequest) => {
  const token = readBearerToken(request);
  const payload = JwtService.verifyAccessTokenIgnoringExpiration(token);
  const body = redirectReportSchema.parse(await request.json());
  const nowSeconds = Math.floor(Date.now() / 1000);

  await SessionService.recordAuthRedirectToLogin(
    payload.sub,
    payload.sid,
    {
      ...body,
      tokenExpiresAt: new Date(payload.exp * 1000).toISOString(),
      tokenExpired: payload.exp <= nowSeconds,
    },
    getRequestSessionContext(request),
  );

  return ResponseHandler.ok({ success: true }, 200);
});
