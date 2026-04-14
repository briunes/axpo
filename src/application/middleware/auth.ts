import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";
import { JwtService } from "@/application/services/jwtService";

export interface AuthContext {
  userId: string;
  role: UserRole;
  agencyId: string;
  email: string;
}

export const requireAuth = async (request: NextRequest): Promise<AuthContext> => {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    throw new UnauthorizedError("Missing Authorization header");
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError("Invalid Authorization header format");
  }

  const payload = JwtService.verifyAccessToken(token);

  return {
    userId: payload.sub,
    role: payload.role,
    agencyId: payload.agencyId,
    email: payload.email,
  };
};
