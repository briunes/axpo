import { NextRequest } from "next/server";
import { ResponseHandler } from "@/application/middleware/response";
import { withErrorHandler } from "@/application/middleware/errorHandler";

/**
 * @swagger
 * /api/v1/internal/health:
 *   get:
 *     tags: [System]
 *     summary: API health check
 *     security: []
 *     responses:
 *       200:
 *         description: Healthy response
 */
export const GET = withErrorHandler(async (_request: NextRequest) => {
  const health = {
    status: "healthy" as const,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.2.0",
    environment: process.env.NODE_ENV || "development",
  };

  return ResponseHandler.ok(health, 200);
});
