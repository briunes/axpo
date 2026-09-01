import { NextRequest } from "next/server";
import { z } from "zod";
import { SimulationStatus, UserRole } from "@/domain/types";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";
import { tryDecryptSensitiveValue } from "@/application/lib/sensitiveData";
import { resolveDefaultBaseValueSetId } from "@/application/services/simulationCalculationRunner";
import { getBaseValueBillingMonths } from "@/application/services/baseValueBillingMonths";

const updateSimulationSchema = z.object({
  status: z.nativeEnum(SimulationStatus).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  payloadJson: z.record(z.unknown()).optional(),
  baseValueSetId: z.string().nullable().optional(),
});

const hasPayloadBase = (payload: unknown): payload is Record<string, unknown> =>
  typeof payload === "object" &&
  payload !== null &&
  !Array.isArray(payload) &&
  ("type" in payload ||
    "electricity" in payload ||
    "gas" in payload ||
    "invoiceData" in payload ||
    "results" in payload ||
    "schemaVersion" in payload);

const latestSelectedOfferFromVersions = (
  versions: Array<{ payloadJson: unknown }>,
) => {
  for (const version of versions) {
    const payload = version.payloadJson;
    if (
      typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload) &&
      Object.prototype.hasOwnProperty.call(payload, "selectedOffer")
    ) {
      return (payload as Record<string, unknown>).selectedOffer;
    }
  }
  return undefined;
};

const mergeVersionPayloads = (
  versions: Array<{ payloadJson: unknown }>,
): Record<string, unknown> | null => {
  const basePayload = versions.find((version) =>
    hasPayloadBase(version.payloadJson),
  )?.payloadJson as Record<string, unknown> | undefined;
  const fallbackPayload = versions[0]?.payloadJson;
  const payload =
    basePayload ??
    (typeof fallbackPayload === "object" &&
    fallbackPayload !== null &&
    !Array.isArray(fallbackPayload)
      ? (fallbackPayload as Record<string, unknown>)
      : undefined);
  if (!payload) return null;

  const selectedOffer = latestSelectedOfferFromVersions(versions);
  return {
    ...payload,
    ...(selectedOffer !== undefined ? { selectedOffer } : {}),
  };
};

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
    await assertPermission(auth, "section.simulations");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    const simulation = await SimulationService.assertSimulationAccess(auth, id);

    // Each version is a complete payload snapshot (including all calculated
    // product results). The detail screen only needs current state, so loading
    // up to 200 snapshots made this endpoint grow dramatically over time.
    // Version/history views use their own endpoints.
    const versions = await prisma.simulationVersion.findMany({
      where: { simulationId: id },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        id: true,
        payloadJson: true,
        baseValueSetId: true,
        createdBy: true,
        createdAt: true,
      },
    });

    const resolvedBaseValueSetId =
      versions[0]?.baseValueSetId ??
      await resolveDefaultBaseValueSetId(simulation.agency.isTlv);

    // Enrich the response and load the compact month list concurrently.
    const [client, ownerUser, agency, billingMonths] = await Promise.all([
      simulation.clientId
        ? prisma.client.findUnique({
            where: { id: simulation.clientId },
            select: {
              id: true,
              name: true,
              contactName: true,
              contactEmail: true,
              street: true,
              city: true,
              postalCode: true,
              province: true,
              country: true,
              language: true,
            },
          })
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
      prisma.agency.findUnique({
        where: { id: simulation.agencyId },
        select: { id: true, name: true, isTlv: true },
      }),
      resolvedBaseValueSetId
        ? getBaseValueBillingMonths(resolvedBaseValueSetId)
        : Promise.resolve([]),
    ]);

    const mergedPayload = mergeVersionPayloads(versions);

    const displayPin =
      tryDecryptSensitiveValue(simulation.pinSnapshot) ??
      tryDecryptSensitiveValue(ownerUser?.pinCurrent);
    const { pinHashSnapshot: _pinHashSnapshot, ...simulationPublicFields } =
      simulation;

    // Attach payloadJson from latest version to simulation
    const simulationWithPayload = {
      ...simulationPublicFields,
      pinSnapshot: displayPin,
      payloadJson: mergedPayload,
      baseValueSetId: versions[0]?.baseValueSetId ?? null,
      billingMonths,
      client: client ?? null,
      ownerUser: ownerUser ?? simulation.ownerUser,
      agency: agency ?? null,
    };

    const versionSummaries = versions.map(
      ({ payloadJson: _payloadJson, ...version }) => version,
    );

    return ResponseHandler.ok(
      { simulation: simulationWithPayload, versions: versionSummaries },
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
    await assertPermission(auth, "simulations.edit_payload");

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
    await assertPermission(auth, "simulations.archive");

    const id = context?.params?.id;
    if (!id) {
      throw new ValidationError("Simulation id parameter is required");
    }

    await SimulationService.softDeleteSimulation(auth, id);
    return ResponseHandler.ok({ simulationId: id, deleted: true }, 200);
  },
);
