/**
 * Error handler middleware
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError, isDomainError } from "@/domain/errors/errors";
import { ResponseHandler } from "./response";

export interface ErrorHandlerOptions {
  logErrors?: boolean;
  exposeDetails?: boolean; // In development only
}

const defaultOptions: ErrorHandlerOptions = {
  logErrors: true,
  exposeDetails: process.env.NODE_ENV === "development",
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
    context?: { params?: Record<string, string> },
  ) => Promise<NextResponse>,
): ((
  req: NextRequest,
  context?: {
    params?: Promise<Record<string, string>> | Record<string, string>;
  },
) => Promise<NextResponse>) => {
  return async (
    req: NextRequest,
    context?: {
      params?: Promise<Record<string, string>> | Record<string, string>;
    },
  ) => {
    try {
      const resolvedParams = context?.params ? await context.params : undefined;
      return await handler(
        req,
        resolvedParams ? { params: resolvedParams } : undefined,
      );
    } catch (error) {
      return errorHandler(error);
    }
  };
};
