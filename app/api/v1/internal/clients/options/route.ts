import { NextRequest } from "next/server";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission, isElevatedRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "clients.view");

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim() || undefined;
  const agencyId =
    isElevatedRole(auth.role) && searchParams.get("agencyId")
      ? searchParams.get("agencyId")!
      : auth.agencyId;
  const take = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("take") ?? "25", 10)),
  );

  const clients = await prisma.client.findMany({
    where: {
      agencyId,
      isDeleted: false,
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { cif: { contains: search, mode: "insensitive" as const } },
              {
                contactName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      cif: true,
      contactName: true,
      language: true,
    },
    orderBy: { name: "asc" },
    take,
  });

  return ResponseHandler.ok(
    clients.map((client) => ({
      id: client.id,
      label: client.name,
      cif: client.cif,
      contactName: client.contactName,
      language: client.language,
    })),
    200,
  );
});
