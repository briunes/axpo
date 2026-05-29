import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { prisma } from "@/infrastructure/database/prisma";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/v1/internal/app-error-logs/client
 *
 * Receives client-side errors (React render crashes, unhandled rejections, etc.)
 * and saves them to the database + forwards to Sentry.
 * No auth required — errors can happen before login.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.message !== "string") {
    return ResponseHandler.error(
      "INVALID_REQUEST",
      "Missing error message",
      400,
    );
  }

  const {
    message,
    stack,
    errorType = "ClientError",
    errorCode,
    path,
    metadata,
  }: {
    message: string;
    stack?: string;
    errorType?: string;
    errorCode?: string;
    path?: string;
    metadata?: Record<string, unknown>;
  } = body;

  // Forward to Sentry from the server side so the DSN is never exposed client-side
  let sentryEventId: string | undefined;
  try {
    const syntheticError = new Error(message);
    syntheticError.name = errorType;
    if (stack) syntheticError.stack = stack;
    sentryEventId = Sentry.captureException(syntheticError, {
      tags: { source: "client", ...(path && { path }) },
      extra: metadata,
    });
    await Sentry.flush(2000);
  } catch {
    // best-effort
  }

  // Save to database
  await (prisma as any).appErrorLog.create({
    data: {
      errorType,
      errorCode: errorCode ?? null,
      message,
      stack: stack ?? null,
      method: "CLIENT",
      path: path ?? null,
      statusCode: null,
      userId: null,
      sentryEventId: sentryEventId ?? null,
      metadata: (metadata as any) ?? null,
    },
  });

  return ResponseHandler.ok({ sentryEventId: sentryEventId ?? null });
});
