import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
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
  assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || undefined;

  // Build RBAC filter (same as simulations list)
  const simFilter = SimulationService.buildSimulationFilter(auth);

  // Query simulation versions joined through simulations
  const versions = await prisma.simulationVersion.findMany({
    where: {
      simulation: {
        ...simFilter,
        isDeleted: false,
        ...(clientId ? { clientId } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      payloadJson: true,
      simulation: {
        select: {
          clientId: true,
          updatedAt: true,
        },
      },
    },
  });

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
    }
  >();

  for (const v of versions) {
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
        clientId: v.simulation.clientId ?? null,
      });
    }
  }

  const items = Array.from(seen.values());

  return ResponseHandler.ok({ items }, 200);
});
