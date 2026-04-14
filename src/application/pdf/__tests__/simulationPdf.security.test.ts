import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/simulations/[id]/pdf/route";
import { ForbiddenError, NotFoundError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertRoleMock = jest.fn();
const assertSimulationAccessMock = jest.fn();
const findVersionMock = jest.fn();

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
    simulationVersion: {
      findFirst: (...args: unknown[]) => findVersionMock(...args),
    },
  },
}));

describe("simulation PDF route security", () => {
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

  it("returns 403 when SimulationService.assertSimulationAccess throws ForbiddenError", async () => {
    assertSimulationAccessMock.mockRejectedValue(
      new ForbiddenError("You do not have access to this simulation")
    );

    const request = new NextRequest("http://localhost/api/v1/internal/simulations/sim-2/pdf", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "sim-2" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(findVersionMock).not.toHaveBeenCalled();
  });

  it("returns 404 when SimulationService.assertSimulationAccess throws NotFoundError", async () => {
    assertSimulationAccessMock.mockRejectedValue(new NotFoundError("Simulation", "sim-missing"));

    const request = new NextRequest("http://localhost/api/v1/internal/simulations/sim-missing/pdf", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "sim-missing" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(findVersionMock).not.toHaveBeenCalled();
  });

  it("returns PDF with secure headers when simulation is accessible", async () => {
    assertSimulationAccessMock.mockResolvedValue({
      id: "sim-1",
      status: "SHARED",
      sharedAt: new Date("2026-03-11T10:00:00.000Z"),
      expiresAt: new Date("2026-03-20T10:00:00.000Z"),
    });
    findVersionMock.mockResolvedValue({ id: "ver-1" });

    const request = new NextRequest("http://localhost/api/v1/internal/simulations/sim-1/pdf", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "sim-1" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("simulation-sim-1.pdf");
  });
});
