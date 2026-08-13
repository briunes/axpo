import { NextRequest } from "next/server";
import { requireAuth } from "@/application/middleware/auth";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { assertPermission } from "@/application/middleware/rbac";
import { getConfiguredMaxUploadFileSizeBytes, getConfiguredMaxUploadFileSizeMb } from "@/application/config/uploadLimits";
import { createSimulationExcelSnapshot } from "@/application/services/simulationIssueSnapshot";
import { SimulationService } from "@/application/services/simulationService";
import { ForbiddenError, ValidationError } from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";

const cleanName = (name: string) => name.replace(/[\r\n"]/g, "_").slice(0, 255) || "attachment";

export const POST = withErrorHandler(async (request: NextRequest, context?: { params?: Record<string, string> }) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.simulations");
  const featureConfig = await (prisma as any).systemConfig?.findFirst({ select: { simulationIssuesEnabled: true } });
  if (featureConfig?.simulationIssuesEnabled === false) {
    throw new ForbiddenError("Simulation incidents are currently disabled");
  }
  const simulationId = context?.params?.id;
  if (!simulationId) throw new ValidationError("Simulation id is required");
  const simulation = await SimulationService.assertSimulationAccess(auth, simulationId);
  const form = await request.formData();
  const description = form.get("description");
  if (typeof description !== "string" || !description.trim()) throw new ValidationError("Issue description is required");
  if (description.trim().length > 10000) throw new ValidationError("Issue description is too long");
  const attachments = form.getAll("attachments").filter((item): item is File => item instanceof File);
  const maxBytes = await getConfiguredMaxUploadFileSizeBytes();
  const maxMb = await getConfiguredMaxUploadFileSizeMb();
  for (const file of attachments) {
    if (file.size <= 0 || file.size > maxBytes) throw new ValidationError(`Each attachment must be between 1 byte and ${maxMb} MB`);
  }
  const snapshot = await createSimulationExcelSnapshot(simulationId, simulation.referenceNumber);
  const issue = await prisma.simulationIssue.create({
    data: {
      simulationId,
      simulationReference: simulation.referenceNumber,
      description: description.trim(),
      snapshotFileName: snapshot.fileName,
      snapshotMimeType: snapshot.mimeType,
      snapshotFileSize: snapshot.data.length,
      snapshotFileData: snapshot.data,
      reportedByUserId: auth.userId,
      attachments: {
        create: await Promise.all(attachments.map(async (file) => ({
          fileName: cleanName(file.name), mimeType: file.type || "application/octet-stream",
          fileSize: file.size, fileData: Buffer.from(await file.arrayBuffer()),
        }))),
      },
    },
    select: { id: true, createdAt: true },
  });
  const createdAt = issue.createdAt instanceof Date
    ? issue.createdAt.toISOString()
    : new Date(issue.createdAt as unknown as string).toISOString();
  return ResponseHandler.ok({ id: issue.id, createdAt }, 201);
});
