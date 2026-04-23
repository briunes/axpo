import { NextRequest } from "next/server";
import { z } from "zod";
import jwt, { type SignOptions } from "jsonwebtoken";
import { InvalidPINError, InvalidTokenError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import {
  applyRateLimit,
  getClientRateLimitKey,
} from "@/application/middleware/rateLimit";
import { PinService } from "@/application/services/pinService";
import { SimulationService } from "@/application/services/simulationService";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";
import {
  extractVariableValues,
  replaceVariables,
} from "@/infrastructure/pdf/variableReplacer";
import type { SimulationPayload } from "@/domain/types/simulation";

const accessSchema = z.object({
  token: z.string().min(16),
  pin: z.string().regex(/^\d+$/),
});

const PUBLIC_ACCESS_EXPIRES_IN = (process.env
  .PUBLIC_ACCESS_SESSION_EXPIRES_IN ?? "15m") as SignOptions["expiresIn"];

const issuePublicSessionToken = (
  simulationId: string,
  token: string,
): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new InvalidTokenError("JWT secret not configured");
  }

  return jwt.sign(
    {
      typ: "PUBLIC_SIM_ACCESS",
      sid: simulationId,
      tok: token,
    },
    secret,
    { expiresIn: PUBLIC_ACCESS_EXPIRES_IN },
  );
};

/**
 * @swagger
 * /api/v1/public/simulations/access:
 *   post:
 *     tags: [Public]
 *     summary: Access shared simulation with token and PIN
 *     security: []
 *     responses:
 *       200:
 *         description: Access granted
 *       401:
 *         description: Invalid token or PIN
 *       429:
 *         description: Rate limit exceeded
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  const body = await request.json();
  const payload = accessSchema.parse(body);

  applyRateLimit(
    getClientRateLimitKey(ip, `public:${payload.token.slice(0, 8)}`),
  );

  const simulation = await prisma.simulation.findFirst({
    where: {
      publicToken: payload.token,
      isDeleted: false,
    },
    include: {
      ownerUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  if (!simulation || !simulation.pinHashSnapshot) {
    await AuditService.logEvent({
      eventType: "PUBLIC_ACCESS_DENIED",
      targetType: "SIMULATION",
      targetId: "unknown",
      metadataJson: {
        tokenFragment: payload.token.slice(0, 8),
        ip: ip ?? "unknown",
        reason: "INVALID_TOKEN",
      },
    });

    throw new InvalidTokenError("Invalid or inactive share token");
  }

  if (SimulationService.isExpired(simulation.expiresAt)) {
    await prisma.accessAttempt.create({
      data: {
        simulationId: simulation.id,
        tokenFragment: payload.token.slice(0, 8),
        ipHashOrMask: ip ?? "unknown",
        success: false,
        reason: "EXPIRED",
      },
    });

    throw new InvalidTokenError("Simulation link has expired");
  }

  const pinValid = await PinService.verify(
    payload.pin,
    simulation.pinHashSnapshot,
  );
  if (!pinValid) {
    await prisma.accessAttempt.create({
      data: {
        simulationId: simulation.id,
        tokenFragment: payload.token.slice(0, 8),
        ipHashOrMask: ip ?? "unknown",
        success: false,
        reason: "INVALID_PIN",
      },
    });

    throw new InvalidPINError("Invalid PIN");
  }

  await prisma.accessAttempt.create({
    data: {
      simulationId: simulation.id,
      tokenFragment: payload.token.slice(0, 8),
      ipHashOrMask: ip ?? "unknown",
      success: true,
      reason: "SUCCESS",
    },
  });

  await AuditService.logEvent({
    eventType: "PUBLIC_ACCESS_GRANTED",
    targetType: "SIMULATION",
    targetId: simulation.id,
    metadataJson: {
      tokenFragment: payload.token.slice(0, 8),
      ip: ip ?? "unknown",
    },
  });

  const recentVersions = await prisma.simulationVersion.findMany({
    where: { simulationId: simulation.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Build a merged payload: use the most recent version that has calculation
  // results (which always includes inputs) as the base, then overlay the most
  // recent selectedOffer.  This prevents a bare "selectedOffer-only" version
  // from masking the inputs and results saved by an earlier calculation.
  const baseVersion =
    recentVersions.find(
      (v) => (v.payloadJson as Record<string, unknown> | null)?.results,
    ) ?? recentVersions[0];
  const latestOfferPayload = recentVersions.find(
    (v) => (v.payloadJson as Record<string, unknown> | null)?.selectedOffer,
  )?.payloadJson as Record<string, unknown> | null;
  const mergedPayload: Record<string, unknown> | null = baseVersion?.payloadJson
    ? {
        ...(baseVersion.payloadJson as Record<string, unknown>),
        ...(latestOfferPayload?.selectedOffer !== undefined
          ? { selectedOffer: latestOfferPayload.selectedOffer }
          : {}),
      }
    : null;
  // Determine commodity from the merged payload inputs
  const commodity = mergedPayload?.type as "ELECTRICITY" | "GAS" | undefined;

  // Fetch the default PDF template for this simulation's commodity
  let defaultPdfTemplate: {
    id: string;
    name: string;
    htmlContent: string;
  } | null = null;
  if (commodity) {
    const systemConfig = await prisma.systemConfig.findFirst({
      select: {
        defaultPdfTemplateGasId: true,
        defaultPdfTemplateElectricityId: true,
      },
    });

    const templateId =
      commodity === "GAS"
        ? systemConfig?.defaultPdfTemplateGasId
        : systemConfig?.defaultPdfTemplateElectricityId;

    if (templateId) {
      const template = await prisma.pdfTemplate.findFirst({
        where: { id: templateId, isDeleted: false, active: true },
        select: {
          id: true,
          name: true,
          htmlContent: true,
          editableSections: true,
        },
      });
      if (template) {
        const editableSections = template.editableSections as
          | import("@/infrastructure/templates/editableSections").EditableSectionsConfig
          | null;
        const variableValues = extractVariableValues(
          simulation,
          mergedPayload as SimulationPayload | undefined,
          undefined,
          editableSections ?? undefined,
        );
        defaultPdfTemplate = {
          id: template.id,
          name: template.name,
          htmlContent: replaceVariables(template.htmlContent, variableValues),
        };
      }
    }
  }

  return ResponseHandler.ok(
    {
      accessSessionToken: issuePublicSessionToken(simulation.id, payload.token),
      simulation: {
        id: simulation.id,
        status: simulation.status,
        expiresAt: simulation.expiresAt,
        sharedAt: simulation.sharedAt,
      },
      owner: simulation.ownerUser,
      latestVersion: baseVersion
        ? {
            id: baseVersion.id,
            payloadJson: mergedPayload,
            createdAt: baseVersion.createdAt,
          }
        : null,
      defaultPdfTemplate,
    },
    200,
  );
});
