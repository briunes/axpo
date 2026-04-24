import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole, SimulationStatus } from "@/domain/types";
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

  const sp = request.nextUrl.searchParams;
  const page = parseInt(sp.get("page") || "1", 10);
  const pageSize = parseInt(sp.get("pageSize") || "25", 10);
  const orderBy = sp.get("orderBy") || "updatedAt";
  const sortDir = (sp.get("sortDir") || "desc") as "asc" | "desc";
  const includeDeleted =
    sp.get("includeDeleted") === "true" && auth.role === UserRole.ADMIN;
  const search = sp.get("search") || undefined;
  const ownerUserId = sp.get("ownerUserId") || undefined;
  const clientId = sp.get("clientId") || undefined;
  const cups = sp.get("cups") || undefined;
  const status = sp.get("status") as SimulationStatus | undefined;

  const baseWhere = SimulationService.buildSimulationFilter(
    auth,
    includeDeleted,
  );

  const where = {
    ...baseWhere,
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            {
              client: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
            {
              ownerUser: {
                fullName: { contains: search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
    ...(cups
      ? {
          versions: {
            some: {
              OR: [
                {
                  payloadJson: {
                    path: ["electricity", "clientData", "cups"],
                    string_contains: cups,
                  },
                },
                {
                  payloadJson: {
                    path: ["gas", "clientData", "cups"],
                    string_contains: cups,
                  },
                },
              ],
            },
          },
        }
      : {}),
  };

  const [simulations, total] = await Promise.all([
    prisma.simulation.findMany({
      where,
      select: {
        id: true,
        agencyId: true,
        ownerUserId: true,
        clientId: true,
        status: true,
        isDeleted: true,
        deletedAt: true,
        sharedAt: true,
        publicToken: true,
        pinSnapshot: true,
        invoiceFilePath: true,
        invoiceFileName: true,
        invoiceFileSize: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        ownerUser: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { payloadJson: true },
        },
      },
      orderBy: { [orderBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.simulation.count({ where }),
  ]);

  // Attach payloadJson and extract CUPS from latest version
  const items = simulations.map((sim) => {
    const latestVersion = sim.versions[0];
    const payload = latestVersion?.payloadJson as any;
    const cupsNumber =
      payload?.electricity?.clientData?.cups ||
      payload?.gas?.clientData?.cups ||
      null;

    const { versions, ...simWithoutVersions } = sim;
    return {
      ...simWithoutVersions,
      payloadJson: payload ?? null,
      cupsNumber,
    };
  });

  return ResponseHandler.ok({ items, total }, 200);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL]);

  const body = await request.json();
  const payload = createSimulationSchema.parse(body);

  const created = await SimulationService.createSimulation(auth, payload);
  return ResponseHandler.ok(created, 201);
});
