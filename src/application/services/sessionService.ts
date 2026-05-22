import crypto from "crypto";
import { UserRole } from "@/domain/types";
import { prisma } from "@/infrastructure/database/prisma";
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

    const autoKickedSessionIds = await prisma.$transaction(async (tx) => {
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

      const overflowCount = Math.max(0, activeSessions.length - maxDevices + 1);
      const sessionsToKick =
        overflowCount > 0
          ? activeSessions.slice(0, overflowCount).map((item) => item.id)
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
