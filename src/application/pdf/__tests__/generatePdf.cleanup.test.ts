import { NextRequest } from "next/server";
import { POST } from "../../../../app/api/v1/internal/simulations/[id]/generate-pdf/route";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertPermissionMock = jest.fn();
const findSimulationMock = jest.fn();
const launchBrowserMock = jest.fn();
const newPageMock = jest.fn();
const setContentMock = jest.fn();
const setRequestInterceptionMock = jest.fn();
const pageOnMock = jest.fn();
const pdfMock = jest.fn();
const closeMock = jest.fn();
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
    simulation: {
      findFirst: (...args: unknown[]) => findSimulationMock(...args),
    },
  },
}));

jest.mock("@/infrastructure/pdf/browserLauncher", () => ({
  launchBrowser: (...args: unknown[]) => launchBrowserMock(...args),
}));

describe("generate simulation PDF cleanup", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    requireAuthMock.mockResolvedValue({
      userId: "commercial-1",
      sessionId: "session-1",
      role: UserRole.COMMERCIAL,
      agencyId: "agency-1",
      email: "commercial@example.com",
    });
    assertPermissionMock.mockResolvedValue(undefined);
    assertSimulationAccessMock.mockResolvedValue({ id: "sim-1" });
    findSimulationMock.mockResolvedValue(null);
    newPageMock.mockResolvedValue({
      setContent: setContentMock,
      setRequestInterception: setRequestInterceptionMock,
      on: pageOnMock,
      pdf: pdfMock,
    });
    launchBrowserMock.mockResolvedValue({
      newPage: newPageMock,
      close: closeMock,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("closes Chromium when PDF rendering fails", async () => {
    setContentMock.mockResolvedValue(undefined);
    pdfMock.mockRejectedValue(new Error("render failed"));
    closeMock.mockResolvedValue(undefined);

    const request = new NextRequest(
      "http://localhost/api/v1/internal/simulations/sim-1/generate-pdf",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ htmlContent: "<html><body>PDF</body></html>" }),
      },
    );

    const response = await POST(request, { params: { id: "sim-1" } });

    expect(response.status).toBe(500);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("closes Chromium after a successful PDF render", async () => {
    setContentMock.mockResolvedValue(undefined);
    pdfMock.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    closeMock.mockResolvedValue(undefined);

    const request = new NextRequest(
      "http://localhost/api/v1/internal/simulations/sim-1/generate-pdf",
      {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ htmlContent: "<html><body>PDF</body></html>" }),
      },
    );

    const response = await POST(request, { params: { id: "sim-1" } });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
