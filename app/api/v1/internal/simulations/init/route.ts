import { ServerTiming } from "@/application/middleware/serverTiming";
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
  const timing = new ServerTiming();
  const auth = await timing.measure("auth", () => requireAuth(request));
  await timing.measure("simulation_permission", () => assertPermission(auth, "section.simulations"));
  await timing.measure("client_permission", () => assertPermission(auth, "clients.view"));

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

  const usersPromise = timing.measure("list_users", () =>
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
      : listUsersForModule(auth, usersParams),
  );

  const [simulations, clients, users] = await Promise.all([
    timing.measure("list_simulations", () => listSimulationsForModule(auth, simulationsParams)),
    timing.measure("list_clients", () => listClientsForModule(auth, clientsParams)),
    usersPromise,
  ]);

  const response = ResponseHandler.ok({ simulations, clients, users }, 200);
  timing.append(response.headers, "list_init_total");
  return response;
});
