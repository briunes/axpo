/**
 * reportClientError
 *
 * Posts a client-side error to the server so it gets saved to the DB
 * and forwarded to Sentry. Safe to call from error boundaries,
 * unhandledrejection handlers, etc.
 */
export async function reportClientError(
  error: unknown,
  extra?: { path?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    const isError = error instanceof Error;
    await fetch("/api/v1/internal/app-error-logs/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: isError ? error.message : String(error),
        stack: isError ? (error.stack ?? undefined) : undefined,
        errorType: isError
          ? (error.constructor?.name ?? "Error")
          : "UnknownError",
        path:
          extra?.path ??
          (typeof window !== "undefined"
            ? window.location.pathname
            : undefined),
        pagePath:
          typeof window !== "undefined"
            ? window.location.pathname
            : undefined,
        metadata: extra?.metadata,
      }),
    });
  } catch {
    // Never throw from an error reporter
  }
}
