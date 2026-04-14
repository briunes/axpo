import { NextRequest } from "next/server";
import { POST } from "../../../../app/api/v1/internal/simulations/[id]/share/route";
import { ForbiddenError, NotFoundError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const shareSimulationMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertRole: (...args: unknown[]) => assertRoleMock(...args),
}));

jest.mock("@/application/services/simulationService", () => ({
  SimulationService: {
    shareSimulation: (...args: unknown[]) => shareSimulationMock(...args),
  },
}));

describe("simulation share route security", () => {
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

  it("returns 403 when simulation share is forbidden by RBAC scope", async () => {
    shareSimulationMock.mockRejectedValue(
      new ForbiddenError("You do not have access to this simulation")
    );

    const request = new NextRequest("http://localhost/api/v1/internal/simulations/sim-2/share", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });

    const response = await POST(request, { params: { id: "sim-2" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 when simulation does not exist or is inaccessible", async () => {
    shareSimulationMock.mockRejectedValue(new NotFoundError("Simulation", "sim-missing"));

    const request = new NextRequest("http://localhost/api/v1/internal/simulations/sim-missing/share", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });

    const response = await POST(request, { params: { id: "sim-missing" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 when simulation id path parameter is missing", async () => {
    const request = new NextRequest("http://localhost/api/v1/internal/simulations/share", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });

    const response = await POST(request, { params: {} });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(shareSimulationMock).not.toHaveBeenCalled();
  });
});