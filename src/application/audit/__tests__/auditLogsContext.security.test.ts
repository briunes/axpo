import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/audit-logs/route";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const assertPermissionMock = jest.fn();
const clientFindFirstMock = jest.fn();
const clientFindManyMock = jest.fn();
const auditFindManyMock = jest.fn();
const auditCountMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
  assertPermission: (...args: unknown[]) => assertPermissionMock(...args),
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: (...args: unknown[]) => auditFindManyMock(...args),
      count: (...args: unknown[]) => auditCountMock(...args),
    },
    client: {
      findFirst: (...args: unknown[]) => clientFindFirstMock(...args),
      findMany: (...args: unknown[]) => clientFindManyMock(...args),
    },
    simulation: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    agency: { findMany: jest.fn() },
    baseValueSet: { findMany: jest.fn() },
  },
}));

jest.mock("@/application/services/errorLoggerService", () => ({
  ErrorLoggerService: { capture: jest.fn().mockResolvedValue(undefined) },
}));

describe("contextual audit log security", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    requireAuthMock.mockResolvedValue({
      userId: "agent-1",
      role: UserRole.AGENT,
      agencyId: "agency-1",
      email: "agent@example.com",
    });
    auditFindManyMock.mockResolvedValue([]);
    auditCountMock.mockResolvedValue(0);
    clientFindManyMock.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("allows an agent to read audit logs for a client in their agency", async () => {
    clientFindFirstMock.mockResolvedValue({ id: "client-1" });
    const request = new NextRequest(
      "http://localhost/api/v1/internal/audit-logs?targetType=CLIENT&targetId=client-1",
      { headers: { authorization: "Bearer token" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(assertRoleMock).not.toHaveBeenCalled();
    expect(assertPermissionMock).not.toHaveBeenCalled();
    expect(clientFindFirstMock).toHaveBeenCalledWith({
      where: { id: "client-1", agencyId: "agency-1" },
      select: { id: true },
    });
    expect(auditFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetType: "CLIENT",
          targetId: "client-1",
        }),
      }),
    );
  });

  it("does not reveal audit logs for a client in another agency", async () => {
    clientFindFirstMock.mockResolvedValue(null);
    const request = new NextRequest(
      "http://localhost/api/v1/internal/audit-logs?targetType=CLIENT&targetId=client-2",
      { headers: { authorization: "Bearer token" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(404);
    expect(auditFindManyMock).not.toHaveBeenCalled();
    expect(auditCountMock).not.toHaveBeenCalled();
  });
});
