import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import {
  listClientsForModule,
  listSimulationsForModule,
  listUsersForModule,
} from "@/application/module-init/listQueries";
import { prisma } from "@/infrastructure/database/prisma";

const scopedParams = (source: URLSearchParams, prefix: string) => {
  const target = new URLSearchParams();
  for (const [key, value] of source.entries()) {
    if (key.startsWith(prefix)) {
      target.set(key.slice(prefix.length), value);
    }
  }
  return target;
};

const defaultParams = (
  entries: Record<string, string | number | boolean | undefined>,
) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params;
};

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.simulations");
  await assertPermission(auth, "clients.view");

  const searchParams = request.nextUrl.searchParams;
  const simulationsParams = scopedParams(searchParams, "simulations.");
  const clientsParams = scopedParams(searchParams, "clients.");
  const usersParams = scopedParams(searchParams, "users.");

  if (!simulationsParams.size) {
    defaultParams({
      page: searchParams.get("page") ?? 1,
      pageSize: searchParams.get("pageSize") ?? 25,
      orderBy: searchParams.get("orderBy") ?? "updatedAt",
      sortDir: searchParams.get("sortDir") ?? "desc",
    }).forEach((value, key) => simulationsParams.set(key, value));
  }

  if (!clientsParams.size) {
    defaultParams({
      page: 1,
      pageSize: 1000,
      orderBy: "name",
      sortDir: "asc",
      minimal: true,
    }).forEach((value, key) => clientsParams.set(key, value));
  }

  if (!usersParams.size) {
    defaultParams({
      page: 1,
      pageSize: 1000,
      orderBy: "createdAt",
      sortDir: "desc",
      minimal: true,
      contextual: true,
    }).forEach((value, key) => usersParams.set(key, value));
  }

  const usersPromise =
    auth.role === UserRole.COMMERCIAL
      ? prisma.user
          .findUnique({
            where: { id: auth.userId },
            select: {
              id: true,
              agencyId: true,
              role: true,
              fullName: true,
              email: true,
              isActive: true,
              isDeleted: true,
              deletedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          })
          .then((user) => ({
            items: user ? [user] : [],
            total: user ? 1 : 0,
            page: 1,
            pageSize: 1,
          }))
      : listUsersForModule(auth, usersParams);

  const [simulations, clients, users] = await Promise.all([
    listSimulationsForModule(auth, simulationsParams),
    listClientsForModule(auth, clientsParams),
    usersPromise,
  ]);

  return ResponseHandler.ok({ simulations, clients, users }, 200);
});
