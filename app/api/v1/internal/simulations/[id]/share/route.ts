import { NextRequest } from "next/server";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { SimulationService } from "@/application/services/simulationService";

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/share:
 *   post:
 *     tags: [Simulations]
 *     summary: Share simulation (token + snapshot PIN)
 *     security:
 *       - bearerAuth: []
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "simulations.share");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const shared = await SimulationService.shareSimulation(auth, id);
    return ResponseHandler.ok(shared, 200);
  },
);
