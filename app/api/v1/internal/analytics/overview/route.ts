import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * @swagger
 * /api/v1/internal/analytics/overview:
 *   get:
 *     tags: [Analytics]
 *     summary: Return analytics overview with trends, breakdowns and activity data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days for trend data (7, 30 or 90)
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.analytics");

  const { searchParams } = new URL(request.url);
  const days = Math.min(
    Math.max(parseInt(searchParams.get("days") ?? "30", 10), 7),
    90,
  );
  const since = new Date(Date.now() - days * 86_400_000);

  const simulationFilter =
    auth.role === UserRole.ADMIN
      ? { isDeleted: false }
      : { isDeleted: false, agencyId: auth.agencyId! };

  const accessFilter =
    auth.role === UserRole.ADMIN
      ? {}
      : { simulation: { agencyId: auth.agencyId! } };

  // Period-scoped variants — used for all KPI counts so they respect the days filter
  const simulationPeriodFilter = {
    ...simulationFilter,
    createdAt: { gte: since },
  };

  // Access counts are scoped to simulations created in the period (same cohort),
  // so that "opens" is always comparable to "sent" and open rate stays ≤ 100%
  // (unless a client opens multiple times, which is expected).
  const accessOnPeriodSimsFilter =
    auth.role === UserRole.ADMIN
      ? { simulation: { createdAt: { gte: since } } }
      : { simulation: { agencyId: auth.agencyId!, createdAt: { gte: since } } };

  const [
    totalSimulations,
    sharedSimulations,
    expiredSimulations,
    draftSimulations,
    accessAttempts,
    successfulAccess,
    byAgencyRaw,
    recentSimulations,
    recentAccess,
    byUserRaw,
  ] = await Promise.all([
    prisma.simulation.count({ where: simulationPeriodFilter }),
    prisma.simulation.count({
      where: { ...simulationPeriodFilter, status: "SHARED" },
    }),
    prisma.simulation.count({
      where: { ...simulationPeriodFilter, status: "EXPIRED" },
    }),
    prisma.simulation.count({
      where: { ...simulationPeriodFilter, status: "DRAFT" },
    }),
    prisma.accessAttempt.count({ where: accessOnPeriodSimsFilter }),
    // "Opened" = distinct simulations (created in period) that a client accessed at least once successfully
    prisma.simulation.count({
      where: {
        ...simulationPeriodFilter,
        accessAttempts: { some: { success: true } },
      },
    }),
    auth.role === UserRole.ADMIN
      ? prisma.simulation.groupBy({
          by: ["agencyId"],
          where: simulationPeriodFilter,
          _count: { _all: true },
        })
      : Promise.resolve(null),
    prisma.simulation.findMany({
      where: { ...simulationFilter, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.accessAttempt.findMany({
      where: { ...accessOnPeriodSimsFilter, createdAt: { gte: since } },
      select: { createdAt: true, success: true, simulationId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.simulation.groupBy({
      by: ["ownerUserId"],
      where: simulationPeriodFilter,
      _count: { _all: true },
      orderBy: { _count: { ownerUserId: "desc" } },
      take: 10,
    }),
  ]);

  // ── Build daily bucket arrays ─────────────────────────────────────────────
  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const simByDay = new Map(dayKeys.map((k) => [k, 0]));
  for (const s of recentSimulations) {
    const k = s.createdAt.toISOString().slice(0, 10);
    if (simByDay.has(k)) simByDay.set(k, simByDay.get(k)! + 1);
  }
  const simulationTrend = dayKeys.map((date) => ({
    date,
    count: simByDay.get(date) ?? 0,
  }));

  const accessByDay = new Map(
    dayKeys.map((k) => [k, { count: 0, successful: 0 }]),
  );
  // Track which simulations have already been counted as "opened" per day
  // to avoid counting the same simulation twice in one day bucket.
  const openedSimsByDay = new Map<string, Set<string>>();
  for (const a of recentAccess) {
    const k = a.createdAt.toISOString().slice(0, 10);
    const bucket = accessByDay.get(k);
    if (bucket) {
      bucket.count++;
      if (a.success) {
        if (!openedSimsByDay.has(k)) openedSimsByDay.set(k, new Set());
        if (!openedSimsByDay.get(k)!.has(a.simulationId)) {
          openedSimsByDay.get(k)!.add(a.simulationId);
          bucket.successful++;
        }
      }
    }
  }
  const accessTrend = dayKeys.map((date) => ({
    date,
    ...(accessByDay.get(date) ?? { count: 0, successful: 0 }),
  }));

  // ── By-agency breakdown ───────────────────────────────────────────────────
  let byAgency:
    | Array<{
        agencyId: string;
        agencyName: string;
        total: number;
        shared: number;
        expired: number;
      }>
    | undefined;
  if (byAgencyRaw && byAgencyRaw.length > 0) {
    const agencyIds = byAgencyRaw
      .map((r) => r.agencyId)
      .filter(Boolean) as string[];
    const [agencies, sharedByAgency, expiredByAgency] = await Promise.all([
      prisma.agency.findMany({
        where: { id: { in: agencyIds } },
        select: { id: true, name: true },
      }),
      prisma.simulation.groupBy({
        by: ["agencyId"],
        where: {
          isDeleted: false,
          status: "SHARED",
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.simulation.groupBy({
        by: ["agencyId"],
        where: {
          isDeleted: false,
          status: "EXPIRED",
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
    ]);
    const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
    const sharedMap = new Map(
      sharedByAgency.map((r) => [r.agencyId, r._count._all]),
    );
    const expiredMap = new Map(
      expiredByAgency.map((r) => [r.agencyId, r._count._all]),
    );
    byAgency = byAgencyRaw
      .filter((r) => r.agencyId)
      .map((r) => ({
        agencyId: r.agencyId as string,
        agencyName:
          agencyMap.get(r.agencyId as string) ?? (r.agencyId as string),
        total: r._count._all,
        shared: sharedMap.get(r.agencyId as string) ?? 0,
        expired: expiredMap.get(r.agencyId as string) ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  // ── By-user breakdown ─────────────────────────────────────────────────────
  let byUser:
    | Array<{ userId: string; userName: string; total: number; shared: number }>
    | undefined;
  if (byUserRaw.length > 0) {
    const userIds = byUserRaw.map((r) => r.ownerUserId);
    const [users, sharedByUser] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      }),
      prisma.simulation.groupBy({
        by: ["ownerUserId"],
        where: {
          ...simulationPeriodFilter,
          status: "SHARED",
          ownerUserId: { in: userIds },
        },
        _count: { _all: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));
    const sharedMap = new Map(
      sharedByUser.map((r) => [r.ownerUserId, r._count._all]),
    );
    byUser = byUserRaw.map((r) => ({
      userId: r.ownerUserId,
      userName: userMap.get(r.ownerUserId) ?? r.ownerUserId,
      total: r._count?._all ?? 0,
      shared: sharedMap.get(r.ownerUserId) ?? 0,
    }));
  }

  return ResponseHandler.ok(
    {
      totalSimulations,
      sharedSimulations,
      expiredSimulations,
      draftSimulations,
      accessAttempts,
      successfulAccess,
      simulationTrend,
      accessTrend,
      periodDays: days,
      ...(byAgency ? { byAgency } : {}),
      ...(byUser ? { byUser } : {}),
    },
    200,
  );
});
