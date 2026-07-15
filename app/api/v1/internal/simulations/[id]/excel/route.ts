import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { ValidationError } from "@/domain/errors/errors";
import type { SimulationPayload } from "@/domain/types";
import { SimulationService } from "@/application/services/simulationService";
import { prisma } from "@/infrastructure/database/prisma";
import { fillSimulationWorkbook } from "@/infrastructure/excel/simulationWorkbookExport";

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.simulations");

    const simulationId = context?.params?.id;
    if (!simulationId) throw new ValidationError("Simulation id parameter is required");
    const simulation = await SimulationService.assertSimulationAccess(auth, simulationId);

    const requestedSetId = request.nextUrl.searchParams.get("baseValueSetId");
    const versions = await prisma.simulationVersion.findMany({
      where: { simulationId },
      orderBy: { createdAt: "desc" },
      select: { payloadJson: true, baseValueSetId: true },
    });
    const payloadVersion = versions.find((version) => {
      const payload = version.payloadJson as Record<string, unknown> | null;
      return payload && typeof payload === "object" && payload.electricity;
    });
    const payload = payloadVersion?.payloadJson as SimulationPayload | undefined;
    if (!payload?.electricity) {
      throw new ValidationError("This simulation has no electricity inputs to export");
    }

    const baseValueSetId =
      requestedSetId ??
      payload.results?.baseValueSetId ??
      payloadVersion?.baseValueSetId;
    if (!baseValueSetId) throw new ValidationError("No base-value workbook is linked to this simulation");

    const set = await prisma.baseValueSet.findFirst({
      where: { id: baseValueSetId, isDeleted: false },
      select: { sourceFileName: true, sourceFileData: true },
    });
    if (!set?.sourceFileData || !set.sourceFileName) {
      throw new ValidationError("No source workbook is available for this base-value set");
    }

    const filled = await fillSimulationWorkbook(Buffer.from(set.sourceFileData), {
      electricity: payload.electricity,
      clientName:
        ((payload as unknown as { invoiceData?: { nombreTitular?: string } }).invoiceData
          ?.nombreTitular) ?? undefined,
    });
    const originalExtension = set.sourceFileName.toLowerCase().endsWith(".xlsx") ? ".xlsx" : ".xlsm";
    const reference = safeFilenamePart(simulation.referenceNumber ?? simulation.id) || "simulation";
    const filename = `${reference}-filled${originalExtension}`;
    const contentType = originalExtension === ".xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/vnd.ms-excel.sheet.macroEnabled.12";

    return new NextResponse(filled as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": filled.length.toString(),
      },
    });
  },
);
