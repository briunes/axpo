import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { SimulationService } from "@/application/services/simulationService";

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
  async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const cloned = await SimulationService.cloneSimulation(auth, id);
    return ResponseHandler.ok(cloned, 201);
  }
);
