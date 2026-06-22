import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { prisma } from "@/infrastructure/database/prisma";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import {
  applyRateLimitShared,
  getClientRateLimitKey,
} from "@/application/middleware/rateLimit";
import { getRequestSessionContext } from "@/application/middleware/requestSessionContext";

const clientErrorSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(20000).optional(),
  errorType: z.string().max(120).optional(),
  errorCode: z.string().max(120).optional(),
  path: z.string().max(500).optional(),
  pagePath: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/v1/internal/app-error-logs/client
 *
 * Receives client-side errors (React render crashes, unhandled rejections, etc.)
 * and saves them to the database + forwards to Sentry.
 * No auth required — errors can happen before login.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const { ipAddress } = getRequestSessionContext(request);
  await applyRateLimitShared(getClientRateLimitKey(ipAddress, "client-error"), {
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
  });

  const body = await request.json().catch(() => null);

  const parsed = clientErrorSchema.safeParse(body);
  if (!parsed.success) {
    return ResponseHandler.error(
      "INVALID_REQUEST",
      "Invalid client error report",
      400,
    );
  }

  const {
    message,
    stack,
    errorType = "ClientError",
    errorCode,
    path,
    pagePath,
    metadata,
  }: {
    message: string;
    stack?: string;
    errorType?: string;
    errorCode?: string;
    path?: string;
    pagePath?: string;
    metadata?: Record<string, unknown>;
  } = parsed.data;

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
  const logData = {
      errorType,
      errorCode: errorCode ?? null,
      message,
      stack: stack ?? null,
      method: "CLIENT",
      path: path ?? null,
      pagePath: pagePath ?? path ?? null,
      statusCode: null,
      userId: null,
      sentryEventId: sentryEventId ?? null,
      metadata: (metadata as any) ?? null,
  };
  try {
    await (prisma as any).appErrorLog.create({ data: logData });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("PGRST204") ||
      message.includes("'pagePath' column") ||
      message.includes('"pagePath" column')
    ) {
      const { pagePath: _pagePath, ...legacyLogData } = logData;
      await (prisma as any).appErrorLog.create({ data: legacyLogData });
    } else {
      throw error;
    }
  }

  return ResponseHandler.ok({ sentryEventId: sentryEventId ?? null });
});
