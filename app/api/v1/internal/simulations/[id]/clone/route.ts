import { NextRequest } from "next/server";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { SimulationService } from "@/application/services/simulationService";
import { calculateAndPersistSimulation } from "@/application/services/simulationCalculationRunner";

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/clone:
 *   post:
 *     tags: [Simulations]
 *     summary: Clone simulation from latest version
 *     security:
 *       - bearerAuth: []
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "simulations.duplicate");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const cloned = await SimulationService.cloneSimulation(auth, id);
    try {
      await calculateAndPersistSimulation({
        actor: auth,
        simulationId: cloned.id,
      });
    } catch (error) {
      // Keep the new draft with copied inputs if calculation is temporarily
      // unavailable, but never retain the source simulation's stale results.
      console.error("Auto-calculate during simulation clone failed:", error);
    }
    return ResponseHandler.ok(cloned, 201);
  },
);
