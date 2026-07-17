import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { GET as getAuditLogs } from "../../../../app/api/v1/internal/audit-logs/route";
import { GET as getEmailLogs } from "../../../../app/api/v1/internal/email-logs/route";
import { GET as getOcrLogs } from "../../../../app/api/v1/internal/ocr-logs/route";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const assertPermissionMock = jest.fn();
const auditFindManyMock = jest.fn();
const auditCountMock = jest.fn();
const emailFindManyMock = jest.fn();
const emailCountMock = jest.fn();
const ocrFindManyMock = jest.fn();
const ocrCountMock = jest.fn();
const userFindManyMock = jest.fn();
const simulationFindManyMock = jest.fn();

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
    emailLog: {
      findMany: (...args: unknown[]) => emailFindManyMock(...args),
      count: (...args: unknown[]) => emailCountMock(...args),
    },
    ocrLog: {
      findMany: (...args: unknown[]) => ocrFindManyMock(...args),
      count: (...args: unknown[]) => ocrCountMock(...args),
    },
    user: {
      findMany: (...args: unknown[]) => userFindManyMock(...args),
    },
    simulation: {
      findMany: (...args: unknown[]) => simulationFindManyMock(...args),
      findFirst: jest.fn(),
    },
    client: { findFirst: jest.fn(), findMany: jest.fn() },
    agency: { findMany: jest.fn() },
    baseValueSet: { findMany: jest.fn() },
  },
}));

jest.mock("@/application/services/errorLoggerService", () => ({
  ErrorLoggerService: { capture: jest.fn().mockResolvedValue(undefined) },
}));

describe("log quick search filters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      userId: "admin-1",
      role: UserRole.ADMIN,
      agencyId: "agency-1",
      email: "admin@example.com",
    });
    auditFindManyMock.mockResolvedValue([]);
    auditCountMock.mockResolvedValue(0);
    emailFindManyMock.mockResolvedValue([]);
    emailCountMock.mockResolvedValue(0);
    ocrFindManyMock.mockResolvedValue([]);
    ocrCountMock.mockResolvedValue(0);
    userFindManyMock.mockResolvedValue([{ id: "user-1" }]);
    simulationFindManyMock.mockResolvedValue([{ id: "sim-1" }]);
  });

  it("searches email logs without relation fields inside OR", async () => {
    const response = await getEmailLogs(
      new NextRequest("http://localhost/api/v1/internal/email-logs?search=o.barros"),
    );

    expect(response.status).toBe(200);
    const where = emailFindManyMock.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipientEmail: expect.any(Object) }),
        expect.objectContaining({ triggeredByUserId: { in: ["user-1"] } }),
      ]),
    );
    expect(JSON.stringify(where.OR)).not.toContain('"triggeredByUser":');
  });

  it("searches audit logs by actor through actorUserId, not actor relation filters", async () => {
    const response = await getAuditLogs(
      new NextRequest("http://localhost/api/v1/internal/audit-logs?search=samuel"),
    );

    expect(response.status).toBe(200);
    const where = auditFindManyMock.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: expect.any(Object) }),
        expect.objectContaining({ actorUserId: { in: ["user-1"] } }),
      ]),
    );
    expect(JSON.stringify(where.OR)).not.toContain('"actor"');
  });

  it("searches OCR logs through scalar fields and foreign keys", async () => {
    const response = await getOcrLogs(
      new NextRequest("http://localhost/api/v1/internal/ocr-logs?search=SIM-001"),
    );

    expect(response.status).toBe(200);
    const where = ocrFindManyMock.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userEmail: expect.any(Object) }),
        expect.objectContaining({ userId: { in: ["user-1"] } }),
        expect.objectContaining({ simulationId: { in: ["sim-1"] } }),
      ]),
    );
    expect(JSON.stringify(where.OR)).not.toContain('"user"');
    expect(JSON.stringify(where.OR)).not.toContain('"simulation"');
  });
});
