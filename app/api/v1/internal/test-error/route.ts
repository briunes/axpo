import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ErrorLoggerService } from "@/application/services/errorLoggerService";

/**
 * GET /api/v1/internal/test-error
 *
 * Simulates an unhandled error to verify that:
 *  1. The error is captured in Sentry
 *  2. An AppErrorLog record is saved to the database
 *
 * REMOVE THIS ROUTE AFTER TESTING.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "unhandled";

  if (type === "manual") {
    // Manually call ErrorLoggerService (bypasses withErrorHandler)
    const sentryId = await ErrorLoggerService.capture(
      new Error(
        "Manual test error — triggered via /api/v1/internal/test-error?type=manual",
      ),
      {
        method: req.method,
        path: new URL(req.url).pathname,
        statusCode: 500,
        metadata: { triggeredBy: "test-error route", type: "manual" },
      },
    );
    return NextResponse.json({
      success: true,
      message: "Error manually logged",
      sentryEventId: sentryId ?? null,
    });
  }

  // Default: throw so withErrorHandler catches it automatically
  throw new Error(
    "Unhandled test error — triggered via /api/v1/internal/test-error",
  );
});
