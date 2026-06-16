import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";
import { AuditService } from "@/application/services/auditService";

const ocrPrefillSchema = z.object({
  fields: z.record(z.unknown()),
  source: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/ocr-prefill:
 *   post:
 *     tags: [Simulations]
 *     summary: Store OCR prefill data as a new simulation version
 *     security:
 *       - bearerAuth: []
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "simulations.create");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const simulation = await SimulationService.assertSimulationAccess(auth, id);

    const body = await request.json();
    const payload = ocrPrefillSchema.parse(body);

    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: simulation.id },
      orderBy: { createdAt: "desc" },
    });

    const currentPayload = (latestVersion?.payloadJson ?? {}) as Record<
      string,
      unknown
    >;
    const mergedPayload: Prisma.InputJsonValue = {
      ...currentPayload,
      ...payload.fields,
      ocrMeta: {
        source: payload.source ?? "OCR",
        confidence: payload.confidence ?? null,
        updatedAt: new Date().toISOString(),
      },
    } as Prisma.InputJsonObject;

    const version = await prisma.simulationVersion.create({
      data: {
        simulationId: simulation.id,
        payloadJson: mergedPayload,
        baseValueSetId: latestVersion?.baseValueSetId ?? null,
        createdBy: auth.userId,
      },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "SIMULATION_OCR_PREFILL",
      targetType: "SIMULATION",
      targetId: simulation.id,
      metadataJson: {
        source: payload.source ?? "OCR",
      },
    });

    return ResponseHandler.ok(
      {
        simulationId: simulation.id,
        versionId: version.id,
        prefillApplied: true,
      },
      200,
    );
  },
);
