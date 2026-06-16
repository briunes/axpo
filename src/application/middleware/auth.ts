import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";
import { JwtService } from "@/application/services/jwtService";
import { SessionService } from "@/application/services/sessionService";
import { setRefreshedAccessToken } from "@/application/middleware/requestContext";

export interface AuthContext {
  userId: string;
  sessionId: string;
  role: UserRole;
  agencyId: string;
  email: string;
}

export const requireAuth = async (
  request: NextRequest,
): Promise<AuthContext> => {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    throw new UnauthorizedError("Missing Authorization header");
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Invalid Authorization header format");
  }

  const payload = JwtService.verifyAccessToken(token);

  const activeSession = await SessionService.ensureSessionIsActive(
    payload.sub,
    payload.sid,
  );

  if (!activeSession) {
    throw new UnauthorizedError("Session expired or revoked");
  }

  // Fire-and-forget: only updates lastActivityAt for session tracking.
  // Not awaiting saves one full round-trip (~80ms to remote Supabase) per request.
  SessionService.touchSession(payload.sid).catch(() => {});

  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilExpiry = payload.exp - nowSeconds;

  // Sliding extension: only starts in the last 30 minutes of token lifetime.
  // Any authenticated request in this window resets TTL to 30 minutes.
  if (secondsUntilExpiry > 0 && secondsUntilExpiry <= 30 * 60) {
    const refreshedToken = JwtService.signAccessToken(
      {
        sub: payload.sub,
        sid: payload.sid,
        role: payload.role,
        agencyId: payload.agencyId,
        email: payload.email,
      },
      { expiresIn: "30m" },
    );

    setRefreshedAccessToken(refreshedToken);
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid,
    role: payload.role,
    agencyId: payload.agencyId,
    email: payload.email,
  };
};
