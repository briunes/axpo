import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import {
  assertRole,
  invalidatePermissionCache,
  isElevatedRole,
} from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";
import { LOG_PERMISSION_KEYS } from "../../../../../internal/lib/permissionsDefinitions";

const ADMIN_ONLY_PERMISSION_KEYS = new Set([
  "section.audit-logs",
  "section.email-logs",
  "section.cron-logs",
  "section.ocr-logs",
  "section.app-error-logs",
  "section.users",
  "section.agencies",
  "section.configurations",
  "section.ocr-usage",
  "simulations.delete",
  "users.view",
  "users.create",
  "users.edit",
  "users.deactivate",
  "agencies.view",
  "agencies.create",
  "agencies.edit",
  "agencies.deactivate",
]);

const upsertSchema = z.object({
  updates: z.array(
    z.object({
      role: z.nativeEnum(UserRole),
      permissionKey: z.string().min(1),
      allowed: z.boolean(),
    }),
  ),
});

/**
 * GET /api/v1/internal/config/role-permissions
 * - ADMIN: returns all editable role permission entries.
 * - AGENT / COMMERCIAL: returns only their own role's entries (needed to
 *   enforce DB-driven permissions on the frontend).
 * SYS_ADMIN is always granted every permission and is not stored in the DB.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);

  const isAdmin = isElevatedRole(auth.role);

  // Non-admins may only fetch their own role's permissions
  const roleFilter = isAdmin
    ? { in: [UserRole.ADMIN, UserRole.AGENT, UserRole.COMMERCIAL] as UserRole[] }
    : { equals: auth.role as UserRole };

  const permissions = await prisma.rolePermission.findMany({
    where: { role: roleFilter },
    orderBy: [{ role: "asc" }, { permissionKey: "asc" }],
    select: {
      id: true,
      role: true,
      permissionKey: true,
      allowed: true,
      updatedAt: true,
    },
  });

  return ResponseHandler.ok({ items: permissions }, 200);
});

/**
 * PATCH /api/v1/internal/config/role-permissions
 * Bulk upsert role permission entries.
 * SYS_ADMIN entries are silently ignored. ADMIN can manage log permissions.
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN, UserRole.SYS_ADMIN]);

  const body = await request.json();
  const { updates } = upsertSchema.parse(body);

  const filtered = updates
    .filter((u) => u.role !== UserRole.SYS_ADMIN)
    .filter(
      (u) =>
        u.role !== UserRole.ADMIN ||
        LOG_PERMISSION_KEYS.includes(u.permissionKey as any),
    )
    .map((u) => {
      const isEditableRole =
        u.role === UserRole.AGENT || u.role === UserRole.COMMERCIAL;
      if (
        isEditableRole &&
        (u.permissionKey === "users.sessions.manage" ||
          ADMIN_ONLY_PERMISSION_KEYS.has(u.permissionKey))
      ) {
        return { ...u, allowed: false };
      }
      return u;
    });

  await Promise.all(
    filtered.map((u) =>
      prisma.rolePermission.upsert({
        where: {
          role_permissionKey: {
            role: u.role,
            permissionKey: u.permissionKey,
          },
        },
        update: { allowed: u.allowed },
        create: {
          role: u.role,
          permissionKey: u.permissionKey,
          allowed: u.allowed,
        },
      }),
    ),
  );

  // Invalidate in-process cache so new permissions take effect immediately.
  invalidatePermissionCache();

  return ResponseHandler.ok({ updated: filtered.length }, 200);
});
