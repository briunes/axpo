import { z } from "zod";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { AuthService } from "@/application/services/authService";

const schema = z.object({
  email: z.string().email(),
});

/**
 * @swagger
 * /api/v1/internal/auth/magic-link/request:
 *   post:
 *     tags: [Auth]
 *     summary: Request a magic link login email
 *     description: Sends a magic link email with a one-time token. Always returns success to prevent email enumeration.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Magic link sent (or email not found — response is the same for security)
 *       400:
 *         description: Invalid email format
 */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const { email } = schema.parse(body);

  const result = await AuthService.requestMagicLink(email);

  return ResponseHandler.ok(result);
});
