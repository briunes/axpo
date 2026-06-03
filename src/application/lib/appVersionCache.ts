/**
 * App Version Cache
 *
 * Stores the appVersion from systemConfig in memory so it can be injected
 * into every API response without hitting the database on every request.
 *
 * - Uses `globalThis` so the cache survives Next.js hot-reloads in dev.
 * - TTL of 5 minutes as a safety net; explicit invalidation is the primary
 *   mechanism (call `invalidateAppVersionCache()` whenever appVersion changes).
 */

import { prisma } from "@/infrastructure/database/prisma";

const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes
const FALLBACK_VERSION = "1.0.0";

interface VersionCache {
  version: string;
  loadedAt: number;
}

// Survive hot-reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __axpoAppVersionCache: VersionCache | null;
}

globalThis.__axpoAppVersionCache ??= null;

/** Returns the currently cached version (sync). Falls back to FALLBACK_VERSION. */
export function getCachedAppVersion(): string {
  return globalThis.__axpoAppVersionCache?.version ?? FALLBACK_VERSION;
}

/** Clears the cache so the next `warmAppVersionCache()` call re-fetches from DB. */
export function invalidateAppVersionCache(): void {
  globalThis.__axpoAppVersionCache = null;
}

/**
 * Loads the appVersion from the DB and stores it in cache.
 * No-ops if the cache is still fresh (< TTL).
 */
export async function warmAppVersionCache(): Promise<void> {
  const now = Date.now();
  const cache = globalThis.__axpoAppVersionCache;
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return;

  try {
    const config = await prisma.systemConfig.findFirst({
      select: { appVersion: true },
    });
    globalThis.__axpoAppVersionCache = {
      version: config?.appVersion ?? FALLBACK_VERSION,
      loadedAt: now,
    };
  } catch {
    // On DB error, keep existing cache (or keep fallback); don't crash.
  }
}
