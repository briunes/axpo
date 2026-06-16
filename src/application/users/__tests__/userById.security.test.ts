import { NextRequest } from "next/server";
import { GET, PATCH } from "../../../../app/api/v1/internal/users/[id]/route";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const findUserMock = jest.fn();
const updateUserMock = jest.fn();
const transactionMock = jest.fn();
const logEventMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
  isElevatedRole: (role: UserRole) =>
    role === UserRole.ADMIN || role === UserRole.SYS_ADMIN,
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
    user: {
      findUnique: (...args: unknown[]) => findUserMock(...args),
      update: (...args: unknown[]) => updateUserMock(...args),
    },
    userPreferences: {
      findUnique: jest.fn(),
    },
    systemConfig: {
      findFirst: jest.fn().mockResolvedValue({ defaultMaxActiveDevices: 3 }),
    },
  },
}));

jest.mock("@/application/services/auditService", () => ({
  AuditService: {
    logEvent: (...args: unknown[]) => logEventMock(...args),
  },
}));

describe("user by id security", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    assertRoleMock.mockReturnValue(undefined);
    transactionMock.mockImplementation((callback) =>
      callback({
        user: { update: (...args: unknown[]) => updateUserMock(...args) },
        userPreferences: { upsert: jest.fn() },
      }),
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 404 when commercial requests another user", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "commercial-1",
      role: UserRole.COMMERCIAL,
      agencyId: "agency-1",
      email: "commercial@example.com",
    });
    findUserMock.mockResolvedValue({
      id: "user-2",
      agencyId: "agency-1",
      role: UserRole.COMMERCIAL,
      fullName: "Another User",
      email: "another@example.com",
      isActive: true,
      createdAt: new Date("2026-03-11T10:00:00.000Z"),
      updatedAt: new Date("2026-03-11T10:00:00.000Z"),
      pinRotatedAt: new Date("2026-03-11T10:00:00.000Z"),
    });

    const request = new NextRequest("http://localhost/api/v1/internal/users/user-2", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "user-2" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 when commercial tries to change role on own profile", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "commercial-1",
      role: UserRole.COMMERCIAL,
      agencyId: "agency-1",
      email: "commercial@example.com",
    });
    findUserMock.mockResolvedValue({
      id: "commercial-1",
      agencyId: "agency-1",
      role: UserRole.COMMERCIAL,
      fullName: "Commercial",
      email: "commercial@example.com",
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/v1/internal/users/commercial-1", {
      method: "PATCH",
      body: JSON.stringify({ role: UserRole.AGENT }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request, { params: { id: "commercial-1" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("allows sys admin to promote another user to sys admin", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "sys-admin-1",
      role: UserRole.SYS_ADMIN,
      agencyId: "agency-1",
      email: "sys@example.com",
    });
    findUserMock.mockResolvedValue({
      id: "user-2",
      agencyId: "agency-1",
      role: UserRole.ADMIN,
      fullName: "Admin User",
      email: "admin@example.com",
      isActive: true,
      isDeleted: false,
    });
    updateUserMock.mockResolvedValue({
      id: "user-2",
      agencyId: "agency-1",
      role: UserRole.SYS_ADMIN,
      fullName: "Admin User",
      email: "admin@example.com",
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/v1/internal/users/user-2", {
      method: "PATCH",
      body: JSON.stringify({ role: UserRole.SYS_ADMIN }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request, { params: { id: "user-2" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.SYS_ADMIN }),
      }),
    );
    expect(logEventMock).toHaveBeenCalled();
  });

  it("returns 403 when admin tries to assign sys admin", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "admin-1",
      role: UserRole.ADMIN,
      agencyId: "agency-1",
      email: "admin@example.com",
    });
    findUserMock.mockResolvedValue({
      id: "user-2",
      agencyId: "agency-1",
      role: UserRole.COMMERCIAL,
      fullName: "Commercial User",
      email: "commercial@example.com",
      isActive: true,
      isDeleted: false,
    });

    const request = new NextRequest("http://localhost/api/v1/internal/users/user-2", {
      method: "PATCH",
      body: JSON.stringify({ role: UserRole.SYS_ADMIN }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request, { params: { id: "user-2" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("returns 403 when trying to change an existing sys admin role", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "sys-admin-1",
      role: UserRole.SYS_ADMIN,
      agencyId: "agency-1",
      email: "sys@example.com",
    });
    findUserMock.mockResolvedValue({
      id: "sys-admin-2",
      agencyId: "agency-1",
      role: UserRole.SYS_ADMIN,
      fullName: "Other Sys Admin",
      email: "other-sys@example.com",
      isActive: true,
      isDeleted: false,
    });

    const request = new NextRequest("http://localhost/api/v1/internal/users/sys-admin-2", {
      method: "PATCH",
      body: JSON.stringify({ role: UserRole.ADMIN }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request, { params: { id: "sys-admin-2" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });
});
