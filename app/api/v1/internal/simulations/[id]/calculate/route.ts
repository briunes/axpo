import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";
import { CalculationService } from "@/application/services/calculationService";
import { AuditService } from "@/application/services/auditService";
import type { SimulationPayload } from "@/domain/types";

const calculateSchema = z.object({
  /** Override which BaseValueSet to use. Defaults to the version's baseValueSetId or the latest active global set. */
  baseValueSetId: z.string().min(1).optional(),
});

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/calculate:
 *   post:
 *     tags: [Simulations]
 *     summary: Run price calculation against the latest simulation version
 *     description: |
 *       Loads the latest SimulationVersion's payloadJson (typed as SimulationPayload),
 *       fetches BaseValueItems for the resolved price set, runs CalculationService,
 *       and persists the results into a new SimulationVersion.
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
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) throw new ValidationError("Simulation id parameter is required");

    // Verify access
    await SimulationService.assertSimulationAccess(auth, id);

    // Parse optional body
    let baseValueSetIdOverride: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = calculateSchema.safeParse(body);
      if (parsed.success) baseValueSetIdOverride = parsed.data.baseValueSetId;
    } catch {
      // body is optional — ignore parse errors
    }

    // Load the latest version
    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!latestVersion) {
      throw new ValidationError(
        "Simulation has no versions — save inputs first",
      );
    }

    // Resolve which BaseValueSet to use
    const baseValueSetId =
      baseValueSetIdOverride ??
      latestVersion.baseValueSetId ??
      (await resolveDefaultBaseValueSetId());

    if (!baseValueSetId) {
      throw new ValidationError(
        "No active price set found. Create and activate a BaseValueSet first.",
      );
    }

    // Load price items
    const priceItems = await prisma.baseValueItem.findMany({
      where: { baseValueSetId },
      select: { key: true, valueNumeric: true },
    });

    if (priceItems.length === 0) {
      throw new ValidationError(
        `BaseValueSet ${baseValueSetId} has no price items`,
      );
    }

    // Build price map
    const priceMap = CalculationService.buildPriceMap(
      priceItems.map((i) => ({
        key: i.key,
        valueNumeric:
          i.valueNumeric !== null ? i.valueNumeric.toNumber() : null,
      })),
    );

    // Deserialize payload
    const payload = (latestVersion.payloadJson ?? {}) as SimulationPayload;

    if (!payload.electricity && !payload.gas) {
      throw new ValidationError(
        "Simulation payload has no electricity or gas inputs to calculate",
      );
    }

    // Run calculation
    const results = CalculationService.calculate(
      payload,
      priceMap,
      baseValueSetId,
    );

    // Merge results back into payload and create a new version
    const updatedPayload: SimulationPayload = {
      ...payload,
      results,
    };

    const newVersion = await prisma.simulationVersion.create({
      data: {
        simulationId: id,
        payloadJson: updatedPayload as object,
        baseValueSetId,
        createdBy: auth.userId,
      },
    });

    await AuditService.logEvent({
      actorUserId: auth.userId,
      eventType: "SIMULATION_CALCULATED",
      targetType: "SIMULATION",
      targetId: id,
      metadataJson: {
        baseValueSetId,
        versionId: newVersion.id,
        electricityProducts: results.electricity?.length ?? 0,
        gasProducts: results.gas?.length ?? 0,
      },
    });

    return ResponseHandler.ok(
      {
        simulationId: id,
        versionId: newVersion.id,
        baseValueSetId,
        results,
      },
      200,
    );
  },
);

/** Find the latest active global BaseValueSet. */
async function resolveDefaultBaseValueSetId(): Promise<string | null> {
  const set = await prisma.baseValueSet.findFirst({
    where: { isActive: true, isDeleted: false, scopeType: "GLOBAL" },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  return set?.id ?? null;
}
