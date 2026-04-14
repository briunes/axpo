import { NextRequest } from "next/server";
import { GET, PATCH } from "../../../../app/api/v1/internal/agencies/[id]/route";
import { ForbiddenError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const findAgencyMock = jest.fn();
const updateAgencyMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    agency: {
      findUnique: (...args: unknown[]) => findAgencyMock(...args),
      update: (...args: unknown[]) => updateAgencyMock(...args),
    },
  },
}));

describe("agency by id security", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
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
    expect(findAgencyMock).toHaveBeenCalledWith({ where: { id: "agency-2" } });
  });

  it("returns 403 when non-admin tries to patch an agency", async () => {
    requireAuthMock.mockResolvedValue({
      userId: "agent-1",
      role: UserRole.AGENT,
      agencyId: "agency-1",
      email: "agent@example.com",
    });
    assertRoleMock.mockImplementation(() => {
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
});