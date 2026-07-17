/**
 * Error handler middleware
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { isDomainError } from "@/domain/errors/errors";
import { ResponseHandler } from "./response";
import { getRefreshedAccessToken, withRequestContext } from "./requestContext";
import { ErrorLoggerService } from "@/application/services/errorLoggerService";
import {
  getLoadedAppVersion,
  warmAppVersionCache,
} from "@/application/lib/appVersionCache";
import { JwtService } from "@/application/services/jwtService";

export interface ErrorHandlerOptions {
  logErrors?: boolean;
  exposeDetails?: boolean; // In development only
}

const defaultOptions: ErrorHandlerOptions = {
  logErrors: true,
  exposeDetails: process.env.NODE_ENV === "development",
};

const ERROR_LOG_EXCLUDED_PATHS = new Set([
  "/api/v1/internal/app-error-logs/client",
  "/api/v1/internal/auth/session",
  "/api/v1/internal/auth/redirect-report",
]);

type HandlerContext = {
  params?: Record<string, string>;
};

type NextRouteContext = {
  params: Promise<Record<string, string>>;
};

type RouteHandlerWithErrorHandling = {
  (req: NextRequest): Promise<NextResponse>;
  (req: NextRequest, context: HandlerContext): Promise<NextResponse>;
  (req: NextRequest, context: NextRouteContext): Promise<NextResponse>;
};

class ApiResponseError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiResponseError";
  }
}

const getRequestUserId = (req: NextRequest): string | undefined => {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;

  try {
    return JwtService.verifyAccessTokenIgnoringExpiration(
      authorization.slice(7),
    ).sub;
  } catch {
    return undefined;
  }
};

const captureApiErrorResponse = async (
  req: NextRequest,
  response: NextResponse,
  originalError?: unknown,
): Promise<void> => {
  if (response.status < 400) return;

  const path = new URL(req.url).pathname;
  if (ERROR_LOG_EXCLUDED_PATHS.has(path)) return;

  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as
    | {
        error?: {
          code?: string;
          message?: string;
          details?: Record<string, unknown>;
        };
      }
    | null;

  const error =
    originalError instanceof Error
      ? originalError
      : new ApiResponseError(
          body?.error?.message ??
            `API request failed with status ${response.status}`,
          body?.error?.code,
        );

  await ErrorLoggerService.capture(error, {
    method: req.method,
    path,
    pagePath: req.headers.get("x-axpo-page-path") ?? undefined,
    statusCode: response.status,
    userId: getRequestUserId(req),
    metadata: body?.error?.details
      ? { responseDetails: body.error.details }
      : undefined,
    sendToSentry: response.status >= 500,
  }).catch(() => undefined);
};

/**
 * Central error handler for API routes
 */
export const errorHandler = (
  error: unknown,
  options: ErrorHandlerOptions = defaultOptions,
) => {
  const { logErrors, exposeDetails } = { ...defaultOptions, ...options };

  if (logErrors) {
    console.error("[Error Handler]", error);
  }

  if (isDomainError(error)) {
    return ResponseHandler.error(
      error.code,
      error.message,
      error.statusCode,
      exposeDetails ? error.details : undefined,
    );
  }

  if (error instanceof SyntaxError) {
    return ResponseHandler.error(
      "INVALID_REQUEST",
      "Invalid request JSON",
      400,
    );
  }

  if (error instanceof ZodError) {
    return ResponseHandler.error("VALIDATION_ERROR", "Validation failed", 400, {
      issues: error.issues,
    });
  }

  if (error instanceof Error) {
    return ResponseHandler.error(
      "INTERNAL_SERVER_ERROR",
      exposeDetails ? error.message : "Internal server error",
      500,
    );
  }

  return ResponseHandler.error(
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred",
    500,
  );
};

/**
 * Wrapper to safely execute handler with error handling
 */
export const withErrorHandler = (
  handler: (
    req: NextRequest,
    context?: HandlerContext,
  ) => Promise<NextResponse>,
): RouteHandlerWithErrorHandling => {
  return async (
    req: NextRequest,
    context?: HandlerContext | NextRouteContext,
  ) => {
    try {
      return await withRequestContext(async () => {
        const frontendVersion = req.headers.get("x-axpo-app-version");
        if (frontendVersion) {
          await warmAppVersionCache();
          const currentVersion = getLoadedAppVersion();

          if (currentVersion && frontendVersion !== currentVersion) {
            const response = ResponseHandler.error(
              "APP_VERSION_OUTDATED",
              "A newer application version is available",
              409,
              {
                frontendVersion,
                currentVersion,
              },
            );
            await captureApiErrorResponse(req, response);
            return response;
          }
        }

        const resolvedParams = context?.params
          ? await context.params
          : undefined;
        const response = await handler(
          req,
          resolvedParams ? { params: resolvedParams } : undefined,
        );

        const refreshedAccessToken = getRefreshedAccessToken();
        if (refreshedAccessToken) {
          response.headers.set("x-access-token", refreshedAccessToken);
        }

        await captureApiErrorResponse(req, response);
        return response;
      });
    } catch (error) {
      const response = errorHandler(error);
      await captureApiErrorResponse(req, response, error);
      return response;
    }
  };
};
