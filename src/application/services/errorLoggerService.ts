/**
 * ErrorLoggerService
 *
 * Centralised service that:
 *  1. Captures the error in Sentry (with full context)
 *  2. Persists an AppErrorLog record to the database
 *
 * Both operations are best-effort — a failure in one never throws to the caller.
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/infrastructure/database/prisma";

export interface ErrorLogContext {
  /** HTTP method (GET, POST, …) */
  method?: string;
  /** Request pathname, e.g. /api/v1/internal/simulations */
  path?: string;
  /** Browser route where the API request originated */
  pagePath?: string;
  /** HTTP status code that will be returned to the client */
  statusCode?: number;
  /** Authenticated user id, if available */
  userId?: string;
  /** Any additional key/value data to store alongside the error */
  metadata?: Record<string, unknown>;
  /** Whether this error should also be sent to Sentry */
  sendToSentry?: boolean;
}

export class ErrorLoggerService {
  private static async persist(data: Record<string, unknown>): Promise<void> {
    try {
      await (prisma as any).appErrorLog.create({ data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        "pagePath" in data &&
        (message.includes("PGRST204") ||
          message.includes("'pagePath' column") ||
          message.includes('"pagePath" column'))
      ) {
        const { pagePath: _pagePath, ...legacyData } = data;
        await (prisma as any).appErrorLog.create({ data: legacyData });
        return;
      }
      throw error;
    }
  }

  /**
   * Log an error to Sentry AND to the database.
   *
   * @param error  - The caught error (any type)
   * @param ctx    - Optional HTTP / user context
   * @returns      - The Sentry event id (if captured), for cross-referencing
   */
  static async capture(
    error: unknown,
    ctx: ErrorLogContext = {},
  ): Promise<string | undefined> {
    let sentryEventId: string | undefined;

    // ── 1. Send to Sentry ────────────────────────────────────────────────────
    if (ctx.sendToSentry !== false) {
      try {
        sentryEventId = Sentry.captureException(error, {
          tags: {
            ...(ctx.path && { path: ctx.path }),
            ...(ctx.pagePath && { pagePath: ctx.pagePath }),
            ...(ctx.method && { method: ctx.method }),
            ...(ctx.statusCode && { statusCode: String(ctx.statusCode) }),
          },
          user: ctx.userId ? { id: ctx.userId } : undefined,
          extra: ctx.metadata,
        });
        // Flush the Sentry queue — critical in serverless environments where the
        // process exits immediately after the response is sent.
        await Sentry.flush(2000);
      } catch (sentryErr) {
        // Never let Sentry failures break the request
        console.error("[ErrorLoggerService] Sentry capture failed:", sentryErr);
      }
    }

    // ── 2. Persist to database ───────────────────────────────────────────────
    try {
      const isError = error instanceof Error;
      const errorType = isError
        ? (error.constructor?.name ?? "Error")
        : typeof error;
      const message = isError
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
      const stack = isError ? (error.stack ?? null) : null;

      // Read domain error code if present
      const errorCode =
        error != null &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : null;

      await this.persist({
          errorType,
          errorCode,
          message,
          stack,
          method: ctx.method ?? null,
          path: ctx.path ?? null,
          pagePath: ctx.pagePath ?? null,
          statusCode: ctx.statusCode ?? null,
          userId: ctx.userId ?? null,
          sentryEventId: sentryEventId ?? null,
          metadata: (ctx.metadata as any) ?? null,
      });
    } catch (dbErr) {
      console.error("[ErrorLoggerService] DB persist failed:", dbErr);
    }

    return sentryEventId;
  }
}
