import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/simulation-issues/route";
import { UserRole } from "@/domain/types";

const findManyMock = jest.fn();
const countMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: async () => ({ userId: "sys-1", role: UserRole.SYS_ADMIN }),
}));
jest.mock("@/application/services/errorLoggerService", () => ({
  ErrorLoggerService: { capture: async () => undefined },
}));
jest.mock("@/infrastructure/database/prisma", () => ({ prisma: {
  rolePermission: { findUnique: async () => null },
  simulationIssue: {
    findMany: (...args: unknown[]) => findManyMock(...args),
    count: (...args: unknown[]) => countMock(...args),
  },
} }));

describe("Simulation issue listing queues", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it("keeps the default admin listing unrestricted", async () => {
    const response = await GET(new NextRequest("http://localhost/api/v1/internal/simulation-issues"));
    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(countMock).toHaveBeenCalledWith({ where: {} });
  });

  it.each(["", "NEW", "IN_REVIEW", "RESOLVED", "DISMISSED"])(
    "restricts sys admin results and totals to escalations with progress %s",
    async (status) => {
      const response = await GET(new NextRequest(
        `http://localhost/api/v1/internal/simulation-issues?queue=sys-admin&status=${status}&page=2&limit=10&reporter=Bruno&dateFrom=2026-09-01`,
      ));
      expect(response.status).toBe(200);
      const where = findManyMock.mock.calls[0][0].where;
      expect(where).toEqual(expect.objectContaining({
        status: "ESCALATED",
        reportedByUser: { OR: [
          { fullName: { contains: "Bruno", mode: "insensitive" } },
          { email: { contains: "Bruno", mode: "insensitive" } },
        ] },
        createdAt: { gte: new Date("2026-09-01T00:00:00.000Z") },
      }));
      if (status) expect(where.OR).toEqual([{ status }, { appStatus: status }]);
      else expect(where.OR).toBeUndefined();
      expect(countMock).toHaveBeenCalledWith({ where });
      expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    },
  );
});
