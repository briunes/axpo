import { NextRequest } from "next/server";
import { UserRole } from "@/domain/types";
import { withErrorHandler } from "@/application/middleware/errorHandler";
import { ResponseHandler } from "@/application/middleware/response";
import { requireAuth } from "@/application/middleware/auth";
import { assertPermission, isElevatedRole } from "@/application/middleware/rbac";
import { prisma } from "@/infrastructure/database/prisma";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  await assertPermission(auth, "section.simulations");

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim() || undefined;
  const role = searchParams.get("role") as UserRole | null;
  const agencyId =
    isElevatedRole(auth.role) && searchParams.get("agencyId")
      ? searchParams.get("agencyId")!
      : auth.agencyId;
  const take = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("take") ?? "25", 10)),
  );

  const users = await prisma.user.findMany({
    where: {
      agencyId,
      isDeleted: false,
      isActive: true,
      ...(auth.role === UserRole.COMMERCIAL ? { id: auth.userId } : {}),
      ...(role && Object.values(UserRole).includes(role) ? { role } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      agencyId: true,
    },
    orderBy: { fullName: "asc" },
    take,
  });

  return ResponseHandler.ok(
    users.map((user) => ({
      id: user.id,
      label: user.fullName,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
    })),
    200,
  );
});
