import { NextRequest } from "next/server";
import { GET } from "../../../../app/api/v1/internal/simulations/[id]/pdf/route";
import { ForbiddenError, NotFoundError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertPermissionMock = jest.fn();
const assertSimulationAccessMock = jest.fn();
const findSimulationMock = jest.fn();
const findVersionsMock = jest.fn();
const findSystemConfigMock = jest.fn();
const findPdfTemplateMock = jest.fn();
const findLegacyPdfTemplateMock = jest.fn();
const closeBrowserMock = jest.fn();
const pagePdfMock = jest.fn();
const extractVariableValuesMock = jest.fn();

jest.mock("@/application/middleware/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

jest.mock("@/application/middleware/rbac", () => ({
  assertPermission: (...args: unknown[]) => assertPermissionMock(...args),
}));

jest.mock("@/application/services/simulationService", () => ({
  SimulationService: {
    assertSimulationAccess: (...args: unknown[]) => assertSimulationAccessMock(...args),
  },
}));

jest.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    simulation: {
      findFirst: (...args: unknown[]) => findSimulationMock(...args),
    },
    simulationVersion: {
      findMany: (...args: unknown[]) => findVersionsMock(...args),
    },
    systemConfig: {
      findFirst: (...args: unknown[]) => findSystemConfigMock(...args),
    },
    pdfTemplate: {
      findFirst: (...args: unknown[]) => findPdfTemplateMock(...args),
      findUnique: (...args: unknown[]) => findLegacyPdfTemplateMock(...args),
    },
  },
}));

jest.mock("@/infrastructure/pdf/browserLauncher", () => ({
  launchBrowser: async () => ({
    newPage: async () => ({
      setDefaultTimeout: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
      setContent: jest.fn(),
      pdf: (...args: unknown[]) => pagePdfMock(...args),
    }),
    close: (...args: unknown[]) => closeBrowserMock(...args),
  }),
}));

jest.mock("@/infrastructure/pdf/pdfResourceGuard", () => ({
  installPdfResourceGuard: jest.fn(),
}));

jest.mock("@/infrastructure/pdf/variableReplacer", () => ({
  extractVariableValues: (...args: unknown[]) => extractVariableValuesMock(...args),
  replaceVariables: jest.fn((html: string) => html),
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
    assertPermissionMock.mockResolvedValue(undefined);
    findSimulationMock.mockResolvedValue({
      id: "sim-1",
      referenceNumber: null,
      ownerUser: { preferences: { language: "es" } },
      client: null,
    });
    findVersionsMock.mockResolvedValue([
      { id: "ver-1", payloadJson: { type: "GAS", results: {} } },
    ]);
    findSystemConfigMock.mockResolvedValue({
      defaultPdfTemplateGasId: "gas-default",
      defaultPdfTemplateElectricityId: "electricity-default",
    });
    findPdfTemplateMock.mockResolvedValue({
      id: "gas-default",
      active: true,
      htmlContent: "<html><head></head><body>Gas PDF</body></html>",
      editableSections: {
        COMMERCIALTEXT: { label: "Commercial text", default: "Default offer text" },
      },
      translations: [],
    });
    findLegacyPdfTemplateMock.mockResolvedValue(null);
    pagePdfMock.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    closeBrowserMock.mockResolvedValue(undefined);
    extractVariableValuesMock.mockReturnValue({ COMMERCIALTEXT: "Default offer text" });
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
    expect(findVersionsMock).not.toHaveBeenCalled();
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
    expect(findVersionsMock).not.toHaveBeenCalled();
  });

  it("returns PDF with secure headers when simulation is accessible", async () => {
    assertSimulationAccessMock.mockResolvedValue({
      id: "sim-1",
      status: "SHARED",
      sharedAt: new Date("2026-03-11T10:00:00.000Z"),
      expiresAt: new Date("2026-03-20T10:00:00.000Z"),
    });
    const request = new NextRequest("http://localhost/api/v1/internal/simulations/sim-1/pdf", {
      headers: { authorization: "Bearer token" },
    });

    const response = await GET(request, { params: { id: "sim-1" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("sim-1.pdf");
    expect(findPdfTemplateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "gas-default", commodity: "GAS" }),
      }),
    );
    expect(pagePdfMock).toHaveBeenCalled();
    expect(closeBrowserMock).toHaveBeenCalled();
    expect(extractVariableValuesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      undefined,
      expect.objectContaining({
        COMMERCIALTEXT: expect.objectContaining({ default: "Default offer text" }),
      }),
      undefined,
      "es",
    );
  });
});
