import { z } from "zod";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { AuthService } from "@/application/services/authService";

const setupPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12).max(128),
});

/**
 * @swagger
 * /api/v1/internal/auth/setup-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set password for the first time using a setup token
 *     description: Validates the one-time setup token and saves the new password. The token is consumed after use.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 12
 *                 maxLength: 128
 *     responses:
 *       200:
 *         description: Password set successfully — returns JWT + user info
 *       400:
 *         description: Invalid token or password does not meet policy
 */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const { token, password } = setupPasswordSchema.parse(body);

  const result = await AuthService.setupPassword(token, password);

  return ResponseHandler.ok(result);
});
