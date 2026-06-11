import { NextRequest } from "next/server";
import { POST } from "../../../../app/api/v1/internal/simulations/[id]/send-email/route";
import { ForbiddenError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertPermissionMock = jest.fn();
const assertSimulationAccessMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertPermission: (...args: unknown[]) => assertPermissionMock(...args),
}));

jest.mock("@/application/services/simulationService", () => ({
  SimulationService: {
    assertSimulationAccess: (...args: unknown[]) =>
      assertSimulationAccessMock(...args),
  },
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulation: { findFirst: jest.fn() },
  },
}));

jest.mock("@/infrastructure/pdf/browserLauncher", () => ({
  launchBrowser: jest.fn(),
}));

jest.mock("@/application/services/emailService", () => ({
  EmailService: { sendEmail: jest.fn() },
}));

jest.mock("@/application/services/errorLoggerService", () => ({
  ErrorLoggerService: { capture: jest.fn().mockResolvedValue(undefined) },
}));

describe("simulation send-email security", () => {
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
    assertPermissionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("rejects email sharing for a simulation outside the actor scope", async () => {
    assertSimulationAccessMock.mockRejectedValue(
      new ForbiddenError("You do not have access to this simulation"),
    );
    const request = new NextRequest(
      "http://localhost/api/v1/internal/simulations/sim-2/send-email",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          to: "client@example.com",
          subject: "Simulation",
          htmlContent: "<p>Simulation</p>",
        }),
      },
    );

    const response = await POST(request, { params: { id: "sim-2" } });

    expect(response.status).toBe(403);
    expect(assertPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.AGENT }),
      "simulations.share",
    );
    expect(assertSimulationAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: "agency-1" }),
      "sim-2",
    );
  });
});
