import { NextRequest } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { AuthService } from "@/application/services/authService";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";
import {
  applyRateLimitShared,
  getClientRateLimitKey,
} from "@/application/middleware/rateLimit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

/**
 * @swagger
 * /api/v1/internal/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate user with email and password
 *     description: Login with email and password to receive a JWT token for authenticated requests
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login succeeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/LoginResponse'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const sessionContext = getRequestSessionContext(request);
  const ip = sessionContext.ipAddress;
  await applyRateLimitShared(getClientRateLimitKey(ip, "login"), {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });

  const body = await request.json();
  const payload = loginSchema.parse(body);

  payload.email = payload.email.toLowerCase();

  const result = await AuthService.loginWithEmailAndPassword(
    payload.email,
    payload.password,
    sessionContext,
  );
  return ResponseHandler.ok(result, 200);
});
