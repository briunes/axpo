import { Prisma } from "@prisma/client";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";
import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";

/**
 * @swagger
 * /api/v1/internal/cups/lookup:
 *   get:
 *     tags: [Validation]
 *     summary: Look up previously used CUPS codes with associated client data
 *     description: Returns distinct CUPS codes used in past simulations, optionally filtered by client. Useful for auto-completing the CUPS field in the simulation form.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Filter by client ID
 *     responses:
 *       200:
 *         description: List of CUPS entries
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.simulations");

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || undefined;

  // Build RBAC filter (same as simulations list)
  const simFilter = SimulationService.buildSimulationFilter(auth);

  // Resolve the authorized simulations first. PostgREST relation filters use
  // left-join embeds by default, which can return versions with simulation=null
  // even when the nested filter does not match.
  const simulations = await prisma.simulation.findMany({
    where: {
      ...simFilter,
      isDeleted: false,
      ...(clientId ? { clientId } : {}),
    },
    select: {
      id: true,
      clientId: true,
      updatedAt: true,
      status: true,
    },
  });
  const simulationById = new Map(
    simulations.map((simulation) => [simulation.id, simulation]),
  );

  if (simulationById.size === 0) {
    return ResponseHandler.ok({ items: [] }, 200);
  }

  const simulationIds = Array.from(simulationById.keys());
  // Autocomplete only consumes clientData. Avoid transferring and parsing every
  // historical calculation result over the remote database connection. Keep all
  // versions and the existing ordering so older distinct CUPS remain available.
  const versions = isSupabaseApiMode()
    ? await prisma.simulationVersion.findMany({
        where: { simulationId: { in: simulationIds } },
        orderBy: { createdAt: "desc" },
        select: { payloadJson: true, simulationId: true },
      })
    : await prisma.$queryRaw<Array<{ simulationId: string; payloadJson: unknown }>>(
        Prisma.sql`
          SELECT "simulationId",
            jsonb_build_object('electricity', jsonb_build_object(
              'clientData', "payloadJson" #> '{electricity,clientData}'
            )) AS "payloadJson"
          FROM "simulation_versions"
          WHERE "simulationId" IN (${Prisma.join(simulationIds)})
          ORDER BY "createdAt" DESC
        `,
      );

  // Extract clientData from each version's payload, deduplicate by CUPS
  const seen = new Map<
    string,
    {
      cups: string;
      nombreTitular: string;
      personaContacto: string;
      comercial: string;
      direccion: string;
      comercializadorActual: string;
      clientId: string | null;
      lastUsed: string | null;
      lastStatus: string | null;
    }
  >();

  for (const v of versions) {
    const simulation = simulationById.get(v.simulationId);
    if (!simulation) continue;

    const payload = v.payloadJson as any;
    const clientData = payload?.electricity?.clientData;
    const cups: string | undefined = clientData?.cups;

    if (!cups || cups.trim() === "") continue;
    const normalized = cups.toUpperCase().trim();

    if (!seen.has(normalized)) {
      seen.set(normalized, {
        cups: normalized,
        nombreTitular: clientData?.nombreTitular ?? "",
        personaContacto: clientData?.personaContacto ?? "",
        comercial: clientData?.comercial ?? "",
        direccion: clientData?.direccion ?? "",
        comercializadorActual: clientData?.comercializadorActual ?? "",
        clientId: simulation.clientId ?? null,
        lastUsed: simulation.updatedAt
          ? simulation.updatedAt.toISOString()
          : null,
        lastStatus: simulation.status ?? null,
      });
    }
  }

  const items = Array.from(seen.values());

  return ResponseHandler.ok({ items }, 200);
});
