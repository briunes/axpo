import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission, isElevatedRole } from "@/application/middleware/rbac";
import {
  listAgenciesForModule,
  listClientsForModule,
} from "@/application/module-init/listQueries";

const scopedParams = (source: URLSearchParams, prefix: string) => {
  const target = new URLSearchParams();
  for (const [key, value] of source.entries()) {
    if (key.startsWith(prefix)) target.set(key.slice(prefix.length), value);
  }
  return target;
};

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "clients.view");

  const clientsParams = scopedParams(request.nextUrl.searchParams, "clients.");
  const agenciesParams = scopedParams(request.nextUrl.searchParams, "agencies.");

  if (!agenciesParams.size) {
    agenciesParams.set("page", "1");
    agenciesParams.set("pageSize", "1000");
    agenciesParams.set("minimal", "true");
  }

  const [clients, agencies] = await Promise.all([
    listClientsForModule(auth, clientsParams),
    isElevatedRole(auth.role)
      ? listAgenciesForModule(auth, agenciesParams)
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 1000 }),
  ]);

  return ResponseHandler.ok({ clients, agencies }, 200);
});
