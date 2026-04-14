import { NextRequest } from "next/server";
import { POST } from "../../../../app/api/v1/internal/simulations/[id]/pin/rotate/route";
import { ForbiddenError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const assertSimulationAccessMock = jest.fn();
const findOwnerMock = jest.fn();
const updateSimulationMock = jest.fn();
const logEventMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
}));

jest.mock("@/application/services/simulationService", () => ({
  SimulationService: {
    assertSimulationAccess: (...args: unknown[]) => assertSimulationAccessMock(...args),
  },
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findOwnerMock(...args),
    },
    simulation: {
      update: (...args: unknown[]) => updateSimulationMock(...args),
    },
  },
}));

jest.mock("@/application/services/auditService", () => ({
  AuditService: {
    logEvent: (...args: unknown[]) => logEventMock(...args),
  },
}));

describe("simulation pin rotate route security", () => {
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

  it("returns 403 when simulation access is forbidden", async () => {
    assertSimulationAccessMock.mockRejectedValue(
      new ForbiddenError("You do not have access to this simulation")
    );

    const request = new NextRequest("http://localhost/api/v1/internal/simulations/sim-2/pin/rotate", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });

    const response = await POST(request, { params: { id: "sim-2" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(findOwnerMock).not.toHaveBeenCalled();
    expect(updateSimulationMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 when simulation owner is missing", async () => {
    assertSimulationAccessMock.mockResolvedValue({ id: "sim-1", ownerUserId: "owner-1" });
    findOwnerMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/v1/internal/simulations/sim-1/pin/rotate", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });

    const response = await POST(request, { params: { id: "sim-1" } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(updateSimulationMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });
});