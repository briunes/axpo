import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../src/infrastructure/database/prisma";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { SimulationService } from "@/application/services/simulationService";
import { ValidationError } from "@/domain/errors/errors";

export const dynamic = "force-dynamic";

const pickOriginalInvoiceFile = <
  T extends { fileName: string; fileType: string | null },
>(
  files: T[],
): T | null => {
  return (
    files.find((file) => file.fileType === "application/pdf") ??
    files.find((file) => !/_page_\d+\.[^.]+$/i.test(file.fileName)) ??
    files[0] ??
    null
  );
};

/**
 * GET /api/v1/internal/simulations/[id]/invoice
 * Downloads the invoice file associated with a simulation
 */
export const GET = withErrorHandler(
  async (
    req: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(req);
    await assertPermission(auth, "section.simulations");

    const simulationId = context?.params?.id;
    if (!simulationId) {
      throw new ValidationError("Simulation id parameter is required");
    }

    await SimulationService.assertSimulationAccess(auth, simulationId);

    const simulation = await prisma.simulation.findUnique({
      where: { id: simulationId },
      select: {
        invoiceFileData: true,
        invoiceFileName: true,
        invoiceFileMimeType: true,
        // Fallback to old file path system for backwards compatibility
        invoiceFilePath: true,
      },
    });

    if (!simulation) {
      return NextResponse.json(
        { success: false, message: "Simulation not found" },
        { status: 404 },
      );
    }

    // Check if file data exists in database
    if (simulation.invoiceFileData && simulation.invoiceFileName) {
      const fileBuffer = Buffer.from(simulation.invoiceFileData);
      const contentType =
        simulation.invoiceFileMimeType || "application/octet-stream";
      const fileName = simulation.invoiceFileName.replace(/[\r\n"]/g, "_");

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const successfulExtractionLogs = await prisma.ocrLog.findMany({
      where: {
        simulationId,
        type: "INVOICE_EXTRACTION",
        status: "SUCCESS",
      },
      orderBy: { requestedAt: "asc" },
      select: { id: true },
    });
    const successfulExtractionLogIds = successfulExtractionLogs.map(
      (log) => log.id,
    );
    const successfulExtractionFiles =
      successfulExtractionLogIds.length > 0
        ? await prisma.ocrLogFile.findMany({
            where: { ocrLogId: { in: successfulExtractionLogIds } },
            orderBy: { createdAt: "asc" },
            select: {
              fileData: true,
              fileName: true,
              fileType: true,
            },
          })
        : [];
    const ocrInvoiceFiles =
      successfulExtractionFiles.length > 0
        ? successfulExtractionFiles
        : await (async () => {
            const fallbackLogs = await prisma.ocrLog.findMany({
              where: { simulationId },
              orderBy: { requestedAt: "asc" },
              select: { id: true },
            });
            const fallbackLogIds = fallbackLogs.map((log) => log.id);
            if (fallbackLogIds.length === 0) return [];
            return prisma.ocrLogFile.findMany({
              where: { ocrLogId: { in: fallbackLogIds } },
              orderBy: { createdAt: "asc" },
              select: {
                fileData: true,
                fileName: true,
                fileType: true,
              },
            });
          })();
    const ocrInvoiceFile = pickOriginalInvoiceFile(ocrInvoiceFiles);

    if (ocrInvoiceFile) {
      const fileBuffer = Buffer.from(ocrInvoiceFile.fileData);
      const contentType = ocrInvoiceFile.fileType || "application/octet-stream";
      const fileName = ocrInvoiceFile.fileName.replace(/[\r\n"]/g, "_");

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // Fallback: check old file path system (for backwards compatibility)
    if (simulation.invoiceFilePath) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invoice file stored in old format. Please re-upload the invoice.",
        },
        { status: 410 }, // 410 Gone - indicates the resource is no longer available
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "No invoice file found for this simulation",
      },
      { status: 404 },
    );
  },
);
