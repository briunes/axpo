import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { isElevatedRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim() || undefined;
  const take = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("take") ?? "25", 10)),
  );

  const agencies = await prisma.agency.findMany({
    where: {
      isDeleted: false,
      isActive: true,
      ...(isElevatedRole(auth.role) ? {} : { id: auth.agencyId }),
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      isTlv: true,
    },
    orderBy: { name: "asc" },
    take,
  });

  return ResponseHandler.ok(
    agencies.map((agency) => ({
      id: agency.id,
      label: agency.name,
      isTlv: agency.isTlv,
    })),
    200,
  );
});
