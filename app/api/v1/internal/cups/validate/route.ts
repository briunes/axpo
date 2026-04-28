import { NextRequest } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";

const cupsSchema = z.object({
  cups: z.string().min(10),
});

// Simplified CUPS check for MVP: ES + 16-20 alphanumeric chars.
const cupsRegex = /^ES[0-9A-Z]{16,20}$/;

/**
 * @swagger
 * /api/v1/internal/cups/validate:
 *   post:
 *     tags: [Validation]
 *     summary: Validate CUPS value
 *     security:
 *       - bearerAuth: []
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.simulations");

  const body = await request.json();
  const payload = cupsSchema.parse(body);

  const normalized = payload.cups.toUpperCase().replace(/\s+/g, "");
  const valid = cupsRegex.test(normalized);

  return ResponseHandler.ok(
    {
      cups: payload.cups,
      normalized,
      valid,
      reason: valid ? "VALID_FORMAT" : "INVALID_FORMAT",
    },
    200,
  );
});
