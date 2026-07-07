import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { ForbiddenError } from "@/domain/errors/errors";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import {
  listAgenciesForModule,
  listUsersForModule,
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
  if (auth.role === UserRole.COMMERCIAL) {
    throw new ForbiddenError("Insufficient permissions for this operation");
  }
  await assertPermission(auth, "users.view");

  const usersParams = scopedParams(request.nextUrl.searchParams, "users.");
  const agenciesParams = scopedParams(request.nextUrl.searchParams, "agencies.");

  if (!agenciesParams.size) {
    agenciesParams.set("page", "1");
    agenciesParams.set("pageSize", "1000");
    agenciesParams.set("minimal", "true");
  }

  const [users, agencies] = await Promise.all([
    listUsersForModule(auth, usersParams),
    listAgenciesForModule(auth, agenciesParams),
  ]);

  return ResponseHandler.ok({ users, agencies }, 200);
});
