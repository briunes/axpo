import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { SimulationStatus, UserRole } from "@/domain/types";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/domain/errors/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "./auditService";

/** True for roles that have unrestricted access (ADMIN and SYS_ADMIN). */
const isElevatedRole = (role: UserRole) =>
  role === UserRole.ADMIN || role === UserRole.SYS_ADMIN;

interface ActorContext {
  userId: string;
  role: UserRole;
  agencyId: string;
}

interface CreateSimulationInput {
  ownerUserId?: string;
  clientId?: string;
  expiresAt?: string;
  payloadJson?: Record<string, unknown>;
  baseValueSetId?: string;
  ocrLogIds?: string[];
}

interface UpdateSimulationInput {
  status?: SimulationStatus;
  expiresAt?: string | null;
  payloadJson?: Record<string, unknown>;
  baseValueSetId?: string | null;
}

const tokenLength = Number(process.env.PUBLIC_TOKEN_LENGTH ?? 64);

const generatePublicToken = (): string => {
  const bytesNeeded = Math.ceil(tokenLength / 2);
  return randomBytes(bytesNeeded).toString("hex").slice(0, tokenLength);
};

const toInputJson = (value: unknown): Prisma.InputJsonValue => {
  return (value ?? {}) as Prisma.InputJsonValue;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const OCR_CORRECTION_COMMON_FIELDS = [
  "cups",
  "nombreTitular",
  "personaContacto",
  "direccion",
  "clienteAddress",
  "comercializadorActual",
  "cif",
  "tarifaAcceso",
  "zonaGeografica",
  "fechaInicio",
  "fechaFin",
  "facturaActual",
  "alquiler",
  "otrosCargos",
  "ivaTasa",
  "invoiceType",
] as const;

const OCR_CORRECTION_ELECTRICITY_FIELDS = [
  ...OCR_CORRECTION_COMMON_FIELDS,
  "perfilCarga",
  "consumoAnual",
  "consumoP1",
  "consumoP2",
  "consumoP3",
  "consumoP4",
  "consumoP5",
  "consumoP6",
  "potenciaP1",
  "potenciaP2",
  "potenciaP3",
  "potenciaP4",
  "potenciaP5",
  "potenciaP6",
  "precioPotenciaP1",
  "precioPotenciaP2",
  "precioPotenciaP3",
  "precioPotenciaP4",
  "precioPotenciaP5",
  "precioPotenciaP6",
  "precioEnergiaP1",
  "precioEnergiaP2",
  "precioEnergiaP3",
  "precioEnergiaP4",
  "precioEnergiaP5",
  "precioEnergiaP6",
  "excesoPotencia",
  "reactiva",
  "impuestoElectricoTasa",
] as const;

const OCR_CORRECTION_GAS_FIELDS = [
  ...OCR_CORRECTION_COMMON_FIELDS,
  "consumoTotal",
  "impuestoHidrocarburo",
  "telemedida",
] as const;

const parseJsonLikeString = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (
    !(trimmed.startsWith("{") && trimmed.endsWith("}")) &&
    !(trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return value;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
};

const normalizeForAudit = (value: unknown): unknown =>
  parseJsonLikeString(value === undefined ? null : value);

const shouldSkipAuditPath = (path: string): boolean => {
  return (
    path === "results" ||
    path.startsWith("results.") ||
    path === "selectedOffer" ||
    path.startsWith("selectedOffer.")
  );
};

const collectAuditDiff = (
  beforeValue: unknown,
  afterValue: unknown,
  path: string,
  beforeOut: Record<string, unknown>,
  afterOut: Record<string, unknown>,
): void => {
  if (shouldSkipAuditPath(path)) {
    return;
  }

  const normalizedBefore = normalizeForAudit(beforeValue);
  const normalizedAfter = normalizeForAudit(afterValue);

  const beforeIsObject = isPlainObject(normalizedBefore);
  const afterIsObject = isPlainObject(normalizedAfter);

  if (beforeIsObject || afterIsObject) {
    const beforeObj = beforeIsObject
      ? normalizedBefore
      : ({} as Record<string, unknown>);
    const afterObj = afterIsObject
      ? normalizedAfter
      : ({} as Record<string, unknown>);

    const keys = Array.from(
      new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]),
    );
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      collectAuditDiff(
        beforeObj[key],
        afterObj[key],
        nextPath,
        beforeOut,
        afterOut,
      );
    }
    return;
  }

  if (JSON.stringify(normalizedBefore) === JSON.stringify(normalizedAfter)) {
    return;
  }

  beforeOut[path] = normalizedBefore;
  afterOut[path] = normalizedAfter;
};

const mergePayloadPatch = (base: unknown, patch: unknown): unknown => {
  if (patch === undefined) return base;

  if (isPlainObject(base) && isPlainObject(patch)) {
    const merged: Record<string, unknown> = { ...base };
    for (const key of Object.keys(patch)) {
      merged[key] = mergePayloadPatch(base[key], patch[key]);
    }
    return merged;
  }

  return patch;
};

const applySalesAgentDefaults = (
  payload: Record<string, unknown>,
  ownerName: string,
): Record<string, unknown> => {
  if (!ownerName) return payload;

  const next: Record<string, unknown> = { ...payload };

  const electricityRaw = next.electricity;
  if (isPlainObject(electricityRaw)) {
    const electricity = { ...electricityRaw };
    const clientDataRaw = electricity.clientData;
    const clientData = isPlainObject(clientDataRaw)
      ? { ...clientDataRaw }
      : ({} as Record<string, unknown>);
    const comercial =
      typeof clientData.comercial === "string"
        ? clientData.comercial.trim()
        : "";
    if (!comercial) {
      clientData.comercial = ownerName;
    }
    electricity.clientData = clientData;
    next.electricity = electricity;
  }

  const gasRaw = next.gas;
  if (isPlainObject(gasRaw)) {
    const gas = { ...gasRaw };
    const comercial =
      typeof gas.comercial === "string" ? gas.comercial.trim() : "";
    if (!comercial) {
      gas.comercial = ownerName;
    }
    next.gas = gas;
  }

  return next;
};

export class SimulationService {
  static buildSimulationFilter(actor: ActorContext, includeDeleted = false) {
    if (isElevatedRole(actor.role)) {
      return includeDeleted ? {} : { isDeleted: false };
    }

    if (actor.role === UserRole.AGENT) {
      return {
        ...(includeDeleted ? {} : { isDeleted: false }),
        agencyId: actor.agencyId,
      };
    }

    return {
      ...(includeDeleted ? {} : { isDeleted: false }),
      ownerUserId: actor.userId,
    };
  }

  static async assertSimulationAccess(
    actor: ActorContext,
    simulationId: string,
  ) {
    const simulation = await prisma.simulation.findUnique({
      where: { id: simulationId },
      include: {
        ownerUser: {
          select: { id: true, agencyId: true, pinHash: true, fullName: true },
        },
      },
    });

    if (!simulation || simulation.isDeleted) {
      throw new NotFoundError("Simulation", simulationId);
    }

    if (isElevatedRole(actor.role)) {
      return simulation;
    }

    if (
      actor.role === UserRole.AGENT &&
      simulation.agencyId === actor.agencyId
    ) {
      return simulation;
    }

    if (
      actor.role === UserRole.COMMERCIAL &&
      simulation.ownerUserId === actor.userId
    ) {
      return simulation;
    }

    throw new ForbiddenError("You do not have access to this simulation");
  }

  static async createSimulation(
    actor: ActorContext,
    input: CreateSimulationInput,
  ) {
    const ownerUserId = input.ownerUserId ?? actor.userId;

    if (actor.role === UserRole.COMMERCIAL && ownerUserId !== actor.userId) {
      throw new ForbiddenError("Commercial can only create own simulations");
    }

    // Fetch owner once to validate access, resolve agencyId, and snapshot PIN
    const ownerUser = await prisma.user.findUnique({
      where: { id: ownerUserId },
    });

    if (!ownerUser) {
      throw new NotFoundError("User", ownerUserId);
    }

    if (
      actor.role === UserRole.AGENT &&
      ownerUser.agencyId !== actor.agencyId
    ) {
      throw new ForbiddenError(
        "Agent can only create simulations for own agency users",
      );
    }

    // Generate unique reference number: 00001/YYYY
    // Uses a retry loop to handle the unlikely race condition where two
    // simulations are created simultaneously and get the same count.
    let created: Awaited<ReturnType<typeof prisma.simulation.create>>;
    let attempts = 0;
    while (true) {
      attempts++;
      const year = new Date().getFullYear();
      const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
      const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);
      const countThisYear = await prisma.simulation.count({
        where: { createdAt: { gte: yearStart, lt: yearEnd } },
      });
      const referenceNumber = `${String(countThisYear + 1 + (attempts - 1)).padStart(5, "0")}/${year}`;

      try {
        created = await prisma.simulation.create({
          data: {
            agencyId: isElevatedRole(actor.role)
              ? ownerUser.agencyId
              : actor.agencyId,
            ownerUserId,
            clientId: input.clientId ?? null,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            pinHashSnapshot: ownerUser.pinHash,
            pinSnapshot: ownerUser.pinCurrent ?? null,
            referenceNumber,
          },
        });
        break;
      } catch (err: unknown) {
        const isUniqueViolation =
          err instanceof Error &&
          "code" in err &&
          (err as { code: string }).code === "P2002";
        if (isUniqueViolation && attempts < 5) continue;
        throw err;
      }
    }

    await prisma.simulationVersion.create({
      data: {
        simulationId: created.id,
        payloadJson: toInputJson(input.payloadJson),
        baseValueSetId: input.baseValueSetId ?? null,
        createdBy: actor.userId,
      },
    });

    const ocrLogIds = Array.from(
      new Set((input.ocrLogIds ?? []).filter(Boolean)),
    );

    if (ocrLogIds.length > 0) {
      // Fetch existing OCR logs so we can compute per-field user corrections
      const existingLogs = await prisma.ocrLog.findMany({
        where: { id: { in: ocrLogIds }, userId: actor.userId },
        select: { id: true, extractedFields: true },
      });

      // invoiceData in the payload holds exactly the flat OCR field names after
      // the user may have edited them in the extracted-data form
      const invoiceData = isPlainObject(input.payloadJson?.invoiceData)
        ? (input.payloadJson!.invoiceData as Record<string, unknown>)
        : null;
      const invoiceType =
        String(
          invoiceData?.invoiceType ?? input.payloadJson?.type ?? "",
        ).toUpperCase() === "GAS"
          ? "GAS"
          : "ELECTRICITY";
      const correctionFields = new Set<string>(
        invoiceType === "GAS"
          ? OCR_CORRECTION_GAS_FIELDS
          : OCR_CORRECTION_ELECTRICITY_FIELDS,
      );

      for (const log of existingLogs) {
        let userCorrections: Record<
          string,
          { ocr: unknown; corrected: unknown }
        > | null = null;

        if (invoiceData && isPlainObject(log.extractedFields)) {
          const ocrFields = log.extractedFields as Record<string, unknown>;
          const corrections: Record<
            string,
            { ocr: unknown; corrected: unknown }
          > = {};
          const normalise = (v: unknown) =>
            typeof v === "string" ? v.trim() : v;

          // Only compare fields that are explicitly present in invoiceData
          // (fields not mapped there were never shown to the user, so can't be corrections)
          for (const field of Object.keys(invoiceData)) {
            if (!correctionFields.has(field)) {
              continue;
            }

            const submittedValue = invoiceData[field];
            const ocrValue = ocrFields[field];

            // Field was not in OCR output at all — user filled it from scratch
            if (!(field in ocrFields)) {
              if (
                submittedValue !== null &&
                submittedValue !== undefined &&
                submittedValue !== ""
              ) {
                corrections[field] = { ocr: null, corrected: submittedValue };
              }
              continue;
            }

            // Both present — compare
            if (
              String(normalise(ocrValue)) !== String(normalise(submittedValue))
            ) {
              corrections[field] = {
                ocr: ocrValue,
                corrected: submittedValue,
              };
            }
          }

          if (Object.keys(corrections).length > 0) {
            userCorrections = corrections;
          }
        }

        await prisma.ocrLog.update({
          where: { id: log.id },
          data: {
            simulation: { connect: { id: created.id } },
            ...(userCorrections !== null
              ? { userCorrections: userCorrections as Prisma.InputJsonValue }
              : {}),
          },
        });
      }
    }

    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "SIMULATION_CREATED",
      targetType: "SIMULATION",
      targetId: created.id,
    });

    return created;
  }

  static async updateSimulation(
    actor: ActorContext,
    simulationId: string,
    input: UpdateSimulationInput,
  ) {
    const simulation = await this.assertSimulationAccess(actor, simulationId);

    const latestVersion =
      input.payloadJson !== undefined || input.baseValueSetId !== undefined
        ? await prisma.simulationVersion.findFirst({
            where: { simulationId: simulation.id },
            orderBy: { createdAt: "desc" },
            select: { payloadJson: true, baseValueSetId: true },
          })
        : null;

    const payloadBefore = isPlainObject(latestVersion?.payloadJson)
      ? (latestVersion.payloadJson as Record<string, unknown>)
      : {};
    const payloadPatch = isPlainObject(input.payloadJson)
      ? input.payloadJson
      : {};
    const mergedPayload = mergePayloadPatch(payloadBefore, payloadPatch);
    const payloadAfter = isPlainObject(mergedPayload)
      ? mergedPayload
      : payloadBefore;

    const ownerName = simulation.ownerUser?.fullName ?? "";
    const payloadBeforeNormalized = applySalesAgentDefaults(
      payloadBefore,
      ownerName,
    );
    const payloadAfterNormalized = applySalesAgentDefaults(
      payloadAfter,
      ownerName,
    );

    const updated = await prisma.simulation.update({
      where: { id: simulation.id },
      data: {
        status: input.status,
        expiresAt:
          input.expiresAt === undefined
            ? undefined
            : input.expiresAt === null
              ? null
              : new Date(input.expiresAt),
      },
    });

    if (input.payloadJson || input.baseValueSetId !== undefined) {
      await prisma.simulationVersion.create({
        data: {
          simulationId: simulation.id,
          payloadJson:
            input.payloadJson !== undefined
              ? toInputJson(payloadAfterNormalized)
              : toInputJson(latestVersion?.payloadJson ?? {}),
          baseValueSetId: input.baseValueSetId ?? null,
          createdBy: actor.userId,
        },
      });
    }

    const simBefore: Record<string, unknown> = {};
    const simAfter: Record<string, unknown> = {};
    if (input.status !== undefined) {
      simBefore.status = simulation.status;
      simAfter.status = input.status;
    }
    if (input.expiresAt !== undefined) {
      simBefore.expiresAt =
        simulation.expiresAt instanceof Date
          ? simulation.expiresAt.toISOString()
          : (simulation.expiresAt ?? null);
      simAfter.expiresAt = input.expiresAt;
    }
    if (input.baseValueSetId !== undefined) {
      simBefore.baseValueSetId = latestVersion?.baseValueSetId ?? null;
      simAfter.baseValueSetId = input.baseValueSetId ?? null;
    }
    if (input.payloadJson !== undefined) {
      const payloadBeforeDiff: Record<string, unknown> = {};
      const payloadAfterDiff: Record<string, unknown> = {};

      const rootKeys = Array.from(
        new Set([
          ...Object.keys(payloadBeforeNormalized),
          ...Object.keys(payloadAfterNormalized),
        ]),
      );
      for (const key of rootKeys) {
        collectAuditDiff(
          payloadBeforeNormalized[key],
          payloadAfterNormalized[key],
          key,
          payloadBeforeDiff,
          payloadAfterDiff,
        );
      }

      const MAX_FIELDS = 120;
      const changedPaths = Object.keys(payloadBeforeDiff);
      for (const path of changedPaths.slice(0, MAX_FIELDS)) {
        simBefore[path] = payloadBeforeDiff[path];
        simAfter[path] = payloadAfterDiff[path];
      }
      if (changedPaths.length > MAX_FIELDS) {
        simAfter._truncatedFields = changedPaths.length - MAX_FIELDS;
      }
    }
    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "SIMULATION_UPDATED",
      targetType: "SIMULATION",
      targetId: simulation.id,
      metadataJson:
        Object.keys(simBefore).length > 0
          ? { before: simBefore, after: simAfter }
          : undefined,
    });

    return updated;
  }

  static async softDeleteSimulation(actor: ActorContext, simulationId: string) {
    const simulation = await this.assertSimulationAccess(actor, simulationId);

    await prisma.simulation.update({
      where: { id: simulation.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "SIMULATION_SOFT_DELETED",
      targetType: "SIMULATION",
      targetId: simulation.id,
    });
  }

  static async cloneSimulation(actor: ActorContext, simulationId: string) {
    const simulation = await this.assertSimulationAccess(actor, simulationId);

    const latestVersion = await prisma.simulationVersion.findFirst({
      where: { simulationId: simulation.id },
      orderBy: { createdAt: "desc" },
    });

    if (!latestVersion) {
      throw new ValidationError("Simulation has no versions to clone");
    }

    // Resolve the actor's own agency: for ADMIN, fall back to the source
    // simulation's agency (admins operate globally); for everyone else use
    // their own agency so the clone belongs to them.
    const newAgencyId = isElevatedRole(actor.role)
      ? simulation.agencyId
      : actor.agencyId;

    // Fetch the new owner's PIN snapshot so the cloned simulation is
    // properly associated with the duplicating user's credentials.
    const [newOwner, systemConfig] = await Promise.all([
      prisma.user.findUnique({ where: { id: actor.userId } }),
      prisma.systemConfig.findFirst(),
    ]);

    // Compute expiresAt from system config (same logic as createSimulation)
    const expirationDays = systemConfig?.simulationExpirationDays ?? 30;
    const cloneExpiresAt = new Date();
    cloneExpiresAt.setDate(cloneExpiresAt.getDate() + expirationDays);

    // Generate a unique reference number (same retry loop as createSimulation)
    let cloned: Awaited<ReturnType<typeof prisma.simulation.create>>;
    let attempts = 0;
    while (true) {
      attempts++;
      const year = new Date().getFullYear();
      const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
      const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);
      const countThisYear = await prisma.simulation.count({
        where: { createdAt: { gte: yearStart, lt: yearEnd } },
      });
      const referenceNumber = `${String(countThisYear + 1 + (attempts - 1)).padStart(5, "0")}/${year}`;

      try {
        cloned = await prisma.simulation.create({
          data: {
            agencyId: newAgencyId,
            ownerUserId: actor.userId, // Actor becomes the new owner
            clientId: simulation.clientId,
            status: SimulationStatus.DRAFT,
            expiresAt: cloneExpiresAt,
            referenceNumber,
            pinHashSnapshot: newOwner?.pinHash ?? null,
            pinSnapshot: newOwner?.pinCurrent ?? null,
          },
        });
        break;
      } catch (err: unknown) {
        const isUniqueViolation =
          err instanceof Error &&
          "code" in err &&
          (err as { code: string }).code === "P2002";
        if (isUniqueViolation && attempts < 5) continue;
        throw err;
      }
    }

    // Strip selectedOffer from the payload so the cloned simulation starts
    // without a pre-selected offer (calculated results are kept).
    let clonedPayload: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    if (latestVersion.payloadJson === null) {
      clonedPayload = Prisma.JsonNull;
    } else {
      const raw = latestVersion.payloadJson as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { selectedOffer: _dropped, ...rest } = raw;
      clonedPayload = rest as Prisma.InputJsonValue;
    }

    await prisma.simulationVersion.create({
      data: {
        simulationId: cloned.id,
        payloadJson: clonedPayload,
        baseValueSetId: latestVersion.baseValueSetId,
        createdBy: actor.userId,
      },
    });

    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "SIMULATION_CLONED",
      targetType: "SIMULATION",
      targetId: cloned.id,
      metadataJson: { sourceSimulationId: simulation.id },
    });

    return cloned;
  }

  static async shareSimulation(
    actor: ActorContext,
    simulationId: string,
    sharedVia?: string,
  ) {
    const simulation = await this.assertSimulationAccess(actor, simulationId);
    const owner = await prisma.user.findUnique({
      where: { id: simulation.ownerUserId },
    });

    if (!owner) {
      throw new ValidationError("Simulation owner not found");
    }

    const publicToken = generatePublicToken();

    const shared = await prisma.simulation.update({
      where: { id: simulation.id },
      data: {
        publicToken,
        pinHashSnapshot: owner.pinHash,
        pinSnapshot: owner.pinCurrent ?? null,
        status: SimulationStatus.SHARED,
        sharedAt: new Date(),
        ...(sharedVia ? { sharedVia } : {}),
      },
    });

    await AuditService.logEvent({
      actorUserId: actor.userId,
      eventType: "SIMULATION_SHARED",
      targetType: "SIMULATION",
      targetId: simulation.id,
    });

    return {
      simulationId: shared.id,
      publicToken: shared.publicToken,
      sharedAt: shared.sharedAt,
      expiresAt: shared.expiresAt,
    };
  }

  static isExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) {
      return false;
    }
    return expiresAt.getTime() < Date.now();
  }
}
