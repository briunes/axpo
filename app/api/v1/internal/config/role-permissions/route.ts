import { NextRequest } from "next/server";
import { z } from "zod";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

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
 * - ADMIN: returns all role permission entries for AGENT and COMMERCIAL.
 * - AGENT / COMMERCIAL: returns only their own role's entries (needed to
 *   enforce DB-driven permissions on the frontend).
 * ADMIN is always granted every permission and is not stored in the DB.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);

  const isAdmin = auth.role === UserRole.ADMIN;

  // Non-admins may only fetch their own role's permissions
  const roleFilter = isAdmin
    ? { in: [UserRole.AGENT, UserRole.COMMERCIAL] as UserRole[] }
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
 * ADMIN entries are silently ignored — ADMIN is always fully granted.
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  assertRole(auth, [UserRole.ADMIN]);

  const body = await request.json();
  const { updates } = upsertSchema.parse(body);

  // Strip ADMIN entries — cannot be changed
  const filtered = updates.filter((u) => u.role !== UserRole.ADMIN);

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

  return ResponseHandler.ok({ updated: filtered.length }, 200);
});
