/**
 * API Response utilities - Standard response format
 */

import { NextResponse } from "next/server";
import { ApiResponse, ApiError } from "@/domain/types";

export class ResponseHandler {
  /**
   * Success response
   */
  static ok<T>(data: T, statusCode: number = 200): NextResponse<ApiResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }

  /**
   * Error response
   */
  static error(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: Record<string, unknown>
  ): NextResponse<ApiResponse<null>> {
    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
          ...(details && { details }),
        } as ApiError,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }

  /**
   * Paginated response
   */
  static paginated<T>(
    items: T[],
    page: number,
    pageSize: number,
    total: number,
    statusCode: number = 200
  ) {
    const hasMore = page * pageSize < total;
    return NextResponse.json(
      {
        success: true,
        data: {
          items,
          pagination: {
            page,
            pageSize,
            total,
            hasMore,
          },
        },
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}

/**
 * Type-safe wrapper for handler functions
 */
export type ApiHandler<T = any> = (
  request: Request,
  context?: any
) => Promise<NextResponse<ApiResponse<T>>>;

/**
 * Async error wrapper for handlers
 */
export const withErrorHandling = (handler: ApiHandler) => {
  return async (request: Request, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error("Unhandled error in handler:", error);
      
      if (error instanceof Error) {
        return ResponseHandler.error(
          "INTERNAL_SERVER_ERROR",
          error.message,
          500
        );
      }
      
      return ResponseHandler.error(
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred",
        500
      );
    }
  };
};
