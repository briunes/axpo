import { NextRequest } from "next/server";
import { POST } from "../../../../app/api/v1/internal/users/[id]/pin/rotate/route";
import { ForbiddenError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const rotateUserPinMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
}));

jest.mock("@/application/services/authService", () => ({
  AuthService: {
    rotateUserPin: (...args: unknown[]) => rotateUserPinMock(...args),
  },
}));

describe("user pin rotate route security", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    requireAuthMock.mockResolvedValue({
      userId: "commercial-1",
      role: UserRole.COMMERCIAL,
      agencyId: "agency-1",
      email: "commercial@example.com",
    });
    assertRoleMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 403 when AuthService.rotateUserPin throws ForbiddenError", async () => {
    rotateUserPinMock.mockRejectedValue(
      new ForbiddenError("Commercial can only rotate own PIN")
    );

    const request = new NextRequest("http://localhost/api/v1/internal/users/user-2/pin/rotate", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });

    const response = await POST(request, { params: { id: "user-2" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 when user id path parameter is missing", async () => {
    const request = new NextRequest("http://localhost/api/v1/internal/users/pin/rotate", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });

    const response = await POST(request, { params: {} });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(rotateUserPinMock).not.toHaveBeenCalled();
  });
});