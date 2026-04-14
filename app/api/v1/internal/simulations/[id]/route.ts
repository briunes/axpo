import { NextRequest } from "next/server";
import { z } from "zod";
import { SimulationStatus, UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";

const updateSimulationSchema = z.object({
  status: z.nativeEnum(SimulationStatus).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  payloadJson: z.record(z.unknown()).optional(),
  baseValueSetId: z.string().nullable().optional(),
});

/**
 * @swagger
 * /api/v1/internal/simulations/{id}:
 *   get:
 *     tags: [Simulations]
 *     summary: Get simulation details
 *     security:
 *       - bearerAuth: []
 *   patch:
 *     tags: [Simulations]
 *     summary: Update simulation and create version when payload changes
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     tags: [Simulations]
 *     summary: Soft delete simulation
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const simulation = await SimulationService.assertSimulationAccess(auth, id);

    // Load the latest version to get payloadJson
    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: id },
      orderBy: { createdAt: "desc" },
    });

    const versions = await prisma.simulationVersion.findMany({
      where: { simulationId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Enrich with client and full ownerUser for PDF/email template variable replacement
    const [client, ownerUser] = await Promise.all([
      simulation.clientId
        ? prisma.client.findUnique({ where: { id: simulation.clientId } })
        : null,
      prisma.user.findUnique({
        where: { id: simulation.ownerUserId },
        select: {
          id: true,
          fullName: true,
          email: true,
          mobilePhone: true,
          commercialPhone: true,
          commercialEmail: true,
          agencyId: true,
          pinCurrent: true,
        },
      }),
    ]);

    // Build a merged payload so the form always loads with complete data.
    // A "select offer" save used to create a version with only the selectedOffer
    // field, stripping inputs and results.  To recover from those broken versions
    // (and guard against future regressions) we reconstruct the canonical payload
    // by taking the most recent version that contains calculated results as the
    // base (it always includes inputs too), then overlaying the most recent
    // selectedOffer on top.
    const versionsWithResults = versions.filter(
      (v) => (v.payloadJson as Record<string, unknown> | null)?.results,
    );
    const versionsWithOffer = versions.filter(
      (v) => (v.payloadJson as Record<string, unknown> | null)?.selectedOffer,
    );
    const baseVersionPayload = (versionsWithResults[0]?.payloadJson ??
      latestVersion?.payloadJson) as Record<string, unknown> | null;
    const latestSelectedOffer = (
      versionsWithOffer[0]?.payloadJson as Record<string, unknown> | null
    )?.selectedOffer;
    const mergedPayload: Record<string, unknown> | null = baseVersionPayload
      ? {
          ...baseVersionPayload,
          ...(latestSelectedOffer !== undefined
            ? { selectedOffer: latestSelectedOffer }
            : {}),
        }
      : null;

    // Attach payloadJson from latest version to simulation
    const simulationWithPayload = {
      ...simulation,
      pinSnapshot: simulation.pinSnapshot ?? ownerUser?.pinCurrent ?? null,
      payloadJson: mergedPayload,
      client: client ?? null,
      ownerUser: ownerUser ?? simulation.ownerUser,
    };

    return ResponseHandler.ok(
      { simulation: simulationWithPayload, versions },
      200,
    );
  },
);

export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const body = await request.json();
    const payload = updateSimulationSchema.parse(body);

    const updated = await SimulationService.updateSimulation(auth, id, payload);
    return ResponseHandler.ok(updated, 200);
  },
);

export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const auth = await requireAuth(request);
    assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    await SimulationService.softDeleteSimulation(auth, id);
    return ResponseHandler.ok({ simulationId: id, deleted: true }, 200);
  },
);
