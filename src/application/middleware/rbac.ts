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

/**
 * DB-backed permission check. ADMIN is always granted.
 * For other roles, looks up the rolePermission table and falls back
 * to the static defaults if no record is found.
 */
export async function assertPermission(
  context: AuthContext,
  key: PermissionKey,
): Promise<void> {
  if (context.role === UserRole.ADMIN) return;

  const record = await prisma.rolePermission.findUnique({
    where: { role_permissionKey: { role: context.role, permissionKey: key } },
    select: { allowed: true },
  });

  const allowed =
    record !== null
      ? record.allowed
      : (ROLE_PERMISSION_DEFAULTS[context.role]?.[key] ?? false);

  if (!allowed) {
    throw new ForbiddenError("Insufficient permissions for this operation");
  }
}
