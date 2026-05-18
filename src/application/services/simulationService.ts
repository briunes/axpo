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

export class SimulationService {
  static buildSimulationFilter(actor: ActorContext, includeDeleted = false) {
    if (actor.role === UserRole.ADMIN) {
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
          select: { id: true, agencyId: true, pinHash: true },
        },
      },
    });

    if (!simulation || simulation.isDeleted) {
      throw new NotFoundError("Simulation", simulationId);
    }

    if (actor.role === UserRole.ADMIN) {
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
            agencyId:
              actor.role === UserRole.ADMIN
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
      await prisma.ocrLog.updateMany({
        where: {
          id: { in: ocrLogIds },
          userId: actor.userId,
        },
        data: {
          simulationId: created.id,
        },
      });
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
          payloadJson: toInputJson(input.payloadJson),
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
    const newAgencyId =
      actor.role === UserRole.ADMIN ? simulation.agencyId : actor.agencyId;

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
