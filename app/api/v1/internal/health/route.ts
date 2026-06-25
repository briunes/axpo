import { NextRequest } from "next/server";
import { ResponseHandler } from "@/application/middleware/response";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { getDatabaseConnectionMode } from "@/infrastructure/database/databaseMode";
import { prisma } from "@/infrastructure/database/prisma";

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
export const GET = withErrorHandler(async (request: NextRequest) => {
  const databaseMode = getDatabaseConnectionMode();
  const shouldCheckDatabase =
    request.nextUrl.searchParams.get("checkDatabase") === "true";

  let databaseStatus: "not-checked" | "connected" = "not-checked";
  if (shouldCheckDatabase) {
    await prisma.$connect();
    databaseStatus = "connected";
  }

  const health = {
    status: "healthy" as const,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.2.0",
    database: {
      mode: shouldCheckDatabase ? databaseMode : "not-disclosed",
      status: databaseStatus,
    },
  };

  return ResponseHandler.ok(health, 200);
});
