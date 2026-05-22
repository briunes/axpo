import jwt, { type SignOptions } from "jsonwebtoken";
import { UserRole } from "@/domain/types";
import { InvalidTokenError, InternalServerError } from "@/domain/errors/errors";

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ??
  "8h") as SignOptions["expiresIn"];

export interface AuthTokenPayload {
  sub: string;
  sid: string;
  role: UserRole;
  agencyId: string;
  email: string;
}

export interface VerifiedAuthTokenPayload extends AuthTokenPayload {
  exp: number;
  iat: number;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new InternalServerError("JWT_SECRET is not configured");
  }
  return secret;
};

const isAuthTokenPayload = (value: unknown): value is AuthTokenPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === "string" &&
    typeof payload.sid === "string" &&
    typeof payload.email === "string" &&
    typeof payload.agencyId === "string" &&
    Object.values(UserRole).includes(payload.role as UserRole)
  );
};

const isVerifiedAuthTokenPayload = (
  value: unknown,
): value is VerifiedAuthTokenPayload => {
  if (!isAuthTokenPayload(value)) return false;

  const payload = value as AuthTokenPayload & {
    exp?: unknown;
    iat?: unknown;
  };
  return typeof payload.exp === "number" && typeof payload.iat === "number";
};

export class JwtService {
  static signAccessToken(
    payload: AuthTokenPayload,
    options?: { expiresIn?: SignOptions["expiresIn"] },
  ): string {
    try {
      return jwt.sign(payload, getJwtSecret(), {
        expiresIn: options?.expiresIn ?? JWT_EXPIRES_IN,
      });
    } catch {
      throw new InternalServerError("Failed to issue access token");
    }
  }

  static verifyAccessToken(token: string): VerifiedAuthTokenPayload {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      if (!isVerifiedAuthTokenPayload(decoded)) {
        throw new InvalidTokenError();
      }
      return decoded;
    } catch {
      throw new InvalidTokenError();
    }
  }
}
