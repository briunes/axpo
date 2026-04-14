import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { InvalidTokenError, ValidationError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { SimulationService } from "@/application/services/simulationService";
import { prisma } from "@/infrastructure/database/prisma";

interface PublicSessionPayload {
  typ?: string;
  sid?: string;
  tok?: string;
}

const readPublicSessionToken = (request: NextRequest): string => {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice(7).trim();
  }

  const custom = request.headers.get("x-public-session-token");
  if (custom) {
    return custom;
  }

  throw new InvalidTokenError("Missing public access session token");
};

const verifyPublicSessionToken = (
  sessionToken: string,
): PublicSessionPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new InvalidTokenError("JWT secret not configured");
  }

  const decoded = jwt.verify(sessionToken, secret);
  if (!decoded || typeof decoded !== "object") {
    throw new InvalidTokenError("Invalid public session token");
  }

  return decoded as PublicSessionPayload;
};

/**
 * @swagger
 * /api/v1/public/simulations/{token}:
 *   get:
 *     tags: [Public]
 *     summary: Retrieve public simulation details using validated session token
 *     security: []
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ) => {
    const token = context?.params?.token;
    if (!token) {
      throw new ValidationError("Simulation token parameter is required");
    }

    const sessionToken = readPublicSessionToken(request);
    const payload = verifyPublicSessionToken(sessionToken);

    if (
      payload.typ !== "PUBLIC_SIM_ACCESS" ||
      payload.tok !== token ||
      !payload.sid
    ) {
      throw new InvalidTokenError(
        "Public access session is invalid for this token",
      );
    }

    const simulation = await prisma.simulation.findFirst({
      where: {
        id: payload.sid,
        publicToken: token,
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

    if (!simulation) {
      throw new InvalidTokenError("Invalid or inactive share token");
    }

    if (SimulationService.isExpired(simulation.expiresAt)) {
      throw new InvalidTokenError("Simulation link has expired");
    }

    const recentVersions = await prisma.simulationVersion.findMany({
      where: { simulationId: simulation.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Build a merged payload: use the most recent version with results (which
    // always includes inputs) as the base, then overlay the most recent
    // selectedOffer.  This prevents a bare "selectedOffer-only" version from
    // masking the inputs and results saved by an earlier calculation.
    const baseVersion =
      recentVersions.find(
        (v) => (v.payloadJson as Record<string, unknown> | null)?.results,
      ) ?? recentVersions[0];
    const latestOfferPayload = recentVersions.find(
      (v) => (v.payloadJson as Record<string, unknown> | null)?.selectedOffer,
    )?.payloadJson as Record<string, unknown> | null;
    const mergedPayload: Record<string, unknown> | null =
      baseVersion?.payloadJson
        ? {
            ...(baseVersion.payloadJson as Record<string, unknown>),
            ...(latestOfferPayload?.selectedOffer !== undefined
              ? { selectedOffer: latestOfferPayload.selectedOffer }
              : {}),
          }
        : null;

    return ResponseHandler.ok(
      {
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
      },
      200,
    );
  },
);
