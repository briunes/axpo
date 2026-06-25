import { NextRequest } from "next/server";
import { GET, PATCH } from "../../../../app/api/v1/internal/agencies/[id]/route";
import { ForbiddenError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const assertPermissionMock = jest.fn();
const findAgencyMock = jest.fn();
const updateAgencyMock = jest.fn();
const transactionMock = jest.fn();
const auditLogMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
  assertPermission: (...args: unknown[]) => assertPermissionMock(...args),
  isElevatedRole: (role: UserRole) =>
    role === UserRole.ADMIN || role === UserRole.SYS_ADMIN,
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    agency: {
      findUnique: (...args: unknown[]) => findAgencyMock(...args),
      update: (...args: unknown[]) => updateAgencyMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

jest.mock("@/application/services/auditService", () => ({
  AuditService: {
    logEvent: (...args: unknown[]) => auditLogMock(...args),
  },
}));

describe("agency by id security", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    assertPermissionMock.mockResolvedValue(undefined);
    auditLogMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 404 when agent requests a different agency id", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "agent-1",
      role: UserRole.AGENT,
      agencyId: "agency-1",
      email: "agent@example.com",
    });
    assertRoleMock.mockReturnValue(undefined);

    const request = new NextRequest("http://localhost/api/v1/internal/agencies/agency-2", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "agency-2" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(findAgencyMock).not.toHaveBeenCalled();
  });

  it("allows admin to read any agency", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "admin-1",
      role: UserRole.ADMIN,
      agencyId: "agency-admin",
      email: "admin@example.com",
    });
    assertRoleMock.mockReturnValue(undefined);
    findAgencyMock.mockResolvedValue({
      id: "agency-2",
      name: "Agency 2",
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/v1/internal/agencies/agency-2", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "agency-2" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("agency-2");
    expect(findAgencyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "agency-2" } }),
    );
  });

  it("returns 403 when non-admin tries to patch an agency", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "agent-1",
      role: UserRole.AGENT,
      agencyId: "agency-1",
      email: "agent@example.com",
    });
    assertPermissionMock.mockImplementation(() => {
      throw new ForbiddenError("Insufficient permissions for this operation");
    });

    const request = new NextRequest("http://localhost/api/v1/internal/agencies/agency-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request, { params: { id: "agency-1" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(findAgencyMock).not.toHaveBeenCalled();
    expect(updateAgencyMock).not.toHaveBeenCalled();
  });

  it("persists the TLV agency flag when admin patches agency", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "admin-1",
      role: UserRole.ADMIN,
      agencyId: "agency-admin",
      email: "admin@example.com",
    });
    findAgencyMock.mockResolvedValue({
      id: "agency-1",
      name: "Agency 1",
      isActive: true,
      isDeleted: false,
      isTlv: false,
    });
    updateAgencyMock.mockResolvedValue({
      id: "agency-1",
      name: "Agency 1",
      isTlv: true,
    });
    transactionMock.mockImplementation(async (callback) =>
      callback({
        agency: {
          update: updateAgencyMock,
        },
      }),
    );

    const request = new NextRequest("http://localhost/api/v1/internal/agencies/agency-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Agency 1", isTlv: true }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request, { params: { id: "agency-1" } });

    expect(response.status).toBe(200);
    expect(updateAgencyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isTlv: true }),
      }),
    );
  });
});
