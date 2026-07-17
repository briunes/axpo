import { NextRequest } from "next/server";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import {
  calculateAndPersistSchema,
  calculateAndPersistSimulation,
} from "@/application/services/simulationCalculationRunner";
import type { SimulationPayload } from "@/domain/types";

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/calculate:
 *   post:
 *     tags: [Simulations]
 *     summary: Run price calculation against simulation inputs
 *     description: |
 *       Calculates from the latest SimulationVersion payload by default. When
 *       payloadJson is provided, calculates from that payload and persists it
 *       together with the generated results in a new SimulationVersion.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               baseValueSetId:
 *                 type: string
 *                 description: Optional override for the price set to use
 *               selectedMonth:
 *                 type: string
 *                 description: Optional YYYY-MM billing month override for indexed offers
 *               payloadJson:
 *                 type: object
 *                 description: Optional current form payload to save and calculate in one request
 *     responses:
 *       200:
 *         description: Calculation results
 */
export const POST = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "section.simulations");

    const id = context?.params?.id;
    if (!id) throw new ValidationError("Simulation id parameter is required");

    const body = await request.json().catch(() => ({}));
    const parsed = calculateAndPersistSchema.safeParse(body);
    const input = parsed.success ? parsed.data : {};

    const result = await calculateAndPersistSimulation({
      actor: auth,
      simulationId: id,
      baseValueSetId: input.baseValueSetId,
      selectedMonth: input.selectedMonth,
      payloadJson: input.payloadJson as SimulationPayload | undefined,
    });

    return ResponseHandler.ok(result, 200);
  },
);
