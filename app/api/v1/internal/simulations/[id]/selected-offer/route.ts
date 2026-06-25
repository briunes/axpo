import { NextRequest } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { SimulationService } from "@/application/services/simulationService";

const selectedOfferSchema = z.object({
  selectedOffer: z
    .object({
      productKey: z.string().min(1),
      commodity: z.enum(["ELECTRICITY", "GAS"]),
      pricingType: z.enum(["FIXED", "INDEXED"]),
      selectedAt: z.string().datetime(),
    })
    .nullable(),
});

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/selected-offer:
 *   patch:
 *     tags: [Simulations]
 *     summary: Select or clear the offer presented to the client
 *     security:
 *       - bearerAuth: []
 */
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    await assertPermission(auth, "simulations.edit_payload");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const body = await request.json();
    const payload = selectedOfferSchema.parse(body);

    const updated = await SimulationService.updateSelectedOffer(
      auth,
      id,
      payload,
    );

    return ResponseHandler.ok(updated, 200);
  },
);
