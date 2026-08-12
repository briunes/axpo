import type { SimulationPayload } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { fillSimulationWorkbook } from "@/infrastructure/excel/simulationWorkbookExport";

const safePart = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

export async function createSimulationExcelSnapshot(simulationId: string, reference?: string | null) {
  const versions = await prisma.simulationVersion.findMany({
    where: { simulationId }, orderBy: { createdAt: "desc" },
    select: { payloadJson: true, baseValueSetId: true },
  });
  const version = versions.find(({ payloadJson }) => {
    const payload = payloadJson as Record<string, unknown> | null;
    return payload && (payload.electricity || payload.gas);
  });
  const payload = version?.payloadJson as SimulationPayload | undefined;
  if (!payload?.electricity && !payload?.gas) throw new ValidationError("This simulation has no inputs to export");
  const baseValueSetId = payload.results?.baseValueSetId ?? version?.baseValueSetId;
  if (!baseValueSetId) throw new ValidationError("No base-value workbook is linked to this simulation");
  const set = await prisma.baseValueSet.findFirst({
    where: { id: baseValueSetId, isDeleted: false }, select: { sourceFileName: true, sourceFileData: true },
  });
  if (!set?.sourceFileData || !set.sourceFileName) throw new ValidationError("No source workbook is available");
  const data = await fillSimulationWorkbook(Buffer.from(set.sourceFileData), {
    electricity: payload.electricity,
    gas: payload.gas,
    clientName: payload.electricity
      ? ((payload as unknown as { invoiceData?: { nombreTitular?: string } }).invoiceData?.nombreTitular ??
        (payload.electricity as unknown as { clientData?: { nombreTitular?: string } }).clientData?.nombreTitular)
      : payload.gas?.nombreTitular,
  });
  const extension = set.sourceFileName.toLowerCase().endsWith(".xlsx") ? ".xlsx" : ".xlsm";
  return {
    data,
    fileName: `${safePart(reference ?? simulationId) || "simulation"}-issue-snapshot${extension}`,
    mimeType: extension === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.ms-excel.sheet.macroEnabled.12",
  };
}
