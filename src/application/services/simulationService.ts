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

    const created = await prisma.simulation.create({
      data: {
        agencyId:
          actor.role === UserRole.ADMIN ? ownerUser.agencyId : actor.agencyId,
        ownerUserId,
        clientId: input.clientId ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        pinHashSnapshot: ownerUser.pinHash,
        pinSnapshot: ownerUser.pinCurrent ?? null,
      },
    });

    await prisma.simulationVersion.create({
      data: {
        simulationId: created.id,
        payloadJson: toInputJson(input.payloadJson),
        baseValueSetId: input.baseValueSetId ?? null,
        createdBy: actor.userId,
      },
    });

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

    const cloned = await prisma.simulation.create({
      data: {
        agencyId: simulation.agencyId,
        ownerUserId: simulation.ownerUserId,
        clientId: simulation.clientId, // Copy client reference
        status: SimulationStatus.DRAFT,
        expiresAt: simulation.expiresAt,
      },
    });

    await prisma.simulationVersion.create({
      data: {
        simulationId: cloned.id,
        payloadJson:
          latestVersion.payloadJson === null
            ? Prisma.JsonNull
            : (latestVersion.payloadJson as Prisma.InputJsonValue),
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

  static async shareSimulation(actor: ActorContext, simulationId: string) {
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
