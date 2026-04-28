import { NextRequest } from "next/server";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";
import { AuditService } from "@/application/services/auditService";

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/pin/rotate:
 *   post:
 *     tags: [Simulations]
 *     summary: Refresh shared simulation PIN snapshot from owner current PIN
 *     security:
 *       - bearerAuth: []
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.simulations");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const simulation = await SimulationService.assertSimulationAccess(auth, id);
    const owner = await prisma.user.findUnique({
      where: { id: simulation.ownerUserId },
    });
    if (!owner) {
      throw new ValidationError("Simulation owner not found");
    }

    await prisma.simulation.update({
      where: { id },
      data: {
        pinHashSnapshot: owner.pinHash,
        pinSnapshot: owner.pinCurrent ?? null,
      },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "SIMULATION_PIN_SNAPSHOT_ROTATED",
      targetType: "SIMULATION",
      targetId: id,
    });

    return ResponseHandler.ok(
      { simulationId: id, pinSnapshotRefreshed: true },
      200,
    );
  },
);
