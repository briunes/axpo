import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { SimulationService } from "@/application/services/simulationService";

const createSimulationSchema = z.object({
  ownerUserId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  payloadJson: z.record(z.unknown()).optional(),
  baseValueSetId: z.string().min(1).optional(),
});

/**
 * @swagger
 * /api/v1/internal/simulations:
 *   get:
 *     tags: [Simulations]
 *     summary: List simulations by RBAC scope
 *     description: List simulations based on user role (Admin sees all, Agent sees agency's, Commercial sees own)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Simulations listed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Simulation'
 *                           - type: object
 *                             properties:
 *                               ownerUser:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   fullName:
 *                                     type: string
 *                                   email:
 *                                     type: string
 *                               client:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   name:
 *                                     type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags: [Simulations]
 *     summary: Create simulation and initial version
 *     description: Create a new simulation with its first version
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSimulationRequest'
 *     responses:
 *       201:
 *         description: Simulation created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Simulation'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

  const simulations = await prisma.simulation.findMany({
    where: SimulationService.buildSimulationFilter(auth),
    include: {
      ownerUser: { select: { id: true, fullName: true, email: true } },
      client: { select: { id: true, name: true } },
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { payloadJson: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Attach payloadJson and extract CUPS from latest version
  const items = simulations.map((sim) => {
    const latestVersion = sim.versions[0];
    const payload = latestVersion?.payloadJson as any;
    const cupsNumber = payload?.electricity?.cups || null;

    const { versions, ...simWithoutVersions } = sim;
    return {
      ...simWithoutVersions,
      payloadJson: payload ?? null,
      cupsNumber,
    };
  });

  return ResponseHandler.ok({ items }, 200);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

  const body = await request.json();
  const payload = createSimulationSchema.parse(body);

  const created = await SimulationService.createSimulation(auth, payload);
  return ResponseHandler.ok(created, 201);
});
