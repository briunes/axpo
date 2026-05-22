import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SessionService } from "@/application/services/sessionService";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "users.sessions.manage");

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, Number(searchParams.get("pageSize") ?? "25") || 25),
  );
  const userId = searchParams.get("userId") ?? undefined;
  const activeOnly = searchParams.get("activeOnly") === "true";
  const inactiveOnly = searchParams.get("inactiveOnly") === "true";

  const isActiveFilter = activeOnly ? true : inactiveOnly ? false : undefined;

  const where = {
    ...(userId ? { userId } : {}),
    ...(typeof isActiveFilter === "boolean"
      ? { isActive: isActiveFilter }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.userSession.findMany({
      where,
      select: {
        id: true,
        userId: true,
        sessionTokenId: true,
        loginAt: true,
        logoutAt: true,
        isActive: true,
        authMethod: true,
        browser: true,
        os: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        terminationReason: true,
        metadataJson: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            agencyId: true,
            maxActiveDevices: true,
          },
        },
        terminatedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        loginAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.userSession.count({ where }),
  ]);

  return ResponseHandler.ok(
    {
      items,
      total,
      page,
      pageSize,
    },
    200,
  );
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "users.sessions.manage");

  const revokedCount = await SessionService.forceLogoutAllSessions({
    userId: auth.userId,
    role: auth.role,
    agencyId: auth.agencyId,
  });

  return ResponseHandler.ok(
    {
      success: true,
      revokedCount,
    },
    200,
  );
});
