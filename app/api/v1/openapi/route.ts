import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import openapiPublic from "@/infrastructure/openapi-public.json";

/**
 * @swagger
 * /api/v1/openapi:
 *   get:
 *     tags: [System]
 *     summary: Get public OpenAPI specification
 *     description: Public API contract for token+PIN flows.
 *     security: []
 *     responses:
 *       200:
 *         description: Public OpenAPI specification
 */
export const GET = withErrorHandler(async (_request: NextRequest) => {
  return NextResponse.json(openapiPublic, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
});
