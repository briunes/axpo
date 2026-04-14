import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/users/[id]/pin/route";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const findUserMock = jest.fn();

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
    },
  },
}));

describe("user PIN route security", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    assertRoleMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 404 when COMMERCIAL tries to read another user PIN info", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "commercial-1",
      role: UserRole.COMMERCIAL,
      agencyId: "agency-1",
      email: "commercial@example.com",
    });
    findUserMock.mockResolvedValue({
      id: "commercial-2",
      agencyId: "agency-1",
      pinRotatedAt: new Date("2026-03-11T10:00:00.000Z"),
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/v1/internal/users/commercial-2/pin", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "commercial-2" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when AGENT tries to read PIN info from another agency", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "agent-1",
      role: UserRole.AGENT,
      agencyId: "agency-1",
      email: "agent@example.com",
    });
    findUserMock.mockResolvedValue({
      id: "user-2",
      agencyId: "agency-2",
      pinRotatedAt: new Date("2026-03-11T10:00:00.000Z"),
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/v1/internal/users/user-2/pin", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "user-2" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns masked PIN metadata only and never clear PIN", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "commercial-1",
      role: UserRole.COMMERCIAL,
      agencyId: "agency-1",
      email: "commercial@example.com",
    });
    findUserMock.mockResolvedValue({
      id: "commercial-1",
      agencyId: "agency-1",
      pinRotatedAt: new Date("2026-03-11T10:00:00.000Z"),
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/v1/internal/users/commercial-1/pin", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "commercial-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.maskedPin).toBe("******");
    expect(body.data.pin).toBeUndefined();
    expect(body.data.pinHash).toBeUndefined();
  });
});