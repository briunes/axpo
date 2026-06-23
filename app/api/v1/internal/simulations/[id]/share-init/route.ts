import { NextRequest } from "next/server";
import { ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";

const SIMULATION_PDF_TYPES = ["simulation-output", "simulation-detailed"];
const TEMPLATE_VARIABLE_TYPES = [
  "simulation-output",
  "simulation-detailed",
  "simulation-share",
];

function getSimulationCommodity(payload: unknown): "ELECTRICITY" | "GAS" {
  const data = payload as { type?: "ELECTRICITY" | "GAS"; gas?: unknown } | null;
  return data?.type === "GAS" || data?.gas ? "GAS" : "ELECTRICITY";
}

/**
 * @swagger
 * /api/v1/internal/simulations/{id}/share-init:
 *   get:
 *     tags: [Simulations]
 *     summary: Get templates, variables, and client defaults required to share a simulation
 *     security:
 *       - bearerAuth: []
 */
export const GET = withErrorHandler(
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

    const simulation = await SimulationService.assertSimulationAccess(auth, id);
    const versions = await prisma.simulationVersion.findMany({
      where: { simulationId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { payloadJson: true },
    });
    const latestVersionWithResults = versions.find(
      (version) =>
        (version.payloadJson as Record<string, unknown> | null)?.results,
    );
    const latestPayload =
      latestVersionWithResults?.payloadJson ?? versions[0]?.payloadJson;
    const commodity = getSimulationCommodity(latestPayload);

    const [pdfTemplates, emailTemplates, templateVariables, client] =
      await Promise.all([
        prisma.pdfTemplate.findMany({
          where: {
            active: true,
            isDeleted: false,
            type: { in: SIMULATION_PDF_TYPES },
            ...(commodity === "ELECTRICITY"
              ? { OR: [{ commodity: null }, { commodity }] }
              : { commodity }),
          },
          include: { translations: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.emailTemplate.findMany({
          where: {
            active: true,
            isDeleted: false,
            type: "simulation-share",
          },
          include: { translations: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.templateVariable.findMany({
          where: {
            active: true,
            isDeleted: false,
            AND: [
              { OR: [{ commodity: null }, { commodity }] },
              {
                OR: [
                  { templateTypes: null },
                  ...TEMPLATE_VARIABLE_TYPES.map((type) => ({
                    templateTypes: { contains: type },
                  })),
                ],
              },
            ],
          },
          orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
        }),
        simulation.clientId
          ? prisma.client.findUnique({
              where: { id: simulation.clientId },
              select: {
                id: true,
                contactEmail: true,
                country: true,
                language: true,
              },
            })
          : null,
      ]);

    return ResponseHandler.ok(
      {
        commodity,
        pdfTemplates,
        emailTemplates,
        templateVariables,
        clientDefaults: client
          ? {
              contactEmail: client.contactEmail,
              country: client.country,
              language: client.language,
            }
          : null,
      },
      200,
    );
  },
);
