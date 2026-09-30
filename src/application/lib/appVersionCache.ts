/**
 * App Version Cache
 *
 * Stores the appVersion from systemConfig in memory so it can be injected
 * into every API response without hitting the database on every request.
 *
 * - Uses `globalThis` so the cache survives Next.js hot-reloads in dev.
 * - A short TTL limits cross-instance staleness after a version bump; explicit
 *   invalidation remains primary on the instance handling the update.
 */

import { prisma } from "@/infrastructure/database/prisma";

const CACHE_TTL_MS = 15_000;
const FALLBACK_VERSION = "0.2.1";

interface VersionCache {
  version: string;
  loadedAt: number;
}

// Survive hot-reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __axpoAppVersionCache: VersionCache | null;
  var __axpoAppVersionLoad: Promise<void> | null;
}

globalThis.__axpoAppVersionCache ??= null;
globalThis.__axpoAppVersionLoad ??= null;

/** Returns the currently cached version (sync). Falls back to FALLBACK_VERSION. */
export function getCachedAppVersion(): string {
  return globalThis.__axpoAppVersionCache?.version ?? FALLBACK_VERSION;
}

/** Returns null until the version has been loaded successfully from the DB. */
export function getLoadedAppVersion(): string | null {
  return globalThis.__axpoAppVersionCache?.version ?? null;
}

/** Clears the cache so the next `warmAppVersionCache()` call re-fetches from DB. */
export function invalidateAppVersionCache(): void {
  globalThis.__axpoAppVersionCache = null;
  // An older pending read must not repopulate an explicitly invalidated cache.
  globalThis.__axpoAppVersionLoad = null;
}

/**
 * Loads the appVersion from the DB and stores it in cache.
 * No-ops if the cache is still fresh (< TTL).
 */
export async function warmAppVersionCache(): Promise<void> {
  if (process.env.NODE_ENV === "test") return;

  const now = Date.now();
  const cache = globalThis.__axpoAppVersionCache;
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return;

  if (globalThis.__axpoAppVersionLoad) return globalThis.__axpoAppVersionLoad;

  let pending!: Promise<void>;
  pending = (async () => {
    try {
      const config = await prisma.systemConfig.findFirst({
        select: { appVersion: true },
      });
      if (globalThis.__axpoAppVersionLoad === pending) {
        globalThis.__axpoAppVersionCache = {
          version: config?.appVersion ?? FALLBACK_VERSION,
          loadedAt: now,
        };
      }
    } catch {
      // On DB error, keep existing cache (or keep fallback); don't crash.
    }
  })();
  globalThis.__axpoAppVersionLoad = pending;
  try {
    await pending;
  } finally {
    if (globalThis.__axpoAppVersionLoad === pending) {
      globalThis.__axpoAppVersionLoad = null;
    }
  }
}
