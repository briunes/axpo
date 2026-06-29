import { NextRequest } from "next/server";
import { z } from "zod";
import jwt, { type SignOptions } from "jsonwebtoken";
import { InvalidPINError, InvalidTokenError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import {
  applyRateLimitShared,
  getClientRateLimitKey,
} from "@/application/middleware/rateLimit";
import { PinService } from "@/application/services/pinService";
import { SimulationService } from "@/application/services/simulationService";
import { NotificationService } from "@/application/services/notificationService";
import { prisma } from "@/infrastructure/database/prisma";
import { AuditService } from "@/application/services/auditService";
import {
  extractVariableValues,
  replaceVariables,
} from "@/infrastructure/pdf/variableReplacer";
import type { SimulationPayload } from "@/domain/types/simulation";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";
import { keyedDigest } from "@/application/lib/sensitiveData";

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
    { algorithm: "HS256", expiresIn: PUBLIC_ACCESS_EXPIRES_IN },
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
  const ip = getRequestSessionContext(request).ipAddress;
  const ipFingerprint = keyedDigest(ip, "public-access-ip");

  const body = await request.json();
  const payload = accessSchema.parse(body);

  await applyRateLimitShared(
    getClientRateLimitKey(ip, `public:${payload.token.slice(0, 8)}`),
    { maxRequests: 8, windowMs: 15 * 60 * 1000 },
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
          agency: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      client: {
        select: {
          name: true,
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
        ipFingerprint,
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
        ipHashOrMask: ipFingerprint,
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
        ipHashOrMask: ipFingerprint,
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
      ipHashOrMask: ipFingerprint,
      success: true,
      reason: "SUCCESS",
    },
  });

  // Record the first time the client opens the simulation
  if (!simulation.clientOpenedAt) {
    await prisma.simulation.update({
      where: { id: simulation.id },
      data: { clientOpenedAt: new Date() },
    });
    await NotificationService.notifySimulationViewed({
      simulationId: simulation.id,
      referenceNumber: simulation.referenceNumber,
      ownerUserId: simulation.ownerUserId,
      clientName: simulation.client?.name,
    }).catch((error) => {
      console.error("[Notifications] Failed to create simulation viewed notification:", error);
    });
  }

  await AuditService.logEvent({
    eventType: "PUBLIC_ACCESS_GRANTED",
    targetType: "SIMULATION",
    targetId: simulation.id,
    metadataJson: {
      tokenFragment: payload.token.slice(0, 8),
      ipFingerprint,
    },
  });

  const recentVersions = await prisma.simulationVersion.findMany({
    where: { simulationId: simulation.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Build a merged payload: use the most recent version that has calculation
  // results (which always includes inputs) as the base, then overlay the most
  // recent selectedOffer.  This prevents a bare "selectedOffer-only" version
  // from masking the inputs and results saved by an earlier calculation.
  const baseVersion =
    recentVersions.find(
      (v) => (v.payloadJson as Record<string, unknown> | null)?.results,
    ) ?? recentVersions[0];
  const latestOfferPayload = recentVersions.find((v) => {
    const payload = v.payloadJson as Record<string, unknown> | null;
    return payload !== null && Object.prototype.hasOwnProperty.call(payload, "selectedOffer");
  })?.payloadJson as Record<string, unknown> | null;
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

  // Build a lean payload: keep inputs + only the selected plan result
  let leanPayload: Record<string, unknown> | null = null;
  if (mergedPayload) {
    const selectedOffer = mergedPayload.selectedOffer as
      | { productKey?: string; commodity?: string }
      | undefined;

    // Resolve the selected result from the full results list
    const rawResults = mergedPayload.results as
      | Record<string, unknown>
      | undefined;
    let selectedResult: unknown = null;
    if (rawResults && selectedOffer?.productKey) {
      const commodity = (
        selectedOffer.commodity ?? "electricity"
      ).toLowerCase() as string;
      const allResults = rawResults[commodity] as
        | Array<{ productKey: string }>
        | undefined;
      selectedResult =
        allResults?.find((r) => r.productKey === selectedOffer.productKey) ??
        null;
    }

    // Strip the full results array; expose only the selected plan result
    const { results: _results, ...payloadWithoutResults } = mergedPayload;
    leanPayload = {
      ...payloadWithoutResults,
      ...(selectedResult !== null
        ? {
            selectedResult,
            results: rawResults
              ? {
                  calculatedAt: (rawResults as Record<string, unknown>)
                    .calculatedAt,
                  baseValueSetId: (rawResults as Record<string, unknown>)
                    .baseValueSetId,
                }
              : undefined,
          }
        : {}),
    };
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
            payloadJson: leanPayload,
            createdAt: baseVersion.createdAt,
          }
        : null,
      defaultPdfTemplate,
    },
    200,
  );
});
