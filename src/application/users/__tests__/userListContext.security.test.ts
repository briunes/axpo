import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/users/route";
import { ForbiddenError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertPermissionMock = jest.fn();
const findManyMock = jest.fn();
const countMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertPermission: (...args: unknown[]) => assertPermissionMock(...args),
  isElevatedRole: (role: UserRole) =>
    role === UserRole.ADMIN || role === UserRole.SYS_ADMIN,
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

jest.mock("@/application/services/errorLoggerService", () => ({
  ErrorLoggerService: { capture: jest.fn().mockResolvedValue(undefined) },
}));

describe("contextual user list security", () => {
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
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("allows an agent to list users from their own agency for context", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/internal/users?contextual=true&minimal=true&agencyId=agency-2",
      { headers: { authorization: "Bearer token" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(assertPermissionMock).not.toHaveBeenCalled();
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ agencyId: "agency-1" }),
      }),
    );
  });

  it("keeps the full user list protected by users.view", async () => {
    assertPermissionMock.mockRejectedValue(
      new ForbiddenError("Insufficient permissions for this operation"),
    );
    const request = new NextRequest(
      "http://localhost/api/v1/internal/users?minimal=true",
      { headers: { authorization: "Bearer token" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(assertPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.AGENT }),
      "users.view",
    );
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
