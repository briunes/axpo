import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/app-error-logs/route";

const findMany = jest.fn();
const count = jest.fn();
jest.mock("@/application/middleware/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ role: "SYS_ADMIN" }),
}));
jest.mock("@/application/middleware/rbac", () => ({
  assertRole: jest.fn(),
  assertPermission: jest.fn(),
}));
jest.mock("@/application/middleware/errorHandler", () => ({
  withErrorHandler: (handler: unknown) => handler,
}));
jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: { appErrorLog: {
    findMany: (...args: unknown[]) => findMany(...args),
    count: (...args: unknown[]) => count(...args),
  } },
}));

const request = (query = "") => GET(new NextRequest(`http://localhost/api/v1/internal/app-error-logs${query}`));

// Evaluate the status predicates on representative records, including SQL NULL.
const matchesStatus = (where: any, status: number | null): boolean => {
  if (where.AND) return where.AND.every((part: any) => matchesStatus(part, status));
  if (where.OR) return where.OR.some((part: any) => matchesStatus(part, status));
  if (!("statusCode" in where)) return true;
  if (where.statusCode === null) return status === null;
  if (status === null) return false;
  if (where.statusCode.lt !== undefined) return status < where.statusCode.lt;
  return status >= where.statusCode.gte;
};

describe("App Errors visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it("defaults to unexpected errors, retaining client exceptions and server failures", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    const { where } = findMany.mock.calls[0][0];
    for (const status of [400, 401, 403, 404, 409, 422, 429, 499]) {
      expect(matchesStatus(where, status)).toBe(false);
    }
    for (const status of [null, 500, 502, 503]) {
      expect(matchesStatus(where, status)).toBe(true);
    }
    expect(count).toHaveBeenCalledWith({ where });
  });

  it("allows all errors and preserves explicit type filters from existing saved views", async () => {
    await request("?errorScope=all");
    expect(findMany.mock.calls[0][0].where).toEqual({ isDeleted: false });
    await request("?errorType=SyntaxError");
    expect(findMany.mock.calls[1][0].where).toEqual({ isDeleted: false, errorType: "SyntaxError" });
  });

  it("combines unexpected scope with search, dates and pagination", async () => {
    count.mockResolvedValue(51);
    const response = await request("?errorScope=unexpected&search=invoice&dateFrom=2026-09-01&page=2&limit=25");
    const { where, skip, take } = findMany.mock.calls[0][0];
    expect(where.AND).toBeDefined();
    expect(where.OR).toContainEqual({ message: { contains: "invoice", mode: "insensitive" } });
    expect(where.createdAt.gte).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect({ skip, take }).toEqual({ skip: 25, take: 25 });
    expect(count).toHaveBeenCalledWith({ where });
    expect((await response.json()).data.pagination).toMatchObject({ total: 51, totalPages: 3 });
  });

  it("retains the scope when retrying a legacy database without soft deletion", async () => {
    findMany.mockRejectedValueOnce(new Error("app_error_logs.isDeleted does not exist"));
    await request();
    const first = findMany.mock.calls[0][0].where;
    const retry = findMany.mock.calls[1][0].where;
    const { isDeleted, ...filters } = first;
    expect(isDeleted).toBe(false);
    expect(retry).toEqual(filters);
    expect(matchesStatus(retry, 401)).toBe(false);
    expect(matchesStatus(retry, null)).toBe(true);
    expect(count).toHaveBeenCalledWith({ where: retry });
  });
});
