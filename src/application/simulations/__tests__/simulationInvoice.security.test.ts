import { NextRequest } from "next/server";
import { POST as uploadInvoice } from "../../../../app/api/v1/internal/simulations/upload-invoice/route";
import { GET as downloadInvoice } from "../../../../app/api/v1/internal/simulations/[id]/invoice/route";
import { UnauthorizedError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";

const requireAuthMock = jest.fn();
const assertPermissionMock = jest.fn();
const assertSimulationAccessMock = jest.fn();
const updateSimulationMock = jest.fn();
const findSimulationMock = jest.fn();
const findOcrLogMock = jest.fn();
const findOcrLogFileMock = jest.fn();

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
      update: (...args: unknown[]) => updateSimulationMock(...args),
      findUnique: (...args: unknown[]) => findSimulationMock(...args),
    },
    ocrLog: {
      findMany: (...args: unknown[]) => findOcrLogMock(...args),
    },
    ocrLogFile: {
      findMany: (...args: unknown[]) => findOcrLogFileMock(...args),
    },
  },
}));

describe("simulation invoice route security", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      userId: "commercial-1",
      sessionId: "session-1",
      role: UserRole.COMMERCIAL,
      agencyId: "agency-1",
      email: "commercial@example.com",
    });
    assertPermissionMock.mockResolvedValue(undefined);
    assertSimulationAccessMock.mockResolvedValue({ id: "sim-1" });
    findOcrLogMock.mockResolvedValue([]);
    findOcrLogFileMock.mockResolvedValue([]);
  });

  it("rejects unauthenticated invoice uploads", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError());

    const response = await uploadInvoice(
      new NextRequest(
        "http://localhost/api/v1/internal/simulations/upload-invoice",
        { method: "POST", body: new FormData() },
      ),
    );

    expect(response.status).toBe(401);
    expect(updateSimulationMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported invoice file types", async () => {
    const formData = new FormData();
    formData.set("simulationId", "sim-1");
    formData.set(
      "file",
      new File(["not an invoice"], "invoice.html", { type: "text/html" }),
    );

    const response = await uploadInvoice(
      new NextRequest(
        "http://localhost/api/v1/internal/simulations/upload-invoice",
        {
          method: "POST",
          headers: { authorization: "Bearer token" },
          body: formData,
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(updateSimulationMock).not.toHaveBeenCalled();
  });

  it("checks scoped access before downloading an invoice", async () => {
    assertSimulationAccessMock.mockRejectedValue(new UnauthorizedError());

    const response = await downloadInvoice(
      new NextRequest(
        "http://localhost/api/v1/internal/simulations/sim-2/invoice",
        { headers: { authorization: "Bearer token" } },
      ),
      { params: { id: "sim-2" } },
    );

    expect(response.status).toBe(401);
    expect(findSimulationMock).not.toHaveBeenCalled();
  });

  it("downloads invoice from the linked OCR log file when simulation file data is absent", async () => {
    findSimulationMock.mockResolvedValue({
      invoiceFileData: null,
      invoiceFileName: "invoice.pdf",
      invoiceFileMimeType: "application/pdf",
      invoiceFilePath: null,
    });
    findOcrLogMock.mockResolvedValueOnce([{ id: "ocr-log-1" }]);
    findOcrLogFileMock.mockResolvedValueOnce([
      {
        fileData: Buffer.from("page image bytes"),
        fileName: "invoice_page_1.png",
        fileType: "image/png",
      },
      {
        fileData: Buffer.from("pdf bytes"),
        fileName: "invoice.pdf",
        fileType: "application/pdf",
      },
    ]);

    const response = await downloadInvoice(
      new NextRequest(
        "http://localhost/api/v1/internal/simulations/sim-1/invoice",
        { headers: { authorization: "Bearer token" } },
      ),
      { params: { id: "sim-1" } },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(await response.text()).toBe("pdf bytes");
    expect(findOcrLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          simulationId: "sim-1",
          type: "INVOICE_EXTRACTION",
          status: "SUCCESS",
        },
      }),
    );
    expect(findOcrLogFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ocrLogId: { in: ["ocr-log-1"] } },
      }),
    );
  });
});
