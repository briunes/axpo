import { NextRequest } from "next/server";
import { z } from "zod";
import { InvalidTokenError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import {
  applyRateLimit,
  getClientRateLimitKey,
} from "@/application/middleware/rateLimit";
import { prisma } from "@/infrastructure/database/prisma";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";
import { maskEmail } from "@/application/lib/sensitiveData";

const initSchema = z.object({
  token: z.string().min(16),
});

/**
 * @swagger
 * /api/v1/public/simulations/init:
 *   post:
 *     tags: [Public]
 *     summary: Retrieve basic simulation info by token (no PIN required)
 *     description: Returns the owner name, email, agency name and the client's preferred language (falls back to the owner's preferred language, then the system default) for the simulation identified by the token. Used to pre-populate the access screen before PIN entry.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 minLength: 16
 *     responses:
 *       200:
 *         description: Simulation info retrieved
 *       401:
 *         description: Invalid token
 *       429:
 *         description: Rate limit exceeded
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const ip = getRequestSessionContext(request).ipAddress;

  const body = await request.json();
  const { token } = initSchema.parse(body);

  applyRateLimit(
    getClientRateLimitKey(ip, `public-init:${token.slice(0, 8)}`),
    {
      maxRequests: 20,
      windowMs: 15 * 60 * 1000,
    },
  );

  const simulation = await prisma.simulation.findFirst({
    where: {
      publicToken: token,
      isDeleted: false,
    },
    select: {
      id: true,
      client: {
        select: {
          language: true,
        },
      },
      ownerUser: {
        select: {
          fullName: true,
          email: true,
          agency: {
            select: {
              name: true,
            },
          },
          preferences: {
            select: {
              language: true,
            },
          },
        },
      },
    },
  });

  if (!simulation || !simulation.ownerUser) {
    throw new InvalidTokenError("Invalid or inactive share token");
  }

  // Resolve the language to surface to the public client.
  // Priority: simulation's client preferred language → owner's user preferred language → system default.
  const preferredLanguage =
    simulation.client?.language ??
    simulation.ownerUser.preferences?.language ??
    null;

  return ResponseHandler.ok(
    {
      ownerName: simulation.ownerUser.fullName,
      ownerEmail: maskEmail(simulation.ownerUser.email),
      agencyName: simulation.ownerUser.agency?.name ?? null,
      preferredLanguage,
    },
    200,
  );
});
