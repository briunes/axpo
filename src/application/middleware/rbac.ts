import { ForbiddenError } from "@/domain/errors/errors";
import { UserRole } from "@/domain/types";
import { AuthContext } from "./auth";
import { prisma } from "@/infrastructure/database/prisma";
import {
  ROLE_PERMISSION_DEFAULTS,
  type PermissionKey,
} from "../../../app/internal/lib/permissionsDefinitions";

export const assertRole = (context: AuthContext, allowedRoles: UserRole[]) => {
  if (!allowedRoles.includes(context.role)) {
    throw new ForbiddenError("Insufficient permissions for this operation");
  }
};

// ---------------------------------------------------------------------------
// In-process permission cache
// Avoids a DB round-trip (~80ms to remote Supabase) on every non-ADMIN request.
// role_permissions rows change only when an admin edits configs, so a 60s TTL
// is a good trade-off. The cache is per-process (warmed automatically).
// ---------------------------------------------------------------------------
interface CachedEntry {
  allowed: boolean;
  expiresAt: number; // epoch ms
}

const permissionCache = new Map<string, CachedEntry>();
const PERMISSION_CACHE_TTL_MS = 60_000; // 60 seconds

function permissionCacheKey(role: UserRole, key: PermissionKey): string {
  return `${role}:${key}`;
}

/**
 * Invalidates the entire permission cache.
 * Call this whenever role_permissions are updated via the API.
 */
export function invalidatePermissionCache(): void {
  permissionCache.clear();
}

/**
 * DB-backed permission check. ADMIN is always granted.
 * For other roles, looks up the rolePermission table (with in-process cache)
 * and falls back to the static defaults if no record is found.
 */
export async function assertPermission(
  context: AuthContext,
  key: PermissionKey,
): Promise<void> {
  if (context.role === UserRole.ADMIN) return;

  const cacheKey = permissionCacheKey(context.role, key);
  const now = Date.now();
  const cached = permissionCache.get(cacheKey);

  let allowed: boolean;

  if (cached && cached.expiresAt > now) {
    allowed = cached.allowed;
  } else {
    const record = await prisma.rolePermission.findUnique({
      where: { role_permissionKey: { role: context.role, permissionKey: key } },
      select: { allowed: true },
    });

    allowed =
      record !== null
        ? record.allowed
        : (ROLE_PERMISSION_DEFAULTS[context.role]?.[key] ?? false);

    permissionCache.set(cacheKey, {
      allowed,
      expiresAt: now + PERMISSION_CACHE_TTL_MS,
    });
  }

  if (!allowed) {
    throw new ForbiddenError("Insufficient permissions for this operation");
  }
}
