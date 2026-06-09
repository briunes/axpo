import crypto from "crypto";
import { UserRole } from "@/domain/types";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";
import { JwtService } from "./jwtService";
import { AuditService } from "./auditService";

export type SessionAuthMethod =
  | "PASSWORD"
  | "OTP"
  | "MAGIC_LINK"
  | "SETUP_PASSWORD"
  | "RESET_PASSWORD";

export interface SessionRequestContext {
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  browserFingerprint?: string | null;
}

interface AuthRedirectReport {
  reason: string;
  statusCode?: number;
  path?: string;
  currentPath?: string;
  errorCode?: string;
  errorMessage?: string;
  tokenExpiresAt?: string;
  tokenExpired?: boolean;
}

interface SessionUser {
  id: string;
  role: UserRole;
  agencyId: string;
  email: string;
  maxActiveDevices: number;
}

interface SessionActor {
  userId: string;
  role: UserRole;
  agencyId: string;
}

const DEFAULT_MAX_ACTIVE_DEVICES = 3;
const MIN_ACTIVE_DEVICES = 1;
const MAX_ACTIVE_DEVICES = 10;

const normalizeDeviceLimit = (value: number | null | undefined): number => {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_MAX_ACTIVE_DEVICES;
  }

  return Math.max(MIN_ACTIVE_DEVICES, Math.min(MAX_ACTIVE_DEVICES, value));
};

const normalizedPart = (value: string) => value.trim().toLowerCase();

const buildDeviceFingerprint = (context: SessionRequestContext): string => {
  if (context.browserFingerprint) {
    return normalizedPart(context.browserFingerprint);
  }

  const source = [
    normalizedPart(context.browser),
    normalizedPart(context.os),
    normalizedPart(context.ipAddress),
  ].join("|");

  return crypto.createHash("sha256").update(source).digest("hex");
};

const createSessionThroughApi = async (input: {
  userId: string;
  sessionId: string;
  sessionTokenId: string;
  authMethod: SessionAuthMethod;
  context: SessionRequestContext;
  deviceFingerprint: string;
  loginAt: Date;
  maxDevices: number;
}): Promise<string[]> => {
  const result = await (prisma as any).$rpc("axpo_create_user_session", {
    p_user_id: input.userId,
    p_session_id: input.sessionId,
    p_session_token_id: input.sessionTokenId,
    p_auth_method: input.authMethod,
    p_ip_address: input.context.ipAddress,
    p_user_agent: input.context.userAgent,
    p_browser: input.context.browser,
    p_os: input.context.os,
    p_device_fingerprint: input.deviceFingerprint,
    p_login_at: input.loginAt,
    p_max_devices: input.maxDevices,
    p_metadata: {
      maxActiveDevices: input.maxDevices,
      browserFingerprint: input.context.browserFingerprint ?? null,
    },
  });

  return Array.isArray(result) ? result.map(String) : [];
};

export class SessionService {
  static async createSessionForUser(
    user: SessionUser,
    authMethod: SessionAuthMethod,
    context: SessionRequestContext,
  ): Promise<{
    token: string;
    sessionId: string;
    autoKickedSessionIds: string[];
  }> {
    const sessionTokenId = crypto.randomUUID();
    const loginAt = new Date();
    const deviceFingerprint = buildDeviceFingerprint(context);
    const maxDevices = normalizeDeviceLimit(user.maxActiveDevices);
    const sessionId = crypto.randomUUID();

    const autoKickedSessionIds = isSupabaseApiMode()
      ? await createSessionThroughApi({
          userId: user.id,
          sessionId,
          sessionTokenId,
          authMethod,
          context,
          deviceFingerprint,
          loginAt,
          maxDevices,
        })
      : await prisma.$transaction(async (tx) => {
          await tx.userSession.updateMany({
            where: {
              userId: user.id,
              isActive: true,
              deviceFingerprint,
            },
            data: {
              isActive: false,
              logoutAt: loginAt,
              terminationReason: "REPLACED_BY_NEW_LOGIN",
              terminatedByUserId: user.id,
            },
          });

          const activeSessions = await tx.userSession.findMany({
            where: {
              userId: user.id,
              isActive: true,
            },
            orderBy: {
              loginAt: "asc",
            },
            select: {
              id: true,
            },
          });

          const overflowCount = Math.max(
            0,
            activeSessions.length - maxDevices + 1,
          );
          const sessionsToKick =
            overflowCount > 0
              ? activeSessions
                  .slice(0, overflowCount)
                  .map((item) => item.id)
              : [];

          if (sessionsToKick.length > 0) {
            await tx.userSession.updateMany({
              where: {
                id: {
                  in: sessionsToKick,
                },
              },
              data: {
                isActive: false,
                logoutAt: loginAt,
                terminationReason: "DEVICE_LIMIT_AUTO_KICK",
                terminatedByUserId: user.id,
              },
            });
          }

          await tx.userSession.create({
            data: {
              id: sessionId,
              userId: user.id,
              sessionTokenId,
              authMethod,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
              browser: context.browser,
              os: context.os,
              deviceFingerprint,
              loginAt,
              lastActivityAt: loginAt,
              metadataJson: {
                maxActiveDevices: maxDevices,
                browserFingerprint: context.browserFingerprint ?? null,
              },
            },
          });

          return sessionsToKick;
        });

    const token = JwtService.signAccessToken({
      sub: user.id,
      sid: sessionTokenId,
      role: user.role,
      agencyId: user.agencyId,
      email: user.email,
    });

    await AuditService.logEvent({
      actorUserId: user.id,
      eventType: "AUTH_LOGIN",
      targetType: "USER",
      targetId: user.id,
      metadataJson: {
        authMethod,
        browser: context.browser,
        os: context.os,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        browserFingerprint: context.browserFingerprint ?? null,
        sessionTokenId,
        autoKickedSessions: autoKickedSessionIds.length,
      },
    });

    if (autoKickedSessionIds.length > 0) {
      await AuditService.logEvent({
        actorUserId: user.id,
        eventType: "AUTH_SESSION_AUTO_KICK",
        targetType: "USER",
        targetId: user.id,
        metadataJson: {
          kickedSessionIds: autoKickedSessionIds,
          reason: "DEVICE_LIMIT_AUTO_KICK",
          maxActiveDevices: maxDevices,
        },
      });
    }

    return {
      token,
      sessionId: sessionTokenId,
      autoKickedSessionIds,
    };
  }

  static async ensureSessionIsActive(userId: string, sessionTokenId: string) {
    const session = await prisma.userSession.findUnique({
      where: {
        sessionTokenId,
      },
      include: {
        user: {
          select: {
            isActive: true,
            isDeleted: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    if (!session.isActive || session.userId !== userId) {
      return null;
    }

    if (!session.user.isActive || session.user.isDeleted) {
      return null;
    }

    return session;
  }

  static async touchSession(sessionTokenId: string): Promise<void> {
    await prisma.userSession.updateMany({
      where: {
        sessionTokenId,
        isActive: true,
      },
      data: {
        lastActivityAt: new Date(),
      },
    });
  }

  static async recordAuthRedirectToLogin(
    userId: string,
    sessionTokenId: string,
    report: AuthRedirectReport,
    context: SessionRequestContext,
  ): Promise<void> {
    const session = await prisma.userSession.findUnique({
      where: {
        sessionTokenId,
      },
      select: {
        id: true,
        userId: true,
        metadataJson: true,
      },
    });

    if (!session || session.userId !== userId) {
      return;
    }

    const existingMetadata =
      session.metadataJson &&
      typeof session.metadataJson === "object" &&
      !Array.isArray(session.metadataJson)
        ? (session.metadataJson as Record<string, unknown>)
        : {};

    const existingReports = Array.isArray(
      existingMetadata.authRedirectReports,
    )
      ? existingMetadata.authRedirectReports
      : [];

    const redirectReport = {
      ...report,
      at: new Date().toISOString(),
      ipAddress: context.ipAddress,
      browser: context.browser,
      os: context.os,
      userAgent: context.userAgent,
      browserFingerprint: context.browserFingerprint ?? null,
    };

    await prisma.userSession.update({
      where: {
        id: session.id,
      },
      data: {
        metadataJson: {
          ...existingMetadata,
          latestAuthRedirect: redirectReport,
          authRedirectReports: [...existingReports, redirectReport].slice(-10),
        },
      },
    });

    await AuditService.logEvent({
      actorUserId: userId,
      eventType: "AUTH_REDIRECT_TO_LOGIN",
      targetType: "SESSION",
      targetId: session.id,
      metadataJson: {
        sessionTokenId,
        ...redirectReport,
      },
    });
  }

  static async logoutCurrentSession(
    actor: SessionActor,
    sessionTokenId: string,
    reason: string = "USER_LOGOUT",
  ): Promise<void> {
    const now = new Date();

    await prisma.userSession.updateMany({
      where: {
        sessionTokenId,
        userId: actor.userId,
        isActive: true,
      },
      data: {
        isActive: false,
        logoutAt: now,
        terminationReason: reason,
        terminatedByUserId: actor.userId,
      },
    });

    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "AUTH_LOGOUT",
      targetType: "USER",
      targetId: actor.userId,
      metadataJson: {
        reason,
        sessionTokenId,
      },
    });
  }

  static async forceLogoutSession(
    actor: SessionActor,
    sessionId: string,
  ): Promise<void> {
    const now = new Date();

    await prisma.userSession.updateMany({
      where: {
        id: sessionId,
        isActive: true,
      },
      data: {
        isActive: false,
        logoutAt: now,
        terminationReason: "FORCED_BY_ADMIN",
        terminatedByUserId: actor.userId,
      },
    });

    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "AUTH_FORCE_LOGOUT_SESSION",
      targetType: "SESSION",
      targetId: sessionId,
    });
  }

  static async forceLogoutAllSessionsByUser(
    actor: SessionActor,
    userId: string,
  ): Promise<number> {
    const now = new Date();

    const result = await prisma.userSession.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
        logoutAt: now,
        terminationReason: "FORCED_BY_ADMIN_ALL_USER",
        terminatedByUserId: actor.userId,
      },
    });

    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "AUTH_FORCE_LOGOUT_ALL_USER",
      targetType: "USER",
      targetId: userId,
      metadataJson: {
        revokedCount: result.count,
      },
    });

    return result.count;
  }

  static async forceLogoutAllSessions(actor: SessionActor): Promise<number> {
    const now = new Date();

    const result = await prisma.userSession.updateMany({
      where: {
        isActive: true,
      },
      data: {
        isActive: false,
        logoutAt: now,
        terminationReason: "EMERGENCY_GLOBAL_LOGOUT",
        terminatedByUserId: actor.userId,
      },
    });

    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "AUTH_FORCE_LOGOUT_ALL_GLOBAL",
      targetType: "SYSTEM",
      targetId: "all-sessions",
      metadataJson: {
        revokedCount: result.count,
      },
    });

    return result.count;
  }
}
