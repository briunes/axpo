import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole, SimulationStatus } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import {
  assertPermission,
  isElevatedRole,
} from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";
import { SimulationService } from "@/application/services/simulationService";
import {
  calculateAndPersistSimulation,
} from "@/application/services/simulationCalculationRunner";
import type { SimulationPayload } from "@/domain/types";

const createSimulationSchema = z.object({
  ownerUserId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  payloadJson: z.record(z.unknown()).optional(),
  baseValueSetId: z.string().min(1).optional(),
  ocrLogIds: z.array(z.string().min(1)).max(10).optional(),
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

const getNestedString = (
  value: Record<string, unknown> | null,
  path: string[],
) => {
  let current: unknown = value;
  for (const key of path) {
    if (
      typeof current !== "object" ||
      current === null ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
};

const buildListPayloadSummary = (payload: Record<string, unknown> | null) => {
  if (!payload) return null;

  const electricityCups = getNestedString(payload, [
    "electricity",
    "clientData",
    "cups",
  ]);
  const gasCups = getNestedString(payload, ["gas", "clientData", "cups"]);

  return {
    ...(typeof payload.type === "string" ? { type: payload.type } : {}),
    ...(electricityCups
      ? { electricity: { clientData: { cups: electricityCups } } }
      : {}),
    ...(gasCups ? { gas: { clientData: { cups: gasCups } } } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, "selectedOffer")
      ? { selectedOffer: payload.selectedOffer }
      : {}),
  };
};

const parseDateBoundary = (value: string | null, boundary: "start" | "end") => {
  if (!value) return undefined;
  const date = new Date(
    value.length === 10
      ? `${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`
      : value,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const payloadCupsFilter = (value: string) => ({
  versions: {
    some: {
      OR: [
        {
          payloadJson: {
            path: ["electricity", "clientData", "cups"],
            string_contains: value,
          },
        },
        {
          payloadJson: {
            path: ["gas", "clientData", "cups"],
            string_contains: value,
          },
        },
      ],
    },
  },
});

const payloadTypeFilter = (value: string) => ({
  versions: {
    some: {
      payloadJson: {
        path: ["type"],
        equals: value,
      },
    },
  },
});

const payloadMatchesCups = (
  payload: Record<string, unknown> | null,
  value: string,
) => {
  const needle = value.toLowerCase();
  return [
    getNestedString(payload, ["electricity", "clientData", "cups"]),
    getNestedString(payload, ["gas", "clientData", "cups"]),
  ].some((candidate) => candidate?.toLowerCase().includes(needle));
};

const payloadMatchesType = (
  payload: Record<string, unknown> | null,
  value: string | undefined,
) => !value || getNestedString(payload, ["type"]) === value;

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
  await assertPermission(auth, "section.simulations");

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(sp.get("pageSize") || "25", 10)),
  );
  const rawOrderBy = sp.get("orderBy") || "updatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";
  const includeDeleted =
    sp.get("includeDeleted") === "true" && isElevatedRole(auth.role);
  const search = sp.get("search") || undefined;
  const ownerUserId = sp.get("ownerUserId") || undefined;
  const clientId = sp.get("clientId") || undefined;
  const cups = sp.get("cups") || undefined;
  const status = sp.get("status") as SimulationStatus | undefined;
  const type = sp.get("type") || undefined;
  const createdFrom = parseDateBoundary(sp.get("createdFrom"), "start");
  const createdTo = parseDateBoundary(sp.get("createdTo"), "end");
  const expiresFrom = parseDateBoundary(sp.get("expiresFrom"), "start");
  const expiresTo = parseDateBoundary(sp.get("expiresTo"), "end");
  const allowedOrderBy: Record<string, true> = {
    updatedAt: true,
    createdAt: true,
    expiresAt: true,
    status: true,
    pinSnapshot: true,
    referenceNumber: true,
  };
  const orderBy = allowedOrderBy[rawOrderBy] ? rawOrderBy : "updatedAt";
  const postFilterPayload = isSupabaseApiMode() && Boolean(search || cups || type);

  const baseWhere = SimulationService.buildSimulationFilter(
    auth,
    includeDeleted,
  );

  const [matchingClients, matchingOwners] = search
    ? await Promise.all([
        prisma.client.findMany({
          where: {
            name: { contains: search, mode: "insensitive" },
          },
          select: { id: true },
        }),
        prisma.user.findMany({
          where: {
            fullName: { contains: search, mode: "insensitive" },
          },
          select: { id: true },
        }),
      ])
    : [[], []];
  const searchFilters = search
    ? [
        {
          referenceNumber: {
            contains: search,
            mode: "insensitive" as const,
          },
        },
        ...(!postFilterPayload ? [payloadCupsFilter(search)] : []),
        ...(matchingClients.length
          ? [
              {
                clientId: {
                  in: matchingClients.map((client) => client.id),
                },
              },
            ]
          : []),
        ...(matchingOwners.length
          ? [
              {
                ownerUserId: {
                  in: matchingOwners.map((owner) => owner.id),
                },
              },
            ]
          : []),
      ]
    : [];
  const advancedPayloadFilters = [
    ...(!postFilterPayload && cups ? [payloadCupsFilter(cups)] : []),
    ...(!postFilterPayload && type ? [payloadTypeFilter(type)] : []),
  ];

  const where = {
    ...baseWhere,
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(status ? { status } : {}),
    ...(createdFrom || createdTo
      ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), ...(createdTo ? { lte: createdTo } : {}) } }
      : {}),
    ...(expiresFrom || expiresTo
      ? { expiresAt: { ...(expiresFrom ? { gte: expiresFrom } : {}), ...(expiresTo ? { lte: expiresTo } : {}) } }
      : {}),
    ...(search && !postFilterPayload
      ? {
          OR: searchFilters,
        }
      : {}),
    ...(advancedPayloadFilters.length ? { AND: advancedPayloadFilters } : {}),
  };

  const [simulations, dbTotal] = await Promise.all([
    prisma.simulation.findMany({
      where,
      select: {
        id: true,
        referenceNumber: true,
        agencyId: true,
        ownerUserId: true,
        clientId: true,
        status: true,
        isDeleted: true,
        deletedAt: true,
        sharedAt: true,
        clientOpenedAt: true,
        sharedVia: true,
        publicToken: true,
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
          // The list only needs a compact payload summary (type, CUPS, selectedOffer).
          // A small recent window preserves legacy selectedOffer patch versions while
          // avoiding deserializing large historical calculation payloads for every row.
          take: 5,
          select: { payloadJson: true },
        },
      },
      orderBy: { [orderBy]: sortDir },
      ...(postFilterPayload
        ? {}
        : { skip: (page - 1) * pageSize, take: pageSize }),
    }),
    postFilterPayload ? Promise.resolve(0) : prisma.simulation.count({ where }),
  ]);

  // Attach payloadJson and extract CUPS from latest version
  const allItems = simulations.map((sim) => {
    const payload = mergeVersionPayloads(sim.versions);
    const payloadSummary = buildListPayloadSummary(payload);
    const cupsNumber =
      getNestedString(payloadSummary, ["electricity", "clientData", "cups"]) ||
      getNestedString(payloadSummary, ["gas", "clientData", "cups"]) ||
      null;

    const { versions, ...simWithoutVersions } = sim;
    return {
      ...simWithoutVersions,
      hasPublicToken: Boolean(sim.publicToken),
      payloadJson: payloadSummary,
      cupsNumber,
    };
  });
  const filteredItems = postFilterPayload
    ? allItems.filter((sim) => {
        const payload = sim.payloadJson as Record<string, unknown> | null;
        const searchNeedle = search?.toLowerCase();
        const matchesSearch =
          !searchNeedle ||
          sim.referenceNumber?.toLowerCase().includes(searchNeedle) ||
          sim.client?.name?.toLowerCase().includes(searchNeedle) ||
          sim.ownerUser?.fullName?.toLowerCase().includes(searchNeedle) ||
          payloadMatchesCups(payload, search ?? "");
        return (
          matchesSearch &&
          (!cups || payloadMatchesCups(payload, cups)) &&
          payloadMatchesType(payload, type)
        );
      })
    : allItems;
  const total = postFilterPayload ? filteredItems.length : dbTotal;
  const items = postFilterPayload
    ? filteredItems.slice((page - 1) * pageSize, page * pageSize)
    : filteredItems;

  return ResponseHandler.ok({ items, total }, 200);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "simulations.create");

  const body = await request.json();
  const payload = createSimulationSchema.parse(body);

  const created = await SimulationService.createSimulation(auth, payload);
  const initialPayload = payload.payloadJson as SimulationPayload | undefined;
  if (initialPayload?.electricity || initialPayload?.gas) {
    try {
      await calculateAndPersistSimulation({
        actor: auth,
        simulationId: created.id,
        baseValueSetId: payload.baseValueSetId,
        payloadJson: initialPayload,
      });
    } catch (error) {
      console.error("Auto-calculate during simulation creation failed:", error);
    }
  }

  return ResponseHandler.ok(created, 201);
});
