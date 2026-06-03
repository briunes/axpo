import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import {
  assertPermission,
  isElevatedRole,
} from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { Prisma } from "@prisma/client";

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

  // Admin can optionally scope to a specific agency
  const filterAgencyId = isElevatedRole(auth.role)
    ? (searchParams.get("agencyId") ?? undefined)
    : auth.agencyId!;

  // Optional energy type filter: "ELECTRICITY" | "GAS" | undefined (all)
  const energyTypeParam = searchParams.get("energyType") ?? undefined;
  const energyTypeFilter =
    energyTypeParam === "ELECTRICITY" || energyTypeParam === "GAS"
      ? energyTypeParam
      : undefined;

  // SQL clause helpers — used in raw queries
  const agencyClause = filterAgencyId
    ? Prisma.sql`AND s."agencyId" = ${filterAgencyId}`
    : Prisma.sql``;

  // When energy type is set, narrow to matching simulation IDs via the JSON payload
  let energyTypeIdFilter: { id?: { in: string[] } } = {};
  if (energyTypeFilter) {
    const matchingRows = await prisma.$queryRaw<
      Array<{ simulationId: string }>
    >`
      WITH latest AS (
        SELECT DISTINCT ON ("simulationId") "simulationId", "payloadJson"
        FROM simulation_versions
        ORDER BY "simulationId", "createdAt" DESC
      )
      SELECT latest."simulationId"
      FROM latest
      INNER JOIN simulations s ON s.id = latest."simulationId"
      WHERE s."isDeleted" = false
        ${agencyClause}
        AND latest."payloadJson"->>'type' = ${energyTypeFilter}
    `;
    energyTypeIdFilter = {
      id: { in: matchingRows.map((r) => r.simulationId) },
    };
  }

  const simulationFilter = filterAgencyId
    ? { isDeleted: false, agencyId: filterAgencyId, ...energyTypeIdFilter }
    : { isDeleted: false, ...energyTypeIdFilter };

  const accessFilter = filterAgencyId
    ? { simulation: { agencyId: filterAgencyId } }
    : {};

  // Period-scoped variants — used for all KPI counts so they respect the days filter
  const simulationPeriodFilter = {
    ...simulationFilter,
    createdAt: { gte: since },
  };

  // Access counts are scoped to simulations created in the period (same cohort),
  // so that "opens" is always comparable to "sent" and open rate stays ≤ 100%
  // (unless a client opens multiple times, which is expected).
  const accessOnPeriodSimsFilter = filterAgencyId
    ? {
        simulation: {
          agencyId: filterAgencyId,
          createdAt: { gte: since },
          ...energyTypeIdFilter,
        },
      }
    : { simulation: { createdAt: { gte: since }, ...energyTypeIdFilter } };

  const [
    totalSimulations,
    sharedSimulations,
    emailSharedSimulations,
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
    // Only simulations sent via email can be "opened" by the client —
    // PDF/download shares will never register an open, so email-sent is the
    // correct denominator for open-rate calculations.
    prisma.simulation.count({
      where: {
        ...simulationPeriodFilter,
        status: "SHARED",
        sharedVia: "EMAIL",
      },
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
    isElevatedRole(auth.role) && !filterAgencyId
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
      where: { ...accessFilter, createdAt: { gte: since } },
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

  // ── Simulation content metrics (raw SQL — JSON payload extraction) ────────
  const energyTypeClause = energyTypeFilter
    ? Prisma.sql`AND latest."payloadJson"->>'type' = ${energyTypeFilter}`
    : Prisma.sql``;

  const [energyTypeSplitRaw, tariffBreakdownRaw, avgConsumptionRaw] =
    await Promise.all([
      prisma.$queryRaw<Array<{ type: string | null; count: number }>>`
        WITH latest AS (
          SELECT DISTINCT ON ("simulationId") "simulationId", "payloadJson"
          FROM simulation_versions
          ORDER BY "simulationId", "createdAt" DESC
        )
        SELECT latest."payloadJson"->>'type' AS type, COUNT(*)::int AS count
        FROM latest
        INNER JOIN simulations s ON s.id = latest."simulationId"
        WHERE s."isDeleted" = false
          AND s."createdAt" >= ${since}
          ${agencyClause}
          ${energyTypeClause}
        GROUP BY latest."payloadJson"->>'type'
      `,
      prisma.$queryRaw<Array<{ tariff: string | null; count: number }>>`
        WITH latest AS (
          SELECT DISTINCT ON ("simulationId") "simulationId", "payloadJson"
          FROM simulation_versions
          ORDER BY "simulationId", "createdAt" DESC
        )
        SELECT
          COALESCE(
            latest."payloadJson"->'electricity'->>'tarifaAcceso',
            latest."payloadJson"->'gas'->>'tarifaAcceso'
          ) AS tariff,
          COUNT(*)::int AS count
        FROM latest
        INNER JOIN simulations s ON s.id = latest."simulationId"
        WHERE s."isDeleted" = false
          AND s."createdAt" >= ${since}
          ${agencyClause}
          ${energyTypeClause}
        GROUP BY tariff
        ORDER BY count DESC
      `,
      prisma.$queryRaw<Array<{ avg_consumption: number | null }>>`
        WITH latest AS (
          SELECT DISTINCT ON ("simulationId") "simulationId", "payloadJson"
          FROM simulation_versions
          ORDER BY "simulationId", "createdAt" DESC
        )
        SELECT AVG(
          CASE
            WHEN latest."payloadJson"->>'type' = 'ELECTRICITY'
              THEN (latest."payloadJson"->'electricity'->'clientData'->>'consumoAnual')::float
            WHEN latest."payloadJson"->>'type' = 'GAS'
              THEN (latest."payloadJson"->'gas'->>'consumo')::float
            ELSE NULL
          END
        ) AS avg_consumption
        FROM latest
        INNER JOIN simulations s ON s.id = latest."simulationId"
        WHERE s."isDeleted" = false
          AND s."createdAt" >= ${since}
          ${agencyClause}
          ${energyTypeClause}
      `,
    ]);

  const energyTypeSplit = energyTypeSplitRaw
    .filter((r) => r.type)
    .map((r) => ({ type: r.type as string, count: Number(r.count) }));

  const tariffBreakdown = tariffBreakdownRaw
    .filter((r) => r.tariff)
    .map((r) => ({ tariff: r.tariff as string, count: Number(r.count) }));

  const avgConsumoAnual =
    avgConsumptionRaw[0]?.avg_consumption != null
      ? Math.round(Number(avgConsumptionRaw[0].avg_consumption))
      : null;

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
    const [agencies, sharedByAgency, expiredByAgency, openedByAgency] =
      await Promise.all([
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
        prisma.simulation.groupBy({
          by: ["agencyId"],
          where: {
            isDeleted: false,
            createdAt: { gte: since },
            agencyId: { in: agencyIds },
            accessAttempts: { some: { success: true } },
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
    const openedMap = new Map(
      openedByAgency.map((r) => [r.agencyId, r._count._all]),
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
        opened: openedMap.get(r.agencyId as string) ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  // ── By-user breakdown ─────────────────────────────────────────────────────
  let byUser:
    | Array<{
        userId: string;
        userName: string;
        total: number;
        shared: number;
        opened: number;
      }>
    | undefined;
  if (byUserRaw.length > 0) {
    const userIds = byUserRaw.map((r) => r.ownerUserId);
    const [users, sharedByUser, openedByUser] = await Promise.all([
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
      prisma.simulation.groupBy({
        by: ["ownerUserId"],
        where: {
          ...simulationPeriodFilter,
          ownerUserId: { in: userIds },
          accessAttempts: { some: { success: true } },
        },
        _count: { _all: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));
    const sharedMap = new Map(
      sharedByUser.map((r) => [r.ownerUserId, r._count._all]),
    );
    const openedMap = new Map(
      openedByUser.map((r) => [r.ownerUserId, r._count._all]),
    );
    byUser = byUserRaw.map((r) => ({
      userId: r.ownerUserId,
      userName: userMap.get(r.ownerUserId) ?? r.ownerUserId,
      total: r._count?._all ?? 0,
      shared: sharedMap.get(r.ownerUserId) ?? 0,
      opened: openedMap.get(r.ownerUserId) ?? 0,
    }));
  }

  return ResponseHandler.ok(
    {
      totalSimulations,
      sharedSimulations,
      emailSharedSimulations,
      expiredSimulations,
      draftSimulations,
      accessAttempts,
      successfulAccess,
      simulationTrend,
      accessTrend,
      periodDays: days,
      energyTypeSplit,
      tariffBreakdown,
      avgConsumoAnual,
      ...(byAgency ? { byAgency } : {}),
      ...(byUser ? { byUser } : {}),
    },
    200,
  );
});
