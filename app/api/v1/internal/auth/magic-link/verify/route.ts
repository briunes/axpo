import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { AuthService } from "@/application/services/authService";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";
import {
  applyRateLimit,
  getClientRateLimitKey,
} from "@/application/middleware/rateLimit";

/**
 * @swagger
 * /api/v1/internal/auth/magic-link/verify:
 *   get:
 *     tags: [Auth]
 *     summary: Verify a magic link token and return a session
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Login successful, returns JWT and user info
 *       400:
 *         description: Invalid or expired token
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const sessionContext = getRequestSessionContext(request);
  applyRateLimit(
    getClientRateLimitKey(sessionContext.ipAddress, "magic-link-verify"),
    { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  );

  const result = await AuthService.verifyMagicLink(token, sessionContext);

  return ResponseHandler.ok(result);
});
