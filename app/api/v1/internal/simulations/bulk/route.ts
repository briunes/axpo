import { NextRequest } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";
import { AuditService } from "@/application/services/auditService";

const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one id is required"),
});

/**
 * @swagger
 * /api/v1/internal/simulations/bulk:
 *   delete:
 *     tags: [Simulations]
 *     summary: Bulk soft-delete simulations
 *     security:
 *       - bearerAuth: []
 *   patch:
 *     tags: [Simulations]
 *     summary: Bulk archive (soft-delete) simulations
 *     security:
 *       - bearerAuth: []
 */

/** Bulk soft-delete */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "simulations.archive");

  const body = await request.json();
  const { ids } = bulkIdsSchema.parse(body);

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      await SimulationService.softDeleteSimulation(auth, id);
      results.push({ id, success: true });
    } catch (err: unknown) {
      results.push({
        id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;

  await AuditService.logEvent({
    actorUserId: auth.userId,
    eventType: "SIMULATION_BULK_DELETED",
    targetType: "SIMULATION",
    targetId: ids.join(","),
  });

  return ResponseHandler.ok({ results, total: ids.length, succeeded }, 200);
});

/** Bulk archive — marks simulations as deleted (archived) */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "simulations.archive");

  const body = await request.json();
  const { ids } = bulkIdsSchema.parse(body);

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      // Verify access then archive
      const simulation = await SimulationService.assertSimulationAccess(
        auth,
        id,
      );

      await prisma.simulation.update({
        where: { id: simulation.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      results.push({ id, success: true });
    } catch (err: unknown) {
      results.push({
        id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;

  await AuditService.logEvent({
    actorUserId: auth.userId,
    eventType: "SIMULATION_BULK_ARCHIVED",
    targetType: "SIMULATION",
    targetId: ids.join(","),
  });

  return ResponseHandler.ok({ results, total: ids.length, succeeded }, 200);
});
