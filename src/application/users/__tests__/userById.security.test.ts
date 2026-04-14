import { NextRequest } from "next/server";
import { GET, PATCH } from "../../../../app/api/v1/internal/users/[id]/route";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const findUserMock = jest.fn();
const updateUserMock = jest.fn();
const logEventMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUserMock(...args),
      update: (...args: unknown[]) => updateUserMock(...args),
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
});