import { UserRole, SimulationStatus } from "@/domain/types";
import type { AuthContext } from "@/application/middleware/auth";
import { isElevatedRole } from "@/application/middleware/rbac";
import { SimulationService } from "@/application/services/simulationService";
import { prisma } from "@/infrastructure/database/prisma";
import { isSupabaseApiMode } from "@/infrastructure/database/databaseMode";

const pageValue = (value: string | null, fallback = 1) =>
  Math.max(1, parseInt(value || String(fallback), 10));

const pageSizeValue = (value: string | null, fallback = 25) =>
  Math.min(100, Math.max(1, parseInt(value || String(fallback), 10)));

const sortDirValue = (value: string | null): "asc" | "desc" =>
  value === "asc" ? "asc" : "desc";

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

export async function listSimulationsForModule(
  auth: AuthContext,
  sp: URLSearchParams,
) {
  const page = pageValue(sp.get("page"));
  const pageSize = pageSizeValue(sp.get("pageSize"), 25);
  const rawOrderBy = sp.get("orderBy") || "updatedAt";
  const sortDir = sortDirValue(sp.get("sortDir"));
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
          where: { name: { contains: search, mode: "insensitive" } },
          select: { id: true },
        }),
        prisma.user.findMany({
          where: { fullName: { contains: search, mode: "insensitive" } },
          select: { id: true },
        }),
      ])
    : [[], []];

  const searchFilters = search
    ? [
        { referenceNumber: { contains: search, mode: "insensitive" as const } },
        ...(!postFilterPayload ? [payloadCupsFilter(search)] : []),
        ...(matchingClients.length
          ? [{ clientId: { in: matchingClients.map((client) => client.id) } }]
          : []),
        ...(matchingOwners.length
          ? [{ ownerUserId: { in: matchingOwners.map((owner) => owner.id) } }]
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
    ...(search && !postFilterPayload ? { OR: searchFilters } : {}),
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

  return { items, total };
}

export async function listUsersForModule(
  auth: AuthContext,
  sp: URLSearchParams,
) {
  const contextual = sp.get("contextual") === "true";
  const page = pageValue(sp.get("page"));
  const pageSize = pageSizeValue(sp.get("pageSize"), 25);
  const search = sp.get("search") || undefined;
  const roleFilter = sp.get("role") || undefined;
  const agencyIdFilter = sp.get("agencyId") || undefined;
  const includeDeleted =
    sp.get("includeDeleted") === "true" && isElevatedRole(auth.role);
  const rawOrderBy = sp.get("orderBy") || "createdAt";
  const sortDir = sortDirValue(sp.get("sortDir"));
  const minimal =
    sp.get("minimal") === "true" ||
    (contextual && auth.role === UserRole.AGENT);
  const allowedOrderBy: Record<string, string> = {
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    fullName: "fullName",
    email: "email",
    role: "role",
  };
  const orderByField = allowedOrderBy[rawOrderBy] ?? "createdAt";

  const baseWhere = isElevatedRole(auth.role) ? {} : { agencyId: auth.agencyId };
  const where = {
    ...baseWhere,
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(roleFilter ? { role: roleFilter as UserRole } : {}),
    ...(agencyIdFilter && isElevatedRole(auth.role)
      ? { agencyId: agencyIdFilter }
      : {}),
    ...(includeDeleted
      ? { isDeleted: true, deletedAt: null }
      : { isDeleted: false }),
  };

  const select = minimal
    ? {
        id: true,
        agencyId: true,
        role: true,
        fullName: true,
        email: true,
        isActive: true,
        isDeleted: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      }
    : {
        id: true,
        agencyId: true,
        role: true,
        fullName: true,
        email: true,
        mobilePhone: true,
        commercialPhone: true,
        commercialEmail: true,
        otherDetails: true,
        maxActiveDevices: true,
        isActive: true,
        isDeleted: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        pinRotatedAt: true,
        createdByUser: { select: { id: true, fullName: true } },
        updatedByUser: { select: { id: true, fullName: true } },
      };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select,
      orderBy: { [orderByField]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: users, total, page, pageSize };
}

export async function listAgenciesForModule(
  auth: AuthContext,
  sp: URLSearchParams,
) {
  const page = pageValue(sp.get("page"));
  const pageSize = pageSizeValue(sp.get("pageSize"), 25);
  const search = sp.get("search") || undefined;
  const includeDeleted =
    sp.get("includeDeleted") === "true" && isElevatedRole(auth.role);
  const orderBy = sp.get("orderBy") ?? "createdAt";
  const sortDir = sortDirValue(sp.get("sortDir"));
  const isTlvParam = sp.get("isTlv");
  const statusParam = sp.get("status");
  const minimal = sp.get("minimal") === "true";
  const allowedOrderBy: Record<string, true> = {
    createdAt: true,
    name: true,
    updatedAt: true,
  };
  const safeOrderBy = allowedOrderBy[orderBy] ? orderBy : "createdAt";

  const baseWhere = isElevatedRole(auth.role)
    ? search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {}
    : { id: auth.agencyId };

  const where = {
    ...baseWhere,
    ...(includeDeleted
      ? { isDeleted: true, deletedAt: null }
      : { isDeleted: false }),
    ...(isTlvParam === "true"
      ? { isTlv: true }
      : isTlvParam === "false"
        ? { isTlv: false }
        : {}),
    ...(statusParam === "active"
      ? { isActive: true }
      : statusParam === "inactive"
        ? { isActive: false }
        : {}),
  };

  const agenciesPromise = minimal
    ? prisma.agency.findMany({
        where,
        orderBy: { [safeOrderBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          isTlv: true,
          isActive: true,
          isDeleted: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : prisma.agency.findMany({
        where,
        orderBy: { [safeOrderBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { users: true } },
          users: {
            where: { role: UserRole.COMMERCIAL },
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
          createdByUser: {
            select: { id: true, fullName: true, email: true },
          },
          updatedByUser: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

  const [agencies, total] = await Promise.all([
    agenciesPromise,
    prisma.agency.count({ where }),
  ]);

  return { items: agencies, total, page, pageSize };
}

export async function listClientsForModule(
  auth: AuthContext,
  sp: URLSearchParams,
) {
  const page = pageValue(sp.get("page"));
  const pageSize = pageSizeValue(sp.get("pageSize"), 25);
  const search = sp.get("search") || undefined;
  const includeDeleted =
    sp.get("includeDeleted") === "true" && isElevatedRole(auth.role);
  const agencyIdFilter = isElevatedRole(auth.role)
    ? (sp.get("agencyId") ?? undefined)
    : undefined;
  const orderBy = sp.get("orderBy") ?? "name";
  const sortDir = sortDirValue(sp.get("sortDir") ?? "asc");
  const minimal = sp.get("minimal") === "true";
  const allowedOrderBy: Record<string, true> = {
    name: true,
    createdAt: true,
    updatedAt: true,
  };
  const safeOrderBy = allowedOrderBy[orderBy] ? orderBy : "name";

  const baseWhere = isElevatedRole(auth.role)
    ? {
        ...(includeDeleted
          ? { isDeleted: true, deletedAt: null }
          : { isDeleted: false }),
        ...(agencyIdFilter ? { agencyId: agencyIdFilter } : {}),
      }
    : { agencyId: auth.agencyId, isDeleted: false };

  const where = search
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { cif: { contains: search, mode: "insensitive" as const } },
          { contactName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : { ...baseWhere };

  const clientsPromise = minimal
    ? prisma.client.findMany({
        where,
        orderBy: { [safeOrderBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          cif: true,
          contactName: true,
          contactEmail: true,
          agencyId: true,
          isActive: true,
          isDeleted: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : prisma.client.findMany({
        where,
        orderBy: { [safeOrderBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          agency: { select: { id: true, name: true } },
          createdByUser: {
            select: { id: true, fullName: true, email: true },
          },
          updatedByUser: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

  const [clients, total] = await Promise.all([
    clientsPromise,
    prisma.client.count({ where }),
  ]);

  return { items: clients, total, page, pageSize };
}
