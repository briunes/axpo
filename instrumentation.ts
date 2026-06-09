export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // Pre-warm the app version cache so the very first API response already
    // contains the correct version without waiting for a DB round-trip.
    if (process.env.NODE_ENV !== "test") {
      const { warmAppVersionCache } =
        await import("./src/application/lib/appVersionCache");
      await warmAppVersionCache();
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
