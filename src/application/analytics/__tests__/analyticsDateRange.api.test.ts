import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/analytics/overview/route";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ role: "ADMIN", agencyId: "agency-1" }),
}));
jest.mock("@/application/middleware/rbac", () => ({
  assertPermission: jest.fn(), isElevatedRole: () => true,
}));
jest.mock("@/application/middleware/errorHandler", () => ({ withErrorHandler: (handler: unknown) => handler }));
jest.mock("@/application/lib/appVersionCache", () => ({
  warmAppVersionCache: jest.fn(), getCachedAppVersion: () => "test",
}));
jest.mock("@/infrastructure/database/databaseMode", () => ({ isSupabaseApiMode: jest.fn() }));
jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulation: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    accessAttempt: { findMany: jest.fn(), count: jest.fn() },
    emailLog: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    agency: { findMany: jest.fn() }, user: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

const db = prisma as unknown as Record<string, any>;
const request = () => new NextRequest("http://localhost/api/v1/internal/analytics/overview?startDate=2026-08-01&endDate=2026-08-02&agencyId=agency-1");
const since = new Date("2026-08-01T00:00:00Z");
const until = new Date("2026-08-03T00:00:00Z");
const previousSince = new Date("2026-07-30T00:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
  for (const model of [db.simulation, db.accessAttempt, db.emailLog, db.agency, db.user]) {
    model.findMany?.mockResolvedValue([]);
    model.count?.mockResolvedValue(0);
    model.groupBy?.mockResolvedValue([]);
    model.aggregate?.mockResolvedValue({ _sum: { openCount: 0 } });
  }
  db.$queryRaw.mockResolvedValue([]);
});

it.each([false, true])("bounds queries and produces every selected date (API mode: %s)", async (apiMode) => {
  jest.mocked(isSupabaseApiMode).mockReturnValue(apiMode);
  const response = await GET(request());
  const { data } = await response.json();
  expect(response.status).toBe(200);
  expect(data.periodDays).toBe(2);
  expect(data.simulationTrend).toEqual([
    { date: "2026-08-01", count: 0 }, { date: "2026-08-02", count: 0 },
  ]);
  expect(db.accessAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ createdAt: { gte: since, lt: until } }),
  }));
  if (apiMode) {
    expect(db.simulation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ agencyId: "agency-1", createdAt: { gte: previousSince, lt: until } }),
    }));
    expect(db.simulation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ agencyId: "agency-1", sharedAt: { gte: previousSince, lt: until } }),
    }));
  } else {
    expect(db.simulation.count).toHaveBeenCalledWith({ where: {
      isDeleted: false, agencyId: "agency-1", createdAt: { gte: since, lt: until },
    } });
    expect(db.simulation.count).toHaveBeenCalledWith({ where: {
      isDeleted: false, agencyId: "agency-1", createdAt: { gte: previousSince, lt: since },
    } });
    for (const call of db.$queryRaw.mock.calls) {
      expect(call).toContainEqual(until);
    }
  }
});

it.each([false, true])("includes agencies even when the entire period is empty (API mode: %s)", async (apiMode) => {
  jest.mocked(isSupabaseApiMode).mockReturnValue(apiMode);
  db.agency.findMany.mockResolvedValue([
    { id: "agency-1", name: "First agency" },
    { id: "agency-2", name: "No activity agency" },
  ]);
  const response = await GET(new NextRequest(
    "http://localhost/api/v1/internal/analytics/overview?startDate=2026-08-01&endDate=2026-08-02",
  ));
  const { data } = await response.json();
  expect(data.byAgency).toEqual([
    { agencyId: "agency-1", agencyName: "First agency", total: 0, shared: 0, expired: 0, opened: 0 },
    { agencyId: "agency-2", agencyName: "No activity agency", total: 0, shared: 0, expired: 0, opened: 0 },
  ]);
  expect(data.activeAgencies).toBe(0);
  expect(db.agency.findMany).toHaveBeenCalledWith({
    where: { isDeleted: false }, select: { id: true, name: true },
  });
});
