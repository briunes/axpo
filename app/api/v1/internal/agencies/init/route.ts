import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission } from "@/application/middleware/rbac";
import { listAgenciesForModule } from "@/application/module-init/listQueries";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "agencies.view");

  const agencies = await listAgenciesForModule(
    auth,
    request.nextUrl.searchParams,
  );

  return ResponseHandler.ok({ agencies }, 200);
});
