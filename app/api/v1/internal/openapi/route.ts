import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import openapiInternal from "@/infrastructure/openapi-internal.json";
import {
  isSwaggerBasicAuthValid,
  swaggerUnauthorizedResponse,
} from "@/infrastructure/security/swaggerBasicAuth";

/**
 * @swagger
 * /api/v1/internal/openapi:
 *   get:
 *     tags: [System]
 *     summary: Get internal OpenAPI specification
 *     description: Internal AXPO API contract (RBAC protected).
 *     security: []
 *     responses:
 *       200:
 *         description: Internal OpenAPI specification
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  if (!isSwaggerBasicAuthValid(request.headers.get("authorization"))) {
    return swaggerUnauthorizedResponse();
  }

  return NextResponse.json(openapiInternal, {
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
});
