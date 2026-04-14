/**
 * Domain Errors - Application error types
 */

export class DomainError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

// Authentication & Authorization
export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized", details?: Record<string, unknown>) {
    super("UNAUTHORIZED", message, 401, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden", details?: Record<string, unknown>) {
    super("FORBIDDEN", message, 403, details);
  }
}

export class InvalidTokenError extends DomainError {
  constructor(message = "Invalid or expired token", details?: Record<string, unknown>) {
    super("INVALID_TOKEN", message, 401, details);
  }
}

export class InvalidPINError extends DomainError {
  constructor(message = "Invalid PIN", details?: Record<string, unknown>) {
    super("INVALID_PIN", message, 401, details);
  }
}

// Resource Errors
export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message = "Resource conflict", details?: Record<string, unknown>) {
    super("CONFLICT", message, 409, details);
  }
}

export class AlreadyExistsError extends DomainError {
  constructor(resource: string, field: string, value: string) {
    super(
      "ALREADY_EXISTS",
      `${resource} with ${field} '${value}' already exists`,
      409
    );
  }
}

// Validation Errors
export class ValidationError extends DomainError {
  constructor(message = "Validation failed", details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

// Rate Limiting
export class RateLimitError extends DomainError {
  constructor(
    public retryAfterSeconds: number = 60,
    message = `Too many requests. Retry after ${retryAfterSeconds}s`
  ) {
    super("RATE_LIMIT_EXCEEDED", message, 429);
  }
}

// Server Errors
export class InternalServerError extends DomainError {
  constructor(message = "Internal server error", details?: Record<string, unknown>) {
    super("INTERNAL_SERVER_ERROR", message, 500, details);
  }
}

/**
 * Helper to check if error is DomainError
 */
export const isDomainError = (error: unknown): error is DomainError => {
  return error instanceof DomainError;
};
