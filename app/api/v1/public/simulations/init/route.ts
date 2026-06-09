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
 *     description: Returns the owner name, email, and agency name for the simulation identified by the token. Used to pre-populate the access screen before PIN entry.
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

  applyRateLimit(getClientRateLimitKey(ip, `public-init:${token.slice(0, 8)}`), {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
  });

  const simulation = await prisma.simulation.findFirst({
    where: {
      publicToken: token,
      isDeleted: false,
    },
    select: {
      id: true,
      ownerUser: {
        select: {
          fullName: true,
          email: true,
          agency: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!simulation || !simulation.ownerUser) {
    throw new InvalidTokenError("Invalid or inactive share token");
  }

  return ResponseHandler.ok(
    {
      ownerName: simulation.ownerUser.fullName,
      ownerEmail: maskEmail(simulation.ownerUser.email),
      agencyName: simulation.ownerUser.agency?.name ?? null,
    },
    200,
  );
});
