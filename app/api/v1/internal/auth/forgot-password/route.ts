import { z } from "zod";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { AuthService } from "@/application/services/authService";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

/**
 * @swagger
 * /api/v1/internal/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset
 *     description: Sends a password reset email with a one-time token. Always returns success to prevent email enumeration.
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
 *         description: Reset email sent (or email not found - response is the same for security)
 *       400:
 *         description: Invalid email format
 */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const { email } = forgotPasswordSchema.parse(body);

  const result = await AuthService.requestPasswordReset(email);

  return ResponseHandler.ok(result);
});
